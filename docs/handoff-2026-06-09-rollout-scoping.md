# Handoff — Experiment-AI-CMS — 2026-06-09 (rollout scoping session)

> **Companion to `docs/handoff-2026-06-09.md`, not a replacement.** That doc holds the richer
> current-state snapshot (editor architecture, gotchas, working agreements) — read it first.
> This doc captures only what *this* session added: the text-styling rollout was scoped + defined,
> concrete landing complications were surfaced, and the work was **parked** by the user.

## Session type: pickup + scoping — ZERO code changes

Working tree clean. No commits, no dev server started, no edits to app code. The only writes this
session are these docs (this handoff + a §4 edit to the in-place-editor checkpoint).

## Git-state correction

`docs/handoff-2026-06-09.md` says `origin/main = beaa882`, local HEAD `a5970bf` (1 ahead, unpushed).
**That is now stale.** Reality:

```
bbb9ea4  docs: handoff 2026-06-09 + in-place-editor checkpoint; mark multi-page §6 retired  ← HEAD, deployed
4d33275  feat(studio): draggable editor panel + color pickers as anchored flyouts            ← was "a5970bf" pre-rebase
9dddb5c  content(home): update 4 fields via Content Studio (#14)
```

The unpushed draggable-panel + color-flyout work **landed** (as `4d33275`), the docs were committed
on top (`bbb9ea4`), and `main` is pushed/deployed at `bbb9ea4`. Working tree is clean.

## The text-styling rollout — DEFINED and PARKED

**Likely-next task per the 06-09 handoff:** roll the per-block text-styling capability out from `/about`
to `/` (landing) and `/page-2`.

**Plain definition (this is "the rollout"):** Today on `/about`, an authed editor in `?edit=1` can set
any text block's **color / background / alignment** from the design-system palette; it previews live and
ships with the page. On `/` and `/page-2` editors can change the *words* but **cannot restyle** — the
control isn't wired there. The rollout turns that same control on for the other two pages. The styling
engine (`EditableText` + `TextStylesProvider` + `useTextStyle` + the flat `styles` map) already exists
and is proven; it's a wiring job, not a new feature. Per page, three additive changes:

1. **Schema** — add the optional `styles` map to `landingSchema` / `page2Schema` (identical to the one
   already on `aboutSchema` in `lib/content/schema.ts`).
2. **Provider** — wrap the page in `<TextStylesProvider page=… styles={styles}>` (see `app/about/page.tsx`).
3. **Blocks** — swap each `<Text data-content-path=…>` → `<EditableText path=…>`
   (`components/studio/EditableText.tsx`).

No new field type, no publish-path logic change beyond the additive schema field.

## ⚠️ Key new finding — landing is NOT a clean mirror of `/about`

`/about` was built animation-free as the styling playground, so its blocks are tidy block-level `<Text>`.
The landing is different and migrating it is **not** a mechanical find-and-replace:

- **~58 text spots across 8 files** in `components/landing/` (HeroSection, IntroSection, FeaturesSection,
  TourSection, VisionSection, RoadmapSection, FeedbackSection, Footer).
- **Three shapes mixed**, not just block-level Text:
  - block-level `<Text>` — these map cleanly to `<EditableText>`.
  - **inline `<span data-content-path>` inside one `<Text>`** — e.g. `intro.title.line1` / `intro.title.line2`
    in `components/landing/IntroSection.tsx`; `line2` carries a **gradient-clip text fill** (an editor
    color choice would fight it).
  - **`<SectionBadge data-content-path>`** — not a `<Text>` at all.
  - `EditableText` wraps the design-system `<Text>` specifically, so spans + badges don't drop in.
- **GSAP `SplitText`** runs in `IntroSection` (splits paragraphs into animated word-spans). Per-block
  **color/align** inherit down fine; per-block **background** on split text would look wrong.

`/page-2` (`app/page-2/page.tsx`), by contrast, is **clean**: ~15 plain text blocks, no animation — a
second `/about`. It's the obvious low-risk first target if the rollout resumes.

## Parked decision (user said "hold off")

Landing's non-Text editable spots (`SectionBadge` + inline `<span>`): **style only the block-level
`<Text>` blocks** (smallest blast radius, matches "text styling" literally; badges/spans stay
text-editable but not style-able) **vs generalize** `EditableText`/`useTextStyle` to apply to any
element (bigger lift, more review surface). Not decided.

## Next step

**Await user instruction.** The user explicitly parked the rollout. When it resumes, suggested skills:
- `superpowers:brainstorming` — if the rollout is treated as a feature decision (esp. the generalize question).
- `full-review` (Tier 3) with the fresh-eyes `peer-review` agent — the rollout touches the schema
  (`landingSchema` / `page2Schema`), which the house rules flag for full review.
- `superpowers:verification-before-completion` — browser-verify each page before claiming done
  (dev server port 3002; build is the gate; e2e `node tests/in-place-editor.e2e.mjs`).

## Read these (don't duplicate)
- `docs/handoff-2026-06-09.md` — primary current-state snapshot (gotchas, working agreements).
- `docs/in-place-editor_checkpoint.md` — authoritative editor architecture (§4 has the rollout TODO).
- `docs/multi-page-publish_checkpoint.md` — publish spine (untouched this session).
