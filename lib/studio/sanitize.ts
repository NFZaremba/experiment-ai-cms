import DOMPurify from "dompurify";

/**
 * Rich-text sanitization for the Content Studio.
 *
 * v1 rich text is intentionally minimal: inline emphasis + links only (no block
 * elements), so it drops cleanly into the existing single-paragraph layout and
 * can't introduce headings/lists/scripts. Sanitization happens at the editor
 * boundary (on every change), so the value stored in a draft — and ultimately
 * committed to landing.json — is always clean first-party HTML.
 *
 * Runs client-side only (called from the Tiptap editor's change handler).
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
