/**
 * Slugify a spot name into a URL-safe slug (lowercase, hyphenated, ASCII).
 *
 * `slugify` strips diacritics (Amsterdamse Bos → amsterdamse-bos), collapses
 * whitespace/punctuation to single hyphens, and trims leading/trailing dashes.
 * `uniqueSlug` appends a short random suffix to guarantee uniqueness against
 * the `Spot.slug @unique` constraint without a read-then-retry loop.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'plek';
}

/** Slug + a 6-char base36 suffix → collision-resistant in one insert. */
export function uniqueSlug(input: string): string {
  const base = slugify(input);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
