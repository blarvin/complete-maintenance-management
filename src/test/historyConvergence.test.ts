/**
 * The history log converges (IMPLEMENTATION.md → *History ID Scheme*).
 *
 * `rev` is minted by reading *local* history for its max, which cannot see
 * another client. Two clients editing the same element offline both reached
 * rev 5, both built the id `el:5`, and one append then destroyed the other —
 * `setDoc` without merge on the way up, `put` keyed by id on the way down.
 *
 * History rows are append-only and never updated in place, so unique ids are
 * the whole fix: the log becomes a grow-only set, merging is union, and `put`
 * is idempotent rather than destructive. These tests state that as the
 * property — two clients' appends both survive a round trip — rather than
 * asserting an id string format, which is an implementation detail that may
 * change again.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../data/storage/db';
import { compareHistory, createElementHistoryEntry } from '../data/storage/historyHelpers';
import type { ElementHistory } from '../data/models';

/** The colliding case: same element, same rev, two clients, different edits. */
const laptopEdit = () =>
  createElementHistoryEntry({
    elementId: 'el-1',
    rev: 5,
    action: 'update',
    property: 'value',
    prevValue: '10',
    newValue: '99',
  });

const phoneEdit = () =>
  createElementHistoryEntry({
    elementId: 'el-1',
    rev: 5,
    action: 'update',
    property: 'value',
    prevValue: '10',
    newValue: '20',
  });

describe('ElementHistory ids are unique per append', () => {
  it('two clients at the same rev on the same element produce different ids', () => {
    expect(laptopEdit().id).not.toBe(phoneEdit().id);
  });

  it('keeps elementId and rev readable in the key', () => {
    const entry = createElementHistoryEntry({
      elementId: 'el-1',
      rev: 5,
      action: 'update',
      property: 'value',
      prevValue: null,
      newValue: 'x',
    });

    expect(entry.id.startsWith('el-1:5:')).toBe(true);
    expect(entry.elementId).toBe('el-1');
    expect(entry.rev).toBe(5);
  });

  it('stays unique across a burst, where the clock cannot separate appends', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const ids = new Set(
      Array.from({ length: 200 }, () =>
        createElementHistoryEntry({
          elementId: 'el-1',
          rev: 5,
          action: 'update',
          property: 'value',
          prevValue: null,
          newValue: 'x',
        }).id
      )
    );

    expect(ids.size).toBe(200);
    vi.restoreAllMocks();
  });
});

describe('the log merges by union', () => {
  beforeEach(async () => {
    await db.open();
    await db.elementHistory.clear();
  });

  afterEach(async () => {
    await db.elementHistory.clear();
  });

  /**
   * The Tech Debt #4 case end to end: two same-rev appends land in the same
   * store — one written locally, one arriving from a pull — and both remain.
   * Before the fix this store held one row.
   */
  it('keeps both same-rev appends when a remote one lands on a local one', async () => {
    const local = laptopEdit();
    const remote = phoneEdit();

    await db.elementHistory.put(local);
    await db.elementHistory.put(remote); // the pull path: applyRemoteElementHistory

    const rows = await db.elementHistory.where('elementId').equals('el-1').toArray();

    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.newValue).sort()).toEqual(['20', '99']);
  });

  /** A full sync re-applies everything; unique ids make that idempotent. */
  it('re-applying the same append twice is a no-op, not a duplicate', async () => {
    const append = laptopEdit();

    await db.elementHistory.put(append);
    await db.elementHistory.put({ ...append }); // same id, same content

    expect(await db.elementHistory.where('elementId').equals('el-1').count()).toBe(1);
  });
});

describe('compareHistory is a total order every client agrees on', () => {
  const row = (over: Partial<ElementHistory>): ElementHistory => ({
    id: 'el-1:0:aaa',
    elementId: 'el-1',
    rev: 0,
    action: 'update',
    property: 'value',
    prevValue: null,
    newValue: null,
    updatedBy: 'u1',
    updatedAt: 1000,
    ...over,
  });

  it('orders by rev first — the everyday single-client sequence', () => {
    const rows = [row({ rev: 2, id: 'b' }), row({ rev: 0, id: 'a' }), row({ rev: 1, id: 'c' })];

    expect([...rows].sort(compareHistory).map(r => r.rev)).toEqual([0, 1, 2]);
  });

  it('breaks a same-rev tie by updatedAt — server-stamped once pushed', () => {
    const rows = [
      row({ rev: 5, updatedAt: 3000, id: 'x', newValue: 'later' }),
      row({ rev: 5, updatedAt: 2000, id: 'y', newValue: 'earlier' }),
    ];

    expect([...rows].sort(compareHistory).map(r => r.newValue)).toEqual(['earlier', 'later']);
  });

  /**
   * The property convergence actually needs: not that the order is "true" —
   * nothing can recover the real authoring order of two offline edits — but
   * that every client sorts the same set into the same sequence.
   */
  it('never ties, so any input permutation sorts identically', () => {
    const rows = [
      row({ rev: 5, updatedAt: 2000, id: 'el-1:5:aaa' }),
      row({ rev: 5, updatedAt: 2000, id: 'el-1:5:bbb' }),
      row({ rev: 5, updatedAt: 2000, id: 'el-1:5:ccc' }),
    ];
    const expected = ['el-1:5:aaa', 'el-1:5:bbb', 'el-1:5:ccc'];

    expect([...rows].sort(compareHistory).map(r => r.id)).toEqual(expected);
    expect([...rows].reverse().sort(compareHistory).map(r => r.id)).toEqual(expected);
    expect([rows[1], rows[2], rows[0]].sort(compareHistory).map(r => r.id)).toEqual(expected);
  });
});
