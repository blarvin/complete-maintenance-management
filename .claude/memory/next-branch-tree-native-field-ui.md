---
name: next-branch-tree-native-field-ui
description: The tree-native Add Surface landed 2026-08-15; the composer and legacy add-field surfaces are dormant, not deleted, and that state is deliberate and unfiled
metadata: 
  node_type: memory
  type: project
  originSessionId: 41ec2142-12d0-48d6-a7d1-371a0d98f7d3
  modified: 2026-08-22T00:00:00.000Z
---

The rebuild of the **Field authoring and Field adding UI/UX** is done. Planned
2026-08-11, shipped in two passes: a tree-native `AddFieldSurface` +
`LibraryPicker` (2026-08-14), then rebuilt as a **Field row** — the shared row
shell with bands Config · Kind · Tools — on 2026-08-15, which retired the picker.
`ENABLED_ADD_FIELD_SURFACES` (`src/constants.ts`) runs `'add-surface'` alone.

The old surfaces are **dormant, not deleted**: `FieldComposer/`,
`CreateDataField/` and `usePendingForms` still compile and still work — putting
their ids back in the roster restores them verbatim. That is deliberate, and
deleting them is a decision the user makes, not a mop-up. **It is deliberately
*not* filed in ISSUES.md** — the item that tracked it was deleted 2026-08-22
because the user knows the stack is there and is not ready to purge it; an
unfiled standing state, not an oversight. Don't re-file it. `pendingMode` is
**not** in that set any more: the Add Surface's value slot is the kind's real
Renderer in `pendingMode`, so it is load-bearing again.

**Why:** the composer and the legacy `+ Add Field` were scaffolding for the data
model and the registry/manifest rebuild, never the real answer — but a live
comparison in the running app was worth more than reading the old code
afterwards, which is what the roster mechanism bought.

**How to apply:** the `[Fields UI]` tag is **gone** — retired 2026-08-22 along
with the whole per-pass tag convention in ISSUES.md, because it had drifted to
marking four items none of which were composer-bound. Don't tag anything. A
dependency between items goes in the item's prose. The contract for the surface is
`docs/SPECIFICATION.md → The Add Surface`; the non-obvious choices are in
`docs/IMPLEMENTATION.md → The Add Surface`. See [[working-style-docs-and-smells]].
