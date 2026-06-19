import type { NextRequest } from 'next/server';
import { authDb } from '@devrijehond/db';
import { requireAuth } from '@devrijehond/server';
import { SubmitReportRequestSchema, type ReportResponseDto } from '@devrijehond/types';
import { ok, error, NO_STORE_CACHE_CONTROL } from '@/lib/api-response';

/**
 * POST /api/v1/me/reports, file a report against a spot / photo / review (the
 * moderation safety-net). Write-only for users; admins read/resolve them.
 *
 * Registered in the OpenAPI contract under `/me/*` because it requires a
 * session (`@@allow('create', auth().id == reporterId)`).
 */
export const runtime = 'nodejs';

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
  const parsed = SubmitReportRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return error('VALIDATION_FAILED', 'Report did not validate.', {
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const db = authDb(ctx.user);
  const created = await db.report.create({
    data: {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reporterId: ctx.user.id,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
    },
    select: { id: true, createdAt: true },
  });

  const body: ReportResponseDto = {
    id: created.id,
    createdAt: created.createdAt.toISOString(),
  };
  return ok(body, { status: 201, cacheControl: NO_STORE_CACHE_CONTROL });
}
