/**
 * Component + path registration for the OpenAPI document.
 *
 * Two jobs, both side-effecting on the shared `registry`:
 *
 *  1. Register every shared DTO as a NAMED component so `zod-to-openapi` emits
 *     `$ref: "#/components/schemas/Foo"` instead of inlining the schema in
 *     every path (deduplicates output and avoids `JSON.stringify` cycles when
 *     a DTO is referenced from several paths).
 *  2. Register every API PATH (`registry.registerPath`) so the compiled doc
 *     carries the full surface, public reads under `/api/v1/...`, user-scoped
 *     writes under `/api/v1/me/...`.
 *
 * Imported for side-effects from `./index.ts`, AFTER the DTO modules so every
 * schema is fully evaluated.
 *
 * Convention: registered component names are PascalCase, matching the exported
 * symbol name (minus the trailing `Schema`).
 */

import { z } from 'zod';
import { registry } from './registry';

import {
  UserRoleSchema,
  SpotTypeSchema,
  SpotStatusSchema,
  VoteValueSchema,
  ReportReasonSchema,
  ReportTargetSchema,
  FeatureStatusSchema,
  GeoPointSchema,
  ApiErrorSchema,
} from './dto/common';
import { CategorySchema, CategoriesResponseSchema } from './dto/categories';
import { AmenitySchema, AmenitiesResponseSchema } from './dto/amenities';
import {
  SpotGeometrySchema,
  SpotPhotoSchema,
  SpotRatingSchema,
  SpotVerificationSchema,
  SpotSummarySchema,
  SpotsResponseSchema,
  SpotsMapResponseSchema,
  SpotsQuerySchema,
  SpotsMapQuerySchema,
  SpotAuthorSchema,
  SpotDetailSchema,
  MeSpotsResponseSchema,
} from './dto/spots';
import {
  SubmitSpotRequestSchema,
  SubmitSpotResponseSchema,
  UpdateSpotRequestSchema,
  ModerateSpotRequestSchema,
  OkResponseSchema,
} from './dto/submit-spot';
import { SubmitVoteRequestSchema, VoteSchema, VoteResponseSchema } from './dto/votes';
import { ReviewSchema, ReviewsResponseSchema, SubmitReviewRequestSchema } from './dto/reviews';
import { SubmitReportRequestSchema, ReportResponseSchema } from './dto/reports';
import {
  DogSchema,
  DogsResponseSchema,
  CreateDogRequestSchema,
  UpdateDogRequestSchema,
} from './dto/dogs';
import { MeProfileSchema, MeProfilePatchSchema } from './dto/me';
import {
  FeatureRequestSchema,
  FeatureRequestsResponseSchema,
  CreateFeatureRequestRequestSchema,
  FeatureVoteResponseSchema,
} from './dto/feature-requests';
import { GeocodeHitSchema, GeocodeQuerySchema, GeocodeResponseSchema } from './dto/geocode';
import { UploadResponseSchema } from './dto/uploads';
import { AccountDeletionResponseSchema } from './dto/account';
import { AppConfigSchema } from './dto/app-config';
import {
  ModeratorApplicationStatusSchema,
  ModeratorApplicationSchema,
  ModeratorApplicationResponseSchema,
  ApplyModeratorRequestSchema,
} from './dto/moderator';
import { AuthTokenSchema, NativeIdTokenRequestSchema, MagicLinkRequestSchema } from './dto/auth';

// ---------------------------------------------------------------------------
// 1. Named components
// ---------------------------------------------------------------------------

// Enums
registry.register('UserRole', UserRoleSchema);
registry.register('SpotType', SpotTypeSchema);
registry.register('SpotStatus', SpotStatusSchema);
registry.register('VoteValue', VoteValueSchema);
registry.register('ReportReason', ReportReasonSchema);
registry.register('ReportTarget', ReportTargetSchema);
registry.register('FeatureStatus', FeatureStatusSchema);

// Shared primitives / envelopes
registry.register('GeoPoint', GeoPointSchema);
registry.register('ApiError', ApiErrorSchema);

// Taxonomy
registry.register('Category', CategorySchema);
registry.register('CategoriesResponse', CategoriesResponseSchema);
registry.register('Amenity', AmenitySchema);
registry.register('AmenitiesResponse', AmenitiesResponseSchema);

