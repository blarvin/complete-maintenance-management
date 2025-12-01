/**
 * Centralized constants for the application.
 * Single source of truth for magic values used across the codebase.
 */

/**
 * Current user ID. Phase 1 uses a constant; future phases will pull from auth.
 */
export const USER_ID = "localUser" as const;

/**
 * Firestore collection names.
 */
export const COLLECTIONS = {
    NODES: "treeNodes",
    FIELDS: "dataFields",
    HISTORY: "dataFieldHistory",
} as const;

