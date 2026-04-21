export interface HasCardOrder {
  id: string;
  cardOrder: number;
}

/**
 * Given fields in desired display order, return {id, cardOrder} pairs
 * for fields whose cardOrder needs to change to be sequentially 0..N-1.
 * Pure — no I/O.
 */
export function computeCardOrderUpdates<T extends HasCardOrder>(
  orderedFields: T[],
): Array<{ id: string; cardOrder: number }> {
  const updates: Array<{ id: string; cardOrder: number }> = [];
  orderedFields.forEach((f, i) => {
    if (f.cardOrder !== i) updates.push({ id: f.id, cardOrder: i });
  });
  return updates;
}

/**
 * Sort fields into the canonical display order: cardOrder ascending,
 * with id ascending as a deterministic tiebreaker for collisions.
 * Returns a new array; does not mutate input.
 */
export function sortByCardOrder<T extends HasCardOrder>(fields: T[]): T[] {
  return [...fields].sort((a, b) => {
    if (a.cardOrder !== b.cardOrder) return a.cardOrder - b.cardOrder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
