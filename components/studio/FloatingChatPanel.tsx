"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldRect } from "@/lib/studio/messages";

export type Selection = {
  path: string;
  rect: FieldRect;
  currentValue: string;
};

/**
 * Floating editor panel, anchored next to the selected field. Positioned in the
 * shell's coordinate space: the field rect (relative to the iframe viewport) is
 * offset by the iframe's on-screen position.
 *
 * Phase 3: manual text replacement only (no AI yet). The AI instruction box
 * arrives in Phase 4.
 */

const PANEL_WIDTH = 340;

export function FloatingChatPanel({
  selection,
  iframeRect,
  onApply,
  onClose,
}: {
  selection: Selection;
  iframeRect: DOMRect | null;
  onApply: (path: string, value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(selection.currentValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset the field when a different element is selected.
  useEffect(() => {
    setValue(selection.currentValue);
    textareaRef.current?.focus();
  }, [selection.path, selection.currentValue]);

  const offsetTop = (iframeRect?.top ?? 0) + selection.rect.top + selection.rect.height + 8;
  const offsetLeft = (iframeRect?.left ?? 0) + selection.rect.left;

  // Keep the panel inside the viewport horizontally.
  const left =
    typeof window !== "undefined"
      ? Math.min(offsetLeft, window.innerWidth - PANEL_WIDTH - 16)
      : offsetLeft;

  const submit = () => {
    onApply(selection.path, value);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: Math.max(8, offsetTop),
        left: Math.max(8, left),
        width: PANEL_WIDTH,
        zIndex: 2147483000,
      }}
      className="rounded-lg border border-gray-200 bg-white p-3 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <code className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
          {selection.path}
        </code>
        <button
          onClick={onClose}
          className="shrink-0 text-gray-400 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") onClose();
        }}
        rows={4}
        className="w-full resize-y rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="rounded-md bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-800"
        >
          Apply
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400">⌘↵ to apply · Esc to cancel</p>
    </div>
  );
}
