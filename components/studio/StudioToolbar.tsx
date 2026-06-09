"use client";

import type { PublishResult } from "@/lib/studio/draft-store";

export type PreviewStatus = "pending" | "success" | "failure" | "unavailable" | null;

/**
 * The in-place editor's fixed top admin bar + status banners. Ported from the
 * former iframe shell's header/banners, minus the iframe-only bits (the page
 * switcher and the "Preview connected" handshake indicator). Marked
 * `data-studio-chrome` so the overlay's document click handler ignores clicks on
 * it. All state + handlers come from StudioOverlay as props.
 */
export function StudioToolbar({
  pageLabel,
  draftCount,
  publishing,
  merging,
  merged,
  error,
  notice,
  result,
  previewStatus,
  onPublish,
  onReset,
  onPublishForReal,
  onDone,
}: {
  pageLabel: string;
  draftCount: number;
  publishing: boolean;
  merging: boolean;
  merged: boolean;
  error: string | null;
  notice: string | null;
  result: PublishResult | null;
  previewStatus: PreviewStatus;
  onPublish: () => void;
  onReset: () => void;
  onPublishForReal: () => void;
  onDone: () => void;
}) {
  return (
    <div
      data-studio-chrome
      data-studio-toolbar
      style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 2147482000 }}
      className="flex flex-col"
    >
      {/* Toolbar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">Content Studio</span>
          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
            {pageLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {draftCount} unpublished {draftCount === 1 ? "edit" : "edits"}
          </span>
          <button
            onClick={onReset}
            disabled={draftCount === 0 && !result}
            className="rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={onPublish}
            disabled={draftCount === 0 || publishing}
            className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <button
            onClick={onDone}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Done
          </button>
        </div>
      </header>

      {/* Status banner */}
      {error && (
        <div className="shrink-0 bg-red-50 px-4 py-2 text-center text-xs text-red-700">{error}</div>
      )}
      {notice && (
        <div className="shrink-0 bg-slate-100 px-4 py-2 text-center text-xs text-slate-600">
          {notice}
        </div>
      )}
      {merged && (
        <div className="shrink-0 bg-emerald-50 px-4 py-2 text-center text-xs text-emerald-800">
          ✓ Published to production. The live site is rebuilding now.
        </div>
      )}
      {result && previewStatus !== "failure" && previewStatus !== "unavailable" && (
        <div className="flex shrink-0 items-center justify-center gap-3 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {previewStatus === "success" ? (
            <>
              <span>✓ Preview ready.</span>
              <a
                href={result.previewUrl ?? result.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                {result.previewUrl ? "Open deploy preview ↗" : "View pull request ↗"}
              </a>
              <button
                onClick={onPublishForReal}
                disabled={merging}
                className="rounded-md bg-emerald-700 px-2.5 py-1 font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                {merging ? "Publishing…" : "Publish for real"}
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Building deploy preview… (a new page’s first build can take a few minutes).
                “Publish for real” unlocks when it’s green.
              </span>
              {result.previewUrl && (
                <a
                  href={result.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  Open deploy preview ↗
                </a>
              )}
            </>
          )}
        </div>
      )}
      {result && previewStatus === "failure" && (
        <div className="flex shrink-0 items-center justify-center gap-3 bg-red-50 px-4 py-2 text-xs text-red-700">
          <span>✕ Preview build failed — don’t publish.</span>
          <a
            href={result.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            View logs on the PR ↗
          </a>
        </div>
      )}
      {result && previewStatus === "unavailable" && (
        <div className="flex shrink-0 items-center justify-center gap-3 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <span>Couldn’t confirm the preview status — open the PR to verify it built.</span>
          <a
            href={result.previewUrl ?? result.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            {result.previewUrl ? "Open deploy preview ↗" : "View pull request ↗"}
          </a>
          <button
            onClick={() => {
              if (window.confirm("Couldn’t confirm the preview built. Publish to production anyway?"))
                onPublishForReal();
            }}
            disabled={merging}
            className="rounded-md bg-emerald-700 px-2.5 py-1 font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {merging ? "Publishing…" : "Publish anyway"}
          </button>
        </div>
      )}
      {!error && !merged && !result && (
        <div className="shrink-0 bg-cyan-50 px-4 py-1.5 text-center text-xs text-cyan-800">
          Click any highlighted text in the page to edit it.
        </div>
      )}
    </div>
  );
}
