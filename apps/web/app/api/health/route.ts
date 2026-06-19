import { NextResponse } from 'next/server';
import { pgQuery } from '@devrijehond/server';

/**
 * GET /api/health — liveness + readiness probe for Dokku's zero-downtime
 * CHECKS (and any uptime monitor). Pings the database with a trivial query;
 * returns 200 when reachable, 503 otherwise. Never cached.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await pgQuery('SELECT 1');
    return NextResponse.json(
      { status: 'ok', db: 'up' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', db: 'down' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
