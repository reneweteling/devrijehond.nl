import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.devrijehond.nl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/v1/me'] }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
