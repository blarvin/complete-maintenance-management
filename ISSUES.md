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

- No text entry caret when editing dataField names or values - it should only have active blinking caret when in editing state
- Double underline when editing dataField values. There must be a better way.
- **DataFieldHistory written lazily** — History entries are created when the field is re-opened, not on save. Should emit on commit so history is never missing after a reload.
- **REVERT enabled when it shouldn't be** — The REVERT button is active when the current value or the original empty entry is selected. Should be disabled in those cases.
- **No ROOT view loading state** — `BranchView` shows "Loading..." while data loads; `RootView` flashes empty. Mirror the BranchView pattern.

---

## Features

- **Delete with undo** — Confirmation dialog (with descendant/field counts for nodes), Snackbar toast after delete, 5s undo window. Applies to both TreeNode and DataField delete. Requires a global Snackbar component (single-slot, auto-dismiss, optional action button). Blocks full cascade-delete work in LATER.md.
- **Node metadata in TreeNodeDetails** — Show `createdAt`, last `updatedAt`, last `updatedBy`. These belong in TreeNodeDetails, not as DataFields on the card.
- **Inline rename of NodeTitle and NodeSubtitle** — Decide UX (double-tap like DataFields? edit button?), then wire up. Currently nodes are rename-less after creation.
- **DataField restoration UI** — Surface soft-deleted fields somewhere (recycle bin? details view?) and allow setting `deletedAt` back to null. Data model supports it; UI doesn't.
- **DataField picker keyboard + clickaway** — In the CreateDataField combo box: Up/Down to move, Enter to pick, click-outside or tab-away to close. Touch path must keep working. (Typeahead and flip-up are in LATER.md.)
- **Tab focus order audit** — Walk the app with keyboard only; fix any jumps that land in weird places after Tab across views.
- **CreateNodeButton child UX** — Spec says n+1 buttons between children; LATER.md flags this as cluttered. Decide: keep interleaved buttons, switch to a single "Add sub-asset" that appends (or inserts relative to a selection), or something else. Then update spec + implementation to match.
- NodeDetails should show createdAt, createdBy, and last edit date

---

## Tech Debt

- **Timestamp-formatting helper** — Whatever fixes the Invalid Date / NaN bugs should land as a single shared formatter, not two copies. (Pairs with the bug above.)
- **Shared history creation logic** — Duplicated between `IDBAdapter` and `FirestoreAdapter`. Extract alongside the existing `historyHelpers.ts` (where `nextRev` already lives).
- **IDBAdapter error handling is minimal** — `FirestoreAdapter` normalizes to `StorageError` comprehensively; `IDBAdapter` is terse. Bring IDB up to parity before Snackbar work so user-facing error messages have a consistent shape.
- **Nomenclature: DataField vs DataFieldValue** — Inconsistent across code and docs. Pick one, rename, done.
- **Remove unused `nodeId` prop from DataCard** — Trivial cleanup.
- **Double underline while editing** — DataField value has a visible affordance underline plus the browser's input underline while editing. Pick one.

