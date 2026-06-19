import type { ReactNode } from 'react';
import { SiteChrome } from './site-chrome';

/** Wraps every public page with the shared header + footer chrome. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
