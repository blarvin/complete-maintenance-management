import { describe, it, expect } from 'vitest';
import { computeCardOrderUpdates, sortByCardOrder } from '../data/utils/cardOrder';

describe('computeCardOrderUpdates', () => {
  it('returns [] for empty input', () => {
    expect(computeCardOrderUpdates([])).toEqual([]);
  });

  it('returns [] when already contiguous 0..N-1', () => {
    const fields = [
      { id: 'a', cardOrder: 0 },
      { id: 'b', cardOrder: 1 },
      { id: 'c', cardOrder: 2 },
    ];
    expect(computeCardOrderUpdates(fields)).toEqual([]);
  });

  it('fills gaps', () => {
    const fields = [
      { id: 'a', cardOrder: 0 },
      { id: 'b', cardOrder: 2 },
      { id: 'c', cardOrder: 3 },
    ];
    expect(computeCardOrderUpdates(fields)).toEqual([
      { id: 'b', cardOrder: 1 },
      { id: 'c', cardOrder: 2 },
    ]);
  });

  it('resequences when all off', () => {
    const fields = [
      { id: 'a', cardOrder: 5 },
      { id: 'b', cardOrder: 9 },
    ];
    expect(computeCardOrderUpdates(fields)).toEqual([
      { id: 'a', cardOrder: 0 },
      { id: 'b', cardOrder: 1 },
    ]);
  });

  it('uses input array order, not cardOrder values', () => {
    const fields = [
      { id: 'a', cardOrder: 5 },
      { id: 'b', cardOrder: 5 },
    ];
    expect(computeCardOrderUpdates(fields)).toEqual([
      { id: 'a', cardOrder: 0 },
      { id: 'b', cardOrder: 1 },
    ]);
  });
});

describe('sortByCardOrder', () => {
  it('sorts ascending by cardOrder', () => {
    const fields = [
      { id: 'a', cardOrder: 2 },
      { id: 'b', cardOrder: 0 },
      { id: 'c', cardOrder: 1 },
    ];
    expect(sortByCardOrder(fields).map(f => f.id)).toEqual(['b', 'c', 'a']);
  });

  it('tiebreaks by id ascending when cardOrder collides', () => {
    const fields = [
      { id: 'z', cardOrder: 1 },
      { id: 'a', cardOrder: 1 },
      { id: 'm', cardOrder: 1 },
    ];
    expect(sortByCardOrder(fields).map(f => f.id)).toEqual(['a', 'm', 'z']);
  });

  it('does not mutate input', () => {
    const fields = [
      { id: 'b', cardOrder: 1 },
      { id: 'a', cardOrder: 0 },
    ];
    const copy = [...fields];
    sortByCardOrder(fields);
    expect(fields).toEqual(copy);
  });
});
