/**
 * Thin typed data layer over the generated client's `customFetcher`.
 *
 * The Orval client (tags-split → TanStack Query hooks) is regenerated from the
 * committed OpenAPI snapshot. Until generation has run, the hook names are not
 * known here, so every screen goes through `customFetcher` against the
 * documented `/api/v1/*` paths and we keep our own thin `useQuery` wrappers.
 *
 * TODO(verify): once `pnpm --filter @devrijehond/api-client generate` has run,
 * swap these wrappers for the generated hooks — e.g.
 *   import { useGetApiV1SpotsMap, useGetApiV1SpotsSlug } from '@devrijehond/api-client'
 * The generated hook names follow Orval's `use<Method><PathPascalCase>` scheme;
 * confirm the exact identifiers in `packages/api-client/src/generated/spots/spots.ts`.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { customFetcher } from '@devrijehond/api-client';

// ---------------------------------------------------------------------------
// Response shapes. These mirror @devrijehond/types DTOs. We re-declare the
// minimal subset the screens read rather than importing @devrijehond/types
// (mobile imports exclusively from @devrijehond/api-client, which re-exports
// the generated `client.schemas` types once generation has run). Keep in sync
// with packages/types/src/dto/*.
// ---------------------------------------------------------------------------

export type SpotType = 'REGION' | 'POI';
export type SpotStatus = 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';
export type VoteValue = 'CONFIRM' | 'DENY';

export type GeoPoint = { lat: number; lng: number };

export type SpotGeometry = {
  type: 'Point' | 'Polygon';
  coordinates: unknown; // Point → [lng,lat]; Polygon → [[[lng,lat],…]]
};

export type SpotRating = { average: number; count: number };

export type SpotVerification = {
  status: SpotStatus;
  netScore: number;
  confirmCount: number;
  denyCount: number;
  verifiedAt: string | null;
};

export type Category = {
  id: string;
  slug: string;
  label: string;
  type: SpotType;
  icon: string | null;
  color: string | null;
  sortOrder: number;
};

export type Amenity = {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  categoryIds: string[];
};

export type SpotSummary = {
  id: string;
  slug: string;
  type: SpotType;
  name: string;
  categoryId: string;
  status: SpotStatus;
  lat: number | null;
  lng: number | null;
  rating: SpotRating;
  photoUrl: string | null;
  updatedAt: string;
};

export type SpotPhoto = { id: string; url: string; sortOrder: number; createdAt: string };

export type SpotAuthor = {
  id: string;
  handle: string | null;
  name: string | null;
  image: string | null;
};

export type SpotDetail = {
  id: string;
  slug: string;
  type: SpotType;
  name: string;
  description: string | null;
  category: Category;
  status: SpotStatus;
  geometry: SpotGeometry | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  hours: unknown;
  phone: string | null;
  website: string | null;
  amenities: Amenity[];
  photos: SpotPhoto[];
  rating: SpotRating;
  verification: SpotVerification;
  submittedBy: SpotAuthor;
  createdAt: string;
  updatedAt: string;
};

export type Review = {
  id: string;
  spotId: string;
  stars: number;
  body: string | null;
  helpfulCount: number;
  author: { id: string; handle: string | null; name: string | null; image: string | null };
  createdAt: string;
};

export type Dog = {
  id: string;
  name: string;
  breed: string | null;
  birthYear: number | null;
  photoUrl: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeProfile = {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  image: string | null;
  role: 'USER' | 'ADMIN';
  reputation: number;
  dogs: Dog[];
  createdAt: string;
};

export type VoteResponse = {
  vote: { id: string; spotId: string; value: VoteValue; proximityVerified: boolean; createdAt: string };
  netScore: number;
  confirmCount: number;
  denyCount: number;
  status: string;
};

export type Paginated<T> = { items: T[]; nextCursor: string | null };
export type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

// ---------------------------------------------------------------------------
// Query / mutation wrappers. Each hits a documented path via customFetcher.
// ---------------------------------------------------------------------------

export function useCategories(type?: SpotType) {
  return useQuery({
    queryKey: ['categories', type ?? 'all'],
    queryFn: () =>
      customFetcher<{ items: Category[] }>({
        url: '/api/v1/categories',
        method: 'GET',
        params: type ? { type } : undefined,
      }),
  });
}

export function useAmenities(categoryId?: string) {
  return useQuery({
    queryKey: ['amenities', categoryId ?? 'all'],
    queryFn: () =>
      customFetcher<{ items: Amenity[] }>({
        url: '/api/v1/amenities',
        method: 'GET',
        params: categoryId ? { categoryId } : undefined,
      }),
  });
}

/** GET /api/v1/spots/map — markers within the viewport. */
export function useSpotsInViewport(
  bbox: Bbox | null,
  opts?: { type?: SpotType; categoryId?: string },
) {
  return useQuery({
    queryKey: ['spots-map', bbox, opts?.type, opts?.categoryId],
    enabled: bbox != null,
    queryFn: () =>
      customFetcher<{ items: SpotSummary[] }>({
        url: '/api/v1/spots/map',
        method: 'GET',
        params: { ...(bbox as Bbox), type: opts?.type, categoryId: opts?.categoryId },
      }),
  });
}

