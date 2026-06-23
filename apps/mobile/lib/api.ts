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

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import { API_URL } from './config';
import { clearSession, loadSession } from './session';
import {
  setAuthToken,
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
  patchApiV1MeDogsId,
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
  type UpdateDogRequest,
  type MeProfilePatch,
  type MapCluster,
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
  MapCluster,
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
    // Keep the previous markers on screen while panning/zooming refetches, so
    // the polygons + pins don't blink out and back in (the geofence flicker).
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      getApiV1SpotsMap(
        { ...(bbox as Bbox), type: opts?.type, categoryId: opts?.categoryId, cluster: true },
        signal,
      ),
  });
}

/**
 * GET /api/v1/spots, paginated list (the Nearby tab). When `near` is given the
 * server orders nearest-first (PostGIS distance), so the list reflects the
 * user's location instead of recency.
 *
 * The point is snapped to a coarse ~1km grid (2 decimals) for the request, so
 * everyone in the same neighbourhood hits the SAME URL and the CDN can actually
 * cache it. The screen still sorts the returned spots by the user's EXACT
 * location client-side (haversine), so the order stays precise — the coarse grid
 * only decides which ~200 spots come back, not their on-screen ordering.
 */
const NEAR_GRID = 100; // 1/0.01° ≈ ~1km cells

export function useSpots(opts?: {
  type?: SpotType;
  categoryId?: string;
  limit?: number;
  near?: { lat: number; lng: number };
}) {
  const nearLat = opts?.near ? Math.round(opts.near.lat * NEAR_GRID) / NEAR_GRID : undefined;
  const nearLng = opts?.near ? Math.round(opts.near.lng * NEAR_GRID) / NEAR_GRID : undefined;
  return useQuery({
    queryKey: ['spots', opts?.type, opts?.categoryId, opts?.limit, nearLat, nearLng],
    queryFn: ({ signal }) =>
      getApiV1Spots(
        {
          type: opts?.type,
          categoryId: opts?.categoryId,
          limit: opts?.limit ?? 50,
          nearLat,
          nearLng,
        },
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

/** PATCH /api/v1/me/dogs/:id, update an existing dog. */
export function useUpdateDog() {
  return useMutation({
    mutationFn: ({ id, dog }: { id: string; dog: UpdateDogRequest }) => patchApiV1MeDogsId(id, dog),
  });
}

/** DELETE /api/v1/me/dogs/:id, remove a dog. */
export function useDeleteDog() {
  return useMutation({
    mutationFn: (id: string) => deleteApiV1MeDogsId(id),
  });
}

/**
 * GET /api/v1/me/spots, the user's own submissions (all statuses). Not in the
 * generated client yet, so this reads it directly with the stored bearer.
 */
export function useMySpots(enabled = true) {
  return useQuery({
    queryKey: ['my-spots'],
    enabled,
    queryFn: async ({ signal }): Promise<SpotSummary[]> => {
      const session = await loadSession();
      const res = await fetch(`${API_URL}/api/v1/me/spots`, {
        headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
        signal,
      });
      if (res.status === 401) {
        await clearSession();
        setAuthToken(null);
        throw new Error(`me/spots 401`);
      }
      if (!res.ok) throw new Error(`me/spots ${res.status}`);
      const data = (await res.json()) as { items: SpotSummary[] };
      return data.items;
    },
  });
}

// ---------------------------------------------------------------------------
// Moderator application (raw-fetch bearer pattern, not in generated client).
// ---------------------------------------------------------------------------

export type ModeratorApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ModeratorApplication {
  id: string;
  status: ModeratorApplicationStatus;
  motivation: string;
  createdAt: string;
}

/**
 * GET /api/v1/me/moderator-application, the signed-in user's own application
 * (null if none).
 */
export function useModeratorApplication(enabled = true) {
  return useQuery({
    queryKey: ['moderator-application'],
    enabled,
    queryFn: async ({ signal }): Promise<ModeratorApplication | null> => {
      const session = await loadSession();
      const res = await fetch(`${API_URL}/api/v1/me/moderator-application`, {
        headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
        signal,
      });
      if (res.status === 401) {
        await clearSession();
        setAuthToken(null);
        throw new Error(`me/moderator-application 401`);
      }
      if (!res.ok) throw new Error(`me/moderator-application ${res.status}`);
      const data = (await res.json()) as { application: ModeratorApplication | null };
      return data.application;
    },
  });
}

/** POST /api/v1/me/moderator-application, submit a new application. */
export function useApplyModerator() {
  return useMutation({
    mutationFn: async (args: { motivation: string }): Promise<ModeratorApplication> => {
      const session = await loadSession();
      const res = await fetch(`${API_URL}/api/v1/me/moderator-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ motivation: args.motivation }),
      });
      if (res.status === 401) {
        await clearSession();
        setAuthToken(null);
        throw new Error(`me/moderator-application 401`);
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(err.error ?? `apply-moderator ${res.status}`), {
          status: res.status,
        });
      }
      return res.json() as Promise<ModeratorApplication>;
    },
  });
}

/**
 * PATCH /api/v1/me/spots/:id/moderate, staff-only spot status update.
 * Invalidates spot detail + list caches on success via the returned
 * `invalidateQueries` helper (caller provides the QueryClient).
 */
export function useModerateSpot() {
  return useMutation({
    mutationFn: async (args: {
      spotId: string;
      status: 'VERIFIED' | 'UNVERIFIED' | 'HIDDEN' | 'REMOVED';
    }): Promise<{ ok: boolean }> => {
      const session = await loadSession();
      const res = await fetch(`${API_URL}/api/v1/me/spots/${args.spotId}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ status: args.status }),
      });
      if (res.status === 401) {
        await clearSession();
        setAuthToken(null);
        throw new Error(`moderate 401`);
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(err.error ?? `moderate ${res.status}`), {
          status: res.status,
        });
      }
      return res.json() as Promise<{ ok: boolean }>;
    },
  });
}
