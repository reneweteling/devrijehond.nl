import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { withStaffContext } from '@devrijehond/server';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * PATCH /api/v1/me/spots/:id/moderate — stel de spot-status in (staff only).
 *
 * Body: { status: 'VERIFIED' | 'UNVERIFIED' | 'HIDDEN' | 'REMOVED' }
 *
 * Mirrors `setSpotStatus` in apps/web/app/admin/actions.ts:
 *   - VERIFIED  → verifiedAt = now, hiddenAt ongewijzigd
 *   - HIDDEN / REMOVED → hiddenAt = now
 *   - UNVERIFIED → hiddenAt = null
 *
 * Vereist ADMIN of MODERATOR rol. Anonieme callers → 401, gewone users → 403.
 */
export const runtime = 'nodejs';

const ALLOWED_STATUSES = ['VERIFIED', 'UNVERIFIED', 'HIDDEN', 'REMOVED'] as const;
type SpotStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await withStaffContext(request);
  } catch (res) {
    return res as Response;
  }
  const { user } = ctx;
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const status = body?.status;
  if (typeof status !== 'string' || !(ALLOWED_STATUSES as readonly string[]).includes(status)) {
    return error(
      'VALIDATION_FAILED',
      `Status moet een van de volgende waarden zijn: ${ALLOWED_STATUSES.join(', ')}.`,
      { status: 400 },
    );
  }

  const db = authDb({ id: user.id, role: user.role });

  const data: {
    status: SpotStatus;
    verifiedAt?: Date | null;
    hiddenAt?: Date | null;
  } = { status: status as SpotStatus };

  if (status === 'VERIFIED') data.verifiedAt = new Date();
  if (status === 'HIDDEN' || status === 'REMOVED') data.hiddenAt = new Date();
  if (status === 'UNVERIFIED') data.hiddenAt = null;

  try {
    await db.spot.update({ where: { id }, data });
  } catch {
    return error('NOT_FOUND', 'Spot niet gevonden.', { status: 404 });
  }

  return ok({ ok: true }, { cacheControl: NO_STORE_CACHE_CONTROL });
}
