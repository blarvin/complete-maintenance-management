/**
 * IDBAdapter error normalization: Dexie/IndexedDB failures should surface as
 * StorageErrors with the right code (parity with FirestoreAdapter), and
 * hand-thrown StorageErrors must pass through unwrapped.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { isStorageError, type StorageErrorCode } from '../data/storage/storageErrors';

/** Build an Error carrying a DOMException-style `.name`, as Dexie surfaces them. */
const namedError = (name: string): Error => Object.assign(new Error(name), { name });

describe('IDBAdapter — error normalization (mapDexieError)', () => {
  let adapter: IDBAdapter;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    adapter = new IDBAdapter();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
  });

  const cases: Array<{ name: string; code: StorageErrorCode; retryable: boolean }> = [
    { name: 'QuotaExceededError', code: 'unavailable', retryable: true },
    { name: 'ConstraintError', code: 'conflict', retryable: false },
    { name: 'NotFoundError', code: 'not-found', retryable: false },
    { name: 'DataError', code: 'validation', retryable: false },
    { name: 'VersionError', code: 'unavailable', retryable: true },
    { name: 'SomethingUnexpected', code: 'internal', retryable: false },
  ];

  for (const { name, code, retryable } of cases) {
    it(`maps Dexie ${name} to StorageError code "${code}"`, async () => {
      vi.spyOn(db.elements, 'toArray').mockRejectedValueOnce(namedError(name));

      const err = await adapter.listRootElements().then(
        () => { throw new Error('expected listRootElements to reject'); },
        (e) => e,
      );

      expect(isStorageError(err)).toBe(true);
      expect(err).toMatchObject({ code, retryable });
    });
  }

  it('passes hand-thrown StorageErrors through without re-wrapping to internal', async () => {
    // Non-node kind without a definitionId throws makeStorageError('validation', ...)
    // before any Dexie call — the catch must not re-map it to 'internal'.
    const err = await adapter
      .createElement({ id: 'x', kind: 'text-kv', parentId: 'p', name: 'F' })
      .then(
        () => { throw new Error('expected createElement to reject'); },
        (e) => e,
      );

    expect(isStorageError(err)).toBe(true);
    expect(err).toMatchObject({ code: 'validation' });
  });
});
