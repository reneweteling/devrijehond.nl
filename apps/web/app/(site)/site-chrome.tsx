/**
 * Shared site chrome: a sticky glass header and a deep-moss footer with legal
 * links, an app-download push and a small "made by Felobo B.V." business card.
 * Server components, styled via globals.css. Wraps every page in (site).
 */

import Image from 'next/image';

import { HeaderAccount } from './header-account';

const IOS_URL = 'https://apps.apple.com/app/de-vrije-hond/id000000000';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=nl.devrijehond.app';

export function PawMark({ size = 26, color = 'var(--moss)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth={66} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="360" cy="468" rx="54" ry="72" transform="rotate(-18 360 468)" />
        <ellipse cx="452" cy="392" rx="52" ry="74" transform="rotate(-7 452 392)" />
        <ellipse cx="572" cy="392" rx="52" ry="74" transform="rotate(7 572 392)" />
        <ellipse cx="664" cy="468" rx="54" ry="72" transform="rotate(18 664 468)" />
        <path d="M 512 556 C 600 556 668 612 668 690 C 668 760 604 792 558 808 C 528 818 496 818 466 808 C 420 792 356 760 356 690 C 356 612 424 556 512 556 Z" />
      </g>
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M16.36 1.43c0 1.14-.42 2.2-1.25 3.05-.9.94-2 .54-2.06.5-.04-1.1.45-2.16 1.2-2.94.85-.9 2.1-1.42 2.11-1.4-.01.27 0 .53 0 .8zM20.5 17.1c-.5 1.16-.74 1.68-1.39 2.7-.9 1.42-2.18 3.2-3.76 3.2-1.4.01-1.76-.92-3.67-.9-1.9.01-2.3.92-3.7.9-1.58-.01-2.78-1.6-3.69-3.03C1.96 16.4 1.7 11.7 3.27 9.2c1.11-1.78 2.86-2.82 4.5-2.82 1.68 0 2.73.92 4.12.92 1.34 0 2.16-.92 4.1-.92 1.47 0 3.02.8 4.13 2.18-3.63 1.99-3.04 7.18.28 8.54z" />
    </svg>
  );
}

function PlayGlyph() {
  // simple-icons Google Play glyph, rendered monochrome white to match the
  // Apple mark next to it.
  return (
    <svg width="20" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L2.27.195a1.49 1.49 0 0 0-.84-.069l12.114 10.863zm0 2.022L1.43 23.874a1.49 1.49 0 0 0 .84-.07l14.532-7.558-3.258-3.235z" />
    </svg>
  );
}

export function StoreButton({ href, kind }: { href: string; kind: 'ios' | 'android' }) {
  // Pre-launch: the store listings don't exist yet (placeholder id / unpublished
  // package). Render a non-clickable "Binnenkort" pill instead of a dead link.
  const comingSoon = href.includes('id000000000') || href.includes('details?id=nl.devrijehond.app');
  const glyph = kind === 'ios' ? <AppleGlyph /> : <PlayGlyph />;
  const small = comingSoon
    ? kind === 'ios'
      ? 'Binnenkort in de'
      : 'Binnenkort op'
    : kind === 'ios'
      ? 'Download in de'
      : 'Ontdek op';
  const big = kind === 'ios' ? 'App Store' : 'Google Play';
  const inner = (
    <>
      {glyph}
      <span>
        <span className="store-small" style={{ display: 'block' }}>
          {small}
        </span>
        <span className="store-big" style={{ display: 'block' }}>
          {big}
        </span>
      </span>
    </>
  );
  if (comingSoon) {
    return (
      <span className="store-btn" aria-disabled="true" style={{ opacity: 0.62, cursor: 'default' }}>
        {inner}
      </span>
    );
  }
  return (
    <a className="store-btn" href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  );
}

