"use client";

import { useDraftStore } from "@/lib/studio/draft-store";
import {
  isImageValue,
  isLinkValue,
  type FieldType,
  type FieldValue,
} from "@/lib/studio/field-types";

/**
 * Pure DOM helpers for in-place editing, shared by the studio overlay.
 *
 * Each editable element declares its kind via `data-field-type` (default
 * "text"). The DOM is the source of truth for current values (drafts are
 * re-applied to it on enter-edit), so reading/writing is uniform across text,
 * link, richtext, image, and layout.
 *
 * Extracted verbatim from the former `EditModeBridge` (the iframe-era cross-frame
 * bridge) — no postMessage. The studio overlay attaches the listeners and calls
 * these directly because the page and the editor now share one document.
 */

export const STYLE_ID = "studio-edit-mode-style";

export const EDIT_STYLES = `
  [data-content-path] { cursor: text; }
  /* Make editable elements clickable even when they (or a parent) set
     pointer-events: none — e.g. decorative hero/vision/feedback images. */
  [data-content-path] { pointer-events: auto !important; }
  [data-field-type="image"] { cursor: pointer; }
  [data-field-type="icon"] { cursor: pointer; }
  [data-content-path].studio-hover {
    outline: 2px dashed rgba(22, 173, 207, 0.9);
    outline-offset: 3px;
    border-radius: 2px;
  }
`;

export function fieldTypeOf(el: HTMLElement): FieldType {
  return (el.dataset.fieldType as FieldType) || "text";
}

export function readValue(el: HTMLElement): FieldValue {
  switch (fieldTypeOf(el)) {
    case "link":
      return {
        label: (el.textContent ?? "").trim(),
        href: el.dataset.href ?? "",
        newTab: el.dataset.newtab === "true",
      };
    case "image":
      return {
        // Prefer the canonical data-src: next/image rewrites `src` to a
        // /_next/image proxy URL, which we never want to round-trip into content.
        src: el.dataset.src ?? el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? "",
      };
    case "richtext":
      return el.innerHTML;
    case "layout":
    case "icon":
      // The chip / icon carries the current value (variant or icon key) in
      // data-current.
      return el.dataset.current ?? "";
    case "order":
      return el.dataset.current ?? "";
    default:
      return (el.textContent ?? "").trim();
  }
}

export function writeValue(el: HTMLElement, value: FieldValue) {
  switch (fieldTypeOf(el)) {
    case "link":
      if (isLinkValue(value)) {
        el.textContent = value.label;
        el.dataset.href = value.href;
        el.dataset.newtab = String(value.newTab);
      }
      break;
    case "image":
      if (isImageValue(value) && el instanceof HTMLImageElement) {
        el.src = value.src;
        el.dataset.src = value.src; // keep the canonical value in sync for re-reads
        el.alt = value.alt;
        // next/image emits a `srcset`; with it present the browser ignores a bare
        // `src` change, so the live preview wouldn't swap. Drop it.
        el.removeAttribute("srcset");
      }
      break;
    case "richtext":
      if (typeof value === "string") el.innerHTML = value;
      break;
    case "layout":
    case "icon":
      // No DOM mutation: the section reads the value reactively from the draft
      // store (useLayoutValue) and re-renders the variant / icon. We do refresh
      // data-current so a subsequent re-read reports the new value.
      if (typeof value === "string") el.dataset.current = value;
      break;
    case "order":
      // No single-element DOM mutation: the collection re-renders from the draft
      // store after recordEdit writes the new order.
      break;
    default:
      if (typeof value === "string") el.textContent = value;
  }
}

export function applyOverride(path: string, value: FieldValue) {
  document
    .querySelectorAll<HTMLElement>(`[data-content-path="${CSS.escape(path)}"]`)
    .forEach((node) => writeValue(node, value));
}

/** Record an edit produced directly in the page (e.g. a drag reorder): write it
 *  to the draft store so the page re-renders live and the edit is queued for
 *  publish. The in-place replacement for the iframe-era `recordBridgeEdit`. */
export function recordEdit(page: string, path: string, value: FieldValue) {
  useDraftStore.getState().setEdit(page, path, value);
}
