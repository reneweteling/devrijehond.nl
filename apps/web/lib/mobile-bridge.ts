import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@devrijehond/auth';

/**
 * Shared native social-sign-in bridge for the Expo app.
 *
 * The mobile app runs the native Apple / Google sheet (expo-apple-authentication
 * / @react-native-google-signin), gets an identity token, and POSTs `{ idToken }`
 * here. We hand it to BetterAuth's `signInSocial`, which verifies the token
 * against the provider's public keys and its audience, then creates/links the
 * user and issues a session. We read the SIGNED session-token cookie off the
 * response headers (the bearer plugin needs the signed `<raw>.<hmac>` form, not
 * the raw `Session.token`) and return it as `{ token, expiresAt }` for the
 * mobile SecureStore path.
 */

const BodySchema = z.object({ idToken: z.string().min(1) });

// Matches `session.expiresIn` (30 days) in packages/auth/src/auth.ts.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function handleNativeSignIn(
  request: NextRequest,
  provider: 'apple' | 'google',
): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let result: unknown;
  try {
    // TODO(verify): confirm the `signInSocial` body shape (`idToken: { token }`)
    // against the installed better-auth version.
    result = await auth.api.signInSocial({
      body: { provider, idToken: { token: parsed.data.idToken } },
      headers: request.headers,
      returnHeaders: true,
    });
  } catch {
    return NextResponse.json({ error: `${provider}_signin_failed` }, { status: 401 });
  }

  if (!result || typeof result !== 'object' || !('headers' in result)) {
    return NextResponse.json({ error: `${provider}_signin_failed` }, { status: 401 });
  }

  const headers = (result as { headers: Headers }).headers;
  const token = extractSessionToken(headers);
  if (!token) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  return NextResponse.json({ token, expiresAt }, { status: 200 });
}

/**
 * Pull the BetterAuth signed session-token cookie value out of a response's
 * Set-Cookie headers. Recognises every cookie-name variant BetterAuth may emit
 * (with/without `__Secure-` and the `dvh.` / `dvh_` prefixes).
 */
function extractSessionToken(headers: Headers): string | null {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : (headers.get('set-cookie') ?? '').split(/,(?=[^;]+=)/);

  for (const c of cookies) {
    const first = c.split(';')[0];
    if (!first) continue;
    const eq = first.indexOf('=');
    if (eq < 0) continue;
    const name = first.slice(0, eq).trim();
    if (!/(?:^|-|\.|_)session_token$/.test(name)) continue;
    const value = first.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}
