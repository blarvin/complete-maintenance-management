/**
 * Add-field surface registry.
 *
 * FieldList can host multiple "add field" UX surfaces side by side
 * (deliberate A/B comparison, per SPEC §Field Composer). They share one
 * mutex signal so at most one is open at a time.
 *
 * Contract for a surface component:
 *  - receives `activeSurface: Signal<ActiveSurface>` from FieldList
 *  - is open iff `activeSurface.value === <its own id>`
 *  - opens by writing its own id; closes by writing 'none'
 *    (last writer wins — opening one surface implicitly closes the rest)
 *  - persists via the command bus; no reload callback needed — writes emit
 *    on the storage event bus and FieldList's data hook reloads itself
 *
 * Adding a new surface:
 *  1. add its id to AddFieldSurfaceId
 *  2. build the component to the contract above
 *  3. add the id to ENABLED_ADD_FIELD_SURFACES in src/constants.ts
 *  4. render it in FieldList gated on roster membership
 */
export type AddFieldSurfaceId = 'composer' | 'legacy';

export type ActiveSurface = AddFieldSurfaceId | 'none';
