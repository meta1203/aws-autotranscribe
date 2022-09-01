# Autotranscribe #

*Instructions*

To install, run `terraform apply`. This will generate an S3 bucket in the format `autotranscribe-[random string]`
with two lambda functions.

Simply upload any valid file to the folder/prefix `input` in this bucket to kick off a transcription job.

To select the number of speakers in the audio, add `[#]people` to the filename.

Amazon Transcribe json files will be saved to `output`, while the compiled transcriptions will saved to `transcriptions`.

*Warning*

The terraform script will progressively move objects over 20 megabytes in the bucket from Standard to Infrequent Access
to Deep Archive by default. To disable this behavior entirely, delete the `lifecycle.tf` file before executing terraform.
To disable just the Deep Archive step, remove the `rule { ... }` block from `lifecycle.tf`.