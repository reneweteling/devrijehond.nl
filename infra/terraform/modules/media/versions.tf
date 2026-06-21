terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      # The default provider serves S3 + IAM (regional, eu-west-1).
      # aws.us_east_1 is required because CloudFront only accepts ACM
      # certificates from us-east-1.
      configuration_aliases = [aws, aws.us_east_1]
    }
  }
}
