variable "attach_custom_domain" {
  type        = bool
  default     = false
  description = "Flip to true and re-apply after the DNS validation records are live."
}

module "media" {
  source = "../../modules/media"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment          = "dev"
  bucket_name          = "devrijehond-media-dev"
  domain_name          = "media-dev.devrijehond.nl"
  iam_user_name        = "devrijehond-media-app-dev"
  attach_custom_domain = var.attach_custom_domain
}

output "media" {
  value = {
    bucket_name             = module.media.bucket_name
    bucket_region           = module.media.bucket_region
    cloudfront_domain       = module.media.cloudfront_domain
    cloudfront_distribution = module.media.cloudfront_distribution_id
    public_base_url         = module.media.public_base_url
    acm_validation_records  = module.media.acm_validation_records
    media_cname             = module.media.media_cname
    access_key_id           = module.media.access_key_id
  }
}

output "secret_access_key" {
  value     = module.media.secret_access_key
  sensitive = true
}
