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
 *     carries the full surface — public reads under `/api/v1/...`, user-scoped
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
} from './dto/spots';
import {
  SubmitSpotRequestSchema,
  SubmitSpotResponseSchema,
  UpdateSpotRequestSchema,
} from './dto/submit-spot';
import { SubmitVoteRequestSchema, VoteSchema, VoteResponseSchema } from './dto/votes';
import {
  ReviewSchema,
  ReviewsResponseSchema,
  SubmitReviewRequestSchema,
} from './dto/reviews';
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

// Submit spot
registry.register('SubmitSpotRequest', SubmitSpotRequestSchema);
registry.register('SubmitSpotResponse', SubmitSpotResponseSchema);
registry.register('UpdateSpotRequest', UpdateSpotRequestSchema);

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
    200: { description: 'Cursor-paginated feature requests.', ...json(FeatureRequestsResponseSchema) },
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

export const PATHS_REGISTERED = true;
