locals {
  tags = merge(var.tags, {
    Project     = "devrijehond"
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "media"
  })
}

# ---------------------------------------------------------------------------
# S3 bucket — private, served only through CloudFront (OAC). The app writes
# objects with the IAM user credentials; the public reads through CloudFront.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  cors_rule {
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ---------------------------------------------------------------------------
# ACM certificate (us-east-1, required by CloudFront). DNS validation.
# Always created so we can surface the validation records; only validated
# and attached to CloudFront when attach_custom_domain = true.
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "this" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"
  tags              = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "this" {
  count           = var.attach_custom_domain ? 1 : 0
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.this.arn
  # Records are added manually at the registrar (TransIP), so we just wait for
  # the cert to flip to ISSUED.
}

# ---------------------------------------------------------------------------
# CloudFront — Origin Access Control (sigv4) reads from the private bucket.
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.bucket_name}-oac"
  description                       = "OAC for ${var.domain_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  comment             = "devrijehond media (${var.environment})"
  price_class         = var.price_class
  default_root_object = ""
  aliases             = var.attach_custom_domain ? [var.domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.this.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${aws_s3_bucket.this.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed "CachingOptimized" policy.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.attach_custom_domain ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate.this.arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.attach_custom_domain ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }

  tags = local.tags

  # Make sure the cert is ISSUED before CloudFront tries to use it.
  depends_on = [aws_acm_certificate_validation.this]
}

# Bucket policy: only this CloudFront distribution may read objects.
data "aws_iam_policy_document" "bucket" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.this.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.bucket.json
}

# ---------------------------------------------------------------------------
# IAM user the app uses to upload/manage objects (S3 SDK + presigned URLs).
# Least privilege: scoped to this bucket only.
# ---------------------------------------------------------------------------
resource "aws_iam_user" "app" {
  name = var.iam_user_name
  tags = local.tags
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "BucketObjects"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.this.arn}/*"]
  }
  statement {
    sid       = "BucketList"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.this.arn]
  }
}

resource "aws_iam_user_policy" "app" {
  name   = "${var.iam_user_name}-s3"
  user   = aws_iam_user.app.name
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_access_key" "app" {
  user = aws_iam_user.app.name
}
