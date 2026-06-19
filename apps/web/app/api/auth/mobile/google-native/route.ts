/**
 * Native Google Sign-In bridge. The app POSTs `{ idToken }` from
 * @react-native-google-signin; we exchange it for a bearer session token.
 */
import { type NextRequest } from 'next/server';
import { handleNativeSignIn } from '@/lib/mobile-bridge';

export function POST(request: NextRequest) {
  return handleNativeSignIn(request, 'google');
}
