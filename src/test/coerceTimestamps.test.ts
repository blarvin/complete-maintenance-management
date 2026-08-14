/**
 * Unit tests for coerceTimestamps — Firestore Timestamp → epoch ms.
 *
 * The point of the rule is that it is self-maintaining: a timestamp column
 * added later must be covered without anyone remembering to extend a list.
 */

import { describe, it, expect } from 'vitest';
import { coerceTimestamps } from '../data/storage/coerceTimestamps';

/** Minimal stand-in for a Firestore Timestamp — the helper ducks on toMillis. */
const ts = (ms: number) => ({ toMillis: () => ms });

describe('coerceTimestamps', () => {
  it('coerces the columns the hardcoded list used to name', () => {
    const out = coerceTimestamps<{ updatedAt: number; deletedAt: number }>({
      updatedAt: ts(1000),
      deletedAt: ts(2000),
    });
    expect(out.updatedAt).toBe(1000);
    expect(out.deletedAt).toBe(2000);
  });

  it('coerces any *At key, which the hardcoded list did not', () => {
    const out = coerceTimestamps<Record<string, number>>({
      createdAt: ts(3000),
      lastSyncedAt: ts(4000),
      archivedAt: ts(5000),
    });
    expect(out.createdAt).toBe(3000);
    expect(out.lastSyncedAt).toBe(4000);
    expect(out.archivedAt).toBe(5000);
  });

  it('leaves non-*At keys alone even when Timestamp-shaped', () => {
    const stamp = ts(6000);
    const out = coerceTimestamps<Record<string, unknown>>({ attachment: stamp });
    expect(out.attachment).toBe(stamp);
  });

  it('leaves already-coerced numbers and absent values alone', () => {
    const out = coerceTimestamps<Record<string, unknown>>({
      updatedAt: 7000,
      deletedAt: null,
      createdAt: undefined,
    });
    expect(out.updatedAt).toBe(7000);
    expect(out.deletedAt).toBeNull();
    expect(out.createdAt).toBeUndefined();
  });

  it('passes through non-object input without throwing', () => {
    expect(coerceTimestamps<null>(null)).toBeNull();
    expect(coerceTimestamps<undefined>(undefined)).toBeUndefined();
  });
});
