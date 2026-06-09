"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CldUploadWidget } from "next-cloudinary";
import {
  isImageValue,
  isLinkValue,
  type FieldRect,
  type FieldType,
  type FieldValue,
  type ImageValue,
  type LinkValue,
} from "@/lib/studio/field-types";
import { layoutFieldFor } from "@/lib/content/layout-vocab";
import { ICON_KEYS, iconFor } from "@/lib/content/icons";
import { RichTextEditor } from "./RichTextEditor";

export type Selection = {
  path: string;
  rect: FieldRect;
  point: { x: number; y: number };
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
  page,
  onApply,
  onClose,
}: {
  selection: Selection;
  iframeRect: DOMRect | null;
  page: string;
  onApply: (path: string, value: FieldValue, fieldType: FieldType) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(8);

  // Anchor at the point the user clicked (offset into the shell by the iframe
  // position), not the field's bounding box — feels direct, and avoids landing
  // far from the cursor on large fields. Clamped to the viewport.
  const clickX = (iframeRect?.left ?? 0) + selection.point.x;
  const left =
    typeof window !== "undefined"
      ? Math.max(8, Math.min(clickX, window.innerWidth - PANEL_WIDTH - 16))
      : clickX;

  // Vertical: just below the cursor, but flip above it if the panel would
  // overflow the viewport. Measured after render so it accounts for editor height.
  useLayoutEffect(() => {
    const vh = window.innerHeight;
    const clickY = (iframeRect?.top ?? 0) + selection.point.y;
    const h = panelRef.current?.offsetHeight ?? 240;
    let t = clickY + 12;
    if (t + h > vh - 8) {
      const above = clickY - 12 - h;
      t = above >= 8 ? above : Math.max(8, vh - h - 8);
    }
    setTop(t);
  }, [iframeRect, selection.point.x, selection.point.y, selection.path]);

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top,
        left,
        width: PANEL_WIDTH,
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
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
      ) : selection.fieldType === "image" && isImageValue(selection.currentValue) ? (
        <ImageEditor
          initial={selection.currentValue}
          onApply={(v) => {
            onApply(selection.path, v, "image");
            onClose();
          }}
          onClose={onClose}
        />
      ) : selection.fieldType === "layout" && typeof selection.currentValue === "string" ? (
        <SelectEditor
          path={selection.path}
          page={page}
          initial={selection.currentValue}
          onApply={(v) => {
            onApply(selection.path, v, "layout");
            onClose();
          }}
          onClose={onClose}
        />
      ) : selection.fieldType === "icon" && typeof selection.currentValue === "string" ? (
        <IconEditor
          initial={selection.currentValue}
          onApply={(v) => {
            onApply(selection.path, v, "icon");
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

function ImageEditor({
  initial,
  onApply,
  onClose,
}: {
  initial: ImageValue;
  onApply: (value: ImageValue) => void;
  onClose: () => void;
}) {
  const [src, setSrc] = useState(initial.src);
  const [alt, setAlt] = useState(initial.alt);
  const [widgetError, setWidgetError] = useState(false);
  useEffect(() => {
    setSrc(initial.src);
    setAlt(initial.alt);
  }, [initial.src, initial.alt]);

  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  return (
    <>
      <div className="mb-2 flex h-28 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 p-2">
        {/* Plain img: the source can be a local path or a remote Cloudinary URL,
            and this thumbnail doesn't need next/image optimization. Fixed-height
            box so the panel's measured height is stable before the img loads
            (keeps the viewport-clamp placement accurate). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-full w-auto object-contain" />
      </div>
      {preset ? (
        <CldUploadWidget
          uploadPreset={preset}
          onSuccess={(result) => {
            const info = result?.info;
            if (info && typeof info === "object" && "secure_url" in info) {
              setSrc(String((info as { secure_url: string }).secure_url));
            }
          }}
        >
          {({ open, isLoading }) => (
            <button
              type="button"
              // Gate on isLoading (next-cloudinary's own pattern). The try/catch is
              // the real guard: if the widget couldn't be created (script blocked
              // by an ad-blocker/network), open() throws synchronously inside
              // next-cloudinary ("reading 'open'") — we swallow it and steer the
              // user to the URL field instead of red-screening the editor.
              onClick={() => {
                try {
                  open?.();
                } catch {
                  setWidgetError(true);
                }
              }}
              disabled={isLoading}
              className="mb-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Loading uploader…" : "Upload image…"}
            </button>
          )}
        </CldUploadWidget>
      ) : (
        <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
          Set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> +{" "}
          <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> to enable uploads. You can still set an
          image URL below.
        </p>
      )}
      {widgetError && (
        <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
          The uploader couldn’t load — often an ad-blocker or privacy extension blocking
          Cloudinary. Disable it for this site, or paste an image URL below.
        </p>
      )}
      {/* Fallback that always works, even if the upload widget is blocked by the
          browser/network: paste an image URL (a Cloudinary URL renders in prod;
          a local /img path also works). Bound to `src` so the thumbnail updates live. */}
      <label className="mb-1 block text-[11px] font-medium text-gray-500">…or paste an image URL</label>
      <input
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        placeholder="https://res.cloudinary.com/…"
        className="mb-2 w-full rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
      />
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Alt text</label>
      <input
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        placeholder="Describe the image"
        className="mb-2 w-full rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
      />
      <Actions onApply={() => onApply({ src, alt })} onClose={onClose} />
    </>
  );
}

function SelectEditor({
  path,
  page,
  initial,
  onApply,
  onClose,
}: {
  path: string;
  page: string;
  initial: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const field = layoutFieldFor(path);
  const [value, setValue] = useState(initial);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  useEffect(() => setValue(initial), [initial]);

  if (!field) return null;

  const askAi = async () => {
    if (!instruction.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/studio/ai-layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page, path, instruction, currentValue: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      // The server only ever returns a value from this field's allowlist.
      if (typeof data.value === "string") setValue(data.value);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{field.label}</label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {field.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setValue(o.value)}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              value === o.value
                ? "border-cyan-600 bg-cyan-50 font-medium text-cyan-800"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Optional AI shortcut — fills the SAME control, never exceeds the allowlist. */}
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Ask AI</label>
      <div className="mb-1 flex gap-1.5">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") askAi();
          }}
          placeholder="e.g. put the image on the left"
          className="min-w-0 flex-1 rounded-md border border-gray-200 p-2 text-sm text-gray-900 outline-none focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={askAi}
          disabled={aiBusy || !instruction.trim()}
          className="shrink-0 rounded-md bg-cyan-700 px-2.5 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50"
        >
          {aiBusy ? "…" : "✦"}
        </button>
      </div>
      {aiError && <p className="mb-1 text-[11px] text-red-600">{aiError}</p>}

      <Actions onApply={() => onApply(value)} onClose={onClose} hint="AI fills the options above" />
    </>
  );
}

function IconEditor({
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
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Icon</label>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {ICON_KEYS.map((key) => {
          const Icon = iconFor(key);
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setValue(key)}
              title={key}
              aria-label={key}
              aria-pressed={selected}
              className={`flex aspect-square items-center justify-center rounded-md border ${
                selected
                  ? "border-cyan-600 bg-cyan-50 text-cyan-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
      <Actions onApply={() => onApply(value)} onClose={onClose} hint="Pick an icon" />
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
