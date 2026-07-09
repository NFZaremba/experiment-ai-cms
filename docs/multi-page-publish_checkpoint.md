# Multi-page publish — PR-per-page model

> **Status (2026-06-08): BUILT.** The PR-per-page model is shipped — `PAGES` registry,
> per-page `studio/<slug>` branches, page-scoped drafts/publish, and pages `/`, `/page-2`,
> `/about` all live. The §1–§5 architecture below is implemented (see `lib/content/pages.ts`,
> `lib/studio/github.ts`, `lib/studio/changeset.ts`).
>
> **✅ §6 "Studio shell — page switcher" is RETIRED (done 2026-06-09).** The iframe shell + dropdown were
> replaced by an in-place "admin-bar" editor (floating pencil on any page → edit in place, no iframe, no
> postMessage); `/studio` is now just an authed directory landing. **The editor is its own domain now —
> see `docs/in-place-editor_checkpoint.md` (authoritative).** The per-page-PR spine (§1–§5 below) is KEPT
> and unchanged; only the entry/UI changed. The Tier-1 frontier (shared draft/presence) and roles remain
> unbuilt.
>
> **🔧 Branch-lifecycle fix (2026-07-09).** "Publish for real" (squash-merge) left the page's
> `studio/<slug>` branch behind; the page's NEXT publish then found no open PR, tried
> `git.createRef` on the still-existing branch, and failed with 422 "Reference already exists" —
> every page became unpublishable after its first production merge (bit `/` via orphaned
> `studio/home` from PR #14). Fixed in `lib/studio/github.ts`: `ensureBranchAt` (create the
> branch, or force-reset a 422-orphan to base) now backs `publishChangeSet`, and both
> `mergePullRequest` and `closePullRequest` delete the studio branch via `deleteBranchIfStudio`.
> Tests: `tests/github-branch-reconcile.test.ts`. Verified live: heal-publish → merge (branch
> auto-deleted) → fresh publish → Reset/close (branch deleted). Legacy `studio/edit-*` branches
> removed from the remote.
>
> **⚠️ Drift flag (2026-07-09):** §4 build-on-branch and §5 sha-retry are **NOT implemented**,
> despite the status line above — `buildContentChangeSet` (lib/studio/changeset.ts:29) builds
> from the *bundled* page JSON and `commitFiles` has no 409 retry; `readFileOnRef` is used only
> for the no-op guard. Concurrent same-page publishes from two browsers still overwrite each
> other. The "Same page, different fields ✅" row below is therefore aspirational until §4/§5
> land (planned as concurrency Phase 2 in the 2026-07-08 improvement roadmap).

## The model in one line

**Shard editing state by *document* (page), not by user.** One content file, one
branch, and one shared PR/preview *per page*. Everyone editing a given page
collaborates on that page's single PR; different pages are fully independent.

```
home page   → lib/content/home.json    → branch studio/home    → PR + preview (shared)
pricing page→ lib/content/pricing.json → branch studio/pricing → PR + preview (shared)
```

- Different pages, different editors → never touch the same file → zero conflict. ✅
- Same page, multiple editors → one shared PR; their edits **stack** (see "build-on-branch"). ✅ for non-overlapping fields.

This is exactly how git-backed CMSs (TinaCMS, Decap) shard. It generalizes Tier 0's
"one global preview" into "one preview per page."

## Why not PR-per-user

Per-user PRs on a shared file just relocate the clobber to merge time (PR-B built off
stale `main` overwrites PR-A's fields on merge). User IDs are worth adding — for
roles, attribution, presence, an edit-lock — but they do **not** make concurrent edits
to the same file safe. Per-*document* sharding does. (Full reasoning in the
2026-06-05 conversation / handoff.)

## Architecture

### 1. Content layout — one file per page + a registry
```
lib/content/
  pages/
    home.json
    page-2.json
  schema.ts        // per-page schemas + a PAGES registry
  index.ts         // getPageContent(slug) + PAGES metadata
```
`index.ts` exposes a registry so the studio can enumerate pages and resolve a slug
to `{ file, schema, route }`:
```ts
export const PAGES = {
  home:    { route: "/",        file: "lib/content/pages/home.json",    schema: homeSchema },
  "page-2":{ route: "/page-2",  file: "lib/content/pages/page-2.json",  schema: page2Schema },
} as const;
export type PageSlug = keyof typeof PAGES;
export function getPageContent(slug: PageSlug) { /* parse + cache per slug */ }
```
Today's `getLandingContent()` becomes `getPageContent("home")` (keep a thin alias to
avoid churn). This is the single swap-point the content layer was always designed for.

### 2. Page-scoped edit paths
The bridge needs to know which page+path a field belongs to. Two equivalent options:
- **(preferred) `data-page` + `data-content-path`** — the section renders `data-page="page-2"`
  on a wrapper (or each field), and `data-content-path` stays *relative within the page
  file* (`sections.0.heading`). The bridge reads both; the publish payload becomes
  `{ page, edits: { path → value } }`.
