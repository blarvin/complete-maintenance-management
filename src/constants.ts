/**
 * Centralized constants for the application.
 */

import type { AddFieldSurfaceId } from "./components/FieldList/addFieldSurfaces";

/**
 * Current user ID. Phase 1 uses a constant; future phases will pull from auth.
 */
export const USER_ID = "localUser" as const;

/**
 * Reserved author id for dev-seeded Definitions. End-user content always
 * uses `getCurrentUserId()` (currently `USER_ID`).
 */
export const AUTHOR_ID_APP_DEVELOPER = "appDeveloper" as const;

/**
 * Which add-field surfaces FieldList renders — in *both* display and
 * construction mode. See src/components/FieldList/addFieldSurfaces.ts for the
 * surface contract.
 *
 * Empty on this branch: both legacy surfaces (the composer and the single-pick
 * "+ Add Field") are switched off while the tree-native picker is built. They
 * are kept, not deleted — restore either id to bring it back verbatim. With
 * the list empty there is no way to add a field to an existing node; new nodes
 * still get their defaults, which useNodeCreation seeds directly.
 */
export const ENABLED_ADD_FIELD_SURFACES: readonly AddFieldSurfaceId[] = []; // 'picker' or 'composer' or both
 
/**
 * Max push attempts per sync queue item before it's parked as exhausted
 * (surfaced via error snackbar with Retry; re-armed on app startup).
 */
export const MAX_SYNC_RETRIES = 5;

/**
 * Per-write timeout for sync pushes. The Firestore SDK buffers writes and
 * retries forever instead of rejecting when the server is unreachable, so
 * without this the push (and the whole sync cycle) hangs indefinitely.
 */
export const SYNC_WRITE_TIMEOUT_MS = 10000;

/**
 * Timeout for the pull phase of a sync cycle — keeps a hung getDocs from
 * wedging SyncManager's isSyncing flag (which would skip all future cycles).
 */
export const SYNC_PULL_TIMEOUT_MS = 30000;

/**
 * Firestore collection names.
 */
export const COLLECTIONS = {
    FIELD_DEFINITIONS: "fieldDefinitions",
    ELEMENTS: "elements",
    ELEMENT_HISTORY: "elementHistory",
} as const;

/*
 * Historical prototype DataField labels (bootstrap-only, no longer exported):
 *   Description, Type Of, Tags, Location, Serial Number, Part Number,
 *   Manufacturer, Model, Status, Installed Date, Weight, Dimensions,
 *   Power Rating, Current Reading, Note
 *
 * These were hardcoded strings used during early UI/UX development. The
 * Component/Definition/Instance refactor replaced them with a
 * `fieldDefinitions` table populated by a follow-up plan. Kept here as a
 * reminder of the prototype set only.
 */
