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
