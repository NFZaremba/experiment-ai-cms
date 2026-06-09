import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FieldValue } from "./field-types";

/**
 * Draft edits for the Content Studio, scoped PER PAGE.
 *
 * Holds, for each page slug, a map of `data-content-path` → new value for
 * fields the editor changed but hasn't published, plus that page's open
 * preview (PR). Persisted to localStorage so a refresh doesn't lose work and so
 * editing one page doesn't discard another page's drafts. The in-place editor
 * overlay reads and writes this store directly (same document as the page) —
 * applying each edit to the DOM live and queueing it here for publish.
 *
 * This is UI/draft state only — never server state. A page's entry is cleared
 * on publish-for-real / reset of that page.
 */

export type DraftEdits = Record<string, FieldValue>;

/** The open publish (PR) for a page's drafts, persisted so the preview link and
 *  "Publish for real" survive a refresh / page switch. */
export type PublishResult = {
  prNumber: number;
  prUrl: string;
  previewUrl: string | null;
  /** The commit SHA this preview is built from — poll status for THIS build. */
  headSha?: string | null;
};

type PageDraft = { edits: DraftEdits; lastPublish: PublishResult | null };

type DraftState = {
  pages: Record<string, PageDraft>;
  setEdit: (page: string, path: string, value: FieldValue) => void;
  /** Remove a single edit (used to revert a live-previewed change on Cancel when
   *  no draft existed for that path before the edit session). */
  removeEdit: (page: string, path: string) => void;
  setLastPublish: (page: string, result: PublishResult | null) => void;
  clearPage: (page: string) => void;
};

export const STUDIO_DRAFT_KEY = "studio-draft-v2";

const emptyPage = (): PageDraft => ({ edits: {}, lastPublish: null });

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      pages: {},
      // A new edit makes that page's open preview stale, so drop it.
      setEdit: (page, path, value) =>
        set((s) => {
          const prev = s.pages[page] ?? emptyPage();
          return {
            pages: {
              ...s.pages,
              [page]: { edits: { ...prev.edits, [path]: value }, lastPublish: null },
            },
          };
        }),
      removeEdit: (page, path) =>
        set((s) => {
          const prev = s.pages[page];
          if (!prev || !(path in prev.edits)) return s;
          const rest = { ...prev.edits };
          delete rest[path];
          return { pages: { ...s.pages, [page]: { ...prev, edits: rest } } };
        }),
      setLastPublish: (page, result) =>
        set((s) => {
          const prev = s.pages[page] ?? emptyPage();
          return { pages: { ...s.pages, [page]: { ...prev, lastPublish: result } } };
        }),
      clearPage: (page) => set((s) => ({ pages: { ...s.pages, [page]: emptyPage() } })),
    }),
    { name: STUDIO_DRAFT_KEY }
  )
);
