import type { ReactNode } from 'react';

/**
 * Shared shell for the static legal pages (/privacy, /terms). Uses the site
 * design system (globals.css) for a clean, readable document column.
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
    <main className="container container-narrow" style={{ padding: '36px 24px 72px' }}>
      <nav style={{ fontSize: 14, marginBottom: 18 }}>
        <a href="/">← Terug naar de kaart</a>
      </nav>
      <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>{title}</h1>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
        Laatst bijgewerkt: {updated}
      </p>
      <div style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 8 }}>
        {children}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '36px 0 16px' }} />
      <p className="muted" style={{ fontSize: 14 }}>
        Vragen? Mail naar <a href="mailto:hallo@devrijehond.nl">hallo@devrijehond.nl</a>.
      </p>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 21, margin: '0 0 8px' }}>{heading}</h2>
      {children}
    </section>
  );
}
