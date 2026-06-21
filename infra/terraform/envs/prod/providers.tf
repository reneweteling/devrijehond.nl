terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_profile" {
  type        = string
  default     = "devrijehond"
  description = "Local AWS CLI/SSO profile to authenticate with (account 262517452192)."
}

provider "aws" {
  region  = "eu-west-1"
  profile = var.aws_profile
}

# CloudFront requires its ACM certificate to live in us-east-1.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile
}