// Spots
registry.register('SpotGeometry', SpotGeometrySchema);
registry.register('SpotPhoto', SpotPhotoSchema);
registry.register('SpotRating', SpotRatingSchema);
registry.register('SpotVerification', SpotVerificationSchema);
registry.register('SpotAuthor', SpotAuthorSchema);
registry.register('SpotSummary', SpotSummarySchema);
registry.register('SpotsResponse', SpotsResponseSchema);
registry.register('SpotsMapResponse', SpotsMapResponseSchema);
registry.register('SpotDetail', SpotDetailSchema);
registry.register('MeSpotsResponse', MeSpotsResponseSchema);

// Submit spot
registry.register('SubmitSpotRequest', SubmitSpotRequestSchema);
registry.register('SubmitSpotResponse', SubmitSpotResponseSchema);
registry.register('UpdateSpotRequest', UpdateSpotRequestSchema);
registry.register('ModerateSpotRequest', ModerateSpotRequestSchema);
registry.register('OkResponse', OkResponseSchema);

// Votes
registry.register('SubmitVoteRequest', SubmitVoteRequestSchema);
registry.register('Vote', VoteSchema);
registry.register('VoteResponse', VoteResponseSchema);

// Reviews
registry.register('Review', ReviewSchema);
registry.register('ReviewsResponse', ReviewsResponseSchema);
registry.register('SubmitReviewRequest', SubmitReviewRequestSchema);

// Reports
registry.register('SubmitReportRequest', SubmitReportRequestSchema);
registry.register('ReportResponse', ReportResponseSchema);

// Dogs
registry.register('Dog', DogSchema);
registry.register('DogsResponse', DogsResponseSchema);
registry.register('CreateDogRequest', CreateDogRequestSchema);
registry.register('UpdateDogRequest', UpdateDogRequestSchema);

// Me
registry.register('MeProfile', MeProfileSchema);
registry.register('MeProfilePatch', MeProfilePatchSchema);

// Feature requests
registry.register('FeatureRequest', FeatureRequestSchema);
registry.register('FeatureRequestsResponse', FeatureRequestsResponseSchema);
registry.register('CreateFeatureRequest', CreateFeatureRequestRequestSchema);
registry.register('FeatureVoteResponse', FeatureVoteResponseSchema);

// Geocode
registry.register('GeocodeHit', GeocodeHitSchema);
registry.register('GeocodeResponse', GeocodeResponseSchema);

// Uploads
registry.register('UploadResponse', UploadResponseSchema);

// Account
registry.register('AccountDeletionResponse', AccountDeletionResponseSchema);

// App config
registry.register('AppConfig', AppConfigSchema);

// Moderator applications
registry.register('ModeratorApplicationStatus', ModeratorApplicationStatusSchema);
registry.register('ModeratorApplication', ModeratorApplicationSchema);
registry.register('ModeratorApplicationResponse', ModeratorApplicationResponseSchema);
registry.register('ApplyModeratorRequest', ApplyModeratorRequestSchema);

// Mobile auth
registry.register('AuthToken', AuthTokenSchema);
registry.register('NativeIdTokenRequest', NativeIdTokenRequestSchema);
registry.register('MagicLinkRequest', MagicLinkRequestSchema);

// ---------------------------------------------------------------------------
// 2. Paths
// ---------------------------------------------------------------------------

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});
const bearer = [{ bearerAuth: [] as string[] }];

const errorResponses = {
  400: { description: 'Validation failed.', ...json(ApiErrorSchema) },
  401: { description: 'Authentication required.', ...json(ApiErrorSchema) },
  404: { description: 'Not found.', ...json(ApiErrorSchema) },
};

// --- Public reads (anonymous, CDN-cacheable) ---

