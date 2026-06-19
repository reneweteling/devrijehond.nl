import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import {
  CreateDogRequestSchema,
  type DogDto,
  type DogsResponseDto,
} from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/** GET (list) + POST (create) the authenticated user's dogs. */
export const runtime = 'nodejs';

function toDto(d: {
  id: string;
  name: string;
  breed: string | null;
  birthYear: number | null;
  photoUrl: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DogDto {
  return {
    id: d.id,
    name: d.name,
    breed: d.breed ?? null,
    birthYear: d.birthYear ?? null,
    photoUrl: d.photoUrl ?? null,
    note: d.note ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }
  const db = authDb(ctx.user);
  const rows = await db.dog.findMany({
    where: { ownerId: ctx.user.id },
    orderBy: { createdAt: 'asc' },
  });
  const body: DogsResponseDto = { items: rows.map(toDto) };
  return ok(body, { cacheControl: NO_STORE_CACHE_CONTROL });
}

export async function POST(request: NextRequest) {
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
  const parsed = CreateDogRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Dog did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }
  const db = authDb(ctx.user);
  const created = await db.dog.create({
    data: {
      ownerId: ctx.user.id,
      name: parsed.data.name,
      breed: parsed.data.breed ?? null,
      birthYear: parsed.data.birthYear ?? null,
      photoUrl: parsed.data.photoUrl ?? null,
      note: parsed.data.note ?? null,
    },
  });
  return ok(toDto(created), { status: 201, cacheControl: NO_STORE_CACHE_CONTROL });
}
