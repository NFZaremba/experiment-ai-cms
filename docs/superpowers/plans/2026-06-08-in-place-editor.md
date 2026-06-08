# Plan — In-place "admin-bar" editor (retire the iframe shell)

## Context

The Studio today is an iframe shell (`app/studio/page.tsx`): a `/studio` route loads the
target page in an `<iframe src="…?edit=1">` and talks to it over `postMessage`. That's the
*decoupled-CMS* pattern (Sanity/Storyblok) applied to an **integrated single Next app** — so the
iframe is ceremony (the app loads itself in a frame) and has caused real pain (stale frames, the
`key={currentPage}` remount, cross-frame Playwright fragility). It also doesn't scale in UX:
editing N pages means a `/studio` dropdown switcher.

The site is ~20 unique bespoke marketing pages. The right pattern for an integrated app is the
**admin-bar / in-place** model (WordPress, Ghost, Craft): visit any page; if you're an
authenticated studio user, a floating pencil appears bottom-right; clicking it turns *that page*
into the editor in place (same URL + `?edit=1`), with the editing chrome overlaid via a portal —
no iframe, no postMessage. This deletes the switcher-scaling problem, edits in real context, and
removes the whole cross-frame layer. It also fixes a latent bug: today the editor bundle ships to
anonymous visitors; the new model is server-gated + code-split so the public never downloads it.

**Decisions locked:** in-place editing as a **clean cutover** (retire the iframe shell +
postMessage); **reuse the existing studio auth** (single shared password / `studio_auth` cookie —
no new identity/roles); pencil shows only on **registered editable pages** (those in `PAGES`).

## How it works (target architecture)

```
ANY registered page (e.g. /about)            authed studio user
  app/layout.tsx (server) ── await isStudioAuthed() ──▶ <StudioMount authed/>
      └─ children render normally (pure data-content-path markup; NO per-page bridge)
      └─ <StudioMount authed>  (client, code-split):
            authed && registered-page && !edit → ✦ pencil (bottom-right) → set ?edit=1
            authed && ?edit=1 → dynamic import <StudioOverlay/>  (the only place editor JS loads)
                 ├─ document listeners: hover-outline / click→select / click-out→deselect
                 │     (reused DOM helpers; write edits straight to the draft store + DOM)
                 ├─ <FloatingChatPanel/>  (anchors to click point in page coords)
                 └─ <StudioToolbar/>  (page label · draft count · Publish · Reset · status · Done)
```

Anonymous visitors: `authed=false` → `StudioMount` renders nothing and the overlay chunk is never
fetched. Edit mode reuses the existing `?edit=1` signal, so the landing page's existing
Lenis/GSAP freeze (`isEdit` gate in `app/page.tsx`) already makes in-place editing animation-safe.

## What's reused (unchanged)
- Draft store (`lib/studio/draft-store.ts`), field types (`lib/studio/field-types.ts`),
  `useLayoutValue`/`useOrderedItems` (`lib/studio/use-edit-mode.ts`), `reorderById`/`get-set-path`.
- `FloatingChatPanel` editors (text/richtext/link/image/layout `SelectEditor`) + `Selection` type.
- `ReorderableList` (only its edit-record call changes — see below).
- All API routes: `publish`, `preview`, `status`, `merge`, `close`, `ai-layout` (same shapes).
- Auth: `lib/studio/auth.ts` `isStudioAuthed()`, `app/studio/layout.tsx` gate, `StudioLogin`.

## Files

**Create**
1. `lib/studio/edit-dom.ts` — extract the pure DOM helpers from `EditModeBridge`: `EDIT_STYLES`,
   `fieldTypeOf`, `readValue`, `writeValue`, `applyOverride` (incl. the `"order"` no-op case).
   No postMessage. Used by `StudioOverlay`.
2. `components/studio/StudioMount.tsx` — `"use client"`. Props `{ authed: boolean }`. Renders
   nothing if `!authed` or the current pathname isn't a registered page route. Else: the pencil
   (when not editing) that sets `?edit=1`, and a `next/dynamic({ ssr:false })` import of
   `StudioOverlay` when `?edit=1`. This is the code-split boundary.
