/**
 * Add-field surface registry.
 *
 * FieldList can host multiple "add field" UX surfaces side by side
 * (deliberate A/B comparison, per SPEC §Field Composer). They share one
 * mutex signal so at most one is open at a time.
 *
 * Contract for a surface component:
 *  - receives an `activeSurface: Accessor<ActiveSurface>` + `setActiveSurface`
 *    pair from FieldList (Solid has no writable-signal prop idiom)
 *  - is open iff `activeSurface() === <its own id>`
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
 *
 * `add-surface` is the tree-native replacement (SPEC → The Add Surface). It ships
 * *alongside* `composer` and `legacy` so all three can be compared in the running
 * app; the two legacy ids are deleted once it wins (ISSUES → Tech Debt).
 */
export type AddFieldSurfaceId = 'add-surface' | 'composer' | 'legacy';

export type ActiveSurface = AddFieldSurfaceId | 'none';
