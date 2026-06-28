import Image from 'next/image';
import { pgQuery } from '@devrijehond/server';

import { MapIsland } from './map-island';
import { AppCta, StoreButton } from './site-chrome';
import { Reveal, FadeIn } from './motion';

/**
 * Map home (`/`). A rich, crawlable landing page (hero, categories, the
 * community-verification story, featured verified spots, the live map and an
 * app-download push) over the public data. Per-spot SSR pages remain the
 * deep-indexable surface.
 *
 * Rendered dynamically (not prerendered at build): the build container has no
 * DB, so a build-time render would bake in the loadData() catch fallback
 * (0 plekken). The page stays dynamic so it queries the live DB at runtime (the
 * build has no DB access), but the category counts / featured / stats are cached
 * at runtime via unstable_cache so they aren't re-queried on every request. Map
 * markers load client-side from the API and aren't part of this render.
 */
export const dynamic = 'force-dynamic';

const IOS_URL = 'https://apps.apple.com/app/de-vrije-hond/id6782167612';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=nl.devrijehond.app';

const CATEGORY_EMOJI: Record<string, string> = {
  'off-leash': '🌳',
  'swim-beach': '🏖️',
  horeca: '☕',
  wash: '🚿',
  shop: '🛍️',
  'drinking-point': '🚰',
};

const FAQS = [
  {
    q: 'Hoe voeg ik een plek toe?',
    a: 'Download de app, tik op Toevoegen en zet de plek op de kaart, of teken het losloopgebied als een vlak. Hij staat meteen online en de community helpt hem bevestigen.',
  },
  {
    q: 'Is De Vrije Hond gratis?',
    a: 'Ja. De app en de kaart zijn gratis te gebruiken.',
  },
  {
    q: 'Hoe weet ik of een plek klopt?',
    a: 'De community houdt de kaart eerlijk. Een plek verschijnt meteen als nog niet geverifieerd; zodra genoeg hondenbazen in de buurt hem bevestigen, wordt hij geverifieerd.',
  },
  {
    q: 'Welke plekken staan erop?',
    a: 'Losloopgebieden en hondenstranden als gebieden, plus hondvriendelijke horeca, waterpunten, was- en spoelplekken en winkels, in heel Nederland.',
  },
];

type CatRow = { slug: string; label: string; color: string; n: number };
type FeaturedRow = {
  slug: string;
  name: string;
  type: 'REGION' | 'POI';
  cat_label: string;
  cat_color: string;
  rating_avg: number;
  rating_count: number;
  photo: string | null;
};
type Stats = { spots: number; cats: number };

async function loadData() {
  const __q0 = Date.now();
  try {
    const [cats, featured, stats] = await Promise.all([
      pgQuery<CatRow>(
        `SELECT c.slug, c.label, c.color, COUNT(s.id)::int AS n
           FROM "Category" c
           LEFT JOIN "Spot" s ON s."categoryId" = c.id AND s.status IN ('VERIFIED','UNVERIFIED')
          WHERE c.visible = true
          GROUP BY c.id
          ORDER BY c."sortOrder"`,
      ),
      pgQuery<FeaturedRow>(
        `SELECT s.slug, s.name, s.type,
                c.label AS cat_label, c.color AS cat_color,
                s."ratingAvg" AS rating_avg, s."ratingCount" AS rating_count,
                (SELECT url FROM "SpotPhoto" p WHERE p."spotId" = s.id ORDER BY p."sortOrder" LIMIT 1) AS photo
           FROM "Spot" s
           JOIN "Category" c ON c.id = s."categoryId"
          WHERE s.status = 'VERIFIED'
          ORDER BY s."ratingCount" DESC NULLS LAST, s."netScore" DESC
          LIMIT 6`,
      ),
      pgQuery<Stats>(
        `SELECT
            (SELECT COUNT(*)::int FROM "Spot" WHERE status IN ('VERIFIED','UNVERIFIED')) AS spots,
            (SELECT COUNT(*)::int FROM "Category" WHERE visible = true) AS cats`,
      ),
    ]);
    console.log('[perf] home loadData queries', Date.now() - __q0, 'ms');
    return { cats, featured, stats: stats[0] ?? { spots: 0, cats: 0 } };
  } catch {
    return { cats: [], featured: [], stats: { spots: 0, cats: 0 } };
  }
}

// Cache the (live-DB) home data at runtime so the dynamic page stays fast without
// re-querying on every request. A plain module-level memo (one value per process)
// instead of unstable_cache, which on this deployment added ~2.8s of cache-handler
// overhead per miss (measured) versus ~50ms for the actual queries.
type HomeData = Awaited<ReturnType<typeof loadData>>;
let homeCache: { at: number; data: HomeData } | null = null;
const HOME_TTL_MS = 300_000;

async function getHomeData(): Promise<HomeData> {
  const now = Date.now();
  if (homeCache && now - homeCache.at < HOME_TTL_MS) return homeCache.data;
  const data = await loadData();
  homeCache = { at: now, data };
  return data;
}

function detailHref(type: 'REGION' | 'POI', slug: string) {
  return `/${type === 'REGION' ? 'gebied' : 'plek'}/${slug}`;
}

