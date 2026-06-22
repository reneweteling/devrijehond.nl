import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { MeProfilePatchSchema, type MeProfileDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * /api/v1/me, GET + PATCH the authenticated user's profile (avatar, bio,
 * handle, name) with their dogs embedded. `/me/*` → no-store.
 */
export const runtime = 'nodejs';

async function load(user: {
  id: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}): Promise<MeProfileDto | null> {
  const db = authDb(user);
  const row = await db.user.findUnique({
    where: { id: user.id },
    include: { dogs: { orderBy: { createdAt: 'asc' } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    handle: row.handle ?? null,
    bio: row.bio ?? null,
    image: row.image ?? null,
    role: row.role,
    reputation: row.reputation,
    dogs: row.dogs.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed ?? null,
      birthYear: d.birthYear ?? null,
      birthDate: d.birthDate ? d.birthDate.toISOString().slice(0, 10) : null,
      photoUrl: d.photoUrl ?? null,
      note: d.note ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const profile = await load(ctx.user);
  if (!profile) {
    return error('UNAUTHENTICATED', 'Session user no longer exists.', { status: 401 });
  }
  return ok(profile, { cacheControl: NO_STORE_CACHE_CONTROL });
}

export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }
  const parsed = MeProfilePatchSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Patch did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const patch = parsed.data;

  const db = authDb(ctx.user);
  try {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.handle !== undefined && { handle: patch.handle }),
        ...(patch.bio !== undefined && { bio: patch.bio }),
        ...(patch.image !== undefined && { image: patch.image }),
      },
    });
  } catch (e) {
    // Most likely a unique-handle collision.
    return error('UPDATE_FAILED', 'Could not update the profile (handle may be taken).', {
      status: 400,
      details: process.env.NODE_ENV === 'production' ? undefined : String(e),
    });
  }

  const profile = await load(ctx.user);
  if (!profile) {
    return error('UNAUTHENTICATED', 'Session user no longer exists.', { status: 401 });
  }
  return ok(profile, { cacheControl: NO_STORE_CACHE_CONTROL });
}