3. `components/studio/StudioOverlay.tsx` — `"use client"`. The in-page editor: ports the shell's
   editor state + handlers (`selection`, `publishing/merging/merged/error/notice/previewStatus`,
   `result`, `draftCount`; `publish`, `publishForReal`, `resetDrafts`, the preview-reconcile +
   status-poll effects — all verbatim from `app/studio/page.tsx`, minus iframe/postMessage). Sets
   up the document listeners from `edit-dom.ts` calling local `setSelection`/`applyOverride`+`setEdit`.
   `currentPage = pageSlugForPathname(location.pathname)`. Renders `<FloatingChatPanel/>` (no
   `iframeRect`) + `<StudioToolbar/>`. Provides "Done" → remove `?edit=1`.
4. `components/studio/StudioToolbar.tsx` — slim fixed top admin bar (portal at body root, high
   z-index): page label, draft count, Publish/Reset, the status/preview banner states (ported
   from the shell's banners), Done.

**Edit**
5. `app/layout.tsx` — make the default export `async`; `const authed = await isStudioAuthed();`
   render `<StudioMount authed={authed} />` inside `<body>` after `{children}`.
6. `app/page.tsx`, `app/page-2/page.tsx`, `app/about/page.tsx` — remove the `EditModeBridge`
   import + `<EditModeBridge active={isEdit}/>` mount (editing is global now). Keep all
   `data-content-path` markup and the `isEdit` animation gating.
7. `components/studio/ReorderableList.tsx` — replace `recordBridgeEdit` with a new
   `recordEdit(page, path, value)` that calls `useDraftStore.getState().setEdit(...)` directly
   (in-place; no postMessage). (Put `recordEdit` in `lib/studio/edit-dom.ts` or `use-edit-mode.ts`.)
8. `components/studio/FloatingChatPanel.tsx` — drop the `iframeRect` prop; anchoring uses
   `selection.point` directly (the `(iframeRect?.left ?? 0)` terms become 0 — already identity).
9. `app/studio/page.tsx` — REPLACE the iframe shell with a thin authed landing: a directory of
   registered pages (`PAGE_LIST` → links to each `route`) + "open any page and click ✦ to edit."
   (`app/studio/layout.tsx` already shows `StudioLogin` when unauthed — unchanged. `/studio` stays
   the login + jump-off point.)

**Delete (cutover)**
10. `components/studio/EditModeBridge.tsx` (DOM helpers moved to `edit-dom.ts`; postMessage gone)
    and `lib/studio/messages.ts` (the cross-frame protocol). Remove their imports everywhere.

## Build order
1. Extract `lib/studio/edit-dom.ts` + `recordEdit`; point `ReorderableList` at `recordEdit`. Build.
2. `StudioOverlay` + `StudioToolbar` (port shell state/handlers, wire listeners). 
3. `StudioMount` (pencil + gate + dynamic overlay); mount in `app/layout.tsx` (async + authed).
4. Remove per-page `EditModeBridge` mounts; drop `FloatingChatPanel` `iframeRect`.
5. Replace `app/studio/page.tsx` with the directory landing; delete `EditModeBridge` + `messages.ts`.
6. Each step: `npm run build` + browser check on a real route.

## Verification (no more cross-frame — Playwright drives the real page directly)
- **In-place edit loop** (Playwright on `/about?edit=1`, dev auth or a `studio_auth` cookie):
  pencil appears → enter edit → click text → panel anchors at click → edit → live DOM + draft;
  layout chip → variant swap; **drag handle → reorder live**; Publish (stub) → payload carries the
  edits/order for the right page. This is the same coverage as before but single-window (no
  `frameLocator`/staleness).
- **Auth gate:** with `STUDIO_AUTH_TOKEN` set and NO cookie, `/about` shows no pencil and the page
  HTML/initial JS contains no overlay/@dnd-kit chunk (editor not shipped to anon). With a valid
  cookie, the pencil appears.
- **Published safety:** `/about` (no `?edit=1`) renders authored content, no handles, no toolbar.
- **Build/types:** `npm run build` (gate) + `tsc --noEmit` filtered to changed files; data-layer
  tests still green (`npx tsx --conditions react-server tests/*.test.ts`).
- Dev server on **port 3002**; restart after big changes.

## Out of scope / deferred
- User identity / roles / per-page permissions (still single shared password — `[[handoff]]`).
- A richer pages dashboard (v1 `/studio` is just login + a link list).
- Block-renderer / data-driven pages (the 20 pages stay bespoke React — confirmed).
- Keeping the iframe shell as a long-term fallback (we cut over; git history is the safety net).

## Commit/push
Per working agreement: commit only when asked; push only when asked (push = prod deploy).
