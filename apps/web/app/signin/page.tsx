import { SignInForm } from './signin-form';

/**
 * Magic-link sign-in landing. `proxy.ts` redirects unauthenticated `/admin/**`
 * requests here with a `?next=` param; normal users arrive without one and land
 * on /account after sign-in. Requesting a link emails a login URL (printed to
 * the server console in local dev) that returns to `next` once verified.
 */
export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/') ? next : '/account';
  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 8 }}>Inloggen</h1>
      <p style={{ color: 'var(--ink-2)', margin: 0 }}>
        Voer je e-mailadres in, dan sturen we je een inloglink.
      </p>
      <SignInForm next={target} />
    </main>
  );
}
