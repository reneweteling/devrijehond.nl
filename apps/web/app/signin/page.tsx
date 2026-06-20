import { SignInForm } from './signin-form';

/**
 * Sign-in landing for admins/moderators (magic-link). `proxy.ts` sends
 * unauthenticated `/admin/**` requests here with a `?next=` target. Requesting
 * a link emails a login URL (printed to the server console in local dev) that
 * returns to `next` once verified.
 */
export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/') ? next : '/admin';
  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 8 }}>Inloggen</h1>
      <p style={{ color: 'var(--ink-2)', margin: 0 }}>
        Vraag een inloglink aan om toegang te krijgen tot het beheer.
      </p>
      <SignInForm next={target} />
    </main>
  );
}