registry.registerPath({
  method: 'get',
  path: '/api/v1/categories',
  tags: ['categories'],
  summary: 'List spot categories',
  request: { query: z.object({ type: SpotTypeSchema.optional() }) },
  responses: {
    200: { description: 'All visible categories.', ...json(CategoriesResponseSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/amenities',
  tags: ['amenities'],
  summary: 'List amenities',
  request: { query: z.object({ categoryId: z.string().uuid().optional() }) },
  responses: {
    200: { description: 'All visible amenities.', ...json(AmenitiesResponseSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/spots',
  tags: ['spots'],
  summary: 'List spots (paginated, delta-sync)',
  request: { query: SpotsQuerySchema },
  responses: {
    200: { description: 'Cursor-paginated spots.', ...json(SpotsResponseSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/spots/map',
  tags: ['spots'],
  summary: 'Spots within a map viewport (bbox)',
  request: { query: SpotsMapQuerySchema },
  responses: {
    200: { description: 'Spots intersecting the viewport.', ...json(SpotsMapResponseSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/spots/{slug}',
  tags: ['spots'],
  summary: 'Spot detail',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: { description: 'Full spot detail.', ...json(SpotDetailSchema) },
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/spots/{slug}/reviews',
  tags: ['reviews'],
  summary: 'List reviews for a spot',
  request: {
    params: z.object({ slug: z.string() }),
    query: z.object({ cursor: z.string().optional() }).partial(),
  },
  responses: {
    200: { description: 'Cursor-paginated reviews.', ...json(ReviewsResponseSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/feature-requests',
  tags: ['feature-requests'],
  summary: 'List community feature requests',
  request: { query: z.object({ status: FeatureStatusSchema.optional() }) },
  responses: {
    200: {
      description: 'Cursor-paginated feature requests.',
      ...json(FeatureRequestsResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/geocode',
  tags: ['geocode'],
  summary: 'Forward geocoding (place/address search)',
  request: { query: GeocodeQuerySchema },
  responses: {
    200: { description: 'Ranked geocoding results (NL-biased).', ...json(GeocodeResponseSchema) },
    502: { description: 'Geocoding provider unavailable.', ...json(ApiErrorSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/app-config',
  tags: ['app-config'],
  summary: 'Runtime app config (force-update flow)',
  responses: {
    200: { description: 'Mobile runtime configuration.', ...json(AppConfigSchema) },
  },
});

// --- User-scoped writes (`/me/*`, CDN-bypass, bearer/session auth) ---

registry.registerPath({
  method: 'get',
  path: '/api/v1/me',
  tags: ['me'],
  summary: 'Get my profile',
  security: bearer,
  responses: {
    200: { description: 'Authenticated user profile.', ...json(MeProfileSchema) },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/me',
  tags: ['me'],
  summary: 'Update my profile',
  security: bearer,
  request: { body: json(MeProfilePatchSchema) },
  responses: {
    200: { description: 'Updated profile.', ...json(MeProfileSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/dogs',
  tags: ['dogs'],
  summary: 'List my dogs',
  security: bearer,
  responses: {
    200: { description: 'My dogs.', ...json(DogsResponseSchema) },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/dogs',
  tags: ['dogs'],
  summary: 'Add a dog',
  security: bearer,
  request: { body: json(CreateDogRequestSchema) },
  responses: {
    201: { description: 'Created dog.', ...json(DogSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/me/dogs/{id}',
  tags: ['dogs'],
  summary: 'Update a dog',
  security: bearer,
  request: { params: z.object({ id: z.string() }), body: json(UpdateDogRequestSchema) },
  responses: {
    200: { description: 'Updated dog.', ...json(DogSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/me/dogs/{id}',
  tags: ['dogs'],
  summary: 'Delete a dog',
  security: bearer,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Deleted.' },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/spots',
  tags: ['spots'],
  summary: 'List my submitted spots',
  security: bearer,
  responses: {
    200: {
      description: 'My spots across all statuses, newest first.',
      ...json(MeSpotsResponseSchema),
    },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/spots',
  tags: ['spots'],
  summary: 'Submit a new spot',
  security: bearer,
  request: { body: json(SubmitSpotRequestSchema) },
  responses: {
    201: { description: 'Created spot (UNVERIFIED).', ...json(SubmitSpotResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/me/spots/{id}',
  tags: ['spots'],
  summary: 'Edit my unverified spot',
  security: bearer,
  request: { params: z.object({ id: z.string() }), body: json(UpdateSpotRequestSchema) },
  responses: {
    200: { description: 'Updated spot.', ...json(SubmitSpotResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/me/spots/{id}/moderate',
  tags: ['spots'],
  summary: 'Set spot status (staff only)',
  security: bearer,
  request: { params: z.object({ id: z.string() }), body: json(ModerateSpotRequestSchema) },
  responses: {
    200: { description: 'Status updated.', ...json(OkResponseSchema) },
    ...errorResponses,
    403: { description: 'Staff role required.', ...json(ApiErrorSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/spots/{id}/vote',
  tags: ['votes'],
  summary: 'Cast a verification vote',
  security: bearer,
  request: { params: z.object({ id: z.string() }), body: json(SubmitVoteRequestSchema) },
  responses: {
    200: { description: 'Vote recorded; spot tally recomputed.', ...json(VoteResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/spots/{id}/reviews',
  tags: ['reviews'],
  summary: 'Write a review',
  security: bearer,
  request: { params: z.object({ id: z.string() }), body: json(SubmitReviewRequestSchema) },
  responses: {
    201: { description: 'Created review.', ...json(ReviewSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/reports',
  tags: ['reports'],
  summary: 'Report content',
  security: bearer,
  request: { body: json(SubmitReportRequestSchema) },
  responses: {
    201: { description: 'Report filed.', ...json(ReportResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/feature-requests',
  tags: ['feature-requests'],
  summary: 'Create a feature request',
  security: bearer,
  request: { body: json(CreateFeatureRequestRequestSchema) },
  responses: {
    201: { description: 'Created feature request.', ...json(FeatureRequestSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/feature-requests/{id}/vote',
  tags: ['feature-requests'],
  summary: 'Toggle an upvote on a feature request',
  security: bearer,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Upvote toggled.', ...json(FeatureVoteResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/me/account',
  tags: ['me'],
  summary: 'Delete my account',
  security: bearer,
  responses: {
    200: {
      description: 'Account deleted (or already gone).',
      ...json(AccountDeletionResponseSchema),
    },
    401: errorResponses[401],
    500: { description: 'Deletion failed.', ...json(ApiErrorSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/uploads',
  tags: ['uploads'],
  summary: 'Upload an image',
  description:
    'Multipart upload (`multipart/form-data`, field `file`). The image is resized + ' +
    'JPEG-compressed server-side and stored on S3; the response carries the public URL + key.',
  security: bearer,
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.string().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'The stored image.', ...json(UploadResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/moderator-application',
  tags: ['moderator'],
  summary: 'Get my moderator application',
  security: bearer,
  responses: {
    200: {
      description: 'My application, or null if none.',
      ...json(ModeratorApplicationResponseSchema),
    },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/moderator-application',
  tags: ['moderator'],
  summary: 'Apply to become a moderator',
  security: bearer,
  request: { body: json(ApplyModeratorRequestSchema) },
  responses: {
    201: { description: 'Application filed.', ...json(ModeratorApplicationSchema) },
    ...errorResponses,
    409: { description: 'An application already exists.', ...json(ApiErrorSchema) },
  },
});

// --- Custom mobile auth (under `/api/auth/*`, not `/api/v1`) ---

registry.registerPath({
  method: 'post',
  path: '/api/auth/mobile/apple-native',
  tags: ['auth'],
  summary: 'Exchange a native Apple idToken for a bearer',
  request: { body: json(NativeIdTokenRequestSchema) },
  responses: {
    200: { description: 'Bearer session token.', ...json(AuthTokenSchema) },
    400: { description: 'Invalid body.', ...json(ApiErrorSchema) },
    401: { description: 'Sign-in failed.', ...json(ApiErrorSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/mobile/google-native',
  tags: ['auth'],
  summary: 'Exchange a native Google idToken for a bearer',
  request: { body: json(NativeIdTokenRequestSchema) },
  responses: {
    200: { description: 'Bearer session token.', ...json(AuthTokenSchema) },
    400: { description: 'Invalid body.', ...json(ApiErrorSchema) },
    401: { description: 'Sign-in failed.', ...json(ApiErrorSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/sign-in/magic-link',
  tags: ['auth'],
  summary: 'Request a magic-link email',
  request: { body: json(MagicLinkRequestSchema) },
  responses: {
    200: { description: 'Magic-link email sent (if the address exists).' },
    400: { description: 'Invalid body.', ...json(ApiErrorSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/magic-link/verify',
  tags: ['auth'],
  summary: 'Redeem a magic-link token',
  description:
    'Redeems the token from the magic-link email. BetterAuth returns the bearer in the ' +
    '`set-auth-token` response header (alongside a redirect), so native clients must NOT ' +
    'follow the redirect. The body shape below mirrors the token surfaced to the client.',
  request: { query: z.object({ token: z.string() }) },
  responses: {
    200: {
      description: 'Token redeemed; bearer in `set-auth-token` header.',
      ...json(AuthTokenSchema),
    },
    302: { description: 'Redirect to the callback (header carries the bearer).' },
    401: { description: 'Invalid or expired token.', ...json(ApiErrorSchema) },
  },
});

export const PATHS_REGISTERED = true;
