# Design — Drag-and-drop reordering of collection items (Content Studio)

**Date:** 2026-06-08
**Status:** Approved (brainstorm), pending implementation plan
**Scope target:** the `/about` page's collections, with a generic primitive that any registered collection can opt into later.

## Context & problem

The Content Studio lets non-technical editors change text/richtext/links/images/layout
and ship via a per-page PR + Netlify preview. The natural next editor capability is
**reordering items within a collection** (e.g. the leadership grid, the "solutions" cards) —
direct manipulation editors reach for, and a better fit for this product than expanding the AI.

Reordering an array stays inside the safety model (it's still schema-valid data, never code).
The hard part is the **edit model**, not the drag UI: collection items are addressed by
**positional index** today (`team.members.2.name`), so a reorder changes what every index
means and would corrupt any pending per-item text edit.

Decisions locked during brainstorming:

| Question | Decision |
|---|---|
| Scope | **About-first**, but the primitive is built **generic** (any collection opts in) |
| Reorder + per-item text edits in one unpublished pass | **Must coexist seamlessly** → stable IDs |
| AI-assisted reorder (v1) | **No** — manual drag only; AI reorder is a clean follow-up on the same primitive |
| Drag affordance | **Edit-mode drag handle** (keyboard-accessible); card text stays click-to-edit |

## Goals / non-goals

**Goals**
- Drag-to-reorder items in a collection, edit-mode only, via a drag handle; keyboard-accessible.
- Reorder is live-reactive (no reload) and persists through the existing draft → PR → Netlify flow.
- Reorder and per-item text edits in the same unpublished batch both publish correctly, in any order.
- Generic: a collection opts in with a small wrapper; verified on About's `solutions.items` + `team.members`.

**Non-goals (v1)**
- Add / remove / duplicate items (so no ID generation needed — we assign stable IDs to existing content).
- AI-assisted reorder ("alphabetize", "put X first").
- Reordering non-collection structures, cross-collection moves, or nesting/tiered lists.
- Per-page-vocab-style concerns — unrelated.

## Chosen approach — ID-addressed collections

Give each reorderable item a stable, non-numeric `id`. Address that collection's leaf edits
**by id** instead of index, and represent reorder as an **id ordering**. Text edits (id-keyed)
and reorder (id permutation) become orthogonal, so publish is order-independent.

Rejected alternatives:
- **Index paths + sequenced apply** — keep index paths, apply text edits then reorder. The
  "seamless" guarantee is fragile (@dnd-kit reorders real DOM nodes, fighting stable indices);
  rejected because seamless coexistence was a hard requirement.
- **Whole-array snapshot edits** — reorder and every text edit rewrite the full collection array.
  Discards the granular `path → value` model the studio is built on and bloats the diff; rejected.

## Design

### 1. Data model & the order primitive
- `lib/studio/field-types.ts`: add `"order"` to `FieldType`; widen `FieldValue` with
  `OrderValue = string[]` (item ids in display order); add `isOrderValue = Array.isArray`.
- Content (`lib/content/about.json`): each reorderable item gains a stable **non-numeric** `id`.
  - `solutions.items` → `talent | business-case | knowledge | credentials`
  - `team.members` → name slugs (`rachel-hodgdon`, `prateek-khanna`, …)
- Schemas (`lib/content/schema.ts`): add `id: z.string()` to those item shapes.
- The **array order in the JSON remains canonical** (it is the published order). A reorder edit
  permutes that array on publish — there is no separate "order" field stored in content.

### 2. ID-addressed paths
- `lib/content/get-set-path.ts`: when descending into an array, a **numeric** segment is an index
  (unchanged); a **non-numeric** segment matches the element whose `id` equals it. One small
  `resolveIndex(arr, key)` helper, shared by `getByPath` and `setByPath`. `FORBIDDEN_KEYS` stays.
- Reorderable collections emit **id-based leaf paths** (`team.members.rachel-hodgdon.name`).
  Non-reorderable arrays (`intro.paragraphs`, `stats.items`) keep numeric paths — additive change.
- Invariant: reorderable item ids are **non-numeric** (so they're unambiguous vs indices),
  enforced by a dev-time check.

### 3. Reorder UX + data flow
- `components/studio/ReorderableList.tsx` — reusable, **edit-mode-only**, dynamic-imported
  **@dnd-kit** (`SortableContext` + `useSortable` + `PointerSensor` + `KeyboardSensor`). Renders a
  **drag handle (⠿)** per item. In published mode it renders plain children (no dnd, no handle).
- `lib/studio/use-edit-mode.ts` — add `useOrderedItems(page, path, items)` (mirrors `useLayoutValue`):
  edit mode + a draft order → items sorted by that id list (unknown ids dropped, missing appended);
  otherwise items unchanged.
- On drag end → compute the new id order →
  1. `useDraftStore.getState().setEdit(slug, path, newOrder)` on the iframe store → live re-render.
  2. Post a new **bridge→shell `edit` message** (`lib/studio/messages.ts`) so the shell records the
     edit for publish — mirrors the existing select/ready/deselect bridge→shell channel; the shell
     handler calls `setEdit(currentPage, path, newOrder)`.

### 4. Publish / changeset
- `lib/studio/changeset.ts` `buildContentChangeSet`:
  - An `order`-typed edit at `path` → permute the doc's array at `path` to match the id list
    (keep items; unknown ids ignored; any missing appended in original relative order).
  - Leaf id-paths → `setByPath` with the new id resolution.
  - Order + leaf edits are both id-keyed → application order is irrelevant.
  - Zod `page.schema.parse(doc)` validates (ids present, item shapes intact).
- Order edits ride the existing generic publish spine (`{ [path]: string[] }` serializes fine) —
  no `publish`/`preview`/`github` route or branch changes.
- Field-type detection on the server: an order edit is recognized by its value being a string[]
  (`isOrderValue`) at a collection path, handled before the leaf `setByPath` loop.

### 5. Wiring About + testing
- Wire `components/about/SolutionsGrid.tsx` and `LeadershipTeam.tsx`: add ids in content, render via
  `ReorderableList` + `useOrderedItems`, emit id-based `data-content-path`. **Composes with the
  existing column-count layout variant** (orthogonal — reorder permutes; layout sets columns).
- Add **@dnd-kit** dependency; dynamic-import the reorder layer so it stays out of the published
  page's critical path.
- **Testing**
  - Data layer (node one-off): id-path `get/setByPath` resolution; changeset order permutation;
    **coexistence** — a reorder + a leaf edit by id, both correct regardless of application order.
  - Playwright (cross-frame pattern; keyboard sensor for deterministic drag): drag reorders live;
    publish payload carries the order array; a text edit + reorder in one pass both land.
  - `npm run build` + `tsc --noEmit` (filtered to changed files).

## Risks & pre-mortem
- **Bundle weight** of @dnd-kit in the rendered page → mitigated by edit-mode-only dynamic import.
- **Numeric-looking ids** would collide with index resolution → forbidden by convention + dev check.
- **@dnd-kit inside the iframe + Playwright** cross-frame staleness → drive reorder via the keyboard
  sensor for determinism (the established workaround for iframe handle staleness).
- **Mixed id/index paths** could confuse future readers → documented; resolution is additive and
  numeric vs non-numeric is unambiguous.
- **Scope creep toward a page-builder** → explicitly bounded to reorder-within-a-fixed-collection;
  add/remove and tiered lists are out.

## Affected files (for the plan)
- Edit: `lib/studio/field-types.ts`, `lib/content/get-set-path.ts`, `lib/content/schema.ts`,
  `lib/content/about.json`, `lib/studio/messages.ts`, `components/studio/EditModeBridge.tsx`,
  `app/studio/page.tsx` (shell edit handler), `lib/studio/changeset.ts`,
  `lib/studio/use-edit-mode.ts`, `components/about/SolutionsGrid.tsx`, `LeadershipTeam.tsx`,
  `package.json` (@dnd-kit).
- Create: `components/studio/ReorderableList.tsx`.

## Out of scope / deferred
- AI-assisted reorder (same `order` primitive; later increment).
- Add / remove / duplicate items (needs id generation + add/remove UI).
- Extending reorder to page-2 `cards.items` and other collections (generic primitive makes this a
  small opt-in once About proves it).
