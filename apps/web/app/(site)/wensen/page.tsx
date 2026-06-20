import type { Metadata } from 'next';
import type { FeatureRequestsResponseDto } from '@devrijehond/types';
import { FeatureBoard } from './board';

/**
 * Public feature-request board (/wensen). Lists community feature requests from
 * GET /api/v1/feature-requests, sorted by upvotes. Signed-in users can upvote
 * and submit new requests via client-side fetches; signed-out visitors see an
 * Inloggen CTA. The list is rendered server-side for the initial paint.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wensen & ideeën | De Vrije Hond',
  description:
    'Stuur een verzoek in voor een nieuwe functie of stem op ideeën van andere gebruikers. Samen bouwen we De Vrije Hond beter.',
};

async function loadRequests(): Promise<FeatureRequestsResponseDto> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/v1/feature-requests`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = (await res.json()) as { data: FeatureRequestsResponseDto };
    return json.data;
  } catch {
    return { items: [], nextCursor: null };
  }
}

export default async function WensenPage() {
  const initial = await loadRequests();

  return (
    <main>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <span className="eyebrow">Community</span>
        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 44px)',
            margin: '10px 0 10px',
          }}
        >
          Wensen &amp; ideeën
        </h1>
        <p className="section-lead" style={{ marginBottom: 36, maxWidth: '60ch' }}>
          Wat wil jij nog in De Vrije Hond zien? Dien een verzoek in of stem op ideeën van anderen.
          De populairste wensen krijgen de meeste aandacht.
        </p>

        <FeatureBoard initial={initial} />
      </div>
    </main>
  );
}
