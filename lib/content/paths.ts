import { getByPath } from "./get-set-path";
import type { LandingContent } from "./schema";

/**
 * Which content paths are editable in v1.
 *
 * v1 scope (locked decision): the AI/editor may only touch PLAIN-TEXT string
 * leaves. Rich-text paragraphs (segment arrays with highlight spans) are
 * read-only, and structural / non-copy leaves (enums, URLs) are excluded.
 */

export type FieldType = "text";

/** Leaf keys that are not editable copy (enums + link targets). */
const NON_COPY_LEAF = new Set(["status", "ctaVariant", "ctaHref", "ctaAuthedHref"]);

/** Subtrees that are rich-text and therefore read-only in v1. */
const RICHTEXT_SEGMENT = "paragraphs";

function isEditableLeaf(path: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  const keys = path.split(".");
  if (keys.some((k) => k === RICHTEXT_SEGMENT)) return false; // inside paragraphs
  if (NON_COPY_LEAF.has(keys[keys.length - 1])) return false;
  return true;
}

/** Walk the document and collect every editable plain-text path. */
export function collectEditablePaths(content: LandingContent): string[] {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, prefix ? `${prefix}.${i}` : String(i)));
    } else if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
    } else if (isEditableLeaf(prefix, node)) {
      out.push(prefix);
    }
  };
  walk(content, "");
  return out;
}

/**
 * Validate that `path` points at an editable plain-text leaf in `content`.
 * Used by the AI rewrite route to reject out-of-scope writes.
 */
export function isEditableTextPath(content: LandingContent, path: string): boolean {
  const value = getByPath(content, path);
  return isEditableLeaf(path, value);
}

/** v1 has a single field type. Kept as a function for forward-compatibility. */
export function getFieldType(_path: string): FieldType {
  return "text";
}
