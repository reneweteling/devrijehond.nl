import { MapIsland } from './map-island';

/**
 * Map home (`/`). Server shell — a crawlable intro + a client map island that
 * hydrates over the public spots API. Verified spot content lives on the
 * per-spot SSR pages (`/plek/[slug]`, `/gebied/[slug]`), which are the
 * indexable surface; this page is the entry point.
 */
export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>De Vrije Hond</h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: '#4a5a4d' }}>
          De community-kaart van hondvriendelijke plekken in Nederland — losloopgebieden,
          hondenstranden, horeca, waterpunten en meer. Toegevoegd en geverifieerd door
          hondenbezitters zelf.
        </p>
      </header>
      <MapIsland />
    </main>
  );
}
