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

type DraftState = {
  edits: DraftEdits;
  setEdit: (path: string, value: FieldValue) => void;
  clear: () => void;
};

export const STUDIO_DRAFT_KEY = "studio-draft-v1";

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      edits: {},
      setEdit: (path, value) =>
        set((s) => ({ edits: { ...s.edits, [path]: value } })),
      clear: () => set({ edits: {} }),
    }),
    { name: STUDIO_DRAFT_KEY }
  )
);
