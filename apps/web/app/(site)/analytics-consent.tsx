'use client';

/**
 * GDPR cookie consent banner + GA4 loader.
 *
 * Server passes the GA4 measurement id (WEB_GA_ID) down from the layout. We do
 * not load gtag.js or send any hit until the visitor explicitly accepts. The
 * choice is stored in a first-party cookie (`dvh_consent=granted|denied`) for
 * ~180 days. The banner only appears when no choice has been made yet.
 *
 * On accept (or on load when the cookie already says granted) we inject gtag.js
 * via next/script and run gtag('config', gaId), which sends the default
 * page_view automatically. On weigeren we store the choice and never load GA.
 */

import { useEffect, useState } from 'react';
import Script from 'next/script';

const CONSENT_COOKIE = 'dvh_consent';
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // ~180 days, in seconds.

type Consent = 'granted' | 'denied' | null;

function readConsent(): Consent {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(CONSENT_COOKIE.length + 1);
  return value === 'granted' || value === 'denied' ? value : null;
}

function writeConsent(value: 'granted' | 'denied') {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
}

export function AnalyticsConsent({ gaId }: { gaId: string }) {
  // null = not yet read (SSR / first paint), then 'granted' | 'denied' | 'unset'.
  const [consent, setConsent] = useState<Consent | 'unset'>(null);

  useEffect(() => {
    setConsent(readConsent() ?? 'unset');
  }, []);

  const accept = () => {
    writeConsent('granted');
    setConsent('granted');
  };

  const decline = () => {
    writeConsent('denied');
    setConsent('denied');
  };

  return (
    <>
      {consent === 'granted' ? (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      ) : null}

      {consent === 'unset' ? (
        <div role="dialog" aria-label="Cookietoestemming" className="consent-bar">
          <p className="consent-text">
            We gebruiken cookies om te zien hoe de site gebruikt wordt. Help je ons verbeteren?{' '}
            <a href="/privacy">Meer in onze privacyverklaring</a>.
          </p>
          <div className="consent-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={decline}>
              Weigeren
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
              Accepteren
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
