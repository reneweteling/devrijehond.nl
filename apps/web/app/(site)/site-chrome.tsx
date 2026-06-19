/**
 * Shared site chrome: a sticky header and a rich footer (legal links, an
 * app-download push, and a small "made by" business card for Felobo B.V.).
 * Server components, no client JS. Wraps every page in the (site) group.
 */

const MOSS = '#6E7B33';
const MOSS_DARK = '#4C5622';
const SAND = '#f4efe6';
const INK = '#1f2b22';
const INK2 = '#4a5a4d';
const LINE = 'rgba(60,50,20,.14)';

const IOS_URL = 'https://apps.apple.com/app/de-vrije-hond/id000000000';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=nl.devrijehond.app';

function PawMark({ size = 22, color = MOSS }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth={64} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="360" cy="468" rx="54" ry="72" transform="rotate(-18 360 468)" />
        <ellipse cx="452" cy="392" rx="52" ry="74" transform="rotate(-7 452 392)" />
        <ellipse cx="572" cy="392" rx="52" ry="74" transform="rotate(7 572 392)" />
        <ellipse cx="664" cy="468" rx="54" ry="72" transform="rotate(18 664 468)" />
        <path d="M 512 556 C 600 556 668 612 668 690 C 668 760 604 792 558 808 C 528 818 496 818 466 808 C 420 792 356 760 356 690 C 356 612 424 556 512 556 Z" />
      </g>
    </svg>
  );
}

function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'rgba(244,239,230,0.92)',
        backdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <nav
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
            color: MOSS,
            fontWeight: 600,
            fontSize: 17,
          }}
        >
          <PawMark />
          De Vrije Hond
        </a>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
          <a href="/#kaart" style={{ color: INK2, textDecoration: 'none', fontSize: 14 }}>
            Kaart
          </a>
          <a href="/api/docs" style={{ color: INK2, textDecoration: 'none', fontSize: 14 }}>
            API
          </a>
          <a
            href="#app"
            style={{
              backgroundColor: MOSS,
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 999,
            }}
          >
            Download de app
          </a>
        </div>
      </nav>
    </header>
  );
}

function StoreButton({ href, kind }: { href: string; kind: 'ios' | 'android' }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        backgroundColor: INK,
        color: '#fff',
        textDecoration: 'none',
        padding: '10px 16px',
        borderRadius: 12,
        minWidth: 180,
      }}
    >
      <span style={{ fontSize: 22 }}>{kind === 'ios' ? '' : '▶'}</span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontSize: 10, opacity: 0.8 }}>
          {kind === 'ios' ? 'Download in de' : 'Ontdek op'}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {kind === 'ios' ? 'App Store' : 'Google Play'}
        </span>
      </span>
    </a>
  );
}

export function AppCta() {
  return (
    <section
      id="app"
      style={{
        backgroundColor: MOSS,
        color: '#fff',
        borderRadius: 18,
        padding: '28px 24px',
        margin: '32px 0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div style={{ flex: '1 1 280px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Neem de kaart mee op je wandeling</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,.88)' }}>
          De Vrije Hond-app vindt losloopgebieden, hondenstranden en honden­vriendelijke plekken bij
          jou in de buurt — en jij helpt mee verifiëren.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StoreButton href={IOS_URL} kind="ios" />
        <StoreButton href={ANDROID_URL} kind="android" />
      </div>
    </section>
  );
}

function Footer() {
  const year = 2026;
  return (
    <footer style={{ borderTop: `1px solid ${LINE}`, marginTop: 40 }}>
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '32px 20px 48px',
          display: 'grid',
          gap: 28,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <PawMark />
            <strong style={{ color: MOSS, fontSize: 16 }}>De Vrije Hond</strong>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: INK2 }}>
            De community-kaart van hondvriendelijke plekken in Nederland. Toegevoegd en geverifieerd
            door hondenbezitters zelf.
          </p>
        </div>

        <div>
          <h3
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: INK2,
              margin: '0 0 10px',
            }}
          >
            Info
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 7 }}>
            {[
              ['Privacyverklaring', '/privacy'],
              ['Voorwaarden', '/terms'],
              ['API-documentatie', '/api/docs'],
              ['De app', '#app'],
            ].map(([label, href]) => (
              <li key={href}>
                <a href={href} style={{ color: INK, textDecoration: 'none', fontSize: 14 }}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: INK2,
              margin: '0 0 10px',
            }}
          >
            Gemaakt door
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: INK2 }}>
            <a
              href="https://www.weteling.com"
              style={{ color: MOSS_DARK, fontWeight: 600, textDecoration: 'none' }}
            >
              René Weteling
            </a>{' '}
            — Felobo B.V.
            <br />
            Van idee tot productie: web, mobiel &amp; AI.
            <br />
            <a href="mailto:rene@weteling.com" style={{ color: INK, textDecoration: 'none' }}>
              rene@weteling.com
            </a>
            <br />
            Hilversum, NL
          </p>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${LINE}` }}>
        <p
          style={{
            maxWidth: 980,
            margin: '0 auto',
            padding: '14px 20px',
            fontSize: 12.5,
            color: '#9a957f',
          }}
        >
          De Vrije Hond™ — © {year} Felobo B.V. (KvK 80910483). Alle rechten voorbehouden.
        </p>
      </div>
    </footer>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1 }}>{children}</div>
      <Footer />
    </div>
  );
}
