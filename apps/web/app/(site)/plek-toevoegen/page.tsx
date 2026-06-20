/**
 * /plek-toevoegen — community spot submission form.
 *
 * Server component: renders the page shell (title, lead copy, breadcrumb).
 * The interactive form (map + inputs) lives in the AddSpotForm client island
 * so the server render stays fast and cacheable.
 *
 * Auth is handled inside AddSpotForm: unauthenticated visitors see a sign-in
 * CTA without a full redirect, keeping the URL stable for sharing.
 *
 * Per-user intent, so opt out of static generation.
 */
export const dynamic = 'force-dynamic';

import { AddSpotForm } from './add-spot-form';

export const metadata = {
  title: 'Plek toevoegen | De Vrije Hond',
  description:
    'Voeg een hondvriendelijke plek toe aan de kaart. Hondvriendelijke horeca, waterpunten, speelplekken en meer.',
};

export default function AddSpotPage() {
  return (
    <main>
      <div className="container" style={{ paddingTop: 32, paddingBottom: 72 }}>
        {/* Breadcrumb */}
        <nav aria-label="Kruimelpad" style={{ fontSize: 14, marginBottom: 20 }}>
          <a href="/">De Vrije Hond</a>
          <span className="muted"> / Plek toevoegen</span>
        </nav>

        {/* Page header */}
        <div style={{ marginBottom: 36, maxWidth: 680 }}>
          <span className="eyebrow">🐾 Bijdragen</span>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)', margin: '10px 0 14px' }}>
            Plek toevoegen
          </h1>
          <p style={{ fontSize: 18, color: 'var(--ink-2)', lineHeight: 1.65 }}>
            Ken je een hondvriendelijk café, waterpunt, speelplaats of een andere handige plek? Zet
            hem op de kaart. Hij staat meteen live en de community helpt hem bevestigen.
          </p>
        </div>

        {/* Two-column layout: form left, tips right */}
        <div
          style={{
            display: 'grid',
            gap: 40,
            gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)',
            alignItems: 'start',
          }}
        >
          <div>
            <AddSpotForm />
          </div>

          {/* Sidebar: tips */}
          <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 84 }}>
            <div className="card" style={{ padding: 22 }}>
              <h2 style={{ fontSize: 17, marginBottom: 12 }}>Tips voor een goede plek</h2>
              <ul
                style={{
                  margin: 0,
                  padding: '0 0 0 18px',
                  display: 'grid',
                  gap: 10,
                  color: 'var(--ink-2)',
                  fontSize: 14.5,
                  lineHeight: 1.6,
                }}
              >
                <li>Zet de speld zo nauwkeurig mogelijk op de ingang of het middelpunt.</li>
                <li>Kies de categorie die het best past, dat helpt anderen zoeken.</li>
                <li>
                  Een korte beschrijving (honden welkom op het terras, gratis waterkom, etc.) maakt
                  de plek veel nuttiger.
                </li>
                <li>Dubbele plekken worden samengevoegd door de community of de beheerder.</li>
              </ul>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <h2 style={{ fontSize: 17, marginBottom: 8 }}>Hoe werkt verificatie?</h2>
              <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
                Jouw plek verschijnt meteen als <em>nog niet geverifieerd</em>. Zodra andere
                hondenbazen in de buurt hem bevestigen, wordt hij geverifieerd en krijgt hij meer
                zichtbaarheid.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
