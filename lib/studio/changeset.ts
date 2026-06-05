import landingJson from "@/lib/content/landing.json";
import { landingSchema } from "@/lib/content/schema";
import { setByPath } from "@/lib/content/get-set-path";
import { isRichtextPath } from "@/lib/content/paths";
import { sanitizeHtmlServer } from "./sanitize-server";
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

/** The single allowlisted file the editor may write in v1. */
export const CONTENT_FILE_PATH = "lib/content/landing.json";

/**
 * Apply draft edits to the current content document, re-validate against the
 * schema (throws on any invalid result — the write allowlist), and serialize.
 *
 * Serializes the path-mutated document (not the Zod-parsed result) so key order
 * matches the original file → a minimal, readable diff. `setByPath` is immutable
 * and preserves key order, so the bundled `landingJson` is never mutated.
 */
export function buildContentChangeSet(edits: DraftEdits): ChangeSet {
  let doc: unknown = landingJson;
  for (const [path, value] of Object.entries(edits)) {
    // Server-side defense: HTML-sanitize rich-text values regardless of how the
    // edit was submitted (the client editor sanitizes too, but can be bypassed).
    const safe =
      isRichtextPath(path) && typeof value === "string" ? sanitizeHtmlServer(value) : value;
    doc = setByPath(doc, path, safe);
  }

  // Validate — rejects any edit that produced an out-of-schema document.
  landingSchema.parse(doc);

  const newContents = JSON.stringify(doc, null, 2) + "\n";
  const count = Object.keys(edits).length;
  const summary = `content: update ${count} field${count === 1 ? "" : "s"} via Content Studio`;

  return { files: [{ path: CONTENT_FILE_PATH, newContents }], summary };
}
