/**
 * App-wide auth state. The app is anonymous-first (browse the map, spots and
 * reviews without an account, per the wireframe); a session is only needed to
 * submit, vote, review, or open the profile.
 *
 * `status`:
 *   - 'loading'       — boot hasn't settled yet (SecureStore read in flight).
 *   - 'authenticated' — a valid bearer is registered with the api-client.
 *   - 'anonymous'     — no session; auth-gated actions show a sign-in CTA.
 *
 * Screens read `useAuth()` to gate `useMe()` (so anonymous users never hit the
 * 401-only `/me` endpoint) and to switch between content and a login CTA.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  /** Set after a successful sign-in / boot, or cleared on sign-out / 401. */
  setAuthenticated: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  const setAuthenticated = useCallback((value: boolean) => {
    setStatus(value ? 'authenticated' : 'anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, isAuthenticated: status === 'authenticated', setAuthenticated }),
    [status, setAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
