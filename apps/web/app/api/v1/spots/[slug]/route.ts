import type { NextRequest } from 'next/server';
import { ok, error } from '@/lib/api-response';
import { loadSpotDetail } from '@/lib/spot-detail';

/**
 * GET /api/v1/spots/:slug — public, anonymous, CDN-cacheable full spot detail.
 *
 * Geometry, amenities, photos, rating + verification status/netScore. Reads via
 * `anonDb()` (in `loadSpotDetail`) so the HIDDEN/REMOVED read policy is
 * enforced — a hidden spot returns 404 to anonymous callers.
 */
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const detail = await loadSpotDetail(slug);
  if (!detail) {
    return error('NOT_FOUND', 'Spot not found.', { status: 404 });
  }

  return ok(detail);
}
