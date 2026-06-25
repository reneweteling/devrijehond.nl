import { staffDb } from '@/lib/admin-db';
import { parsePage, ADMIN_PAGE_SIZE } from '../_components/table-ui';
import {
  CategoriesTable,
  AmenitiesTable,
  type CategoryRow,
  type AmenityRow,
} from './_components/taxonomy-tables';

/**
 * Admin taxonomy curation. Lists categories + amenities and lets an admin
 * create, edit, hide, promote (PROPOSED -> ACTIVE) and delete entries.
 *
 * Both tables are paginated server-side and page independently via their own
 * search params: `?cpage` for categories, `?apage` for amenities. Mutations go
 * through the server actions in `./actions.ts`.
 */
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ cpage?: string; apage?: string }>;
}) {
  const sp = await searchParams;
  const cpage = parsePage(sp.cpage);
  const apage = parsePage(sp.apage);
  const take = ADMIN_PAGE_SIZE;

  const db = await staffDb();

  const [categoryCount, amenityCount, categories, amenities] = await Promise.all([
    db.category.count(),
    db.amenity.count(),
    db.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      skip: (cpage - 1) * take,
      take,
    }),
    db.amenity.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      skip: (apage - 1) * take,
      take,
    }),
  ]);

  const categoryRows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    label: c.label,
    type: c.type,
    icon: c.icon,
    color: c.color,
    sortOrder: c.sortOrder,
    status: c.status,
    visible: c.visible,
  }));

  const amenityRows: AmenityRow[] = amenities.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    sortOrder: a.sortOrder,
    status: a.status,
    visible: a.visible,
  }));

  return (
    <div>
      <span className="eyebrow">Beheer</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '8px 0 8px' }}>Taxonomie</h1>
      <p className="muted" style={{ maxWidth: '60ch', marginBottom: 24 }}>
        Categorieën en voorzieningen groeien mee met de community. Nieuwe voorstellen komen binnen
        als PROPOSED; voeg ze toe, bewerk ze, promoot ze, verberg ze of verwijder ze hier.
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Categorieën</h2>
        <CategoriesTable rows={categoryRows} page={cpage} total={categoryCount} pageSize={take} />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Voorzieningen</h2>
        <AmenitiesTable rows={amenityRows} page={apage} total={amenityCount} pageSize={take} />
      </section>
    </div>
  );
}
