# In-place editor — checkpoint

> Single source of truth for the Content Studio's **in-place editor** (the overlay, field types,
> EditableText, live preview, pickers). The **publish spine** it feeds is in
> `multi-page-publish_checkpoint.md`. Last updated 2026-06-09 (HEAD `bbb9ea4`, deployed). The
> draggable-panel/color-flyout work that was unpushed `a5970bf` has since landed (`4d33275`); §4's
> rollout TODO was sharpened by a scoping pass — see `docs/handoff-2026-06-09-rollout-scoping.md`.

## 1. Current state

Editors edit any *registered* page in place — no iframe. On a registered page an authed studio user sees
a floating ✦ pencil (bottom-right); clicking it hard-navigates to `?edit=1` and overlays the editor
(toolbar + floating panel) in the **same document** as the page. Fully working on `/`, `/page-2`, and
`/about`; per-block **text styling** is wired on `/about` only (rollout pending for the other two).

Editable field types: `text`, `richtext`, `link`, `image`, `layout` (constrained variant), `icon`
(curated set), `order` (drag-reorder), plus per-block **style** (color/background/alignment). All edits
preview **live** and publish through the per-page changeset.

Key code:
- `components/studio/StudioMount.tsx` — body-root mount: client auth (`GET /api/studio/me`) + pencil +
  the **only** code-split boundary (`dynamic(StudioOverlay, {ssr:false})`).
- `components/studio/StudioOverlay.tsx` — the editor: document listeners (hover/click w/ chrome-exclusion),
  selection + snapshot, `applyEdit`/`applyStyle`/`cancelEdit`, publish/preview/status (ported from the old
  shell), body-padding reserve for the toolbar.
- `components/studio/StudioToolbar.tsx` — fixed admin bar + all banner states + Done.
- `components/studio/FloatingChatPanel.tsx` — the editor panel: per-type editors (Text/Rich/Link/Image/
  Select/Icon), `StyleControls` + `SwatchTrigger`/`SwatchGrid` color flyouts, draggable header.
- `components/studio/EditableText.tsx` — universal text-block wrapper + `TextStylesProvider`.
- `lib/studio/edit-dom.ts` — DOM read/write helpers + `recordEdit`.
- `lib/studio/use-edit-mode.ts` — `useIsEditMode` / `useLayoutValue` / `useOrderedItems` / `useImageValue`
  / `useTextStyle`.
- `lib/content/icons.ts`, `lib/content/colors.ts` — curated icon + full color (122-token) registries.
- `tests/in-place-editor.e2e.mjs` — 39-check Playwright e2e (the regression net for all of the above).

## 2. How it works

```
ANY registered page ──ssr static──▶ <StudioMount/> (body root, ~0 KB)
  StudioMount: GET /api/studio/me → authed? + pathname registered? + ?edit=1?
     not editing → ✦ pencil  → location.assign(?edit=1)   (hard nav: re-engages page freezes)
     editing     → dynamic import <StudioOverlay/>          (the only place ~648 KB editor JS loads)
        ├─ document listeners: hover-outline, capture-click → select (preventDefault),
        │     click-out → deselect. Excludes [data-studio-chrome],[data-studio-panel].
        ├─ <FloatingChatPanel/> — anchored at the click point; draggable by header
        └─ <StudioToolbar/> — page label · draft count · Publish/Reset/Done · banners
```
- **Edits are live.** Each editor change calls `applyEdit`/`applyStyle` immediately → DOM (`applyOverride`)
  + draft store (Zustand, persisted to localStorage). Hook-driven types (layout/icon/style/order)
  re-render from the store; text/image also mutate the DOM directly. Panel primary button is **Done**
  (keep); **Cancel/Esc** reverts via a snapshot taken on open (`editSnapshot` + `removeEdit`).
- **Styling** is stored in a flat per-page `styles` map keyed by content-path, written through a
  `style::<path>` draft-key prefix that the changeset routes into `doc.styles[path]`. Applied via inline
  `var(--color-<token>)`. `EditableText` reads it through `useTextStyle` (draft in edit mode, else the
  published `styles` map via `TextStylesProvider`).
