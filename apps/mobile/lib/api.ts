/**
 * Mobile data layer, domain-named TanStack Query hooks over the generated
 * `@devrijehond/api-client`.
 *
 * Each hook wraps a generated fetcher (which calls `customFetcher` against the
 * documented `/api/v1/*` paths), so the screens keep stable, readable names
 * while the request/response types stay contract-driven: they come straight
 * from the OpenAPI document via `client.schemas`, so they can't drift from the
 * server. Regenerate the client with
 * `pnpm --filter @devrijehond/api-client generate`.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getApiV1Categories,
  getApiV1Amenities,
  getApiV1Spots,
  getApiV1SpotsMap,
  getApiV1SpotsSlug,
  getApiV1SpotsSlugReviews,
  getApiV1Me,
  getApiV1FeatureRequests,
  postApiV1MeSpots,
  postApiV1MeSpotsIdVote,
  postApiV1MeSpotsIdReviews,
  postApiV1MeReports,
  postApiV1MeFeatureRequests,
  postApiV1MeFeatureRequestsIdVote,
  patchApiV1Me,
  postApiV1MeDogs,
  deleteApiV1MeDogsId,
  type Category,
  type Amenity,
  type SpotSummary,
  type SpotDetail,
  type SpotPhoto,
  type SpotRating,
  type SpotVerification,
  type SpotAuthor,
  type SpotGeometry,
  type Review,
  type Dog,
  type MeProfile,
  type Vote,
  type VoteResponse,
  type GeoPoint,
  type SpotType,
  type SpotStatus,
  type VoteValue,
  type SubmitSpotRequest,
  type SubmitReportRequest,
  type FeatureRequest,
  type FeatureStatus,
  type CreateDogRequest,
  type MeProfilePatch,
} from '@devrijehond/api-client';

// Re-export the contract types under the names the screens import. These are
// the OpenAPI components, so there's a single source of truth.
export type {
  Category,
  Amenity,
  SpotSummary,
  SpotDetail,
  SpotPhoto,
  SpotRating,
  SpotVerification,
  SpotAuthor,
  SpotGeometry,
  Review,
  Dog,
  MeProfile,
  Vote,
  VoteResponse,
  GeoPoint,
  SpotType,
  SpotStatus,
  VoteValue,
  FeatureRequest,
  FeatureStatus,
};

/** Body for `useSubmitSpot`, the generated submit-spot request shape. */
export type SubmitSpotBody = SubmitSpotRequest;

/** Map viewport bounding box (mirrors the server's MapBboxQuery). */
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

// ---------------------------------------------------------------------------
// Queries / mutations. Each delegates to the generated fetcher.
// ---------------------------------------------------------------------------

export function useCategories(type?: SpotType) {
  return useQuery({
    queryKey: ['categories', type ?? 'all'],
    queryFn: ({ signal }) => getApiV1Categories(type ? { type } : undefined, signal),
  });
}

export function useAmenities(categoryId?: string) {
  return useQuery({
    queryKey: ['amenities', categoryId ?? 'all'],
    queryFn: ({ signal }) => getApiV1Amenities(categoryId ? { categoryId } : undefined, signal),
  });
}

/** GET /api/v1/spots/map, markers within the viewport. */
export function useSpotsInViewport(
  bbox: Bbox | null,
  opts?: { type?: SpotType; categoryId?: string },
) {
  return useQuery({
    queryKey: ['spots-map', bbox, opts?.type, opts?.categoryId],
    enabled: bbox != null,
    queryFn: ({ signal }) =>
      getApiV1SpotsMap(
        { ...(bbox as Bbox), type: opts?.type, categoryId: opts?.categoryId },
        signal,
      ),
  });
}

/** GET /api/v1/spots, paginated list (the Nearby tab). */
export function useSpots(opts?: { type?: SpotType; categoryId?: string; limit?: number }) {
  return useQuery({
    queryKey: ['spots', opts?.type, opts?.categoryId, opts?.limit],
    queryFn: ({ signal }) =>
      getApiV1Spots(
        { type: opts?.type, categoryId: opts?.categoryId, limit: opts?.limit ?? 50 },
        signal,
      ),
  });
}

