/**
 * Convert Firestore Timestamp fields to epoch ms numbers.
 *
 * Firestore returns Timestamp objects for serverTimestamp() fields; our domain
 * models expect plain numbers (epoch ms). The rule is "every key ending in
 * `At`" — the project's timestamp naming convention — rather than a hardcoded
 * list, so a future timestamp column is covered the day it lands. The narrow
 * version was a silent trap: an un-coerced Timestamp never throws, it just
 * compares and serialises wrong.
 *
 * Lives apart from firestoreAdapter.ts so it carries no `firebase` import and
 * stays reachable from unit tests. Duck-typed on `toMillis` for the same
 * reason — no `instanceof Timestamp`.
 *
 * Mutates and returns `data`; callers pass a fresh object from `doc.data()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function coerceTimestamps<T>(data: any): T {
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (!key.endsWith('At')) continue;
      const val = data[key];
      if (val != null && typeof val === 'object' && typeof val.toMillis === 'function') {
        data[key] = val.toMillis();
      }
    }
  }
  return data as T;
}