- (alt) Prefix the path with the slug (`page-2:sections.0.heading`) — simpler DOM, uglier paths.

Drafts (`draft-store`) key by **`page` then `path`** so two pages' drafts don't collide
in localStorage. The studio shows per-page unpublished counts.

### 3. Publish routing — keyed by page
`publishOrUpdate` (built in Tier 0) gains a `page` arg:
- branch name `studio/<slug>` (stable, reused) — **not** timestamped, so it's the one
  shared branch for that page. `findOpenStudioPRs()` filters by `studio/<slug>`.
- One open PR per page; the single-preview invariant becomes **per page**.
- The publish/preview/merge/close routes take `{ page }` (+ `prNumber` where needed).

### 4. ⭐ Build-on-branch (the one real correctness change)
Today `buildContentChangeSet` builds from the **deployed base** + the current user's
local drafts, so a second publisher overwrites the branch. Fix: build from the
**branch's current contents** when a PR is open.
```ts
// base = open PR branch's file if it exists, else the deployed file
const baseDoc = JSON.parse(await readFileOnRef(branchOrBase, page.file));
let doc = baseDoc;
for (const [path, value] of Object.entries(edits)) doc = setByPath(doc, path, value);
// validate against PAGES[slug].schema, serialize, commit onto studio/<slug>
```
Now B's body edit applies onto A's already-published `{title:A2}` → `{title:A2, body:B2}`.
Both survive. Edits **stack** instead of overwrite.

### 5. ⭐ sha-retry (free optimistic concurrency)
GitHub's Contents API requires the file's current `sha` to update it. Two simultaneous
same-page publishes: the second gets `409 sha mismatch` instead of silently winning.
Wrap `commitFiles` in a small retry — on 409, re-read the branch, re-apply the delta,
re-commit. Concurrent same-page publishes become safe for non-overlapping fields with
**no separate draft store**. (This is the key insight: GitHub's per-file sha *is* the
optimistic-concurrency token.)

### 6. Studio shell — page switcher
`app/studio/page.tsx` gains a page selector (dropdown: Home / Page 2). Selecting a page:
- points the iframe at `PAGES[slug].route + "?edit=1"`,
- scopes the draft view + Publish to that slug,
- reconciles that page's preview via `/api/studio/preview?page=<slug>`.
Each page has its own banner/preview/"Publish for real". The mental model stays "one
preview per page," now visible per page.

## What this solves vs. the remaining tail

| Scenario | PR-per-page | Notes |
|---|---|---|
| Different pages, different editors | ✅ fully | separate files, never conflict |
| Same page, different fields | ✅ (with build-on-branch + sha-retry) | edits stack; concurrent-safe |
| Same page, **same field** | ⚠️ last-publish-wins | needs presence/locking or field-version checks |
| See each other's *unpublished* edits live | ❌ | editor loads branch/base, not a live shared draft |

The last two rows are the **Tier-1 frontier**: a shared draft store + presence so the
*editing surface itself* is shared (Google-Docs-style). PR-per-page ships without it
and is genuinely good for a small team editing mostly-different pages/fields; Tier 1 is
polish on top, not a prerequisite. Beyond that (roles, scheduling, content history) =
adopt a headless CMS.

## Build phases (when greenlit)
1. **Content registry** — move `landing.json` → `pages/home.json`, add `PAGES` + `getPageContent`, alias `getLandingContent`. (No behavior change; pure refactor.)
2. **Page-scoped paths + drafts** — `data-page`, draft-store keyed by page, bridge + messages carry `page`.
3. **Per-page publish** — `publishOrUpdate(page, …)`, `studio/<slug>` branches, routes take `{ page }`, **build-on-branch**, **sha-retry**.
4. **Shell page switcher** — iframe src + per-page banners/reconcile.
5. (later, Tier 1) shared draft + presence for same-page live co-editing.

## Verification (per phase)
- Phase 1: build green, `/` unchanged (alias works).
- Phase 3: edit page A + page B → **two** independent PRs (`studio/home`, `studio/page-2`); merging one doesn't touch the other. Two editors on the same page, different fields → one PR, both edits present after both publish (build-on-branch). Force a concurrent publish → 409 retry resolves, no lost field.
- Phase 4: switch pages in the shell → correct iframe + per-page preview banner.

## Related
- `docs/handoff-2026-06-05.md` — session context, Tier-0 build, the multi-user discussion.
- Tier 0 (built): `lib/studio/github.ts` (`publishOrUpdate`, `findOpenStudioPRs`), `app/api/studio/preview/route.ts`.
- Current fixture: `/page-2` (`app/page-2/page.tsx`, `lib/content/page2.json`, `page2Schema`).
