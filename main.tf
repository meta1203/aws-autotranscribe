provider "aws" {
  region = "us-east-2"
}

resource "random_string" "bucket" {
  length = 8
  lower = true
  upper = false
  number = true
  special = false
}

# S3 configs

resource "aws_s3_bucket" "bucket" {
  bucket = "autotranscribe-${random_string.bucket.id}"
}

resource "aws_s3_bucket_lifecycle_configuration" "lifecycle" {
  bucket = aws_s3_bucket.bucket.id

  rule {
    id = "to-IA"

    filter {
      object_size_greater_than = 20000000
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    status = "Enabled"
  }

  rule {
    id = "to-Glacier"

    filter {
      object_size_greater_than = 20000000
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    status = "Enabled"
  }
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.input.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "input/"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.output.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "output/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.input_allow_bucket, aws_lambda_permission.output_allow_bucket]
}

# lambda

resource "aws_lambda_permission" "input_allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.input.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.bucket.arn
}

resource "aws_lambda_permission" "output_allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.output.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.bucket.arn
}

resource "aws_lambda_function" "input" {
  filename         = data.archive_file.input-lambda.output_path
  source_code_hash = data.archive_file.input-lambda.output_base64sha256
  function_name = "autotranscribe-input"
  role          = aws_iam_role.iam_for_lambda.arn
  handler       = "input.handler"
  runtime       = "nodejs14.x"
  timeout       = 60
  environment {
    variables = {
      TRANSCRIBE_ROLE = aws_iam_role.iam_for_transcribe.arn
    }
  }
}

data "archive_file" "input-lambda" {
  type        = "zip"
  output_path = "input.zip"
  source {
    content  = file("src/input.js")
    filename = "input.js"
  }
}

resource "aws_lambda_function" "output" {
  filename      = data.archive_file.output-lambda.output_path
  source_code_hash = data.archive_file.output-lambda.output_base64sha256
  function_name = "autotranscribe-output"
  role          = aws_iam_role.iam_for_lambda.arn
  handler       = "output.handler"
  runtime       = "nodejs14.x"
  memory_size   = 256
  timeout       = 60
  environment {
    variables = {
      BUCKET = aws_s3_bucket.bucket.id
    }
  }
}

data "archive_file" "output-lambda" {
  type        = "zip"
  output_path = "output.zip"
  source {
    content  = file("src/output.js")
    filename = "output.js"
  }
}

# IAM

resource "aws_iam_role" "iam_for_lambda" {
  name = "autotranscribe-iam_for_lambda"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role" "iam_for_transcribe" {
  name = "autotranscribe-iam_for_transcribe"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "transcribe.amazonaws.com"
      },
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_policy_attachment" "s3" {
  name = "autotranscribe-lambda-s3"
  roles      = [aws_iam_role.iam_for_lambda.name, aws_iam_role.iam_for_transcribe.name]
  policy_arn = aws_iam_policy.s3.arn
}

resource "aws_iam_policy_attachment" "transcribe" {
  name = "autotranscribe-lambda-s3"
  roles      = [aws_iam_role.iam_for_lambda.name]
  policy_arn = aws_iam_policy.transcribe.arn
}

resource "aws_iam_policy_attachment" "logging" {
  name = "autotranscribe-lambda-s3"
  roles      = [aws_iam_role.iam_for_lambda.name]
  policy_arn = aws_iam_policy.logging.arn
}

resource "aws_iam_policy" "s3" {
  name        = "autotranscribe-s3-rw"
  description = "R/W access to the autotranscribe S3 bucket"

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:*Object",
                "s3:PutObjectAcl",
                "s3:Get*",
                "s3:Put*",
                "s3:List*"
            ],
            "Resource": [
                "${aws_s3_bucket.bucket.arn}",
                "${aws_s3_bucket.bucket.arn}/*"
            ]
        }
    ]
}
EOF
}

resource "aws_iam_policy" "transcribe" {
  name        = "autotranscribe-transcribe"
  description = "Access to submit transcription jobs"

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "transcribe:StartTranscriptionJob"
                  ],
            "Resource": "*"
        }
    ]
}
EOF
}

resource "aws_iam_policy" "logging" {
  name        = "autotranscribe-lambda-logging"
  path        = "/"
  description = "IAM policy for logging from a Lambda function"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*",
      "Effect": "Allow"
    }
  ]
}
EOF
}
