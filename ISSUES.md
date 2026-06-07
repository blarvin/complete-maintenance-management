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

5.) **REVERT enabled when it shouldn't be** — The REVERT button is active when the current value or the original empty entry is selected. Should be disabled in those cases. In fact, it should be disabled if the seected value is the same as the current value, which is a common edge case.

6.) **No ROOT view loading state** — `BranchView` shows "Loading..." while data loads; `RootView` flashes empty. Mirror the BranchView pattern.

## Features

### Other

1.) **Delete with undo** — Confirmation dialog (with descendant/field counts for nodes), Snackbar toast after delete, 5s undo window. Applies to both TreeNode and DataField delete. Requires a global Snackbar component (single-slot, auto-dismiss, optional action button). Blocks full cascade-delete work in LATER.md.

2.) **Node metadata in TreeNodeDetails** — Show `createdAt`, last `updatedAt`, last `updatedBy`.

3.) **Inline rename of NodeTitle and NodeSubtitle** — Decide UX (double-tap like DataFields? edit button?), then wire up. Currently nodes are rename-less after creation.

4.) **DataField restoration UI** — Surface soft-deleted fields somewhere (recycle bin? details view?) and allow setting `deletedAt` back to null. Data model supports it; UI doesn't.

5.) **enum-kv allowOther support** — When `config.allowOther === true`, dropdown should append "Other…" that reveals an inline text input. Currently the dropdown only shows the fixed options list.

---

## Tech Debt

- **Restore emulator round-trip sync coverage** — The Element refactor traded the live-emulator adapter/sync suite for mock-based unit tests (`fieldDefinitionSync.test.ts` mocks `RemoteSyncAdapter`; its header points here). Result: the whole unit suite now passes without the Firebase emulator, but nothing automatically verifies real Firestore push/pull against the Element model. Reinstate a round-trip suite (Vitest against the emulator, or Cypress E2E) covering `elements` + `elementHistory` + `fieldDefinitions`.
- **Timestamp-formatting helper** — Whatever fixes the Invalid Date / NaN bugs should land as a single shared formatter, not two copies. (Pairs with the bug above.)
- **Shared history creation logic** — Duplicated between `IDBAdapter` and `FirestoreAdapter`. Extract alongside the existing `historyHelpers.ts` (where `nextRev` already lives).
- **IDBAdapter error handling is minimal** — `FirestoreAdapter` normalizes to `StorageError` comprehensively; `IDBAdapter` is terse. Bring IDB up to parity before Snackbar work so user-facing error messages have a consistent shape.
- `**pendingMode` boilerplate across DataField Components** — TextKv/EnumKv/NumberKv/SingleImage each repeat near-identical `pendingMode` wiring into `useFieldEdit` (and Enum has its own click-away path). Don't abstract until a 5th component lands and the pattern is clear — premature now would obscure more than it shares.
- `**useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Works fine, every consumer destructures the same way, no obvious seam. Revisit only if a future Component genuinely needs a different edit lifecycle (e.g. multi-step upload flow).