function Header() {
  return (
    <header className="site-header">
      <nav className="container">
        <a className="brand" href="/">
          <Image src="/logo.png" alt="" width={46} height={36} style={{ display: 'block' }} />
          De Vrije Hond
        </a>
        <div className="nav-links">
          <a href="/kaart">Kaart</a>
          <a href="/#zo-werkt-het">Zo werkt het</a>
          <a className="btn btn-primary" href="/#app" style={{ whiteSpace: 'nowrap' }}>
            <span className="nav-cta-full">Download de app</span>
            <span className="nav-cta-short" aria-hidden="true">
              App
            </span>
          </a>
          <span className="nav-account">
            <HeaderAccount />
          </span>
        </div>
      </nav>
    </header>
  );
}

export function AppCta() {
  return (
    <section
      id="app"
      className="container"
      style={{ paddingTop: 8, paddingBottom: 8, scrollMarginTop: 80 }}
    >
      <div
        className="topo"
        style={{
          background: 'linear-gradient(135deg, var(--moss) 0%, var(--moss-700) 100%)',
          color: '#fff',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 36px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 24,
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ color: '#fff', fontSize: 28, marginBottom: 10 }}>
            Neem de kaart mee op je wandeling
          </h2>
          <p style={{ margin: 0, fontSize: 16.5, color: '#fff', maxWidth: '48ch' }}>
            De Vrije Hond vindt losloopgebieden, hondenstranden en hondvriendelijke plekken bij jou
            in de buurt. En jij helpt mee verifiëren.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StoreButton href={IOS_URL} kind="ios" />
            <StoreButton href={ANDROID_URL} kind="android" />
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            Binnenkort te downloaden
          </span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container foot-grid">
        <div>
          <div className="brand" style={{ color: '#fff', marginBottom: 12 }}>
            <Image
              src="/logo-light.png"
              alt=""
              width={46}
              height={36}
              style={{ display: 'block' }}
            />
            De Vrije Hond
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.6,
              color: '#c4c9ad',
              maxWidth: '40ch',
            }}
          >
            De community-kaart van hondvriendelijke plekken in Nederland. Toegevoegd en geverifieerd
            door hondenbezitters zelf.
          </p>
        </div>

        <div>
          <h3>Info</h3>
          <ul className="foot-links">
            <li>
              <a href="/kaart">Kaart</a>
            </li>
            <li>
              <a href="/#zo-werkt-het">Zo werkt het</a>
            </li>
            <li>
              <a href="/over">Over &amp; meebouwen</a>
            </li>
            <li>
              <a
                href="https://github.com/reneweteling/devrijehond.nl"
                target="_blank"
                rel="noreferrer"
              >
                GitHub (open source) ↗
              </a>
            </li>
            <li>
              <a href="/privacy">Privacyverklaring</a>
            </li>
            <li>
              <a href="/terms">Voorwaarden</a>
            </li>
            <li>
              <a href="/account">Account</a>
            </li>
            <li>
              <a href="/signin">Inloggen</a>
            </li>
          </ul>
        </div>

        <div>
          <h3>Gemaakt door</h3>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: '#c4c9ad' }}>
            <a
              href="https://www.weteling.com"
              target="_blank"
              rel="noreferrer"
              style={{ fontWeight: 600 }}
            >
              René Weteling
            </a>
            , Felobo B.V.
            <br />
            Van idee tot productie: web, mobiel &amp; AI.
            <br />
            <a href="mailto:rene@weteling.com">rene@weteling.com</a>
            <br />
            Hilversum, Nederland
          </p>
        </div>
      </div>
      <div className="foot-bottom">
        <div className="container">
          De Vrije Hond™ · © 2026 Felobo B.V. (KvK 80910483). Alle rechten voorbehouden.
        </div>
      </div>
    </footer>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a className="skip-link" href="#main">
        Naar inhoud
      </a>
      <Header />
      <div id="main" style={{ flex: 1 }}>
        {children}
      </div>
      <Footer />
    </div>
  );
}
