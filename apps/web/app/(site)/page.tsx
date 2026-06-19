import Image from 'next/image';
import { pgQuery } from '@devrijehond/server';

import { MapIsland } from './map-island';
import { AppCta, StoreButton } from './site-chrome';
import { Reveal, FadeIn } from './motion';

/**
 * Map home (`/`). A rich, crawlable landing page (hero, categories, the
 * community-verification story, featured verified spots, the live map and an
 * app-download push) over the public data. Per-spot SSR pages remain the
 * deep-indexable surface. Revalidated periodically so featured content stays
 * fresh.
 */
export const revalidate = 1800;

const IOS_URL = 'https://apps.apple.com/app/de-vrije-hond/id000000000';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=nl.devrijehond.app';

const CATEGORY_EMOJI: Record<string, string> = {
  'off-leash': '🌳',
  'swim-beach': '🏖️',
  horeca: '☕',
  wash: '🚿',
  shop: '🛍️',
  'drinking-point': '🚰',
};

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
    return { cats, featured, stats: stats[0] ?? { spots: 0, cats: 0 } };
  } catch {
    return { cats: [], featured: [], stats: { spots: 0, cats: 0 } };
  }
}

function detailHref(type: 'REGION' | 'POI', slug: string) {
  return `/${type === 'REGION' ? 'gebied' : 'plek'}/${slug}`;
}

export default async function HomePage() {
  const { cats, featured, stats } = await loadData();

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
              <a className="btn btn-ghost" href="#kaart">
                Bekijk de kaart
              </a>
            </div>
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
                width={580}
                height={1200}
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
                  href="#kaart"
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
                        {c.n} {c.n === 1 ? 'plek' : 'plekken'}
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photo} alt={`${s.name}, ${s.cat_label}`} loading="lazy" />
                      ) : null}
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

      <div style={{ height: 24 }} />
      <Reveal>
        <AppCta />
      </Reveal>
      <div style={{ height: 56 }} />
    </main>
  );
}
