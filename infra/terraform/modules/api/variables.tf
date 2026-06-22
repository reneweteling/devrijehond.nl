variable "environment" {
  type        = string
  description = "Environment name, e.g. dev or prod."
}

variable "domain_name" {
  type        = string
  description = "Public hostname CloudFront serves the API on, e.g. api.devrijehond.nl."
}

variable "origin_domain" {
  type        = string
  description = <<-EOT
    The origin the API is actually served from (the dokku app), e.g.
    www.devrijehond.nl. CloudFront connects to it over HTTPS and keeps this as
    the Host header sent to the origin, so the app + BetterAuth keep working
    against their canonical host.
  EOT
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
