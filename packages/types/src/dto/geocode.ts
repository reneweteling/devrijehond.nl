import { z } from 'zod';
import { LatSchema, LngSchema } from './common';
import '../registry';

/**
 * Forward geocoding, `GET /api/v1/geocode?q=...`. Public, anonymous, cacheable.
 *
 * Turns a typed place / street / address into ranked coordinates so the map can
 * fly there. Proxies a keyless OSM geocoder (Photon) server-side, biased to the
 * Netherlands. Returns at most a handful of hits.
 */
export const GeocodeHitSchema = z
  .object({
    label: z.string().openapi({
      description: 'Human-readable place label.',
      example: 'Amsterdamse Bos, Amstelveen',
    }),
    lat: LatSchema,
    lng: LngSchema,
  })
  .openapi('GeocodeHit', { description: 'A single geocoding result.' });
export type GeocodeHitDto = z.infer<typeof GeocodeHitSchema>;

/** GET /api/v1/geocode, query parameters. */
export const GeocodeQuerySchema = z
  .object({
    q: z.string().openapi({
      description: 'Free-text place / street / address query (min 2 chars).',
      example: 'amsterdamse bos',
    }),
  })
  .openapi({ description: 'Query parameters for `GET /api/v1/geocode`.' });
export type GeocodeQueryDto = z.infer<typeof GeocodeQuerySchema>;

/** GET /api/v1/geocode, response. */
export const GeocodeResponseSchema = z
  .object({ items: z.array(GeocodeHitSchema) })
  .openapi('GeocodeResponse', { description: 'Ranked geocoding results (NL-biased).' });
export type GeocodeResponseDto = z.infer<typeof GeocodeResponseSchema>;
