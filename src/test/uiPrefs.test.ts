/**
 * Tests for the uiPrefs store.
 * Validates localStorage persistence for:
 * - Card expansion state (per node)
 * - Field details expansion state (per field)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    STORAGE_KEY,
    loadUIPrefs,
    saveUIPrefs,
    isCardExpanded,
    isFieldDetailsExpanded,
    toggleCardExpanded,
    toggleFieldDetailsExpanded,
    clearUIPrefs,
} from '../state/uiPrefs';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

describe('uiPrefs store', () => {
    beforeEach(() => {
        // Reset localStorage mock
        localStorageMock.clear();
        vi.stubGlobal('localStorage', localStorageMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('STORAGE_KEY', () => {
        it('has expected key format', () => {
            expect(STORAGE_KEY).toBe('treeview:ui:prefs');
        });
    });

    describe('loadUIPrefs', () => {
        it('returns empty sets when localStorage is empty', () => {
            const prefs = loadUIPrefs();
            expect(prefs.expandedCards.size).toBe(0);
            expect(prefs.expandedFieldDetails.size).toBe(0);
        });

        it('returns empty sets when localStorage has invalid JSON', () => {
            localStorageMock.setItem(STORAGE_KEY, 'not valid json');
            const prefs = loadUIPrefs();
            expect(prefs.expandedCards.size).toBe(0);
            expect(prefs.expandedFieldDetails.size).toBe(0);
        });

        it('loads persisted expanded cards', () => {
            const stored = {
                expandedCards: ['node-1', 'node-2'],
                expandedFieldDetails: [],
            };
            localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stored));

            const prefs = loadUIPrefs();
            expect(prefs.expandedCards.has('node-1')).toBe(true);
            expect(prefs.expandedCards.has('node-2')).toBe(true);
            expect(prefs.expandedCards.size).toBe(2);
        });

        it('loads persisted expanded field details', () => {
            const stored = {
                expandedCards: [],
                expandedFieldDetails: ['field-a', 'field-b', 'field-c'],
            };
            localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stored));

            const prefs = loadUIPrefs();
            expect(prefs.expandedFieldDetails.has('field-a')).toBe(true);
            expect(prefs.expandedFieldDetails.has('field-b')).toBe(true);
            expect(prefs.expandedFieldDetails.has('field-c')).toBe(true);
            expect(prefs.expandedFieldDetails.size).toBe(3);
        });

        it('handles partial data gracefully', () => {
            // Only cards, no field details
            const stored = { expandedCards: ['node-1'] };
            localStorageMock.setItem(STORAGE_KEY, JSON.stringify(stored));

            const prefs = loadUIPrefs();
            expect(prefs.expandedCards.has('node-1')).toBe(true);
            expect(prefs.expandedFieldDetails.size).toBe(0);
        });
    });

    describe('saveUIPrefs', () => {
        it('persists expanded cards to localStorage', () => {
            const prefs = {
                expandedCards: new Set(['node-1', 'node-2']),
                expandedFieldDetails: new Set<string>(),
            };

            saveUIPrefs(prefs);

            const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY)!);
            expect(stored.expandedCards).toContain('node-1');
            expect(stored.expandedCards).toContain('node-2');
            expect(stored.expandedCards.length).toBe(2);
        });

        it('persists expanded field details to localStorage', () => {
            const prefs = {
                expandedCards: new Set<string>(),
                expandedFieldDetails: new Set(['field-a', 'field-b']),
            };

            saveUIPrefs(prefs);

            const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY)!);
            expect(stored.expandedFieldDetails).toContain('field-a');
            expect(stored.expandedFieldDetails).toContain('field-b');
            expect(stored.expandedFieldDetails.length).toBe(2);
        });

        it('roundtrips correctly with loadUIPrefs', () => {
            const original = {
                expandedCards: new Set(['node-x', 'node-y']),
                expandedFieldDetails: new Set(['field-1', 'field-2', 'field-3']),
            };

            saveUIPrefs(original);
            const loaded = loadUIPrefs();

            expect(loaded.expandedCards.has('node-x')).toBe(true);
            expect(loaded.expandedCards.has('node-y')).toBe(true);
            expect(loaded.expandedFieldDetails.has('field-1')).toBe(true);
            expect(loaded.expandedFieldDetails.has('field-2')).toBe(true);
            expect(loaded.expandedFieldDetails.has('field-3')).toBe(true);
        });
    });

    describe('isCardExpanded', () => {
        it('returns false when no prefs exist', () => {
            expect(isCardExpanded('node-1')).toBe(false);
        });

        it('returns true when card is in expanded set', () => {
            const prefs = {
                expandedCards: new Set(['node-1']),
                expandedFieldDetails: new Set<string>(),
            };
            saveUIPrefs(prefs);

            expect(isCardExpanded('node-1')).toBe(true);
        });

        it('returns false when card is not in expanded set', () => {
            const prefs = {
                expandedCards: new Set(['node-1']),
                expandedFieldDetails: new Set<string>(),
            };
            saveUIPrefs(prefs);

            expect(isCardExpanded('node-2')).toBe(false);
        });
    });

    describe('isFieldDetailsExpanded', () => {
        it('returns false when no prefs exist', () => {
            expect(isFieldDetailsExpanded('field-1')).toBe(false);
        });

        it('returns true when field details is in expanded set', () => {
            const prefs = {
                expandedCards: new Set<string>(),
                expandedFieldDetails: new Set(['field-1']),
            };
            saveUIPrefs(prefs);

            expect(isFieldDetailsExpanded('field-1')).toBe(true);
        });

        it('returns false when field details is not in expanded set', () => {
            const prefs = {
                expandedCards: new Set<string>(),
                expandedFieldDetails: new Set(['field-1']),
            };
            saveUIPrefs(prefs);

            expect(isFieldDetailsExpanded('field-2')).toBe(false);
        });
    });

    describe('toggleCardExpanded', () => {
        it('adds card to expanded set when not present', () => {
            toggleCardExpanded('node-1');
            expect(isCardExpanded('node-1')).toBe(true);
        });

        it('removes card from expanded set when already present', () => {
            toggleCardExpanded('node-1');
            expect(isCardExpanded('node-1')).toBe(true);

            toggleCardExpanded('node-1');
            expect(isCardExpanded('node-1')).toBe(false);
        });

        it('persists changes to localStorage', () => {
            toggleCardExpanded('node-1');

            // Reload from localStorage
            const prefs = loadUIPrefs();
            expect(prefs.expandedCards.has('node-1')).toBe(true);
        });

        it('preserves other expanded cards', () => {
            toggleCardExpanded('node-1');
            toggleCardExpanded('node-2');

            expect(isCardExpanded('node-1')).toBe(true);
            expect(isCardExpanded('node-2')).toBe(true);

            toggleCardExpanded('node-1'); // Toggle off node-1

            expect(isCardExpanded('node-1')).toBe(false);
            expect(isCardExpanded('node-2')).toBe(true); // Still expanded
        });

        it('preserves expanded field details', () => {
            const prefs = {
                expandedCards: new Set<string>(),
                expandedFieldDetails: new Set(['field-1']),
            };
            saveUIPrefs(prefs);

            toggleCardExpanded('node-1');

            expect(isFieldDetailsExpanded('field-1')).toBe(true);
            expect(isCardExpanded('node-1')).toBe(true);
        });
    });

    describe('toggleFieldDetailsExpanded', () => {
        it('adds field to expanded set when not present', () => {
            toggleFieldDetailsExpanded('field-1');
            expect(isFieldDetailsExpanded('field-1')).toBe(true);
        });

        it('removes field from expanded set when already present', () => {
            toggleFieldDetailsExpanded('field-1');
            expect(isFieldDetailsExpanded('field-1')).toBe(true);

            toggleFieldDetailsExpanded('field-1');
            expect(isFieldDetailsExpanded('field-1')).toBe(false);
        });

        it('persists changes to localStorage', () => {
            toggleFieldDetailsExpanded('field-1');

            const prefs = loadUIPrefs();
            expect(prefs.expandedFieldDetails.has('field-1')).toBe(true);
        });

        it('preserves other expanded field details', () => {
            toggleFieldDetailsExpanded('field-1');
            toggleFieldDetailsExpanded('field-2');

            expect(isFieldDetailsExpanded('field-1')).toBe(true);
            expect(isFieldDetailsExpanded('field-2')).toBe(true);

            toggleFieldDetailsExpanded('field-1');

            expect(isFieldDetailsExpanded('field-1')).toBe(false);
            expect(isFieldDetailsExpanded('field-2')).toBe(true);
        });

        it('preserves expanded cards', () => {
            const prefs = {
                expandedCards: new Set(['node-1']),
                expandedFieldDetails: new Set<string>(),
            };
            saveUIPrefs(prefs);

            toggleFieldDetailsExpanded('field-1');

            expect(isCardExpanded('node-1')).toBe(true);
            expect(isFieldDetailsExpanded('field-1')).toBe(true);
        });
    });

    describe('clearUIPrefs', () => {
        it('removes all prefs from localStorage', () => {
            toggleCardExpanded('node-1');
            toggleFieldDetailsExpanded('field-1');

            clearUIPrefs();

            expect(isCardExpanded('node-1')).toBe(false);
            expect(isFieldDetailsExpanded('field-1')).toBe(false);
        });
    });
});