export default async function HomePage() {
  const __t0 = Date.now();
  const { cats, featured, stats } = await getHomeData();
  console.log('[perf] home getHomeData', Date.now() - __t0, 'ms');

  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-grid">
          <FadeIn>
            <span className="eyebrow">🐾 Voor hondenbazen, door hondenbazen</span>
            <h1>
              Vind de fijnste <em>hondenplekken</em> van Nederland
            </h1>
            <p className="hero-lead">
              Losloopgebieden, hondenstranden, hondvriendelijke horeca en waterpunten. Eén kaart,
              toegevoegd en geverifieerd door de community zelf.
            </p>
            <div className="hero-cta">
              <StoreButton href={IOS_URL} kind="ios" />
              <StoreButton href={ANDROID_URL} kind="android" />
              <a className="btn btn-ghost" href="/kaart">
                Bekijk de kaart
              </a>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--ink-2, #6b6b63)' }}>
              De app is binnenkort te downloaden. Bekijk nu alvast de kaart in je browser.
            </p>
            <div className="hero-stats">
              <div>
                <div className="num">{stats.spots}+</div>
                <div className="lbl">plekken</div>
              </div>
              <div>
                <div className="num">{stats.cats}</div>
                <div className="lbl">categorieën</div>
              </div>
              <div>
                <div className="num">heel NL</div>
                <div className="lbl">van strand tot stad</div>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.12} y={24}>
            <div className="phone">
              <Image
                src="/app-map.png"
                alt="De Vrije Hond app met de kaart van hondenplekken"
                width={720}
                height={1564}
                priority
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Ontdek per soort</span>
            <h2 className="section-title">Alles voor een fijne wandeling</h2>
            <div className="grid grid-3" style={{ marginTop: 28 }}>
              {cats.map((c) => (
                <a
                  key={c.slug}
                  href="/kaart"
                  className="card card-link"
                  style={{ display: 'block' }}
                >
                  <div
                    className="card-body"
                    style={{ display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    <span
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 26,
                        background: `${c.color}1f`,
                      }}
                    >
                      {CATEGORY_EMOJI[c.slug] ?? '📍'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16.5, color: 'var(--ink)' }}>
                        {c.label}
                      </div>
                      <div className="muted" style={{ fontSize: 14 }}>
                        {c.n > 0 ? `${c.n} ${c.n === 1 ? 'plek' : 'plekken'}` : 'Binnenkort'}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="zo-werkt-het" className="section topo" style={{ scrollMarginTop: 72 }}>
        <div className="container">
          <Reveal>
            <span className="eyebrow">Zo werkt het</span>
            <h2 className="section-title">De community houdt de kaart eerlijk</h2>
            <p className="section-lead">
              Geen ondoorzichtige redactie. Een plek verschijnt meteen en wordt betrouwbaar zodra
              genoeg hondenbazen in de buurt hem bevestigen.
            </p>
            <div className="grid grid-3 steps" style={{ marginTop: 32 }}>
              {[
                [
                  'Ontdek',
                  'Open de kaart en zie losloopgebieden, stranden en plekken bij jou in de buurt.',
                ],
                [
                  'Voeg toe',
                  'Ken je een plek die nog ontbreekt? Zet hem er in een paar tikken op.',
                ],
                [
                  'Verifieer',
                  'Ben je er geweest? Bevestig de plek. Genoeg bevestigingen en hij wordt geverifieerd.',
                ],
              ].map(([title, body], i) => (
                <div key={title} className="step card" style={{ padding: 24 }}>
                  <span className="step-num">{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Featured spots */}
      {featured.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal>
              <span className="eyebrow">Geverifieerd door de community</span>
              <h2 className="section-title">Uitgelichte plekken</h2>
              <div className="grid grid-3" style={{ marginTop: 28 }}>
                {featured.map((s) => (
                  <a key={s.slug} href={detailHref(s.type, s.slug)} className="card card-link">
                    <div className="card-media">
                      {s.photo ? (
                        <img src={s.photo} alt={`${s.name}, ${s.cat_label}`} loading="lazy" />
                      ) : (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 40,
                            opacity: 0.55,
                          }}
                        >
                          🐾
                        </span>
                      )}
                    </div>
                    <div className="card-body">
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
                      >
                        <span
                          className="dot"
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: s.cat_color,
                          }}
                        />
                        <span className="muted" style={{ fontSize: 13 }}>
                          {s.cat_label}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>
                        {s.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span className="badge badge-verified">✓ Geverifieerd</span>
                        {s.rating_count > 0 ? (
                          <span className="muted" style={{ fontSize: 13.5 }}>
                            ★ {Number(s.rating_avg).toFixed(1).replace('.', ',')} · {s.rating_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* Live map */}
      <section id="kaart" className="section-tight" style={{ scrollMarginTop: 72 }}>
        <div className="container">
          <Reveal>
            <span className="eyebrow">De kaart</span>
            <h2 className="section-title">Verken alle plekken</h2>
            <p className="section-lead" style={{ marginBottom: 24 }}>
              Verplaats de kaart om plekken in een gebied te laden. Tik op een speld voor details.
            </p>
            <MapIsland />
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Veelgestelde vragen</span>
            <h2 className="section-title">Goed om te weten</h2>
            <div style={{ marginTop: 28, display: 'grid', gap: 12, maxWidth: 820 }}>
              {FAQS.map((f) => (
                <details key={f.q} className="card faq-item" style={{ padding: '18px 22px' }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                      fontFamily: 'var(--font-display-stack)',
                      fontSize: 18,
                      color: 'var(--ink)',
                    }}
                  >
                    {f.q}
                  </summary>
                  <p style={{ marginTop: 12, color: 'var(--ink-2)', lineHeight: 1.65 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQS.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }),
          }}
        />
      </section>

      <Reveal>
        <AppCta />
      </Reveal>
      <div style={{ height: 56 }} />
    </main>
  );
}
