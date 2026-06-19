/**
 * Minimal sign-in landing for admins (magic-link). The full sign-in UI is a
 * later story; this is the redirect target `proxy.ts` sends unauthenticated
 * `/admin/**` requests to, so the route must exist.
 */
export default function SignInPage() {
  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1>Inloggen</h1>
      <p style={{ color: '#4a5a4d' }}>
        Vraag een inloglink aan om toegang te krijgen tot het admin-dashboard.
      </p>
      {/* TODO: wire `authClient.signIn.magicLink({ email })` form (STORY-WEB-AUTH). */}
    </main>
  );
}
