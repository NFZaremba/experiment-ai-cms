"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingChatPanel, type Selection } from "@/components/studio/FloatingChatPanel";
import { useDraftStore } from "@/lib/studio/draft-store";
import {
  isDeselectMessage,
  isSelectMessage,
  isStudioMessage,
  type ApplyEditMessage,
} from "@/lib/studio/messages";
import type { FieldType, FieldValue } from "@/lib/studio/field-types";
import { PAGE_LIST, type PageSlug } from "@/lib/content/pages";

const editRouteFor = (slug: PageSlug) =>
  `${PAGE_LIST.find((p) => p.slug === slug)?.route ?? "/"}?edit=1`;

export default function StudioPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [iframeRect, setIframeRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  // Which page the editor is currently editing. Drives the iframe + per-page drafts.
  const [currentPage, setCurrentPage] = useState<PageSlug>("home");
  const previewSrc = editRouteFor(currentPage);

  const clearPage = useDraftStore((s) => s.clearPage);
  const setEdit = useDraftStore((s) => s.setEdit);
  const draftCount = useDraftStore((s) => Object.keys(s.pages[currentPage]?.edits ?? {}).length);
  // Persisted per page so the preview link + "Publish for real" survive a refresh.
  const result = useDraftStore((s) => s.pages[currentPage]?.lastPublish ?? null);
  const setLastPublish = useDraftStore((s) => s.setLastPublish);

  const [publishing, setPublishing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<
    "pending" | "success" | "failure" | "unavailable" | null
  >(null);

  // Reconcile the current page's open preview from GitHub truth on load and on
  // every page switch: a fresh tab/browser discovers the existing preview
  // instead of spawning a duplicate, and a stale local pointer (PR merged/closed
  // elsewhere) gets cleared.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/studio/preview?page=${currentPage}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const store = useDraftStore.getState();
        const hasDrafts = Object.keys(store.pages[currentPage]?.edits ?? {}).length > 0;
        if (data.preview) {
          // Only surface it when there are no newer unpublished drafts (those
          // must be re-published to advance the preview first). Publish still
          // reuses the existing PR server-side regardless of this banner.
          if (!hasDrafts) store.setLastPublish(currentPage, data.preview);
        } else if (store.pages[currentPage]?.lastPublish) {
          store.setLastPublish(currentPage, null); // preview merged/closed elsewhere
        }
      } catch {
        // offline / not configured — leave local state as-is
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  // Auto-dismiss the transient "nothing new to publish" note.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!isStudioMessage(e.data)) return;
      if (e.data.source !== "studio-bridge") return;
      if (e.data.type === "ready") {
        setReady(true);
        return;
      }
      if (isDeselectMessage(e.data)) {
        setSelection(null);
        return;
      }
      if (isSelectMessage(e.data)) {
        setIframeRect(iframeRef.current?.getBoundingClientRect() ?? null);
        setSelection({
          path: e.data.path,
          rect: e.data.rect,
          point: e.data.point,
          fieldType: e.data.fieldType,
          currentValue: e.data.currentValue,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Close the panel when clicking outside it within the shell chrome. (Clicks
  // inside the iframe don't reach this document — those are handled by the
  // bridge's "deselect" message.)
  useEffect(() => {
    if (!selection) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-studio-panel]")) setSelection(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [selection]);

  // Poll the open PR's deploy-preview status so "Publish for real" only
  // unlocks once the preview build is green. Re-runs on mount if a publish
  // result was restored from localStorage.
  useEffect(() => {
    if (!result) {
      setPreviewStatus(null);
      return;
    }
    let cancelled = false;
    let tries = 0;
    let errors = 0;
    setPreviewStatus("pending");
    const poll = async () => {
      tries += 1;
      try {
        const shaParam = result.headSha ? `&sha=${result.headSha}` : "";
        const res = await fetch(`/api/studio/status?pr=${result.prNumber}${shaParam}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && (data.state === "success" || data.state === "failure")) {
          setPreviewStatus(data.state);
          return; // terminal — stop polling
        }
        if (!res.ok) {
          errors += 1;
          if (errors >= 3) {
            setPreviewStatus("unavailable"); // can't read status (e.g. token perms)
            return;
          }
        } else {
          setPreviewStatus("pending");
        }
      } catch {
        errors += 1;
        if (!cancelled && errors >= 3) {
          setPreviewStatus("unavailable");
          return;
        }
      }
      if (!cancelled && tries < 40) setTimeout(poll, 5000);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const applyEdit = useCallback(
    (path: string, newValue: FieldValue, fieldType: FieldType) => {
      const message: ApplyEditMessage = {
        source: "studio-shell",
        type: "apply",
        path,
        newValue,
        fieldType,
      };
      iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
      // The shell is the source of truth for drafts (it publishes), so record
      // here too under the current page — the iframe's bridge keeps its own copy
      // for reload-survival.
      setEdit(currentPage, path, newValue);
    },
    [setEdit, currentPage]
  );

  const switchPage = (slug: PageSlug) => {
    if (slug === currentPage) return;
    setSelection(null);
    setMerged(false);
    setError(null);
    setNotice(null);
    setReady(false); // the new page's bridge will re-announce "ready"
    setCurrentPage(slug);
  };

  const resetDrafts = () => {
    const open = useDraftStore.getState().pages[currentPage]?.lastPublish ?? null;
    const confirmed = window.confirm(
      open
        ? "Discard your unpublished edits and close the open preview (PR) for this page?"
        : "Discard your unpublished edits for this page?"
    );
    if (!confirmed) return;
    if (open) {
      // Best-effort cleanup so resetting doesn't leave an orphan PR/branch.
      void fetch("/api/studio/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prNumber: open.prNumber }),
      }).catch(() => {});
    }
    clearPage(currentPage); // clears this page's drafts + publish result
    setSelection(null);
    setMerged(false);
    setError(null);
    if (iframeRef.current) iframeRef.current.src = previewSrc;
  };

  const publish = async () => {
    setPublishing(true);
    setError(null);
    setNotice(null);
    setMerged(false);
    try {
      const res = await fetch("/api/studio/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page: currentPage,
          edits: useDraftStore.getState().pages[currentPage]?.edits ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      if (data.noop) {
        // Nothing changed vs. what's already live / in the open preview — no new
        // PR or preview was created. Keep showing the existing preview, if any.
        setNotice("Nothing new to publish — your changes are already in the preview.");
        if (data.prNumber) {
          setLastPublish(currentPage, {
            prNumber: data.prNumber,
            prUrl: data.prUrl,
            previewUrl: data.previewUrl ?? null,
            headSha: data.headSha ?? null,
          });
        }
        return;
      }
      setLastPublish(currentPage, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const publishForReal = async () => {
    if (!result) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prNumber: result.prNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.merged) throw new Error(data.error || "Merge failed");
      setMerged(true);
      clearPage(currentPage); // clears this page's drafts + publish result
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">Content Studio</span>
          <label className="sr-only" htmlFor="studio-page-switcher">
            Page to edit
          </label>
          <select
            id="studio-page-switcher"
            value={currentPage}
            onChange={(e) => switchPage(e.target.value as PageSlug)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-cyan-500"
          >
            {PAGE_LIST.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </select>
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              ready ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-gray-300"}`}
            />
            {ready ? "Preview connected" : "Connecting…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {draftCount} unpublished {draftCount === 1 ? "edit" : "edits"}
          </span>
          <button
            onClick={resetDrafts}
            disabled={draftCount === 0 && !result}
            className="rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={publish}
            disabled={draftCount === 0 || publishing}
            className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
          >
            {publishing ? "Publishing…" : "Publish"}
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
                onClick={publishForReal}
                disabled={merging}
                className="rounded-md bg-emerald-700 px-2.5 py-1 font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                {merging ? "Publishing…" : "Publish for real"}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Building deploy preview… (~1–2 min). “Publish for real” unlocks when it’s green.
            </span>
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
                publishForReal();
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

      {/* Preview iframe */}
      <div className="relative flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={previewSrc}
          title="Landing page preview"
          className="h-full w-full border-0 bg-white"
        />
      </div>

      {selection && (
        <FloatingChatPanel
          selection={selection}
          iframeRect={iframeRect}
          onApply={applyEdit}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
