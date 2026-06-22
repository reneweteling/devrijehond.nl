locals {
  tags = merge(var.tags, {
    Project     = "devrijehond"
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "api"
  })

  origin_id = "api-origin"

  # AWS-managed policy ids.
  origin_request_all_viewer_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
  cache_disabled                        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
}

# ---------------------------------------------------------------------------
# ACM certificate (us-east-1, required by CloudFront). DNS validation; records
# are added manually at the registrar, same flow as the media module.
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
}

# ---------------------------------------------------------------------------
# Cache policy for the public API + SSR pages: honour the origin Cache-Control
# (public reads send `s-maxage=60`), cap the edge TTL at 1 minute, and key the
# cache on the full query string (e.g. the map bbox) so different viewports are
# cached separately. No cookies in the key (public reads are anonymous).
# ---------------------------------------------------------------------------
resource "aws_cloudfront_cache_policy" "public_api" {
  name        = "devrijehond-api-${var.environment}-1m"
  comment     = "Public API + pages, 1 minute edge TTL, query-string keyed."
  min_ttl     = 0
  default_ttl = 60
  max_ttl     = 60

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "all"
    }
    headers_config {
      header_behavior = "none"
    }
    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# ---------------------------------------------------------------------------
# CloudFront — custom origin in front of the dokku app.
# ---------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  comment         = "devrijehond api (${var.environment})"
  price_class     = var.price_class
  is_ipv6_enabled = true
  aliases         = var.attach_custom_domain ? [var.domain_name] : []

  origin {
    domain_name = var.origin_domain
    origin_id   = local.origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # /api/v1/me/* — personalised, never cached, straight passthrough (forwards
  # Authorization + cookies via AllViewerExceptHostHeader).
  ordered_cache_behavior {
    path_pattern             = "/api/v1/me/*"
    target_origin_id         = local.origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = local.cache_disabled
    origin_request_policy_id = local.origin_request_all_viewer_except_host
  }

  # /api/auth/* — BetterAuth, never cached, straight passthrough.
  ordered_cache_behavior {
    path_pattern             = "/api/auth/*"
    target_origin_id         = local.origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = local.cache_disabled
    origin_request_policy_id = local.origin_request_all_viewer_except_host
  }

  # Everything else (public API reads + SSR pages): cached at the edge for up to
  # 1 minute, respecting the origin Cache-Control.
  default_cache_behavior {
    target_origin_id         = local.origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.public_api.id
    origin_request_policy_id = local.origin_request_all_viewer_except_host
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

  depends_on = [aws_acm_certificate_validation.this]
}
