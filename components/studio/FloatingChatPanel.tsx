"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldRect } from "@/lib/studio/messages";
import {
  isLinkValue,
  type FieldType,
  type FieldValue,
  type LinkValue,
} from "@/lib/studio/field-types";
import { RichTextEditor } from "./RichTextEditor";

export type Selection = {
  path: string;
  rect: FieldRect;
  fieldType: FieldType;
  currentValue: FieldValue;
};

/**
 * Floating editor panel, anchored next to the selected field. Renders a
 * type-specific editor (text → textarea, link → label/URL/new-tab). Positioned
 * in the shell's coordinate space (field rect offset by the iframe position).
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
  onApply: (path: string, value: FieldValue, fieldType: FieldType) => void;
  onClose: () => void;
}) {
  const offsetTop = (iframeRect?.top ?? 0) + selection.rect.top + selection.rect.height + 8;
  const offsetLeft = (iframeRect?.left ?? 0) + selection.rect.left;
  const left =
    typeof window !== "undefined"
      ? Math.min(offsetLeft, window.innerWidth - PANEL_WIDTH - 16)
      : offsetLeft;

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
      data-studio-panel
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <code className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
          {selection.path}
        </code>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700" aria-label="Close">
          ✕
        </button>
      </div>

      {selection.fieldType === "link" && isLinkValue(selection.currentValue) ? (
        <LinkEditor
          initial={selection.currentValue}
          onApply={(v) => {
            onApply(selection.path, v, "link");
            onClose();
          }}
          onClose={onClose}
        />
      ) : selection.fieldType === "richtext" ? (
        <RichEditor
          initial={typeof selection.currentValue === "string" ? selection.currentValue : ""}
          onApply={(v) => {
            onApply(selection.path, v, "richtext");
            onClose();
          }}
          onClose={onClose}
        />
      ) : (
        <TextEditor
          initial={typeof selection.currentValue === "string" ? selection.currentValue : ""}
          onApply={(v) => {
            onApply(selection.path, v, selection.fieldType);
            onClose();
          }}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function TextEditor({
  initial,
  onApply,
  onClose,
}: {
  initial: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setValue(initial);
    ref.current?.focus();
  }, [initial]);

  return (
    <>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onApply(value);
          if (e.key === "Escape") onClose();
        }}
        rows={4}
        className="w-full resize-y rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
      />
      <Actions onApply={() => onApply(value)} onClose={onClose} hint="⌘↵ to apply · Esc to cancel" />
    </>
  );
}

function RichEditor({
  initial,
  onApply,
  onClose,
}: {
  initial: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  return (
    <>
      <RichTextEditor initialHtml={initial} onChange={setValue} />
      <Actions onApply={() => onApply(value)} onClose={onClose} hint="Bold / italic / link" />
    </>
  );
}

function LinkEditor({
  initial,
  onApply,
  onClose,
}: {
  initial: LinkValue;
  onApply: (value: LinkValue) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [href, setHref] = useState(initial.href);
  const [newTab, setNewTab] = useState(initial.newTab);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setLabel(initial.label);
    setHref(initial.href);
    setNewTab(initial.newTab);
    ref.current?.focus();
  }, [initial.label, initial.href, initial.newTab]);

  return (
    <>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Label</label>
      <input
        ref={ref}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="mb-2 w-full rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
      />
      <label className="mb-1 block text-[11px] font-medium text-gray-500">URL</label>
      <input
        value={href}
        onChange={(e) => setHref(e.target.value)}
        placeholder="https://…"
        className="mb-2 w-full rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
      />
      <label className="mb-1 flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} />
        Open in new tab
      </label>
      <Actions onApply={() => onApply({ label, href, newTab })} onClose={onClose} />
    </>
  );
}

function Actions({
  onApply,
  onClose,
  hint,
}: {
  onApply: () => void;
  onClose: () => void;
  hint?: string;
}) {
  return (
    <>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
        <button
          onClick={onApply}
          className="rounded-md bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-800"
        >
          Apply
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-gray-400">{hint}</p>}
    </>
  );
}
