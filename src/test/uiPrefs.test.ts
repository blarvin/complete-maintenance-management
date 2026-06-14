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
            expect(STORAGE_KEY).toBe('treeview:ui:prefs:v2');
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
                expandedNodeDetails: new Set<string>(),
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
                expandedNodeDetails: new Set<string>(),
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
                expandedNodeDetails: new Set<string>(),
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

    describe('clearUIPrefs', () => {
        it('removes all prefs from localStorage', () => {
            saveUIPrefs({
                expandedCards: new Set(['node-1']),
                expandedFieldDetails: new Set(['field-1']),
                expandedNodeDetails: new Set<string>(),
            });

            clearUIPrefs();

            const prefs = loadUIPrefs();
            expect(prefs.expandedCards.size).toBe(0);
            expect(prefs.expandedFieldDetails.size).toBe(0);
        });
    });
});

