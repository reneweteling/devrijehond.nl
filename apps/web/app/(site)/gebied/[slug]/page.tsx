import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadSpotDetail, loadNearbySpots } from '@/lib/spot-detail';
import { SpotView } from '../../spot-view';

/**
 * `/gebied/[slug]`, server-rendered REGION page (off-leash zone, dog beach,
 * …). Crawlable URL with its own metadata. Reads via `anonDb()`, so
 * HIDDEN/REMOVED spots 404.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spot = await loadSpotDetail(slug);
  if (!spot) return { title: 'Gebied niet gevonden' };

  const desc =
    spot.description?.slice(0, 160) ?? `${spot.category.label} in De Vrije Hond, ${spot.name}.`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://devrijehond.nl'}/gebied/${spot.slug}`;

  return {
    title: spot.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: spot.name,
      description: desc,
      url,
      type: 'website',
      images: spot.photos[0]?.url ? [{ url: spot.photos[0].url }] : undefined,
    },
  };
}

export default async function GebiedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spot = await loadSpotDetail(slug);
  if (!spot || spot.type !== 'REGION') notFound();
  const nearby =
    spot.lat != null && spot.lng != null ? await loadNearbySpots(spot.id, spot.lat, spot.lng) : [];
  return <SpotView spot={spot} nearby={nearby} />;
}
