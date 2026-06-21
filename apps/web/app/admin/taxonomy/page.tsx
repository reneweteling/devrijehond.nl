import { staffDb } from '@/lib/admin-db';
import {
  CategoriesTable,
  AmenitiesTable,
  type CategoryRow,
  type AmenityRow,
} from './_components/taxonomy-tables';

/**
 * Admin taxonomy curation. Lists categories + amenities with their visibility /
 * status, and lets an admin promote a PROPOSED (community-suggested) entry to
 * ACTIVE or toggle visibility. Mutations go through the server actions.
 *
 * Fetches all rows (admin data volumes are small); client-side DataTable handles
 * sort/search/paging.
 */
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage() {
  const db = await staffDb();

  const [categories, amenities] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
    db.amenity.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
  ]);

  const categoryRows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    label: c.label,
    type: c.type,
    sortOrder: c.sortOrder,
    status: c.status,
    visible: c.visible,
  }));

  const amenityRows: AmenityRow[] = amenities.map((a) => ({
    id: a.id,
    label: a.label,
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
        als PROPOSED; promoot ze of verberg ze hier.
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Categorieën</h2>
        <CategoriesTable rows={categoryRows} />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Voorzieningen</h2>
        <AmenitiesTable rows={amenityRows} />
      </section>
    </div>
  );
}
