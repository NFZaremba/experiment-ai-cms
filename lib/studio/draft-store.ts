import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FieldValue } from "./field-types";

/**
 * Draft edits for the Content Studio.
 *
 * Holds a map of `data-content-path` → new string value for fields the editor
 * has changed but not yet published. Persisted to localStorage so a refresh
 * doesn't lose in-progress work. Because the shell and the preview iframe are
 * same-origin, both windows hydrate from the same persisted key (each keeps its
 * own in-memory instance; cross-window live updates go over postMessage).
 *
 * This is UI/draft state only — never server state. It is cleared on publish.
 */

export type DraftEdits = Record<string, FieldValue>;

/** The open publish (PR) for the current drafts, persisted so the preview link
 *  and "Publish for real" survive a page refresh. */
export type PublishResult = { prNumber: number; prUrl: string; previewUrl: string | null };

type DraftState = {
  edits: DraftEdits;
  lastPublish: PublishResult | null;
  setEdit: (path: string, value: FieldValue) => void;
  setLastPublish: (result: PublishResult | null) => void;
  clear: () => void;
};

export const STUDIO_DRAFT_KEY = "studio-draft-v1";

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      edits: {},
      lastPublish: null,
      // A new edit makes any open preview stale, so drop it.
      setEdit: (path, value) =>
        set((s) => ({ edits: { ...s.edits, [path]: value }, lastPublish: null })),
      setLastPublish: (result) => set({ lastPublish: result }),
      clear: () => set({ edits: {}, lastPublish: null }),
    }),
    { name: STUDIO_DRAFT_KEY }
  )
);
