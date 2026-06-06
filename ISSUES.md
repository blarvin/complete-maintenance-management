# ISSUES.md — Active Work Queue

Live queue of open work, ordered by priority within each section. Completion lives in git history, not here.

**House rules:**

- **Only open items.** When done, **delete** — don't check off. The code is the record.
- **One-line outcomes**, not task breakdowns. "Delete with undo" beats five bullets about dialogs + snackbars + cascades.
- **One screen.** If this file gets long, prune to LATER.md or delete stale items.
- **Order = priority.** No labels, no statuses. Top of a section = do next.
- **Bugs first**, then Features, then Tech Debt.
- For deferred ideas see LATER.md. For product scope see SPECIFICATION.md.

---

## Bugs



### UX

1.) **Construction view: two Cancel buttons** — Inner composer panel has its own Cancel, plus the outer action row also has Cancel (and Create). Pick one location.

2.) **Under Construction view: "Create" enabled with empty Name** — No disabled state; should disable until Name is filled (or validate visibly on click).

3.) **Composer pre-checked + disabled rows have no explanation** — Description / Tags / Type Of are pre-checked and grayed in the construction-view composer with no "(required)" label or tooltip; reads as broken rather than enforced.

4.) **Save button has no visible disabled state** — Renders as plain gray text inside the button border; bump contrast or add a clear disabled style.

5.) **REVERT enabled when it shouldn't be** — The REVERT button is active when the current value or the original empty entry is selected. Should be disabled in those cases.

6.) **No ROOT view loading state** — `BranchView` shows "Loading..." while data loads; `RootView` flashes empty. Mirror the BranchView pattern.

### History

---

## Refactor: Unified Element Model — remaining work

The data path, command/query surface, FSM, push **and pull** sync, and the in-memory node index are unified (`REFACTOR-single-unified-data-model`). UI consumes Element via the `elementToTreeNode` / `elementToDataField` mappers and writes through `CREATE_ELEMENT` / `UPDATE_ELEMENT_VALUE` / `DELETE_ELEMENT` etc. Open items:

1.) **Drop legacy Dexie stores + adapter methods** — `db.nodes` / `db.fields` / `db.history` and the legacy StorageAdapter node/field CRUD (createNode, listFields, …) plus legacy `COLLECTIONS.NODES/FIELDS/HISTORY` are now unused (sync no longer touches them). Bump to a v8 schema that drops the stores and remove the dead methods + collection constants. The `db.nodes`-seeding tests in `initStorage.test.ts` go away with this.

2.) **Component prop reshape** — `TreeNodeDisplayProps`, `DataFieldProps`, `TreeNodeConstructionProps` still take legacy-shaped fields (`nodeName`, `fieldName`, `componentType`, …). Reshape to `{ element: Element }` once renderer-registry direction is decided.

3.) **SPEC prose reconciliation (still needed)** — Component Architecture, TreeNode/DataCard/DataField surface descriptions, Field Composer, and the FieldComponent → FieldDefinition → DataField hierarchy still read in two-primitive terms. Reword for surface/renderer vocabulary.

4.) **Add Migration & Naming row** — TreeNode/DataField → Element, parallel to the existing Template → FieldDefinition row in SPEC.

---

## Features


### Other

1.) **Delete with undo** — Confirmation dialog (with descendant/field counts for nodes), Snackbar toast after delete, 5s undo window. Applies to both TreeNode and DataField delete. Requires a global Snackbar component (single-slot, auto-dismiss, optional action button). Blocks full cascade-delete work in LATER.md.

2.) **Node metadata in TreeNodeDetails** — Show `createdAt`, last `updatedAt`, last `updatedBy`.

3.) **Inline rename of NodeTitle and NodeSubtitle** — Decide UX (double-tap like DataFields? edit button?), then wire up. Currently nodes are rename-less after creation.

4.) **DataField restoration UI** — Surface soft-deleted fields somewhere (recycle bin? details view?) and allow setting `deletedAt` back to null. Data model supports it; UI doesn't.

5.) **enum-kv allowOther support** — When `config.allowOther === true`, dropdown should append "Other…" that reveals an inline text input. Currently the dropdown only shows the fixed options list.

6.) **Real single-image Component** — Replace the "Image upload coming soon" stub with: Dexie `imageBlobs` table, file picker, preview + full-size modal, MIME/size validation, caption input when `requireCaption`. Firestore blob sync and orphaned-blob GC are separate follow-ups (see LATER.md).

---

## Tech Debt

- **Timestamp-formatting helper** — Whatever fixes the Invalid Date / NaN bugs should land as a single shared formatter, not two copies. (Pairs with the bug above.)
- **Shared history creation logic** — Duplicated between `IDBAdapter` and `FirestoreAdapter`. Extract alongside the existing `historyHelpers.ts` (where `nextRev` already lives).
- **IDBAdapter error handling is minimal** — `FirestoreAdapter` normalizes to `StorageError` comprehensively; `IDBAdapter` is terse. Bring IDB up to parity before Snackbar work so user-facing error messages have a consistent shape.
- **Nomenclature: DataField vs DataFieldValue** — Inconsistent across code and docs. Pick one, rename, done.
- **Remove unused `nodeId` prop from DataCard** — Trivial cleanup.
- **Double underline while editing** — DataField value has a visible affordance underline plus the browser's input underline while editing. Pick one.
- **`pendingMode` boilerplate across DataField Components** — TextKv/EnumKv/MeasurementKv/SingleImage each repeat near-identical `pendingMode` wiring into `useFieldEdit` (and Enum has its own click-away path). Don't abstract until a 5th component lands and the pattern is clear — premature now would obscure more than it shares.
- **`useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Works fine, every consumer destructures the same way, no obvious seam. Revisit only if a future Component genuinely needs a different edit lifecycle (e.g. multi-step upload flow).