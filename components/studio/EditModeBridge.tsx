"use client";

import { useEffect } from "react";
import { useDraftStore } from "@/lib/studio/draft-store";
import { pageSlugForPathname } from "@/lib/content/pages";
import {
  isApplyMessage,
  isStudioMessage,
  type SelectFieldMessage,
  type BridgeReadyMessage,
  type BridgeDeselectMessage,
} from "@/lib/studio/messages";
import {
  isImageValue,
  isLinkValue,
  type FieldType,
  type FieldValue,
} from "@/lib/studio/field-types";

/**
 * Mounted inside the previewed landing page when it loads with `?edit=1`.
 * Bridges DOM ↔ Studio shell:
 *  - re-applies persisted draft edits to the DOM on load
 *  - outlines `[data-content-path]` elements on hover
 *  - on click, posts the selected field (path + type + value + rect) to the shell
 *  - on an `apply` message, updates the DOM live + records the edit in the draft
 *
 * Each element declares its kind via `data-field-type` (default "text"). The
 * DOM is the source of truth for current values (drafts are applied to it on
 * load), so reading/writing is uniform across text, link, richtext, image.
 *
 * Renders nothing. No-ops unless `active`.
 */

const STYLE_ID = "studio-edit-mode-style";

const EDIT_STYLES = `
  [data-content-path] { cursor: text; }
  /* Make editable elements clickable even when they (or a parent) set
     pointer-events: none — e.g. decorative hero/vision/feedback images. */
  [data-content-path] { pointer-events: auto !important; }
  [data-field-type="image"] { cursor: pointer; }
  [data-content-path].studio-hover {
    outline: 2px dashed rgba(22, 173, 207, 0.9);
    outline-offset: 3px;
    border-radius: 2px;
  }
`;

function postToShell(
  message: SelectFieldMessage | BridgeReadyMessage | BridgeDeselectMessage
) {
  window.parent.postMessage(message, window.location.origin);
}

function fieldTypeOf(el: HTMLElement): FieldType {
  return (el.dataset.fieldType as FieldType) || "text";
}

function readValue(el: HTMLElement): FieldValue {
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
      // The chip carries the current variant value in data-current.
      return el.dataset.current ?? "";
    default:
      return (el.textContent ?? "").trim();
  }
}

function writeValue(el: HTMLElement, value: FieldValue) {
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
      // No DOM mutation: the section reads the value reactively from the draft
      // store (useLayoutValue) and re-renders the variant. We do refresh the
      // chip's data-current so a subsequent re-read reports the new value.
      if (typeof value === "string") el.dataset.current = value;
      break;
    default:
      if (typeof value === "string") el.textContent = value;
  }
}

function applyOverride(path: string, value: FieldValue) {
  document
    .querySelectorAll<HTMLElement>(`[data-content-path="${CSS.escape(path)}"]`)
    .forEach((node) => writeValue(node, value));
}

export function EditModeBridge({ active }: { active: boolean }) {
  const setEdit = useDraftStore((s) => s.setEdit);

  useEffect(() => {
    if (!active) return;

    // This iframe renders one page; identify it so edits land in the right
    // page bucket (the shell tracks the same slug via its switcher).
    const slug = pageSlugForPathname(window.location.pathname);

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = EDIT_STYLES;
      document.head.appendChild(style);
    }

    // Re-apply this page's persisted draft edits to the DOM.
    const pageDraft = useDraftStore.getState().pages[slug];
    for (const [path, value] of Object.entries(pageDraft?.edits ?? {})) applyOverride(path, value);

    // Hover outline.
    let hovered: HTMLElement | null = null;
    const onPointerOver = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-content-path]");
      if (target === hovered) return;
      hovered?.classList.remove("studio-hover");
      hovered = target ?? null;
      hovered?.classList.add("studio-hover");
    };
    const onPointerOut = (e: PointerEvent) => {
      const related = (e.relatedTarget as HTMLElement | null)?.closest("[data-content-path]");
      if (!related && hovered) {
        hovered.classList.remove("studio-hover");
        hovered = null;
      }
    };

    // Click → select. Capture phase + preventDefault stops CTA navigation.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-content-path]");
      if (!el) {
        // Clicked a non-editable area → ask the shell to close the panel.
        postToShell({ source: "studio-bridge", type: "deselect" });
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const path = el.getAttribute("data-content-path")!;
      const rect = el.getBoundingClientRect();
      postToShell({
        source: "studio-bridge",
        type: "select",
        path,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        point: { x: e.clientX, y: e.clientY },
        currentValue: readValue(el),
        fieldType: fieldTypeOf(el),
      });
    };

    // Apply edits coming back from the shell.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!isStudioMessage(e.data) || !isApplyMessage(e.data)) return;
      const { path, newValue } = e.data;
      applyOverride(path, newValue);
      setEdit(slug, path, newValue);
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);

    postToShell({ source: "studio-bridge", type: "ready" });

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
      hovered?.classList.remove("studio-hover");
    };
  }, [active, setEdit]);

  return null;
}