- **Publish** is unchanged spine: `style::`/reorder/leaf edits → `buildContentChangeSet` → Zod-validated →
  per-page PR. (See multi-page-publish checkpoint.)

## 3. Key decisions (the *why*)

- **In-place, not iframe.** Integrated app → admin-bar pattern (WordPress/Ghost), not headless-CMS iframe
  (Sanity/Storyblok). Removed stale-frame/remount/cross-frame-test pain. Rejected: keeping the iframe.
- **Client auth via `/api/studio/me`, not the root layout.** Reading `cookies()` in the layout taints
  *every* route to dynamic rendering once `STUDIO_AUTH_TOKEN` is set (verified) — bad for marketing CWV/SEO.
  The `me` route keeps pages static (○). The client gate is visibility-only; mutating routes 401 server-side.
- **Hard-nav to enter/exit edit** so per-page `useMemo([])` animation freezes (landing Lenis/GSAP) engage.
- **Styling = constrained design-system tokens applied via CSS vars, NOT classes.** Tailwind v4 only builds
  classes literally in source → an editor-chosen class wouldn't render. CSS vars always resolve and keep
  content as *data* (Zod enum). **No free-form classes** (rejected: JIT + data-not-code safety).
- **Flat `styles` map** (not string→object migration of every text field) → low blast radius.
- **Color pickers as anchored flyouts** (submenu) not inline grids → keeps the panel short with 122 tokens.
- **Live preview with snapshot-restore Cancel** (not commit-on-Apply) — the per-change persist is sub-ms
  for this data size; debounce deferred until a much larger doc warrants it.

## 4. What's next / TODO
- **Roll text styling to `/` + `/page-2`** (scoped 2026-06-09, then parked by the user — full detail in
  `docs/handoff-2026-06-09-rollout-scoping.md`): per page, add the optional `styles` map to
  `landingSchema`/`page2Schema`, wrap in `<TextStylesProvider>`, swap `<Text data-content-path>` →
  `<EditableText path>`. /about is the template. **But the two targets differ in difficulty:**
  - **`/page-2` — clean, low-risk first target.** ~15 plain block-level `<Text>` blocks, no animation; a
    second /about. Do this one first to prove the rollout.
  - **`/` (landing) — NOT a clean mirror.** ~58 text spots across 8 `components/landing/` files, mixing
    block `<Text>` (map cleanly), inline `<span data-content-path>` (e.g. `intro.title.line1/line2`; line2
    has a gradient-clip fill), and `<SectionBadge data-content-path>`. `EditableText` wraps `<Text>` only,
    so spans + badges don't drop in. `IntroSection` runs GSAP `SplitText` — per-block color/align inherit
    fine, per-block *background* on split text looks wrong. **Open decision:** style block-level `<Text>`
    only vs generalize `EditableText`/`useTextStyle` to any element.
  - Schema touch ⇒ run `full-review` (Tier 3) with the fresh-eyes peer agent when this resumes.

## 5. Deferred / out of scope
- **Two alignment systems overlap** on hero/sum (container `textAlign` *layout* field + per-block `align`);
  both work, per-block wins; mild editor confusion. Reconcile if it bites.
- **Unconstrained `styles` map keys** — orphan style entries could accumulate in published JSON (harmless,
  ignored on render; publish is auth-gated).
- **`/api/studio/me` fires per pageview** for all visitors (tiny). Defer behind first-interaction or a
  middleware presence-cookie only if it shows in Netlify function metrics.
- **Per-character richtext color** (block-level only; Tiptap color mark + sanitizer changes = separate).
- **Text-typing persist debounce** — not needed at current content size.
- **Landing `/?edit=1` below-fold sections report `top≈0`** (frozen-GSAP stacking, pre-existing; hero fine).

## 6. Related
- `docs/multi-page-publish_checkpoint.md` (publish spine; §6 shell → in-place)
- `docs/handoff-2026-06-09.md` (current handoff), `docs/handoff-2026-06-08.md` (session narrative)
- `docs/superpowers/plans/2026-06-08-in-place-editor.md` (original approved plan)
- Commits `5c003aa` · `edf9f4e` · `beaa882` · `a5970bf`
