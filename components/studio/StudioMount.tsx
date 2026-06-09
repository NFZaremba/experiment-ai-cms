"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { PAGE_LIST } from "@/lib/content/pages";

// The ONLY place the editor JS loads. ssr:false + dynamic import keeps the whole
// overlay (and its @dnd-kit/cloudinary/tiptap deps) out of the public bundle —
// anonymous visitors (authed=false) never reach this import.
const StudioOverlay = dynamic(
  () => import("./StudioOverlay").then((m) => m.StudioOverlay),
  { ssr: false }
);

/** Enter edit mode with a hard navigation. A reload (not a soft client nav) is
 *  required so pages recompute their edit-mode freeze at mount (e.g. the landing
 *  page's Lenis/GSAP gate is `useMemo(…, [])`). */
function enterEdit() {
  const u = new URL(window.location.href);
  u.searchParams.set("edit", "1");
  window.location.assign(u.toString());
}

/**
 * Mounted once at the body root (in app/layout.tsx). For an authed studio user on
 * a registered editable page it shows a floating ✦ pencil; clicking it enters
 * in-place edit mode (`?edit=1`), which swaps the pencil for the code-split
 * StudioOverlay. Renders nothing for anonymous visitors or unregistered routes.
 *
 * Auth is resolved client-side via GET /api/studio/me (the studio_auth cookie is
 * httpOnly, so the client can't read it directly). Doing the check here rather
 * than in the root layout keeps the public marketing pages statically generated /
 * CDN-cached even when STUDIO_AUTH_TOKEN is set — best for speed + SEO.
 */
export function StudioMount() {
  const pathname = usePathname();
  // Read `?edit=1` after mount (window isn't available during SSR) — matches the
  // useIsEditMode pattern and avoids a hydration mismatch.
  const [editing, setEditing] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setEditing(new URLSearchParams(window.location.search).get("edit") === "1");
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/me")
      .then((r) => (r.ok ? r.json() : { authed: false }))
      .then((d) => {
        if (!cancelled) setAuthed(Boolean(d?.authed));
      })
      .catch(() => {
        /* offline / not configured → stay unauthed (no pencil) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authed) return null;
  if (!PAGE_LIST.some((p) => p.route === pathname)) return null;

  if (editing) return <StudioOverlay />;

  return (
    <button
      data-studio-chrome
      type="button"
      onClick={enterEdit}
      aria-label="Edit this page"
      title="Edit this page"
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 2147482000 }}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-lg text-white shadow-lg transition-transform hover:scale-105 hover:bg-cyan-800 active:scale-95"
    >
      ✦
    </button>
  );
}
