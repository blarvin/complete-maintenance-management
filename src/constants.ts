/**
 * Centralized constants for the application.
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
    TEMPLATES: "dataFieldTemplates",
    FIELDS: "dataFields",
    HISTORY: "dataFieldHistory",
} as const;

/*
 * Historical prototype DataField labels (bootstrap-only, no longer exported):
 *   Description, Type Of, Tags, Location, Serial Number, Part Number,
 *   Manufacturer, Model, Status, Installed Date, Weight, Dimensions,
 *   Power Rating, Current Reading, Note
 *
 * These were hardcoded strings used during early UI/UX development. The
 * Component/Template/Instance refactor replaced them with a `templates`
 * table populated by a follow-up plan. Kept here as a reminder of the
 * prototype set only.
 */
