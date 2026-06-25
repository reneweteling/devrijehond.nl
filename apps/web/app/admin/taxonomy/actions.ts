'use server';

import { revalidatePath } from 'next/cache';
import { staffDb, currentStaff } from '@/lib/admin-db';

/**
 * Taxonomy CRUD server actions (categories + amenities).
 *
 * The shared admin actions in `../actions.ts` only cover promote + a partial
 * visibility/sortOrder patch. This route owns the full create / edit / delete
 * lifecycle the taxonomy page needs. All mutations go through the policy-bound
 * `staffDb()` (ADMIN/MODERATOR grant) and write an `AdminAction` audit row.
 */

type SpotType = 'REGION' | 'POI';
type TaxonomyStatus = 'ACTIVE' | 'PROPOSED';

/** Turn a label into a URL-safe slug ("Off-leash beach" -> "off-leash-beach"). */
function slugify(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Make a slug unique within a table by appending -2, -3, ... if needed.
 * `exists` checks the candidate against the DB.
 */
async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = base || 'item';
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

async function logAction(
  action: 'EDIT' | 'REMOVE',
  targetType: 'CATEGORY' | 'AMENITY',
  targetId: string,
  note?: string,
): Promise<void> {
  const [db, user] = await Promise.all([staffDb(), currentStaff()]);
  await db.adminAction.create({
    data: { adminId: user.id, action, targetType, targetId, note: note ?? null },
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new category. An admin is the author, so it lands ACTIVE + visible.
 * `type` defaults to POI (the common case); REGION is the off-leash-area kind.
 */
export async function createCategory(input: {
  label: string;
  icon?: string;
  color?: string;
  type?: SpotType;
  sortOrder?: number;
}): Promise<void> {
  const label = input.label.trim();
  if (!label) throw new Error('Label is verplicht.');
  const db = await staffDb();
  const slug = await uniqueSlug(
    slugify(label),
    async (s) => (await db.category.count({ where: { slug: s } })) > 0,
  );
  const created = await db.category.create({
    data: {
      slug,
      label,
      type: input.type ?? 'POI',
      icon: input.icon?.trim() || null,
      color: input.color?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      status: 'ACTIVE',
      visible: true,
    },
  });
  await logAction('EDIT', 'CATEGORY', created.id, 'create');
  revalidatePath('/admin/taxonomy');
}

/** Create a new amenity (ACTIVE + visible, admin-authored). */
export async function createAmenity(input: {
  label: string;
  icon?: string;
  sortOrder?: number;
}): Promise<void> {
  const label = input.label.trim();
  if (!label) throw new Error('Label is verplicht.');
  const db = await staffDb();
  const slug = await uniqueSlug(
    slugify(label),
    async (s) => (await db.amenity.count({ where: { slug: s } })) > 0,
  );
  const created = await db.amenity.create({
    data: {
      slug,
      label,
      icon: input.icon?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      status: 'ACTIVE',
      visible: true,
    },
  });
  await logAction('EDIT', 'AMENITY', created.id, 'create');
  revalidatePath('/admin/taxonomy');
}

// ---------------------------------------------------------------------------
// Edit (full patch: covers fields the shared updateCategory/Amenity miss)
// ---------------------------------------------------------------------------

export async function updateCategoryFull(
  categoryId: string,
  patch: {
    label?: string;
    icon?: string | null;
    color?: string | null;
    type?: SpotType;
    sortOrder?: number;
    visible?: boolean;
    status?: TaxonomyStatus;
  },
): Promise<void> {
  const db = await staffDb();
  const data: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new Error('Label mag niet leeg zijn.');
    data.label = label;
  }
  if (patch.icon !== undefined) data.icon = patch.icon?.trim() || null;
  if (patch.color !== undefined) data.color = patch.color?.trim() || null;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
  if (patch.visible !== undefined) data.visible = patch.visible;
  if (patch.status !== undefined) data.status = patch.status;
  await db.category.update({ where: { id: categoryId }, data });
  await logAction('EDIT', 'CATEGORY', categoryId);
  revalidatePath('/admin/taxonomy');
}

export async function updateAmenityFull(
  amenityId: string,
  patch: {
    label?: string;
    icon?: string | null;
    sortOrder?: number;
    visible?: boolean;
    status?: TaxonomyStatus;
  },
): Promise<void> {
  const db = await staffDb();
  const data: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new Error('Label mag niet leeg zijn.');
    data.label = label;
  }
  if (patch.icon !== undefined) data.icon = patch.icon?.trim() || null;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
  if (patch.visible !== undefined) data.visible = patch.visible;
  if (patch.status !== undefined) data.status = patch.status;
  await db.amenity.update({ where: { id: amenityId }, data });
  await logAction('EDIT', 'AMENITY', amenityId);
  revalidatePath('/admin/taxonomy');
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a category. Spot.category is onDelete: Restrict, so deleting a category
 * still used by spots throws a Prisma FK error; we catch it and surface a
 * friendly Dutch message instead of a 500.
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  const db = await staffDb();
  const inUse = await db.spot.count({ where: { categoryId } });
  if (inUse > 0) {
    throw new Error('Categorie wordt nog gebruikt door plekken.');
  }
  try {
    await db.category.delete({ where: { id: categoryId } });
  } catch {
    // Belt-and-braces in case a spot slipped in between the count and delete.
    throw new Error('Categorie wordt nog gebruikt door plekken.');
  }
  await logAction('REMOVE', 'CATEGORY', categoryId, 'delete');
  revalidatePath('/admin/taxonomy');
}

/**
 * Delete an amenity. AmenityOnCategory and SpotAmenity both cascade-delete from
 * Amenity, so this also removes the links; the amenity simply disappears from
 * any spot that had it. No FK restriction to worry about.
 */
export async function deleteAmenity(amenityId: string): Promise<void> {
  const db = await staffDb();
  await db.amenity.delete({ where: { id: amenityId } });
  await logAction('REMOVE', 'AMENITY', amenityId, 'delete');
  revalidatePath('/admin/taxonomy');
}
