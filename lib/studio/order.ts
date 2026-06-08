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
