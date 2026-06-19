import type { MetadataRoute } from 'next';
import { pgQuery } from '@devrijehond/server';

/**
 * Dynamic sitemap: the static pages plus every publicly visible spot
 * (`/plek/[slug]` for POIs, `/gebied/[slug]` for regions). Built from a raw
 * read so it stays cheap; degrades to just the static pages on any DB error.
 */
export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.devrijehond.nl';

type SpotRow = { slug: string; type: 'REGION' | 'POI'; updated_at: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const rows = await pgQuery<SpotRow>(
      `SELECT slug, type, "updatedAt" AS updated_at FROM "Spot"
         WHERE status IN ('VERIFIED','UNVERIFIED')
         ORDER BY "updatedAt" DESC LIMIT 5000`,
    );
    const spotEntries: MetadataRoute.Sitemap = rows.map((r) => ({
      url: `${BASE}/${r.type === 'REGION' ? 'gebied' : 'plek'}/${r.slug}`,
      lastModified: r.updated_at,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
    return [...staticEntries, ...spotEntries];
  } catch {
    return staticEntries;
  }
}
