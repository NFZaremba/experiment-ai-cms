# Drag-and-drop Collection Reordering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let editors drag-reorder items in a collection (About's solutions cards + leadership grid) in edit mode, persisting through the existing draft → per-page-PR → Netlify flow, with reorder and per-item text edits coexisting seamlessly.

**Architecture:** ID-addressed collections. Each reorderable item gets a stable non-numeric `id`; leaf edits are addressed by id (`team.members.rachel-hodgdon.name`) so they're position-independent, and reorder is a new `"order"` edit primitive (an id `string[]`) that permutes the array on publish. Drag UI is an edit-mode-only, dynamically-imported @dnd-kit list with a keyboard-accessible drag handle. The full design is in `docs/superpowers/specs/2026-06-08-drag-reorder-collections-design.md`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Zustand draft store, Zod schemas, @dnd-kit (new), @syscore/ui-library. Tests: `tsx` one-off scripts with `node:assert` for pure/data-layer logic; Playwright (imported by absolute path from the sibling beta repo) for the cross-frame UI flow.

**Conventions for this plan**
- Dev server runs on **port 3002** (`npm run dev`); restart after big changes (HMR goes stale).
- `npm run build` is the real gate; `tsc --noEmit` has pre-existing `@syscore`/`YT` noise — filter to changed files.
- Commit after each task. Do **not** push (push deploys prod; user pushes).
- Data-layer test files live in `tests/` and run with `npx tsx tests/<file>.test.ts`. The test files import the module under test by **relative** path; `@/` aliases that appear *transitively* (inside `changeset.ts`, `pages.ts`, etc.) are resolved by tsx v4 from the project `tsconfig.json` `paths`. If any test errors on an unresolved `@/`, run it as `npx tsx --tsconfig ./tsconfig.json tests/<file>.test.ts`.

---

### Task 1: Add dependencies (@dnd-kit + tsx test runner)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install @dnd-kit/core@^6 @dnd-kit/sortable@^8 @dnd-kit/utilities@^3
npm install -D tsx@^4
```
Expected: installs succeed; `package.json` gains the three `@dnd-kit/*` deps and `tsx` under devDependencies.

- [ ] **Step 2: Smoke-check tsx runs TS with assert**

Run:
```bash
mkdir -p tests && printf 'import assert from "node:assert";\nassert.equal(1+1,2);\nconsole.log("tsx ok");\n' > tests/_smoke.test.ts && npx tsx tests/_smoke.test.ts && rm tests/_smoke.test.ts
```
Expected: prints `tsx ok` and exits 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(studio): add @dnd-kit + tsx for reorder feature

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `order` field type + `isOrderValue`

**Files:**
- Modify: `lib/studio/field-types.ts`
- Test: `tests/field-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/field-types.test.ts`:
```ts
import assert from "node:assert";
import { isOrderValue, isLinkValue, isImageValue } from "../lib/studio/field-types";

assert.equal(isOrderValue(["a", "b"]), true);
assert.equal(isOrderValue([]), true);
assert.equal(isOrderValue("a"), false);
assert.equal(isOrderValue({ src: "x", alt: "" }), false);
// an array must not be mistaken for a link/image value
assert.equal(isLinkValue(["a"] as never), false);
assert.equal(isImageValue(["a"] as never), false);
console.log("field-types ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/field-types.test.ts`
Expected: FAIL — `isOrderValue` is not exported.

- [ ] **Step 3: Implement**

In `lib/studio/field-types.ts`, change the `FieldType` union, widen `FieldValue`, and add the guard:
```ts
export type FieldType = "text" | "richtext" | "link" | "image" | "layout" | "order";

export type LinkValue = { label: string; href: string; newTab: boolean };
export type ImageValue = { src: string; alt: string };
/** A reorder: the collection's item ids in display order. */
export type OrderValue = string[];

/** A field's value, discriminated by its FieldType at the call site. */
export type FieldValue = string | LinkValue | ImageValue | OrderValue;

export function isLinkValue(v: FieldValue): v is LinkValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "href" in v && "label" in v;
}

