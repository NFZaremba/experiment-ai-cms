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
 */

export type FieldType = "text" | "richtext" | "link" | "image";

export type LinkValue = { label: string; href: string; newTab: boolean };
export type ImageValue = { src: string; alt: string };

/** A field's value, discriminated by its FieldType at the call site. */
export type FieldValue = string | LinkValue | ImageValue;

export function isLinkValue(v: FieldValue): v is LinkValue {
  return typeof v === "object" && v !== null && "href" in v && "label" in v;
}

export function isImageValue(v: FieldValue): v is ImageValue {
  return typeof v === "object" && v !== null && "src" in v;
}
