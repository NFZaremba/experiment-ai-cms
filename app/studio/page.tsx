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

const PREVIEW_SRC = "/?edit=1";

export default function StudioPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [iframeRect, setIframeRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const clearDrafts = useDraftStore((s) => s.clear);
  const setEdit = useDraftStore((s) => s.setEdit);
  const draftCount = useDraftStore((s) => Object.keys(s.edits).length);
  // Persisted so the preview link + "Publish for real" survive a refresh.
  const result = useDraftStore((s) => s.lastPublish);
  const setLastPublish = useDraftStore((s) => s.setLastPublish);

  const [publishing, setPublishing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<
    "pending" | "success" | "failure" | null
  >(null);

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
    setPreviewStatus("pending");
    const poll = async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/studio/status?pr=${result.prNumber}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && (data.state === "success" || data.state === "failure")) {
          setPreviewStatus(data.state);
          return; // terminal — stop polling
        }
        setPreviewStatus("pending");
      } catch {
        /* transient — keep polling */
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
      // here too — the iframe's bridge keeps its own copy for reload-survival.
      setEdit(path, newValue);
    },
    [setEdit]
  );

  const resetDrafts = () => {
    clearDrafts(); // also clears the persisted publish result
    setSelection(null);
    setMerged(false);
    setError(null);
    if (iframeRef.current) iframeRef.current.src = PREVIEW_SRC;
  };

  const publish = async () => {
    setPublishing(true);
    setError(null);
    setMerged(false);
    try {
      const res = await fetch("/api/studio/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ edits: useDraftStore.getState().edits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setLastPublish(data);
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
      clearDrafts(); // clears drafts + the persisted publish result
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
      {merged && (
        <div className="shrink-0 bg-emerald-50 px-4 py-2 text-center text-xs text-emerald-800">
          ✓ Published to production. The live site is rebuilding now.
        </div>
      )}
      {result && previewStatus !== "failure" && (
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
      {!error && !merged && !result && (
        <div className="shrink-0 bg-cyan-50 px-4 py-1.5 text-center text-xs text-cyan-800">
          Click any highlighted text in the page to edit it.
        </div>
      )}

      {/* Preview iframe */}
      <div className="relative flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={PREVIEW_SRC}
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
