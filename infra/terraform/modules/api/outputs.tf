output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.this.domain_name
  description = "CloudFront default domain (CNAME target for the api hostname)."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.this.id
  description = "CloudFront distribution id."
}

output "api_base_url" {
  value       = var.attach_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.this.domain_name}"
  description = "Base URL the API is served on (EXPO_PUBLIC_API_URL / NEXT_PUBLIC_API_URL)."
}

output "acm_validation_records" {
  value = [
    for o in aws_acm_certificate.this.domain_validation_options : {
      name  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  ]
  description = "CNAME record(s) to add at the DNS registrar to validate the certificate."
}

output "api_cname" {
  value = {
    name  = var.domain_name
    type  = "CNAME"
    value = aws_cloudfront_distribution.this.domain_name
  }
  description = "DNS record pointing the api hostname at CloudFront."
}
