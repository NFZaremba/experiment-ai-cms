import { getByPath, setByPath } from "@/lib/content/get-set-path";
import { isRichtextPath } from "@/lib/content/paths";
import { PAGES, type PageSlug } from "@/lib/content/pages";
import { sanitizeHtmlServer } from "./sanitize-server";
import { isOrderValue } from "./field-types";
import { reorderById } from "./order";
import type { DraftEdits } from "./draft-store";

/**
 * A generic set of file changes to publish. v1 produces exactly one file (the
 * content JSON), but the shape is deliberately content-agnostic so a future
 * producer (e.g. AI-edited source code) can flow through the same publish spine.
 */
export type ChangeSet = {
  files: { path: string; newContents: string }[];
  summary: string;
};

/**
 * Apply draft edits to a page's content document, re-validate against that
 * page's schema (throws on any invalid result — the write allowlist), and
 * serialize. The `slug` resolves to the right file + schema via the page
 * registry, so a page-2 edit commits to page2.json — never landing.json.
 *
 * Serializes the path-mutated document (not the Zod-parsed result) so key order
 * matches the original file → a minimal, readable diff. `setByPath` is immutable
 * and preserves key order, so the bundled content module is never mutated.
 */
export function buildContentChangeSet(slug: PageSlug, edits: DraftEdits): ChangeSet {
  const page = PAGES[slug];
  let doc: unknown = page.json;
  for (const [path, value] of Object.entries(edits)) {
    // Reorder: value is an id list → permute the array at `path` (id-keyed, so
    // it composes with leaf edits regardless of application order).
    if (isOrderValue(value)) {
      const arr = getByPath(doc, path);
      if (!Array.isArray(arr)) {
        throw new Error(`Reorder target is not an array: ${path}`);
      }
      doc = setByPath(doc, path, reorderById(arr as { id: string }[], value));
      continue;
    }

    // Server-side defense: HTML-sanitize rich-text values regardless of how the
    // edit was submitted (the client editor sanitizes too, but can be bypassed).
    const safe =
      isRichtextPath(path) && typeof value === "string" ? sanitizeHtmlServer(value) : value;
    doc = setByPath(doc, path, safe);
  }

  // Validate — rejects any edit that produced an out-of-schema document.
  page.schema.parse(doc);

  const newContents = JSON.stringify(doc, null, 2) + "\n";
  const count = Object.keys(edits).length;
  const summary = `content(${slug}): update ${count} field${count === 1 ? "" : "s"} via Content Studio`;

  return { files: [{ path: page.file, newContents }], summary };
}
