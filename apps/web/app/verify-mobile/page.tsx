'use client';

/**
 * Mobile magic-link interstitial (blueprint §5).
 *
 * `@devrijehond/auth` rewrites the magic-link email to point HERE (HTTPS, so
 * Gmail/Outlook/Yahoo don't strip the href) with `?token=<one-time>&callback=
 * <deep-link-prefix>`. On a mobile browser we JS-redirect to
 * `<callback>?token=...` so the app picks up the token; on desktop we show an
 * "open this on your phone" fallback. No server-side token validation here ,
 * that's BetterAuth's job once the app POSTs to `/api/auth/magic-link/verify`.
 *
 * Client component: platform detection needs `navigator`.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

const DEFAULT_CALLBACK = 'vrijehond://verify';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isIPad =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  if (/iPhone|iPod/.test(ua) || isIPad) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function VerifyMobileInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const callback = params.get('callback') ?? DEFAULT_CALLBACK;

  const separator = callback.includes('?') ? '&' : '?';
  const deepLink = token ? `${callback}${separator}token=${encodeURIComponent(token)}` : '';

  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    if ((p === 'ios' || p === 'android') && deepLink) {
      const t = setTimeout(() => {
        window.location.href = deepLink;
      }, 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [deepLink]);

  let body: string;
  let showCta = false;
  if (!token) {
    body = 'Deze inloglink mist de token. Vraag een nieuwe aan vanuit de app.';
  } else if (platform === 'desktop') {
    body =
      'Deze inloglink werkt in de De Vrije Hond-app. Open de e-mail op de telefoon waar de app op staat en tik nogmaals op de knop.';
  } else {
    body = 'Gebeurt er niets? Tik dan op de knop hieronder.';
    showCta = true;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        textAlign: 'center',
        backgroundColor: '#1f2b22',
        color: '#f4efe6',
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, paddingTop: 8 }}>De Vrije Hond</h1>
      <p style={{ fontSize: 16, lineHeight: 1.5, maxWidth: 360, margin: 0 }}>{body}</p>
      {showCta ? (
        <a
          href={deepLink}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            padding: '0 24px',
            borderRadius: 8,
            backgroundColor: '#f4efe6',
            color: '#1f2b22',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open de app
        </a>
      ) : null}
    </main>
  );
}

export default function VerifyMobilePage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense>
      <VerifyMobileInner />
    </Suspense>
  );
}
