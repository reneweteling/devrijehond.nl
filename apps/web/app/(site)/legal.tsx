import type { ReactNode } from 'react';

/**
 * Shared shell for the static legal pages (/privacy, /terms). Matches the
 * homepage container + palette. Server component, no client JS.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px' }}>
      <a href="/" style={{ color: '#3F6B4C', textDecoration: 'none', fontSize: 14 }}>
        ← Terug naar de kaart
      </a>
      <h1 style={{ fontSize: 30, margin: '16px 0 4px' }}>{title}</h1>
      <p style={{ fontSize: 13, color: '#9a957f', marginTop: 0 }}>Laatst bijgewerkt: {updated}</p>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: '#3c4a3e' }}>{children}</div>
      <hr
        style={{ border: 'none', borderTop: '1px solid rgba(60,50,20,.12)', margin: '32px 0 16px' }}
      />
      <p style={{ fontSize: 13, color: '#9a957f' }}>
        Vragen? Mail naar{' '}
        <a href="mailto:hallo@devrijehond.nl" style={{ color: '#3F6B4C' }}>
          hallo@devrijehond.nl
        </a>
        .
      </p>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{heading}</h2>
      {children}
    </section>
  );
}
