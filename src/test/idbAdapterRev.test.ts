/**
 * Coverage for `IDBAdapter` history-revision sequencing (audit §4.2).
 *
 * `nextElementRev` was rewritten from a full `toArray()` of an element's
 * history to a single seek on the `[elementId+rev]` compound index, and
 * `createElement` now hardcodes rev 0. These tests pin the externally-visible
 * contract that survives that change: revs are contiguous from 0, per-element,
 * across create / update / delete.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';

let adapter: IDBAdapter;

async function createNode(id: string, name = 'Test'): Promise<void> {
  await adapter.createElement({ id, kind: 'node', parentId: null, name });
}

async function revsFor(elementId: string): Promise<number[]> {
  const rows = await db.elementHistory.where('elementId').equals(elementId).toArray();
  return rows.map(r => r.rev).sort((a, b) => a - b);
}

describe('IDBAdapter history-rev sequencing', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    adapter = new IDBAdapter();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('fresh element starts at rev 0', async () => {
    await createNode('n1');
    const rows = await db.elementHistory.where('elementId').equals('n1').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].rev).toBe(0);
  });

  it('create → updates → delete produce a contiguous rev sequence with no gaps or dupes', async () => {
    await createNode('n1');
    await adapter.updateElement('n1', { name: 'A' });
    await adapter.updateElement('n1', { name: 'B' });
    await adapter.softDeleteElement('n1');

    expect(await revsFor('n1')).toEqual([0, 1, 2, 3]);
  });

  it('scopes revs per element — interleaved writes do not bleed across ids', async () => {
    await createNode('n1');
    await createNode('n2');
    await adapter.updateElement('n1', { name: 'a1' });
    await adapter.updateElement('n2', { name: 'b1' });
    await adapter.updateElement('n1', { name: 'a2' });
    await adapter.updateElement('n2', { name: 'b2' });

    expect(await revsFor('n1')).toEqual([0, 1, 2]);
    expect(await revsFor('n2')).toEqual([0, 1, 2]);
  });

  it('a single multi-prop update writes consecutive revs in one call', async () => {
    await createNode('n1');
    // name + subtitle changed at once → two history rows, revs 1 and 2.
    await adapter.updateElement('n1', { name: 'Renamed', subtitle: 'Sub' });

    expect(await revsFor('n1')).toEqual([0, 1, 2]);
  });
});
