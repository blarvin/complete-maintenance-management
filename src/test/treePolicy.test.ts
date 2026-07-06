/**
 * Tests for the per-tree sync/history policy table (src/data/treePolicy.ts).
 * Pure function tests — this is the single source of truth for SPEC →
 * Populations are typed trees, so it asserts the full table for all four values.
 */

import { describe, it, expect } from 'vitest';
import type { TreeType } from '../data/models';
import {
  treeSyncMode,
  treeHistoryMode,
  shouldSyncTreeType,
  shouldLogHistory,
} from '../data/treePolicy';

const ALL_TREE_TYPES: TreeType[] = ['business', 'library', 'config', 'view-state'];

describe('treeSyncMode', () => {
  it('matches the SPEC table for every treeType', () => {
    expect(treeSyncMode('business')).toBe('shared');
    expect(treeSyncMode('library')).toBe('shared');
    expect(treeSyncMode('config')).toBe('per-user');
    expect(treeSyncMode('view-state')).toBe('none');
  });
});

describe('treeHistoryMode', () => {
  it('matches the SPEC table for every treeType', () => {
    expect(treeHistoryMode('business')).toBe('business');
    expect(treeHistoryMode('library')).toBe('library');
    expect(treeHistoryMode('config')).toBe('overlay');
    expect(treeHistoryMode('view-state')).toBe('none');
  });
});

describe('shouldSyncTreeType', () => {
  it('syncs every tree except view-state', () => {
    expect(shouldSyncTreeType('business')).toBe(true);
    expect(shouldSyncTreeType('library')).toBe(true);
    expect(shouldSyncTreeType('config')).toBe(true);
    expect(shouldSyncTreeType('view-state')).toBe(false);
  });
});

describe('shouldLogHistory', () => {
  it('logs every tree except view-state', () => {
    expect(shouldLogHistory('business')).toBe(true);
    expect(shouldLogHistory('library')).toBe(true);
    expect(shouldLogHistory('config')).toBe(true);
    expect(shouldLogHistory('view-state')).toBe(false);
  });
});

describe('policy totality', () => {
  it('returns a defined mode for every treeType (no fall-through)', () => {
    for (const t of ALL_TREE_TYPES) {
      expect(treeSyncMode(t)).toBeDefined();
      expect(treeHistoryMode(t)).toBeDefined();
    }
  });
});
