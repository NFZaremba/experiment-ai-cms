import DOMPurify from "dompurify";

/**
 * Rich-text sanitization for the Content Studio — CLIENT side (the Tiptap
 * editor's change handler). v1 rich text is intentionally minimal: inline
 * emphasis + links only (no block elements).
 *
 * The server publish boundary sanitizes again via `sanitize-server.ts` (a
 * jsdom-free sanitizer) so committed HTML is clean even if the editor is
 * bypassed — this client pass is just for live-preview fidelity.
 */

const CONFIG = {
  ALLOWED_TAGS: ["strong", "em", "b", "i", "a", "br", "span"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIG);
}

/**
 * Tiptap wraps content in a block `<p>`. For our inline single-paragraph fields
 * we unwrap a single outer `<p>` so the stored HTML is inline (e.g.
 * `text <strong>bold</strong>`), which renders correctly inside the existing
 * `<p>`/`<Text>` element without illegal nested-`<p>` markup.
 */
export function toInlineHtml(html: string): string {
  const clean = sanitizeHtml(html).trim();
  const match = clean.match(/^<p>([\s\S]*)<\/p>$/i);
  if (match && !match[1].includes("<p")) return match[1];
  return clean;
}
