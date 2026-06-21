import sanitizeHtml from 'sanitize-html';

/**
 * Server-side sanitiser for rich-text descriptions authored in the TipTap
 * editor. Spot descriptions are stored as HTML; this is the single trusted
 * gate that strips anything outside a small, safe allowlist (no scripts, no
 * styles, no event handlers) before the HTML is persisted. Both the website
 * (dangerouslySetInnerHTML) and the app (a small RN renderer) consume the
 * stored HTML, so sanitising once on write keeps every reader safe.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'a',
    'h3',
    'blockquote',
  ],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Force safe link behaviour and drop empty paragraphs at the edges.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
    }),
  },
};

/** Sanitise a rich-text HTML string. Returns trimmed HTML, or null when empty. */
export function sanitizeRichText(input: string | null | undefined): string | null {
  if (!input) return null;
  const clean = sanitizeHtml(input, OPTIONS).trim();
  // Treat content with no visible text as empty.
  const text = clean
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length > 0 ? clean : null;
}
