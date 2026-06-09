"use client";

import { useEffect, useState } from "react";
import { useDraftStore } from "./draft-store";
import { reorderById } from "./order";
import { isImageValue, type ImageValue } from "./field-types";

/**
 * True when the page is rendered inside the Studio preview (`?edit=1`).
 * Computed after mount (window isn't available during SSR), so it returns
 * false on the first render — fine for gating edit-only affordances.
 */
export function useIsEditMode(): boolean {
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    setEdit(new URLSearchParams(window.location.search).get("edit") === "1");
  }, []);
  return edit;
}

/**
 * The live value of a string-keyed field (a layout variant OR an icon key). In
 * edit mode it reflects the draft store (so an `setEdit` re-renders the variant /
 * icon instantly — no reload); otherwise it's the static content value. Gated to
 * edit mode so a stale draft in localStorage can never affect the published site.
 */
export function useLayoutValue(page: string, path: string, fallback: string): string {
  const isEdit = useIsEditMode();
  const draft = useDraftStore((s) => s.pages[page]?.edits[path]);
  if (isEdit && typeof draft === "string") return draft;
  return fallback;
}

/**
 * The live value of an image field. In edit mode, returns the draft image (so an
 * avatar that started as an initials placeholder swaps to an `<img>` the instant
 * one is set — no reload); otherwise the static content image (which may be
 * undefined, e.g. members with no photo). Gated to edit mode.
 */
export function useImageValue(
  page: string,
  path: string,
  fallback: ImageValue | undefined
): ImageValue | undefined {
  const isEdit = useIsEditMode();
  const draft = useDraftStore((s) => s.pages[page]?.edits[path]);
  if (isEdit && draft != null && isImageValue(draft)) return draft;
  return fallback;
}

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
