variable "environment" {
  type        = string
  description = "Environment name, e.g. dev or prod."
}

variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for media objects."
}

variable "domain_name" {
  type        = string
  description = "Public hostname CloudFront serves on, e.g. media.devrijehond.nl."
}

variable "iam_user_name" {
  type        = string
  description = "Name of the IAM user the app uses to upload/manage objects."
}

variable "attach_custom_domain" {
  type        = bool
  default     = false
  description = <<-EOT
    When false (first apply), CloudFront serves on its default *.cloudfront.net
    domain and the ACM certificate is only requested (not validated/attached).
    Flip to true and re-apply once the DNS validation records are live at the
    registrar; this validates the cert and attaches the custom domain.
  EOT
}

variable "cors_allowed_origins" {
  type        = list(string)
  default     = ["*"]
  description = "Origins allowed to PUT/GET against the bucket (presigned uploads)."
}

variable "price_class" {
  type        = string
  default     = "PriceClass_100"
  description = "CloudFront price class. PriceClass_100 = NA + EU edges (cheapest, fine for NL)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to all taggable resources."
}