/** GET /api/v1/spots/:slug, full detail. */
export function useSpotDetail(slug: string | undefined) {
  return useQuery({
    queryKey: ['spot', slug],
    enabled: !!slug,
    queryFn: ({ signal }) => getApiV1SpotsSlug(slug as string, signal),
  });
}

/** GET /api/v1/spots/:slug/reviews. */
export function useSpotReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ['spot-reviews', slug],
    enabled: !!slug,
    queryFn: ({ signal }) => getApiV1SpotsSlugReviews(slug as string, undefined, signal),
  });
}

/** GET /api/v1/me, the signed-in profile. */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['me'],
    enabled,
    queryFn: ({ signal }) => getApiV1Me(signal),
  });
}

/** POST /api/v1/me/spots/:id/vote, cast a verification vote. */
export function useCastVote() {
  return useMutation({
    mutationFn: (args: { spotId: string; value: VoteValue; proof?: GeoPoint }) =>
      postApiV1MeSpotsIdVote(args.spotId, { value: args.value, proof: args.proof }),
  });
}

/** POST /api/v1/me/spots/:id/reviews, write a review. */
export function useSubmitReview() {
  return useMutation({
    mutationFn: (args: { spotId: string; stars: number; body?: string }) =>
      postApiV1MeSpotsIdReviews(args.spotId, { stars: args.stars, body: args.body }),
  });
}

/** POST /api/v1/me/spots, submit a new spot (goes live UNVERIFIED). */
export function useSubmitSpot() {
  return useMutation({
    mutationFn: (body: SubmitSpotBody) => postApiV1MeSpots(body),
  });
}

/** POST /api/v1/me/reports, report a spot / photo / review. */
export function useSubmitReport() {
  return useMutation({
    mutationFn: (args: {
      targetType: 'SPOT' | 'PHOTO' | 'REVIEW';
      targetId: string;
      reason: string;
      note?: string;
    }) =>
      postApiV1MeReports({
        targetType: args.targetType,
        targetId: args.targetId,
        reason: args.reason as SubmitReportRequest['reason'],
        note: args.note,
      }),
  });
}

// ---------------------------------------------------------------------------
// Feature requests (community product input). List is public; create + vote
// require auth.
// ---------------------------------------------------------------------------

/** GET /api/v1/feature-requests, public list, optionally filtered by status. */
export function useFeatureRequests(status?: FeatureStatus) {
  return useQuery({
    queryKey: ['feature-requests', status ?? 'all'],
    queryFn: ({ signal }) => getApiV1FeatureRequests(status ? { status } : undefined, signal),
  });
}

/** POST /api/v1/me/feature-requests, create a feature request. */
export function useCreateFeatureRequest() {
  return useMutation({
    mutationFn: (args: { title: string; body?: string; component?: string }) =>
      postApiV1MeFeatureRequests(args),
  });
}

/** POST /api/v1/me/feature-requests/:id/vote, toggle an upvote. */
export function useToggleFeatureVote() {
  return useMutation({
    mutationFn: (id: string) => postApiV1MeFeatureRequestsIdVote(id),
  });
}

// ---------------------------------------------------------------------------
// Profile + dogs (edit profile S14b, add dog S14c). All require auth.
// ---------------------------------------------------------------------------

/** PATCH /api/v1/me, update the signed-in profile (name / handle / bio). */
export function useUpdateMe() {
  return useMutation({
    mutationFn: (patch: MeProfilePatch) => patchApiV1Me(patch),
  });
}

/** POST /api/v1/me/dogs, add a dog to the profile. */
export function useCreateDog() {
  return useMutation({
    mutationFn: (dog: CreateDogRequest) => postApiV1MeDogs(dog),
  });
}

/** DELETE /api/v1/me/dogs/:id, remove a dog. */
export function useDeleteDog() {
  return useMutation({
    mutationFn: (id: string) => deleteApiV1MeDogsId(id),
  });
}
