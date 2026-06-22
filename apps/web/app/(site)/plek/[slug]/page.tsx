import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadSpotDetail, loadNearbySpots, loadSpotReviews } from '@/lib/spot-detail';
import { SpotView } from '../../spot-view';

/**
 * `/plek/[slug]`, server-rendered POI page. Each spot is a crawlable URL with
 * its own metadata (blueprint §7 decision 4). Reads via `anonDb()`
 * (loadSpotDetail), so HIDDEN/REMOVED spots 404.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spot = await loadSpotDetail(slug);
  if (!spot) return { title: 'Plek niet gevonden' };

  const desc =
    spot.description?.slice(0, 160) ?? `${spot.category.label} in De Vrije Hond, ${spot.name}.`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.devrijehond.nl'}/plek/${spot.slug}`;

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

export default async function PlekPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spot = await loadSpotDetail(slug);
  if (!spot || spot.type !== 'POI') notFound();
  const [nearby, reviews] = await Promise.all([
    spot.lat != null && spot.lng != null
      ? loadNearbySpots(spot.id, spot.lat, spot.lng)
      : Promise.resolve([]),
    loadSpotReviews(slug),
  ]);
  return <SpotView spot={spot} nearby={nearby} reviews={reviews} />;
}
