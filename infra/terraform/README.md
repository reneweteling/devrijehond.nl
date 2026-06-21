# infra/terraform

Terraform for De Vrije Hond's media stack: a private S3 bucket fronted by
CloudFront (Origin Access Control), with a per-environment IAM user the app uses
to upload objects. Two environments: `dev` and `prod`.

| Environment | Bucket                   | Public hostname            | CloudFront domain               | IAM user                     |
| ----------- | ------------------------ | -------------------------- | ------------------------------- | ---------------------------- |
| dev         | `devrijehond-media-dev`  | `media-dev.devrijehond.nl` | `d31ij1llzvhaa9.cloudfront.net` | `devrijehond-media-app-dev`  |
| prod        | `devrijehond-media-prod` | `media.devrijehond.nl`     | `d15b3a840vfyd9.cloudfront.net` | `devrijehond-media-app-prod` |

## External accounts

### AWS

- Account: `devrijehond` — **262517452192**. All infra lives here, never in a
  personal account.
- Region: `eu-west-1` (S3 + IAM). CloudFront certs live in `us-east-1` (required
  by CloudFront).
- Access: AWS IAM Identity Center (SSO), role `AdministratorAccess`, local CLI
  profile `devrijehond`.
- Authenticate before running anything:

  ```sh
  aws sso login --profile devrijehond
  # sanity check:
  aws sts get-caller-identity --profile devrijehond   # -> Account 262517452192
  ```

  All `terraform` and `aws` commands here default to `profile = "devrijehond"`.

### Resend (transactional email)

- Account / sender: **info@devrijehond.nl**.
- Used for magic-link and notification email (`packages/email`).
- `RESEND_API_KEY` + `EMAIL_FROM` live in `.env.local` / the deploy secrets, not
  in Terraform.

## Layout

```
infra/terraform/
  modules/media/      reusable bucket + CloudFront + ACM + IAM user
  envs/dev/           dev environment (media-dev.devrijehond.nl)
  envs/prod/          prod environment (media.devrijehond.nl)
```

State is local and gitignored (it contains the IAM secret keys). Solo project,
so no remote backend yet; move to an S3 backend if more people start applying.

## Apply

Two phases, because ACM uses DNS validation and DNS lives at TransIP (manual).

### Phase 1 — create everything on the default CloudFront domain

```sh
aws sso login --profile devrijehond
cd envs/dev   # or envs/prod
terraform init
terraform apply
```

This creates the bucket, IAM user + access key, the CloudFront distribution (on
its `*.cloudfront.net` domain), and _requests_ the ACM certificate. The bucket
and keys work immediately. Read the outputs:

```sh
terraform output media
terraform output -raw secret_access_key
```

### Phase 2 — attach the custom domain

1. Add the DNS records below at TransIP (the ACM validation CNAME + the media
   CNAME). See `terraform output media` → `acm_validation_records` and
   `media_cname`.
2. Wait until the certificate shows `ISSUED`:

   ```sh
   aws acm list-certificates --region us-east-1 --profile devrijehond
   ```

3. Re-apply with the custom domain attached:

   ```sh
   terraform apply -var attach_custom_domain=true
   ```

   This validates the cert, attaches the alias + cert to CloudFront, and the
   site serves on `media[-dev].devrijehond.nl`. Then switch `S3_PUBLIC_BASE_URL`
   in `.env.local` to the custom hostname.

## DNS records to add at TransIP

```
# --- dev ---
# ACM validation (CNAME)
_36eb32a8cef090dd70acc5c71882266c.media-dev   CNAME   _6e616adef69cfff0188d79c4b84bd7f9.jkddzztszm.acm-validations.aws.
# media hostname -> CloudFront (CNAME)
media-dev                                      CNAME   d31ij1llzvhaa9.cloudfront.net.

# --- prod ---
# ACM validation (CNAME)
_510b5841659ad7576d8b4c337e579d56.media        CNAME   _8590ae51f9d032843afd287c11cd6d37.jkddzztszm.acm-validations.aws.
# media hostname -> CloudFront (CNAME)
media                                          CNAME   d15b3a840vfyd9.cloudfront.net.
```

Names are shown host-relative to the `devrijehond.nl` zone. TransIP may want the
trailing dot dropped on the host and kept on the target; mirror whatever the
existing records in the zone do.

## Destroy

```sh
cd envs/dev   # or envs/prod
terraform destroy
```
