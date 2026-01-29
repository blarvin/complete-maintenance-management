/**
 * UI Preferences Store
 * Persists UI state to localStorage:
 * - Card expansion state (isExpanded per node)
 * - Field details expansion state (isMetadataExpanded per field)
 */

export const STORAGE_KEY = 'treeview:ui:prefs';

export type UIPrefs = {
    expandedCards: Set<string>;      // node IDs
    expandedFieldDetails: Set<string>; // field IDs
    expandedNodeDetails: Set<string>; // node IDs
};

type StoredUIPrefs = {
    expandedCards: string[];
    expandedFieldDetails: string[];
    expandedNodeDetails: string[];
};

/**
 * Load UI preferences from localStorage.
 * Returns empty sets if no prefs exist or data is invalid.
 */
export function loadUIPrefs(): UIPrefs {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { expandedCards: new Set(), expandedFieldDetails: new Set(), expandedNodeDetails: new Set() };
        }

        const stored: StoredUIPrefs = JSON.parse(raw);
        return {
            expandedCards: new Set(stored.expandedCards ?? []),
            expandedFieldDetails: new Set(stored.expandedFieldDetails ?? []),
            expandedNodeDetails: new Set(stored.expandedNodeDetails ?? []),
        };
    } catch {
        // Invalid JSON or other error - return defaults
        return { expandedCards: new Set(), expandedFieldDetails: new Set(), expandedNodeDetails: new Set() };
    }
}

/**
 * Save UI preferences to localStorage.
 * Converts Sets to arrays for JSON serialization.
 */
export function saveUIPrefs(prefs: UIPrefs): void {
    const stored: StoredUIPrefs = {
        expandedCards: [...prefs.expandedCards],
        expandedFieldDetails: [...prefs.expandedFieldDetails],
        expandedNodeDetails: [...prefs.expandedNodeDetails],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Check if a card is expanded for a given node.
 */
export function isCardExpanded(nodeId: string): boolean {
    const prefs = loadUIPrefs();
    return prefs.expandedCards.has(nodeId);
}

/**
 * Check if field details are expanded for a given field.
 */
export function isFieldDetailsExpanded(fieldId: string): boolean {
    const prefs = loadUIPrefs();
    return prefs.expandedFieldDetails.has(fieldId);
}

/**
 * Toggle card expansion for a node.
 * Persists the change to localStorage.
 */
export function toggleCardExpanded(nodeId: string): void {
    const prefs = loadUIPrefs();
    if (prefs.expandedCards.has(nodeId)) {
        prefs.expandedCards.delete(nodeId);
    } else {
        prefs.expandedCards.add(nodeId);
    }
    saveUIPrefs(prefs);
}

/**
 * Toggle field details expansion for a field.
 * Persists the change to localStorage.
 */
export function toggleFieldDetailsExpanded(fieldId: string): void {
    const prefs = loadUIPrefs();
    if (prefs.expandedFieldDetails.has(fieldId)) {
        prefs.expandedFieldDetails.delete(fieldId);
    } else {
        prefs.expandedFieldDetails.add(fieldId);
    }
    saveUIPrefs(prefs);
}

/**
 * Clear all UI preferences.
 * Useful for testing or reset functionality.
 */
export function clearUIPrefs(): void {
    localStorage.removeItem(STORAGE_KEY);
}

