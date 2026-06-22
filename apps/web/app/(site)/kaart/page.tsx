import type { Metadata } from 'next';
import { FullMap } from '../full-map';

export const metadata: Metadata = {
  title: 'Kaart',
  description:
    'Bekijk alle hondvriendelijke plekken in Nederland op de kaart: losloopgebieden, hondenstranden, horeca en waterpunten.',
};

/**
 * Full-screen map page (/kaart). The map fills the viewport below the sticky
 * 64 px header. All interactivity lives in the client <FullMap /> component.
 */
export default function KaartPage() {
  return (
    <div style={{ height: 'calc(100vh - 64px)', position: 'relative', overflow: 'hidden' }}>
      <FullMap />
    </div>
  );
}
