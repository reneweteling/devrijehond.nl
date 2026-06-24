import type { ReactNode } from 'react';
import { SiteChrome } from './site-chrome';
import { AnalyticsConsent } from './analytics-consent';

/** Wraps every public page with the shared header + footer chrome. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  // GA4 is opt-in via a cookie consent banner. With no measurement id set
  // (local/dev) we render nothing: no banner, no analytics.
  const gaId = process.env.WEB_GA_ID;
  return (
    <SiteChrome>
      {children}
      {gaId ? <AnalyticsConsent gaId={gaId} /> : null}
    </SiteChrome>
  );
}
