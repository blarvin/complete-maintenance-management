/**
 * libraryChrome — the component-free Library-lens identity predicates. The
 * chrome-vs-Definition split is kind-based, not shape-based: a `logbook`-kind
 * library root (fd_logbook_policy) is a Definition, a `library`-kind root is not.
 */

import { describe, it, expect } from 'vitest';
import {
  isLibraryChrome,
  isDefinitionRow,
  isConfigSubField,
  isFieldLikeDefinitionKind,
  libraryIndexView,
} from '../data/libraryChrome';
import type { Kind, TreeType } from '../data/models';

const el = (kind: Kind, parentId: string | null, treeType: TreeType = 'library') =>
  ({ kind, parentId, treeType });

describe('isLibraryChrome', () => {
  it('is true for exactly the three chrome kinds', () => {
    for (const k of ['library', 'definitions', 'kinds'] as const) {
      expect(isLibraryChrome(k)).toBe(true);
    }
    for (const k of ['node', 'logbook', 'text-kv', 'flag'] as const) {
      expect(isLibraryChrome(k)).toBe(false);
    }
  });
});

describe('isDefinitionRow', () => {
  it('is true for a non-chrome library root — including a re-root policy kind', () => {
    expect(isDefinitionRow(el('text-kv', null))).toBe(true);
    // fd_logbook_policy: a Definition of kind `logbook`, NOT field-like.
    expect(isDefinitionRow(el('logbook', null))).toBe(true);
  });

  it('is false for chrome roots, parented rows, and business rows', () => {
    expect(isDefinitionRow(el('library', null))).toBe(false);
    expect(isDefinitionRow(el('definitions', 'lib_root'))).toBe(false);
    expect(isDefinitionRow(el('text-kv', 'fd_weight'))).toBe(false);
    expect(isDefinitionRow(el('node', null, 'business'))).toBe(false);
  });
});

describe('isConfigSubField', () => {
  it('is true only for parented, non-chrome library rows', () => {
    expect(isConfigSubField(el('flag', 'fd_weight'))).toBe(true);
    expect(isConfigSubField(el('text-kv', null))).toBe(false);
    expect(isConfigSubField(el('definitions', 'lib_root'))).toBe(false);
    expect(isConfigSubField(el('text-kv', 'n1', 'business'))).toBe(false);
  });
});

describe('isFieldLikeDefinitionKind', () => {
  it('keeps the add-surface field kinds and drops policy + config-only kinds', () => {
    for (const k of ['text-kv', 'enum-kv', 'number-kv', 'single-image', 'internal-link', 'external-link'] as const) {
      expect(isFieldLikeDefinitionKind(k)).toBe(true);
    }
    for (const k of ['logbook', 'flag', 'compound', 'string-list', 'node', 'library'] as const) {
      expect(isFieldLikeDefinitionKind(k)).toBe(false);
    }
  });
});

describe('libraryIndexView', () => {
  it('routes the two index lenses and nothing else', () => {
    expect(libraryIndexView('definitions')).toBe('definitions');
    expect(libraryIndexView('kinds')).toBe('kinds');
    expect(libraryIndexView('library')).toBe(null);
    expect(libraryIndexView('node')).toBe(null);
  });
});
