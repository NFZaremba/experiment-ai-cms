"use client";

import { useEffect } from "react";
import { useDraftStore } from "@/lib/studio/draft-store";
import {
  isApplyMessage,
  isStudioMessage,
  type SelectFieldMessage,
  type BridgeReadyMessage,
} from "@/lib/studio/messages";

/**
 * Mounted inside the previewed landing page when it loads with `?edit=1`.
 * Bridges DOM ↔ Studio shell:
 *  - re-applies persisted draft edits to the DOM on load
 *  - outlines `[data-content-path]` elements on hover
 *  - on click, posts the selected field (path + rect + value) to the shell
 *  - on an `apply` message from the shell, updates the DOM live + records the
 *    edit in the draft store (which persists to localStorage)
 *
 * Renders nothing. No-ops unless `active`.
 */

const STYLE_ID = "studio-edit-mode-style";

const EDIT_STYLES = `
  [data-content-path] { cursor: text; }
  [data-content-path].studio-hover {
    outline: 2px dashed rgba(22, 173, 207, 0.9);
    outline-offset: 3px;
    border-radius: 2px;
  }
`;

function postToShell(message: SelectFieldMessage | BridgeReadyMessage) {
  // window.parent is the Studio shell when embedded; falls back to self
  // (harmless no-op) when the page is opened directly.
  window.parent.postMessage(message, window.location.origin);
}

function applyOverride(path: string, value: string) {
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-content-path="${CSS.escape(path)}"]`
  );
  nodes.forEach((node) => {
    node.textContent = value;
  });
}

export function EditModeBridge({ active }: { active: boolean }) {
  const setEdit = useDraftStore((s) => s.setEdit);

  useEffect(() => {
    if (!active) return;

    // 1) Inject edit-mode styles.
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = EDIT_STYLES;
      document.head.appendChild(style);
    }

    // 2) Re-apply any persisted draft edits to the DOM.
    const { edits } = useDraftStore.getState();
    for (const [path, value] of Object.entries(edits)) applyOverride(path, value);

    // 3) Hover outline (event delegation).
    let hovered: HTMLElement | null = null;
    const onPointerOver = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-content-path]"
      );
      if (target === hovered) return;
      hovered?.classList.remove("studio-hover");
      hovered = target;
      hovered?.classList.add("studio-hover");
    };
    const onPointerOut = (e: PointerEvent) => {
      const related = (e.relatedTarget as HTMLElement | null)?.closest(
        "[data-content-path]"
      );
      if (!related && hovered) {
        hovered.classList.remove("studio-hover");
        hovered = null;
      }
    };

    // 4) Click → select. Capture phase + preventDefault stops CTA navigation.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-content-path]"
      );
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const path = el.getAttribute("data-content-path")!;
      const rect = el.getBoundingClientRect();
      const currentValue = (
        useDraftStore.getState().edits[path] ??
        el.textContent ??
        ""
      ).trim();
      postToShell({
        source: "studio-bridge",
        type: "select",
        path,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        currentValue,
        fieldType: "text",
      });
    };

    // 5) Apply edits coming back from the shell.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!isStudioMessage(e.data) || !isApplyMessage(e.data)) return;
      const { path, newValue } = e.data;
      applyOverride(path, newValue);
      setEdit(path, newValue);
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
