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

/**
 * DataField Library - hardcoded field names for Phase 1.
 * From SPECIFICATION.md DataField Library table.
 * Users select from this library when creating new Data Fields.
 */
export const DATAFIELD_LIBRARY = [
    "Description",
    "Type Of",
    "Tags",
    "Location",
    "Serial Number",
    "Part Number",
    "Manufacturer",
    "Model",
    "Status",
    "Installed Date",
    "Weight",
    "Dimensions",
    "Power Rating",
    "Current Reading",
    "Note",
] as const;

export type DataFieldName = typeof DATAFIELD_LIBRARY[number];

/**
 * Default DataFields added at node creation time.
 */
export const DEFAULT_DATAFIELD_NAMES = [
    "Type Of",
    "Description",
    "Tags",
] as const;

