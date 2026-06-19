/**
 * Native Sign in with Apple bridge. The iOS app POSTs `{ idToken }` from
 * expo-apple-authentication; we exchange it for a bearer session token.
 */
import { type NextRequest } from 'next/server';
import { handleNativeSignIn } from '@/lib/mobile-bridge';

export function POST(request: NextRequest) {
  return handleNativeSignIn(request, 'apple');
}
