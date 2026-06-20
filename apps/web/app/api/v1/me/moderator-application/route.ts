import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * POST /api/v1/me/moderator-application — dien een moderatoraanvraag in.
 *
 * Eén aanvraag per gebruiker. Als er al een aanvraag bestaat → 409.
 * Body: { motivation: string (>= 10 tekens) }
 * Respons: 201 { id, status, motivation, createdAt }
 *
 * GET /api/v1/me/moderator-application — haal de eigen aanvraag op.
 * Respons: 200 { application: { id, status, motivation, createdAt } | null }
 *
 * Beide routes: `/me/*` → no-store, requireAuth.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { user } = ctx;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const motivation = body?.motivation;
  if (typeof motivation !== 'string' || motivation.trim().length < 10) {
    return error('VALIDATION_FAILED', 'Motivatie moet minimaal 10 tekens bevatten.', {
      status: 400,
    });
  }

  const db = authDb({ id: user.id, role: user.role });

  // Check for an existing application (one per user, enforced by @unique on userId).
  const existing = await db.moderatorApplication.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, motivation: true, createdAt: true },
  });
  if (existing) {
    return error('ALREADY_EXISTS', 'Je hebt al een moderatoraanvraag ingediend.', {
      status: 409,
    });
  }

  const application = await db.moderatorApplication.create({
    data: { userId: user.id, motivation: motivation.trim() },
    select: { id: true, status: true, motivation: true, createdAt: true },
  });

  return ok(
    {
      id: application.id,
      status: application.status,
      motivation: application.motivation,
      createdAt: application.createdAt.toISOString(),
    },
    { status: 201, cacheControl: NO_STORE_CACHE_CONTROL },
  );
}

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { user } = ctx;

  const db = authDb({ id: user.id, role: user.role });

  const application = await db.moderatorApplication.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, motivation: true, createdAt: true },
  });

  return ok(
    {
      application: application
        ? {
            id: application.id,
            status: application.status,
            motivation: application.motivation,
            createdAt: application.createdAt.toISOString(),
          }
        : null,
    },
    { cacheControl: NO_STORE_CACHE_CONTROL },
  );
}
