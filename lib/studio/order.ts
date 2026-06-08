/**
 * Reorder a collection of `{ id }` items to match an id list. Ids in `order`
 * that don't exist are skipped; a repeated id is applied once (deduped); items
 * whose id isn't named in `order` are appended in their original relative order.
 *
 * The dedupe guarantees the result is always a true PERMUTATION of `items` —
 * each item appears exactly once — so a crafted/replayed `order` (e.g. the same
 * id twice) can never duplicate content past the publish allowlist. Pure +
 * dependency-free so it's shared by the live hook (useOrderedItems) and the
 * publish changeset.
 */
export function reorderById<T extends { id: string }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (seen.has(id)) continue;
    const it = byId.get(id);
    if (it) {
      out.push(it);
      seen.add(id);
    }
  }
  for (const it of items) {
    if (!seen.has(it.id)) out.push(it);
  }
  return out;
}
