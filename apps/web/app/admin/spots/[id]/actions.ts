'use server';

import { revalidatePath } from 'next/cache';
import type { TagOption } from '../../_components/tag-input';
import { staffDb } from '@/lib/admin-db';
import { uniqueSlug } from '@/lib/slug';

/**
 * Create a new amenity from a free-typed label in the spot editor's tag input.
 *
 * Community-introduced terms land as PROPOSED (the admin can later promote /
 * merge them on the taxonomy page). The amenity is linked to the spot's category
 * via AmenityOnCategory so it shows up as a suggestion for that category next
 * time. Returns the {id, label} so the tag input can add it to the selection.
 */
export async function createAmenityTag(
  label: string,
  categoryId: string,
): Promise<TagOption | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const db = await staffDb();

  // Reuse an existing amenity with the same (case-insensitive) label rather than
  // creating a duplicate.
  const existing = await db.amenity.findFirst({
    where: { label: { equals: trimmed, mode: 'insensitive' as const } },
    select: { id: true, label: true },
  });

  let amenity = existing;
  if (!amenity) {
    amenity = await db.amenity.create({
      data: {
        label: trimmed,
        slug: uniqueSlug(trimmed),
        status: 'PROPOSED',
        visible: false,
      },
      select: { id: true, label: true },
    });
  }

  // Link to the spot's category (idempotent: the composite PK guards duplicates).
  if (categoryId) {
    const link = await db.amenityOnCategory.findUnique({
      where: { amenityId_categoryId: { amenityId: amenity.id, categoryId } },
      select: { amenityId: true },
    });
    if (!link) {
      await db.amenityOnCategory.create({
        data: { amenityId: amenity.id, categoryId },
      });
    }
  }

  revalidatePath('/admin/taxonomy');
  return { id: amenity.id, label: amenity.label };
}
