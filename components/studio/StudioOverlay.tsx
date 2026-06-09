"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { FloatingChatPanel, type Selection } from "@/components/studio/FloatingChatPanel";
import { StudioToolbar, type PreviewStatus } from "@/components/studio/StudioToolbar";
import { useDraftStore } from "@/lib/studio/draft-store";
import {
  EDIT_STYLES,
  STYLE_ID,
  applyOverride,
  fieldTypeOf,
  readValue,
} from "@/lib/studio/edit-dom";
import type { FieldType, FieldValue } from "@/lib/studio/field-types";
import { PAGES, pageSlugForPathname } from "@/lib/content/pages";

// Deploy-preview poll budget. Sized for a brand-new page's FIRST (cold) Netlify
// build — it installs deps and builds from scratch and can take several minutes,
// well past the old ~3 min window that left the banner stuck on "Building…".
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TRIES = 72; // ~6 minutes

/** Drop `?edit=1` from the URL with a hard navigation, restoring the page's
 *  normal (animated) render. A reload is required because pages compute their
 *  edit-mode freeze once at mount (e.g. the landing page's Lenis/GSAP gate). */
function exitEdit() {
  const u = new URL(window.location.href);
  u.searchParams.delete("edit");
  window.location.assign(u.toString());
}

/**
 * The in-place editor overlay. Mounted (code-split, ssr:false) by StudioMount
 * only when an authed user is on a registered page with `?edit=1`. Replaces the
 * former iframe shell + EditModeBridge: page content and editor chrome now share
 * one document, so it talks to the DOM and draft store directly — no postMessage.
 */
export function StudioOverlay() {
  // The page being edited is whatever route this overlay is mounted on. Constant
  // for the overlay's lifetime (enter/exit edit is a full navigation).
  const [currentPage] = useState(() => pageSlugForPathname(window.location.pathname));
  const pageLabel = PAGES[currentPage].label;

  const [selection, setSelection] = useState<Selection | null>(null);

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
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>(null);

  // Reconcile the current page's open preview from GitHub truth on load: a fresh
  // tab/browser discovers the existing preview instead of spawning a duplicate,
  // and a stale local pointer (PR merged/closed elsewhere) gets cleared.
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

  // Reserve the fixed toolbar's height on <body> so the page's top content isn't
  // occluded behind the bar (the iframe shell used to reserve this space in flow;
  // the admin-bar model must do it explicitly — same approach as WordPress). Edit
  // mode freezes the landing's GSAP/Lenis, so a static top offset won't fight the
  // animation math. Tracks banner-driven height changes via ResizeObserver.
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>("[data-studio-toolbar]");
    if (!bar) return;
    const prev = document.body.style.paddingTop;
    const apply = () => {
      document.body.style.paddingTop = `${bar.offsetHeight}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      document.body.style.paddingTop = prev;
    };
  }, []);

  // Auto-dismiss the transient "nothing new to publish" note.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Edit-mode DOM wiring: inject the hover/cursor styles, re-apply this page's
  // persisted draft edits to the DOM, and attach the hover-outline + click-to-
  // select listeners. Replaces EditModeBridge's iframe listeners — now in the
  // same document, so it MUST ignore clicks on the editor chrome (panel/toolbar/
  // pencil) or a panel-button click would deselect / get its onClick swallowed.
  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = EDIT_STYLES;
      document.head.appendChild(style);
    }

    // Re-apply this page's persisted draft edits to the DOM.
    const pageDraft = useDraftStore.getState().pages[currentPage];
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
      const target = e.target as HTMLElement | null;
      // Ignore clicks on the editor chrome (panel/toolbar/pencil) — let their own
      // handlers run, and don't deselect when interacting with the panel.
      if (target?.closest("[data-studio-chrome], [data-studio-panel]")) return;
      const el = target?.closest<HTMLElement>("[data-content-path]");
      if (!el) {
        setSelection(null); // clicked a non-editable area → close the panel
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      setSelection({
        path: el.getAttribute("data-content-path")!,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        point: { x: e.clientX, y: e.clientY },
        currentValue: readValue(el),
        fieldType: fieldTypeOf(el),
      });
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("click", onClick, true);
      hovered?.classList.remove("studio-hover");
    };
  }, [currentPage]);

  // Poll the open PR's deploy-preview status so "Publish for real" only unlocks
  // once the preview build is green. Re-runs on mount if a publish result was
  // restored from localStorage.
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
      if (!cancelled && tries < MAX_POLL_TRIES) {
        setTimeout(poll, POLL_INTERVAL_MS);
      } else if (!cancelled) {
        // Build outlived our polling window. Don't strand the editor on an
        // eternal spinner — the preview may well be ready by now (a new page's
        // first build is slow). Surface the deploy-preview link + a way forward.
        setPreviewStatus("unavailable");
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const applyEdit = useCallback(
    (path: string, newValue: FieldValue, _fieldType: FieldType) => {
      applyOverride(path, newValue); // live DOM update
      setEdit(currentPage, path, newValue); // queue for publish
    },
    [setEdit, currentPage]
  );

  const resetDrafts = async () => {
    const open = useDraftStore.getState().pages[currentPage]?.lastPublish ?? null;
    const confirmed = window.confirm(
      open
        ? "Discard your unpublished edits and close the open preview (PR) for this page?"
        : "Discard your unpublished edits for this page?"
    );
    if (!confirmed) return;
    clearPage(currentPage); // clears this page's drafts + publish result
    setSelection(null);
    setMerged(false);
    setError(null);
    if (open) {
      // Close the open PR/branch BEFORE reloading. Must be awaited: the reload
      // below tears down the page, which would cancel a fire-and-forget request
      // before it reaches the (remote) GitHub API and leave an orphan PR. Capped
      // by a timeout so a slow/hung close can't block the reset.
      await Promise.race([
        fetch("/api/studio/close", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prNumber: open.prNumber }),
        }).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
    // The DOM keeps the discarded values until reload; a hard exit/enter would
    // re-render from content. Reloading the current edit view restores authored
    // values without leaving edit mode.
    window.location.reload();
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
    <>
      <StudioToolbar
        pageLabel={pageLabel}
        draftCount={draftCount}
        publishing={publishing}
        merging={merging}
        merged={merged}
        error={error}
        notice={notice}
        result={result}
        previewStatus={previewStatus}
        onPublish={publish}
        onReset={resetDrafts}
        onPublishForReal={publishForReal}
        onDone={exitEdit}
      />
      {selection && (
        <FloatingChatPanel
          selection={selection}
          iframeRect={null}
          page={currentPage}
          onApply={applyEdit}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  );
}

export default StudioOverlay;