/** GET /api/v1/spots — paginated list (the Nearby tab). */
export function useSpots(opts?: { type?: SpotType; categoryId?: string; limit?: number }) {
  return useQuery({
    queryKey: ['spots', opts?.type, opts?.categoryId, opts?.limit],
    queryFn: () =>
      customFetcher<Paginated<SpotSummary>>({
        url: '/api/v1/spots',
        method: 'GET',
        params: { type: opts?.type, categoryId: opts?.categoryId, limit: opts?.limit ?? 50 },
      }),
  });
}

/** GET /api/v1/spots/:slug — full detail. */
export function useSpotDetail(slug: string | undefined) {
  return useQuery({
    queryKey: ['spot', slug],
    enabled: !!slug,
    queryFn: () => customFetcher<SpotDetail>({ url: `/api/v1/spots/${slug}`, method: 'GET' }),
  });
}

/** GET /api/v1/spots/:slug/reviews. */
export function useSpotReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ['spot-reviews', slug],
    enabled: !!slug,
    queryFn: () =>
      customFetcher<Paginated<Review>>({
        url: `/api/v1/spots/${slug}/reviews`,
        method: 'GET',
      }),
  });
}

/** GET /api/v1/me — the signed-in profile. */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['me'],
    enabled,
    queryFn: () => customFetcher<MeProfile>({ url: '/api/v1/me', method: 'GET' }),
  });
}

/** POST /api/v1/me/spots/:id/vote — cast a verification vote. */
export function useCastVote() {
  return useMutation({
    mutationFn: (args: { spotId: string; value: VoteValue; proof?: GeoPoint }) =>
      customFetcher<VoteResponse>({
        url: `/api/v1/me/spots/${args.spotId}/vote`,
        method: 'POST',
        data: { value: args.value, proof: args.proof },
      }),
  });
}

/** POST /api/v1/me/spots/:id/reviews — write a review. */
export function useSubmitReview() {
  return useMutation({
    mutationFn: (args: { spotId: string; stars: number; body?: string }) =>
      customFetcher<Review>({
        url: `/api/v1/me/spots/${args.spotId}/reviews`,
        method: 'POST',
        data: { stars: args.stars, body: args.body },
      }),
  });
}

export type SubmitSpotBody = {
  type: SpotType;
  categoryId: string;
  name: string;
  description?: string;
  point?: GeoPoint;
  polygon?: GeoPoint[];
  amenityIds?: string[];
  photos?: string[];
  address?: string;
  phone?: string;
  website?: string;
};

/** POST /api/v1/me/spots — submit a new spot (goes live UNVERIFIED). */
export function useSubmitSpot() {
  return useMutation({
    mutationFn: (body: SubmitSpotBody) =>
      customFetcher<SpotDetail>({ url: '/api/v1/me/spots', method: 'POST', data: body }),
  });
}

/** POST /api/v1/me/reports — report a spot / photo / review. */
export function useSubmitReport() {
  return useMutation({
    mutationFn: (args: {
      targetType: 'SPOT' | 'PHOTO' | 'REVIEW';
      targetId: string;
      reason: string;
      note?: string;
    }) =>
      customFetcher<{ id: string; createdAt: string }>({
        url: '/api/v1/me/reports',
        method: 'POST',
        data: args,
      }),
  });
}