export function isImageValue(v: FieldValue): v is ImageValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "src" in v;
}

export function isOrderValue(v: FieldValue): v is OrderValue {
  return Array.isArray(v);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/field-types.test.ts`
Expected: prints `field-types ok`, exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/studio/field-types.ts tests/field-types.test.ts
git commit -m "feat(studio): add 'order' field type + isOrderValue guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `reorderById` shared utility

**Files:**
- Create: `lib/studio/order.ts`
- Test: `tests/order.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/order.test.ts`:
```ts
import assert from "node:assert";
import { reorderById } from "../lib/studio/order";

const items = [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }];

// full permutation
assert.deepEqual(reorderById(items, ["c", "a", "b"]).map((x) => x.id), ["c", "a", "b"]);
// ids not named in order are appended in original relative order
assert.deepEqual(reorderById(items, ["b"]).map((x) => x.id), ["b", "a", "c"]);
// unknown ids in order are ignored
assert.deepEqual(reorderById(items, ["zzz", "c"]).map((x) => x.id), ["c", "a", "b"]);
// empty order → unchanged
assert.deepEqual(reorderById(items, []).map((x) => x.id), ["a", "b", "c"]);
console.log("order ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/order.test.ts`
Expected: FAIL — cannot find module `../lib/studio/order`.

- [ ] **Step 3: Implement**

Create `lib/studio/order.ts`:
```ts
/**
 * Reorder a collection of `{ id }` items to match an id list. Ids in `order`
 * that don't exist are skipped; items whose id isn't named in `order` are
 * appended in their original relative order. Pure + dependency-free so it's
 * shared by the live hook (useOrderedItems) and the publish changeset.
 */
export function reorderById<T extends { id: string }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const out: T[] = [];
  for (const id of order) {
    const it = byId.get(id);
    if (it) out.push(it);
  }
  for (const it of items) {
    if (!order.includes(it.id)) out.push(it);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/order.test.ts`
Expected: prints `order ok`, exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/studio/order.ts tests/order.test.ts
git commit -m "feat(studio): add reorderById collection utility

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ID-addressed path resolution

**Files:**
- Modify: `lib/content/get-set-path.ts`
- Test: `tests/get-set-path.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/get-set-path.test.ts`:
```ts
import assert from "node:assert";
import { getByPath, setByPath } from "../lib/content/get-set-path";

const doc = { team: { members: [
  { id: "rachel", name: "Rachel" },
  { id: "prateek", name: "Prateek" },
] } };

// read by id segment
assert.equal(getByPath(doc, "team.members.prateek.name"), "Prateek");
// read by numeric index still works
assert.equal(getByPath(doc, "team.members.0.name"), "Rachel");
// missing id → undefined
assert.equal(getByPath(doc, "team.members.nope.name"), undefined);

// write by id segment, immutably, without disturbing order
const next = setByPath(doc, "team.members.prateek.name", "Prateek K.");
assert.equal(getByPath(next, "team.members.prateek.name"), "Prateek K.");
assert.equal(getByPath(doc, "team.members.prateek.name"), "Prateek"); // original untouched
assert.equal(getByPath(next, "team.members.0.id"), "rachel"); // order preserved

// writing to a missing id throws (no silent index -1 write)
assert.throws(() => setByPath(doc, "team.members.ghost.name", "x"));
console.log("get-set-path ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/get-set-path.test.ts`
Expected: FAIL — id segment resolves to `undefined` / writes incorrectly.

- [ ] **Step 3: Implement**

Replace the body of `lib/content/get-set-path.ts` with (keeps the doc comment + `FORBIDDEN_KEYS`):
```ts
type AnyRecord = Record<string, unknown>;

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isDigits = (s: string) => /^\d+$/.test(s);

/**
 * Resolve a path segment to an array index. Numeric segment → that index.
 * Non-numeric segment → the index of the element whose `id` equals it
 * (reorder-stable addressing), or -1 if none.
 */
function resolveIndex(arr: unknown[], key: string): number {
  if (isDigits(key)) return Number(key);
  return arr.findIndex(
    (el) => el != null && typeof el === "object" && (el as AnyRecord).id === key
  );
}

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) {
      const i = resolveIndex(acc, key);
      return i < 0 ? undefined : acc[i];
    }
    return (acc as AnyRecord)[key];
  }, obj);
}

export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  if (keys.some((k) => FORBIDDEN_KEYS.has(k))) {
    throw new Error(`Refusing to write unsafe path: ${path}`);
  }

  function helper(node: unknown, idx: number): unknown {
    const key = keys[idx];
    const isArray = Array.isArray(node);
    const clone: AnyRecord | unknown[] = isArray
      ? [...(node as unknown[])]
      : { ...(node as AnyRecord) };
    const accessor = isArray ? resolveIndex(node as unknown[], key) : key;
    if (isArray && (accessor as number) < 0) {
      throw new Error(`No array item matches segment "${key}" in path: ${path}`);
    }

    if (idx === keys.length - 1) {
      (clone as AnyRecord)[accessor as string] = value;
    } else {
      const child = (node as AnyRecord)[accessor as string];
      (clone as AnyRecord)[accessor as string] = helper(child, idx + 1);
    }
    return clone;
  }

  return helper(obj, 0) as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/get-set-path.test.ts`
Expected: prints `get-set-path ok`, exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/content/get-set-path.ts tests/get-set-path.test.ts
git commit -m "feat(content): resolve array path segments by item id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Stable ids in About schema + content

**Files:**
- Modify: `lib/content/schema.ts`
- Modify: `lib/content/about.json`
- Test: `tests/about-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/about-schema.test.ts`:
```ts
import assert from "node:assert";
import { aboutSchema } from "../lib/content/schema";
import aboutJson from "../lib/content/about.json";

const doc = aboutSchema.parse(aboutJson);
// every reorderable item has a non-numeric id
for (const it of doc.solutions.items) assert.match(it.id, /^[a-z][a-z0-9-]*$/);
for (const m of doc.team.members) assert.match(m.id, /^[a-z][a-z0-9-]*$/);
// ids are unique within each collection
const sIds = doc.solutions.items.map((i) => i.id);
const tIds = doc.team.members.map((m) => m.id);
assert.equal(new Set(sIds).size, sIds.length);
assert.equal(new Set(tIds).size, tIds.length);
console.log("about-schema ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/about-schema.test.ts`
Expected: FAIL — `id` is missing on items / not in schema.

- [ ] **Step 3a: Add `id` to the schemas**

In `lib/content/schema.ts`, inside `aboutSchema`, add `id: z.string()` to the two item shapes:
```ts
  solutions: z.object({
    heading: z.string(),
    columns: z.enum(["four", "three", "two"]).default("four"),
    items: z.array(
      z.object({ id: z.string(), icon: z.string(), title: z.string(), body: z.string() })
    ),
  }),
```
```ts
  team: z.object({
    heading: z.string(),
    cta: z.string(),
    columns: z.enum(["four", "three", "two"]).default("four"),
    members: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
  }),
```

- [ ] **Step 3b: Add ids to the content**

In `lib/content/about.json`, give every `solutions.items[]` an `id` (`"talent"`, `"business-case"`, `"knowledge"`, `"credentials"`) and every `team.members[]` an `id` (name slug). Example for the first of each:
```json
"items": [
  { "id": "talent", "icon": "magnet", "title": "Attracting top talent", "body": "Attracting top talent, raising productivity, cultivating long-term resilience and improving business performance." }
]
```
```json
"members": [
  { "id": "rachel-hodgdon", "name": "Rachel Hodgdon", "role": "President & CEO, IWBI" }
]
```
Slugs for the remaining members: `prateek-khanna`, `judith-webb`, `jessica-cooper`, `jason-hartke`, `xue-ya`, `lindsay-jacobs`, `jodie-pimentel`, `paul-scialla`, `rick-fedrizzi`, `kimberly-lewis-inkumsah`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/about-schema.test.ts`
Expected: prints `about-schema ok`, exits 0.

- [ ] **Step 5: Verify the build still parses the doc**

Run: `npm run build`
Expected: build succeeds; `/about` listed.

- [ ] **Step 6: Commit**

```bash
git add lib/content/schema.ts lib/content/about.json tests/about-schema.test.ts
git commit -m "feat(about): add stable ids to solutions + team items

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Changeset handles `order` edits + id-leaf coexistence

**Files:**
- Modify: `lib/studio/changeset.ts`
- Test: `tests/changeset-reorder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/changeset-reorder.test.ts`:
```ts
import assert from "node:assert";
import { buildContentChangeSet } from "../lib/studio/changeset";

function parse(cs: { files: { newContents: string }[] }) {
  return JSON.parse(cs.files[0].newContents);
}

// reorder alone permutes the array
const a = parse(buildContentChangeSet("about", { "team.members": ["jessica-cooper", "rachel-hodgdon"] }));
assert.equal(a.team.members[0].id, "jessica-cooper");
assert.equal(a.team.members[1].id, "rachel-hodgdon");
assert.equal(a.team.members.length, 11); // unnamed members appended

// reorder + id-keyed text edit coexist, regardless of key order
const edits1 = {
  "team.members": ["jessica-cooper", "rachel-hodgdon"],
  "team.members.rachel-hodgdon.name": "Rachel H.",
};
const b = parse(buildContentChangeSet("about", edits1));
assert.equal(b.team.members[0].id, "jessica-cooper");
const rachelB = b.team.members.find((m: { id: string }) => m.id === "rachel-hodgdon");
assert.equal(rachelB.name, "Rachel H.");

// same edits, reversed insertion order → identical result
const edits2 = {
  "team.members.rachel-hodgdon.name": "Rachel H.",
  "team.members": ["jessica-cooper", "rachel-hodgdon"],
};
const c = parse(buildContentChangeSet("about", edits2));
assert.deepEqual(c.team.members.map((m: { id: string }) => m.id), b.team.members.map((m: { id: string }) => m.id));
assert.equal(c.team.members.find((m: { id: string }) => m.id === "rachel-hodgdon").name, "Rachel H.");
console.log("changeset-reorder ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/changeset-reorder.test.ts`
Expected: FAIL — order edit is written as a raw array via `setByPath` (corrupts `team.members`), so assertions fail.

- [ ] **Step 3: Implement**

In `lib/studio/changeset.ts`, import the helpers and special-case order edits in the apply loop. The file **already imports `setByPath`** from `./get-set-path` — extend that existing import to also pull `getByPath` (don't add a second import line, which would be a duplicate-symbol error), and add two new imports:
```ts
// extend the EXISTING get-set-path import to include getByPath
// (get-set-path is in lib/content; changeset is in lib/studio):
import { getByPath, setByPath } from "@/lib/content/get-set-path";
// new (same dir as changeset):
import { isOrderValue } from "./field-types";
import { reorderById } from "./order";
```
(Match the existing import's path style for get-set-path — keep whatever alias/relative form the file already uses for `setByPath`, just add `getByPath` to it.)
Replace the edit-application loop in `buildContentChangeSet` with:
```ts
  for (const [path, value] of Object.entries(edits)) {
    // Reorder: value is an id list → permute the array at `path` (id-keyed, so
    // it composes with leaf edits regardless of application order).
    if (isOrderValue(value)) {
      const arr = getByPath(doc, path);
      if (!Array.isArray(arr)) {
        throw new Error(`Reorder target is not an array: ${path}`);
      }
      doc = setByPath(doc, path, reorderById(arr as { id: string }[], value));
      continue;
    }
    // Server-side defense: HTML-sanitize rich-text values regardless of how the
    // edit was submitted (the client editor sanitizes too, but can be bypassed).
    const safe =
      isRichtextPath(path) && typeof value === "string" ? sanitizeHtmlServer(value) : value;
    doc = setByPath(doc, path, safe);
  }
```
(Leave the existing `getByPath` import if one already exists — dedupe imports. If `setByPath` was imported from a local relative path, keep that import and only add the missing ones.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/changeset-reorder.test.ts`
Expected: prints `changeset-reorder ok`, exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/studio/changeset.ts tests/changeset-reorder.test.ts
git commit -m "feat(studio): apply 'order' edits as id-keyed array permutation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `useOrderedItems` live hook

**Files:**
- Modify: `lib/studio/use-edit-mode.ts`

- [ ] **Step 1: Implement (no unit test — covered by `reorderById` test + Task 11 Playwright)**

Append to `lib/studio/use-edit-mode.ts`:
```ts
import { reorderById } from "./order";

/**
 * The live display order of a collection. In edit mode, if a reorder draft
 * exists for `path` (an id list), returns the items in that order; otherwise the
 * items as-authored. Gated to edit mode so a stale localStorage draft can never
 * reorder the published site.
 */
export function useOrderedItems<T extends { id: string }>(
  page: string,
  path: string,
  items: T[]
): T[] {
  const isEdit = useIsEditMode();
  const draft = useDraftStore((s) => s.pages[page]?.edits[path]);
  if (isEdit && Array.isArray(draft)) return reorderById(items, draft as string[]);
  return items;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep "lib/studio/use-edit-mode" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add lib/studio/use-edit-mode.ts
git commit -m "feat(studio): add useOrderedItems live reorder hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: bridge→shell `edit` message + shell handler

**Files:**
- Modify: `lib/studio/messages.ts`
- Modify: `app/studio/page.tsx`
- Modify: `components/studio/EditModeBridge.tsx`

- [ ] **Step 1: Add the message type + guard**

In `lib/studio/messages.ts`, add after `BridgeDeselectMessage`:
```ts
/** iframe → shell: the bridge produced an edit directly (e.g. a drag reorder),
 *  so the shell records it for publish. Mirrors ApplyEditMessage in reverse. */
export type BridgeEditMessage = {
  source: "studio-bridge";
  type: "edit";
  path: string;
  value: FieldValue;
  fieldType: FieldType;
};
```
Add `BridgeEditMessage` to the `StudioMessage` union, and add a guard:
```ts
export function isBridgeEditMessage(m: StudioMessage): m is BridgeEditMessage {
  return m.source === "studio-bridge" && m.type === "edit";
}
```

- [ ] **Step 2: Handle it in the shell**

In `app/studio/page.tsx`, import the guard:
```ts
import {
  isDeselectMessage,
  isSelectMessage,
  isStudioMessage,
  isBridgeEditMessage,
  type ApplyEditMessage,
} from "@/lib/studio/messages";
```
In the `onMessage` handler (the `useEffect` that already handles `ready`/`select`/`deselect`), add before the `isSelectMessage` branch:
```ts
      if (isBridgeEditMessage(e.data)) {
        setEdit(currentPage, e.data.path, e.data.value);
        return;
      }
```
Add **both `setEdit` and `currentPage`** to that effect's dependency array (the handler now reads `currentPage`; `setEdit` is already available from the store hook at the top of the component). Re-subscribing on page switch is harmless.

- [ ] **Step 3: Export a `postEditToShell` helper from the bridge module**

In `components/studio/EditModeBridge.tsx`, broaden `postToShell`'s type and add an exported helper the reorder list will call:
```ts
import {
  isApplyMessage,
  isStudioMessage,
  type SelectFieldMessage,
  type BridgeReadyMessage,
  type BridgeDeselectMessage,
  type BridgeEditMessage,
} from "@/lib/studio/messages";
```
Change the `postToShell` signature to include `BridgeEditMessage`:
```ts
function postToShell(
  message:
    | SelectFieldMessage
    | BridgeReadyMessage
    | BridgeDeselectMessage
    | BridgeEditMessage
) {
  window.parent.postMessage(message, window.location.origin);
}

/** Record a bridge-originated edit (e.g. a drag reorder): update this window's
 *  draft store so the page re-renders live, and notify the shell to persist it
 *  for publish. */
export function recordBridgeEdit(path: string, value: FieldValue, fieldType: FieldType) {
  const slug = pageSlugForPathname(window.location.pathname);
  useDraftStore.getState().setEdit(slug, path, value);
  postToShell({ source: "studio-bridge", type: "edit", path, value, fieldType });
}
```
Also add no-op `"order"` cases to `readValue` and `writeValue` (defensive — an order edit's path matches no `[data-content-path]` element, but keep the switches total):
```ts
    case "order":
      return el.dataset.current ?? "";
```
```ts
    case "order":
      // No DOM mutation — the collection re-renders from the draft store
      // (useOrderedItems). Nothing to write to a single element.
      break;
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit 2>&1 | grep -E "messages|app/studio/page|EditModeBridge" || echo "clean"`
Expected: `clean`.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add lib/studio/messages.ts app/studio/page.tsx components/studio/EditModeBridge.tsx
git commit -m "feat(studio): bridge->shell 'edit' message for bridge-originated edits

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `ReorderableList` component (@dnd-kit, edit-mode, drag handle)

**Files:**
- Create: `components/studio/ReorderableList.tsx`

- [ ] **Step 1: Implement the component**

Create `components/studio/ReorderableList.tsx`:
```tsx
"use client";

import React from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { recordBridgeEdit } from "@/components/studio/EditModeBridge";

export type ReorderableListProps<T extends { id: string }> = {
  page: string;
  /** content path of the collection, e.g. "team.members" */
  path: string;
  items: T[];
  className?: string;
  /** render an item; `handle` must be spread onto the drag-handle element */
  renderItem: (item: T, handle: HandleProps) => React.ReactNode;
};

export type HandleProps = {
  ref: (el: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
};

function SortableItem<T extends { id: string }>({
  item,
  renderItem,
}: {
  item: T;
  renderItem: ReorderableListProps<T>["renderItem"];
}) {
  const { setNodeRef, transform, transition, setActivatorNodeRef, attributes, listeners, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, { ref: setActivatorNodeRef, attributes, listeners })}
    </div>
  );
}

/** Edit-mode drag-to-reorder for a collection. Reorders write to the draft
 *  store (live) + notify the shell for publish via recordBridgeEdit. */
export function ReorderableList<T extends { id: string }>({
  page,
  path,
  items,
  className,
  renderItem,
}: ReorderableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    recordBridgeEdit(path, next, "order");
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep "ReorderableList" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add components/studio/ReorderableList.tsx
git commit -m "feat(studio): ReorderableList @dnd-kit sortable with drag handle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Wire LeadershipTeam + SolutionsGrid to reorder

**Files:**
- Modify: `components/about/LeadershipTeam.tsx`
- Modify: `components/about/SolutionsGrid.tsx`

A shared drag-handle visual (inline, edit-mode only). Both sections: read order with `useOrderedItems`, render the grid via a dynamically-imported `ReorderableList` in edit mode (so @dnd-kit stays out of the published bundle), plain grid otherwise. Item leaf paths become **id-based**.

- [ ] **Step 1: LeadershipTeam — imports + dynamic ReorderableList**

At the top of `components/about/LeadershipTeam.tsx`:
```tsx
import dynamic from "next/dynamic";
import { useLayoutValue, useOrderedItems, useIsEditMode } from "@/lib/studio/use-edit-mode";
import type { HandleProps } from "@/components/studio/ReorderableList";

const ReorderableList = dynamic(
  () => import("@/components/studio/ReorderableList").then((m) => m.ReorderableList),
  { ssr: false }
);
```
(Remove the now-redundant separate `useLayoutValue` import line if one exists — keep a single combined import.)

- [ ] **Step 2: LeadershipTeam — render via order + reorder**

Inside the component, after the existing `const columns = useLayoutValue(...)`:
```tsx
  const PAGE = "about";
  const isEdit = useIsEditMode();
  const members = useOrderedItems(PAGE, "team.members", team.members);
  const gridCls = cn("grid w-full gap-x-6 gap-y-10", COLS[columns] ?? COLS.four);

  const renderMember = (m: (typeof team.members)[number], handle?: HandleProps) => (
    <div className="flex flex-col">
      {handle && (
        <button
          type="button"
          ref={handle.ref}
          {...handle.attributes}
          {...handle.listeners}
          aria-label={`Drag to reorder ${m.name}`}
          className="mb-1 cursor-grab self-start rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
        >
          ⠿
        </button>
      )}
      <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-lg bg-gray-200 text-gray-400">
        <span className="heading-small">{initials(m.name)}</span>
      </div>
      <Text as="p" variant="body-large" className="font-semibold text-gray-800" data-content-path={`team.members.${m.id}.name`}>
        {m.name}
      </Text>
      <Text as="p" variant="body-small" className="text-gray-500" data-content-path={`team.members.${m.id}.role`}>
        {m.role}
      </Text>
    </div>
  );
```
Replace the existing grid `<div className={cn("grid w-full ...")}> … members.map … </div>` block with:
```tsx
        {isEdit ? (
          <ReorderableList
            page={PAGE}
            path="team.members"
            items={members}
            className={gridCls}
            renderItem={(m, handle) => renderMember(m, handle)}
          />
        ) : (
          <div className={gridCls}>{members.map((m) => <div key={m.id}>{renderMember(m)}</div>)}</div>
        )}
```
(The `key` now uses `m.id`. Keep the surrounding heading + CTA button untouched.)

- [ ] **Step 3: SolutionsGrid — same pattern**

At the top of `components/about/SolutionsGrid.tsx` add the same dynamic import + hooks import. Inside the component, after `const columns = useLayoutValue(...)`:
```tsx
  const PAGE = "about";
  const isEdit = useIsEditMode();
  const items = useOrderedItems(PAGE, "solutions.items", solutions.items);
  const gridCls = cn("grid gap-8", COLS[columns] ?? COLS.four);

  const renderCard = (item: (typeof solutions.items)[number], handle?: HandleProps) => {
    const Icon = ICONS[item.icon] ?? Sparkles;
    const idx = solutions.items.findIndex((s) => s.id === item.id);
    return (
      <div className="flex flex-col gap-3">
        {handle && (
          <button
            type="button"
            ref={handle.ref}
            {...handle.attributes}
            {...handle.listeners}
            aria-label={`Drag to reorder ${item.title}`}
            className="cursor-grab self-start rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
          >
            ⠿
          </button>
        )}
        <Icon className={cn("h-9 w-9", ICON_COLOR[idx % ICON_COLOR.length])} strokeWidth={1.5} />
        <Text as="h3" variant="body-large" className="font-semibold text-gray-800" data-content-path={`solutions.items.${item.id}.title`}>
          {item.title}
        </Text>
        <Text as="p" variant="body-small" className="text-gray-600" data-content-path={`solutions.items.${item.id}.body`}>
          {item.body}
        </Text>
      </div>
    );
  };
```
Replace the existing `<div className={cn("grid gap-8", ...)}> … items.map … </div>` block with:
```tsx
        {isEdit ? (
          <ReorderableList
            page={PAGE}
            path="solutions.items"
            items={items}
            className={gridCls}
            renderItem={(item, handle) => renderCard(item, handle)}
          />
        ) : (
          <div className={gridCls}>{items.map((item) => <div key={item.id}>{renderCard(item)}</div>)}</div>
        )}
```
(Icon color uses the item's stable index so colors stay with the item across reorder.)

- [ ] **Step 4: Build + tsc + visual check**

Run: `npm run build` → succeeds.
Run: `npx tsc --noEmit 2>&1 | grep -E "components/about" || echo "clean"` → `clean`.
Restart dev server, open `http://localhost:3002/about` (published) — grids render normally, no handles.

- [ ] **Step 5: Commit**

```bash
git add components/about/LeadershipTeam.tsx components/about/SolutionsGrid.tsx
git commit -m "feat(about): drag-to-reorder leadership + solutions in edit mode

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: End-to-end verification (Playwright cross-frame)

**Files:**
- Create: `tests/reorder.e2e.mjs`

- [ ] **Step 1: Write the e2e test**

Create `tests/reorder.e2e.mjs` (drives the keyboard sensor for deterministic, staleness-free reorder; stubs publish to capture the payload):
```js
import { chromium } from 'file:///Users/nickzaremba/Documents/certainly/iwbi/onewell-standard-frontend/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
let pub = null;
await page.route('**/api/studio/preview**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preview: null }) }));
await page.route('**/api/studio/publish', r => { pub = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prNumber: 1, prUrl: 'x', previewUrl: 'x', headSha: 'a' }) }); });

await page.goto('http://localhost:3002/studio', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.selectOption('#studio-page-switcher', 'about');
const ready = async () => page.evaluate(() => { try { const w = document.querySelector('iframe').contentWindow; return w.location.pathname === '/about' && !!w.document.querySelector('[data-content-path^="team.members."]'); } catch { return false; } });
let ok = false; for (let i = 0; i < 50; i++) { if (await ready()) { ok = true; break; } await page.waitForTimeout(400); }
if (!ok) throw new Error('iframe/about not ready');

const firstMemberName = () => page.evaluate(() => document.querySelector('iframe').contentWindow.document.querySelector('[data-content-path^="team.members."][data-content-path$=".name"]').textContent.trim());
const before = await firstMemberName();

// focus the first member's drag handle and move it down with keyboard (space, arrow-down, space)
await page.evaluate(() => {
  const d = document.querySelector('iframe').contentWindow.document;
  const handle = d.querySelector('button[aria-label^="Drag to reorder"]');
  handle.focus();
});
await page.keyboard.press('Space');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Space');
await page.waitForTimeout(500);
const afterFirst = await firstMemberName();

// also edit the (now-moved) person's text via the panel, then publish
await page.locator('header button', { hasText: /^Publish$/ }).dispatchEvent('click');
await page.waitForTimeout(600);

console.log('first member before:', JSON.stringify(before));
console.log('first member after reorder:', JSON.stringify(afterFirst));
console.log('changed:', before !== afterFirst);
console.log('publish edits:', JSON.stringify(pub?.edits), 'page:', pub?.page);
console.log('order edit present + is array:', Array.isArray(pub?.edits?.['team.members']));
console.log('pageerrors:', JSON.stringify(errs));
await browser.close();
```

- [ ] **Step 2: Run it (dev server must be on 3002; restart first)**

Run:
```bash
lsof -ti:3002 | xargs kill -9 2>/dev/null; (npm run dev > /tmp/devserver.log 2>&1 &) ; sleep 8
node tests/reorder.e2e.mjs
```
Expected output includes:
- `changed: true` (the first member changed after the keyboard reorder)
- `order edit present + is array: true`
- `publish edits` contains `"team.members": [ ...ids... ]` with `page: about`
- `pageerrors: []`

- [ ] **Step 3: Run the whole data-layer suite + build + tsc**

Run:
```bash
for f in tests/field-types tests/order tests/get-set-path tests/about-schema tests/changeset-reorder; do npx tsx "$f.test.ts" || exit 1; done
npm run build
npx tsc --noEmit 2>&1 | grep -E "components/(about|studio)|lib/(studio|content)" || echo "tsc clean on changed files"
```
Expected: every data-layer test prints its `ok` line; build succeeds; tsc clean on changed files.

- [ ] **Step 4: Manual sanity (optional but recommended)**

Open `http://localhost:3002/studio`, switch to About, drag a leadership card by its ⠿ handle → it reorders live; edit that person's name → both survive; click Publish → banner appears. Confirm published `/about` (no `?edit=1`) shows the authored order (drafts don't leak).

- [ ] **Step 5: Commit**

```bash
git add tests/reorder.e2e.mjs
git commit -m "test(studio): e2e drag-reorder (keyboard) + publish payload

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the reviewer (post-implementation review)
- Confirm published mode renders **no** @dnd-kit / handles and uses the authored order (edit-mode gating).
- Confirm reorder + id-leaf text edits compose in the publish payload (Task 6 test) and on a real publish.
- Confirm the `order` edit never matches a `[data-content-path]` element (so `applyOverride` is a no-op for it).
- @dnd-kit is dynamically imported (Task 10) → not in the published page's critical bundle.
- Out of scope (do not implement): add/remove items, AI reorder, page-2/other collections (generic primitive ready for opt-in).
