/**
 * GET /api/docs — interactive API reference (Scalar) for the v1 OpenAPI document
 * served at /api/v1/openapi.json. Standalone HTML loading Scalar from a CDN, so
 * there's no build dependency. Public, no auth.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-static';

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>De Vrije Hond API — reference</title>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/v1/openapi.json"
      data-configuration='{"theme":"default","hideDownloadButton":false,"metaData":{"title":"De Vrije Hond API"}}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

export function GET(): Response {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
