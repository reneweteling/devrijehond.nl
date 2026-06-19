/**
 * Informational page for authenticated non-admins who hit `/admin/**`.
 * `proxy.ts` redirects role=USER sessions here.
 */
export default function UnauthorizedPage() {
  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1>Geen toegang</h1>
      <p style={{ color: '#4a5a4d' }}>
        Dit gedeelte is alleen voor beheerders. Je bent ingelogd, maar hebt geen
        admin-rechten.
      </p>
      <a href="/" style={{ color: '#3F6B4C' }}>
        Terug naar de kaart
      </a>
    </main>
  );
}
