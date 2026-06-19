import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'De Vrije Hond — de kaart van hondvriendelijke plekken',
    template: '%s · De Vrije Hond',
  },
  description:
    'Ontdek losloopgebieden, hondenstranden, horeca en meer — community-gedreven en geverifieerd door hondenbezitters in heel Nederland.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://devrijehond.nl'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          backgroundColor: '#f4efe6',
          color: '#1f2b22',
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
