/**
 * Field types the Studio can edit, and the value shape each carries.
 *
 * The editor is field-type-driven: a `data-field-type` attribute on an element
 * (default "text") tells the bridge how to read its current value and how to
 * apply an edit, and tells the panel which editor UI to render.
 *
 *  - text     → plain string (textContent)
 *  - richtext → sanitized HTML string (innerHTML)   [P7]
 *  - link     → { label, href, newTab }
 *  - image    → { src, alt }                          [P8]
 *  - layout   → a constrained enum string (a layout variant)  [AI layout]
 *  - icon     → a curated icon key string (see lib/content/icons.ts)
 *  - order    → string[] (collection item ids in display order)
 */

export type FieldType = "text" | "richtext" | "link" | "image" | "layout" | "icon" | "order";

/** The bounding box of a selected field, in viewport coords. Used to anchor the
 *  floating editor panel. (Formerly in the now-removed cross-frame messages.ts.) */
export type FieldRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type LinkValue = { label: string; href: string; newTab: boolean };
export type ImageValue = { src: string; alt: string };
/** A reorder: the collection's item ids in display order. */
export type OrderValue = string[];

/** A field's value, discriminated by its FieldType at the call site. */
export type FieldValue = string | LinkValue | ImageValue | OrderValue;

export function isLinkValue(v: FieldValue): v is LinkValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "href" in v && "label" in v;
}

export function isImageValue(v: FieldValue): v is ImageValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "src" in v;
}

export function isOrderValue(v: FieldValue): v is OrderValue {
  return Array.isArray(v);
}
