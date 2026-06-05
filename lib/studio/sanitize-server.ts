import "server-only";
import sanitizeHtmlLib from "sanitize-html";

/**
 * Server-side rich-text sanitizer for the publish boundary.
 *
 * Uses `sanitize-html` (htmlparser2-based — no jsdom, so it bundles cleanly in
 * Next/Netlify). Allowlist mirrors the client `sanitize.ts`: inline emphasis +
 * links only. This is the authoritative pass — any HTML committed to
 * landing.json goes through here regardless of how the edit was submitted.
 */

const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: ["strong", "em", "b", "i", "a", "br", "span"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

export function sanitizeHtmlServer(html: string): string {
  return sanitizeHtmlLib(html, OPTIONS);
}
