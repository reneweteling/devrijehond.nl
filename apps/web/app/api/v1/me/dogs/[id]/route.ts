import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { UpdateDogRequestSchema, type DogDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/** PATCH (update) + DELETE the authenticated user's dog. Ownership is policy-enforced. */
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body is not valid JSON.', { status: 400 });
  }
  const parsed = UpdateDogRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Dog did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const db = authDb(ctx.user);
  // Scope by ownerId too so a non-owner gets a 404 rather than a policy 500.
  const existing = await db.dog.findFirst({
    where: { id, ownerId: ctx.user.id },
    select: { id: true },
  });
  if (!existing) {
    return error('NOT_FOUND', 'Dog not found.', { status: 404 });
  }

  const p = parsed.data;
  const updated = await db.dog.update({
    where: { id },
    data: {
      ...(p.name !== undefined && { name: p.name }),
      ...(p.breed !== undefined && { breed: p.breed ?? null }),
      ...(p.birthYear !== undefined && { birthYear: p.birthYear ?? null }),
      ...(p.birthDate !== undefined && {
        birthDate: p.birthDate ? new Date(p.birthDate) : null,
      }),
      ...(p.photoUrl !== undefined && { photoUrl: p.photoUrl ?? null }),
      ...(p.note !== undefined && { note: p.note ?? null }),
    },
  });

  const dto: DogDto = {
    id: updated.id,
    name: updated.name,
    breed: updated.breed ?? null,
    birthYear: updated.birthYear ?? null,
    birthDate: updated.birthDate ? updated.birthDate.toISOString().slice(0, 10) : null,
    photoUrl: updated.photoUrl ?? null,
    note: updated.note ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
  return ok(dto, { cacheControl: NO_STORE_CACHE_CONTROL });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const { id } = await params;

  const db = authDb(ctx.user);
  const existing = await db.dog.findFirst({
    where: { id, ownerId: ctx.user.id },
    select: { id: true },
  });
  if (!existing) {
    return error('NOT_FOUND', 'Dog not found.', { status: 404 });
  }
  await db.dog.delete({ where: { id } });

  return new Response(null, {
    status: 204,
    headers: { 'X-API-Version': 'v1', 'Cache-Control': NO_STORE_CACHE_CONTROL },
  });
}
