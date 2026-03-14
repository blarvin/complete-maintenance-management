import type { StorageResult } from './storageAdapter';

export function createResult<T>(data: T, adapter: string, fromCache?: boolean): StorageResult<T> {
  return {
    data,
    meta: {
      adapter,
      fromCache,
    },
  };
}
