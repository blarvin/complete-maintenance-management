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
 * The tree-native Add Surface runs alone. The two legacy surfaces are still in
 * the codebase and still work — add their ids back to compare all three side by
 * side in the running app, which is why the new surface shipped as a roster
 * entry rather than a replacement.
 *
 * They are deleted, along with this roster, once the new surface is settled
 * (ISSUES → Tech Debt). Until then this line is the whole switch.
 */
export const ENABLED_ADD_FIELD_SURFACES: readonly AddFieldSurfaceId[] = [
    'add-surface',
]; // 'add-surface', 'composer', 'legacy' or any subset
 
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
