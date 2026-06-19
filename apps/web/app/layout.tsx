import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Inter } from 'next/font/google';

import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const SITE_NAME = 'De Vrije Hond';
const DESCRIPTION =
  'Ontdek losloopgebieden, hondenstranden, hondvriendelijke horeca en meer — community-gedreven en geverifieerd door hondenbezitters in heel Nederland.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.devrijehond.nl'),
  title: {
    default: 'De Vrije Hond — de kaart van hondvriendelijke plekken',
    template: '%s · De Vrije Hond',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'hondvriendelijk',
    'losloopgebied',
    'hondenstrand',
    'hondvriendelijke horeca',
    'honden uitlaten',
    'Nederland',
    'hondenkaart',
  ],
  authors: [{ name: 'Felobo B.V.', url: 'https://www.weteling.com' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'nl_NL',
    title: 'De Vrije Hond — de kaart van hondvriendelijke plekken',
    description: DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
