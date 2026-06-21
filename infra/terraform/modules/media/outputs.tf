output "bucket_name" {
  value       = aws_s3_bucket.this.id
  description = "S3 bucket name (S3_BUCKET)."
}

output "bucket_region" {
  value       = aws_s3_bucket.this.region
  description = "S3 bucket region (S3_REGION)."
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.this.domain_name
  description = "CloudFront default domain (CNAME target for the media hostname)."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.this.id
  description = "CloudFront distribution id."
}

output "public_base_url" {
  value       = var.attach_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.this.domain_name}"
  description = "Base URL objects are publicly served on."
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

output "media_cname" {
  value = {
    name  = var.domain_name
    type  = "CNAME"
    value = aws_cloudfront_distribution.this.domain_name
  }
  description = "DNS record pointing the media hostname at CloudFront."
}

output "access_key_id" {
  value       = aws_iam_access_key.app.id
  description = "IAM access key id for the app (S3_ACCESS_KEY_ID)."
}

output "secret_access_key" {
  value       = aws_iam_access_key.app.secret
  sensitive   = true
  description = "IAM secret access key for the app (S3_SECRET_ACCESS_KEY)."
}
