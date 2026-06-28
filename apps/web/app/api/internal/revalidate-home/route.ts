import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Internal-only: regenerate the ISR homepage with live data. Called by the
 * in-process keep-warm pinger (see instrumentation.ts) right after startup so
 * the DB-less build render is replaced with real counts/featured immediately,
 * and periodically to keep it fresh on this low-traffic site. Guarded by a
 * token header so it can't be triggered (and used to spam re-renders) externally.
 */
export const dynamic = 'force-dynamic';

const TOKEN = process.env.WARM_TOKEN ?? 'dvh-warm';

export function GET(req: Request): NextResponse {
  if (req.headers.get('x-warm') !== TOKEN) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  revalidatePath('/');
  return NextResponse.json({ ok: true, revalidated: '/' });
}
