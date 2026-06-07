# Unified Element Data Model — Refactor Plan

## Context

The codebase currently has two parallel primitives: `TreeNode` (hierarchy containers) and `DataField` (typed values attached to a node), each with their own Dexie store, adapter methods, services, commands, queries, and history table. The SPEC and `opus_chat_unified_data_model.md` have converged on a unified **Element** primitive: one recursive entity discriminated by `kind` (`"node"` for containers, `"text-kv" | "enum-kv" | "number-kv" | "single-image"` for value-bearing). One `elements` store, one `elementHistory` log, one service/command/query surface. This unblocks Logbook/Equipment Plate renderers and fixes long-standing gaps (node renames unlogged, no uniform `siblingOrder`).

The refactor is structural, not feature-adding. Scope is Phase-1 columns only (no `virtualParents`, `componentVersion`, `customProperties`, `isRequired/Locked/Editable`). `subtitle` stays a column on Element; demotion to a child Element is deferred (LATER).

Decisions locked with the user: wipe-on-upgrade (Dexie v7 + Firestore emulator wipe), full rename to `elementService`/element commands, uniform `siblingOrder` for all children, components keep their UI-role names (TreeNode/DataCard/DataField), FSM IDs rename to `elementId`, tests updated per-commit to keep CI green.

## Target Model

```ts
type Kind = "node" | "text-kv" | "enum-kv" | "number-kv" | "single-image";

interface Element {
  id: ID;
  kind: Kind;
  name: string;                    // required, max 100
  subtitle: string | null;         // node-scoped Phase-1
  value: DataFieldValue | null;    // null when kind === "node"
  parentId: ID | null;             // null = root
  siblingOrder: number;            // incremental, renumber-the-run
  fieldDefinitionId: ID | null;    // null for nodes
  updatedBy: UserId;
  updatedAt: number;
  deletedAt: number | null;
}

interface ElementHistory {
  id: string;                              // `${elementId}:${rev}`
  elementId: ID;
  rev: number;
  property: "value" | "name" | "subtitle" | "parentId" | "siblingOrder";
  prevValue: unknown;
  newValue: unknown;
  updatedBy: UserId;
  updatedAt: number;
}
```

`FieldDefinition` is unchanged. `componentType` on a definition becomes the `kind` literal on its instances.

## Commit Plan

Each commit must `npm run typecheck && npm run test` clean. Components keep their names; renames are at the data/service/command/query/state layers.

### Commit 1 — Element types + Dexie v7 wipe-on-upgrade

- `src/data/models.ts`: add `Element`, `ElementHistory`, `Kind`. Keep `TreeNode`/`DataField` types as deprecated aliases during transition (deleted in Commit 6) so the file compiles while later commits update consumers. Keep `FieldDefinition` and value/config types untouched.
- `src/data/storage/db.ts`: bump to v7. New stores `elements` (`id, parentId, kind, fieldDefinitionId, siblingOrder, updatedAt, deletedAt`) and `elementHistory` (`id, elementId, updatedAt, rev, [elementId+rev]`). Drop `nodes`, `fields`, `history` in the v7 upgrade (wipe pattern matches v3–v6). Keep `fieldDefinitions`, `syncQueue`, `syncMetadata`.
- `src/constants.ts`: collapse `COLLECTIONS.NODES/FIELDS/HISTORY` → `COLLECTIONS.ELEMENTS`, `COLLECTIONS.ELEMENT_HISTORY`. Keep `FIELD_DEFINITIONS`.
- No adapter/service/UI behavior changes yet — old code still references old types via aliases. Tests: db schema test asserting v7 stores exist.

### Commit 2 — Storage adapters: ElementStorageAdapter

- `src/data/storage/storageAdapter.ts`: replace `StorageAdapter` with element-shaped methods:
  - `listRootElements()`, `getElement(id)`, `listChildren(parentId)`, `listChildrenByKind(parentId, kind)`
  - `createElement(input)`, `updateElement(id, patch)`, `softDeleteElement(id)`, `restoreElement(id)`
  - `nextSiblingOrder(parentId)`
  - `getElementHistory(elementId)`
  - FieldDefinition methods unchanged
  - `SyncableStorageAdapter`: `getAllElements()`, `getAllElementHistory()`, `applyRemoteElement()`, `applyRemoteElementHistory()`, `deleteElementLocal()`
- `IDBAdapter.ts`: rewrite against the `elements`/`elementHistory` tables. Soft delete via `deletedAt`. `nextSiblingOrder` = `max(siblingOrder where parentId=?) + 1`. History entries use composite `${id}:${rev}` key; rev via `computeNextRev`.
- `firestoreAdapter.ts`: same methods, mapped to `elements` and `elementHistory` collections. Subcollection structure: top-level `elements/{id}` and `elementHistory/{id}` to match local indexes.
- `historyHelpers.ts`: generalize `createHistoryEntry()` to accept any `property` value and a generic `prevValue`/`newValue`.
- Tests: adapter unit tests (fake-IndexedDB) for create/update/delete/restore, history append for all five `property` values, `siblingOrder` mint and renumber-on-insert.

### Commit 3 — Commands, queries, services renamed to Element

- `src/data/commands/types.ts`:
  - `CREATE_ELEMENT` (replaces `CREATE_EMPTY_NODE` and `ADD_FIELD_FROM_DEFINITION` — payload `{kind, parentId, name, subtitle?, fieldDefinitionId?, value?}`)
  - `UPDATE_ELEMENT_NAME`, `UPDATE_ELEMENT_SUBTITLE`, `UPDATE_ELEMENT_VALUE`, `MOVE_ELEMENT` (parentId / siblingOrder), `DELETE_ELEMENT`, `RESTORE_ELEMENT`
  - `CREATE_FIELD_DEFINITION` unchanged
- `src/data/commands/handlers.ts`: rewire to `elementService` + adapter. Each command appends an `ElementHistory` row with the matching `property`.
- `src/data/queries/types.ts`:
  - `IElementQueries`: `getRootElements()`, `getElementById(id)`, `getChildren(parentId)`, `getChildrenByKind(parentId, kind)`, `getElementHistory(id)`, `nextSiblingOrder(parentId)`
  - `IFieldDefinitionQueries` unchanged
- `src/data/queries/index.ts`: `getElementQueries()`, drop `getNodeQueries()`/`getFieldQueries()`.
- `src/data/services/index.ts`: `getElementService()` (single service). Drop `getNodeService()`/`getFieldService()`.
- Tests: command-bus unit tests for each command, query tests for tree traversal and child-by-kind.

### Commit 4 — UI consumption: TreeNode + DataCard + DataField rewired

Components keep filenames; props/internals shift to Element.

- `src/components/TreeNode/types.ts`: `TreeNodeDisplayProps` drops `nodeName`/`nodeSubtitle`/`parentId` named fields and takes `{element: Element, nodeState: 'ROOT'|'PARENT'|'CHILD', ...callbacks}`. Same for construction props.
- `src/components/TreeNode/useTreeNodeFields.ts` → `useElementChildren.ts`: calls `getElementQueries().getChildrenByKind(elementId, 'text-kv' | ...)` or just `getChildren` and filters by `kind !== 'node'` for DataCard, `kind === 'node'` for child nodes. Single hook, two consumers.
- `src/components/DataField/DataField.tsx`: prop shape becomes `{element: Element}`; dispatcher reads `element.kind` (was `componentType`). Edit/delete call `UPDATE_ELEMENT_VALUE` / `DELETE_ELEMENT`.
- `src/components/TreeNode/TreeNode.tsx`: orchestrator reads `element.name`/`element.subtitle`. Construction form calls `CREATE_ELEMENT({kind:'node'})`.
- `src/components/CreateNodeButton/*`, add-field UI: call `CREATE_ELEMENT` with the appropriate `kind`.
- Children sorted by `siblingOrder` ascending — drops the old `updatedAt` sort on child nodes.
- Tests: existing component tests retargeted; DataField dispatcher table covers all four kinds.

### Commit 5 — FSM/UIState rename to elementId

- `src/state/appState.types.ts`:
  - `ViewState`: `{state:'BRANCH'; elementId: string}`
  - `UnderConstructionData`: `{id, parentId, kind, name, subtitle}`
  - `UIState`: keep two sets but rename — `expandedCards` (keyed by container elementId) and `expandedFieldDetails` (keyed by field elementId); drop `expandedNodeDetails` if redundant, otherwise rename consistently.
  - `editingFieldId` → `editingElementId`.
- `src/state/appState.transitions.ts` + `appState.selectors.ts`: rename throughout; persisted localStorage key bumped (e.g. `appState.v2`) so old persisted state is discarded cleanly.
- Tests: FSM transition tests updated.

### Commit 6 — Sync layer + cleanup

- `src/data/sync/*` (SyncManager, SyncQueueManager): retarget to `elements`/`elementHistory`. Queue entries reference elementId, not nodeId/fieldId. Server-authority conflict resolution unchanged conceptually (newer `updatedAt` wins).
- Remove deprecated `TreeNode`/`DataField` type aliases from `models.ts`.
- Remove `LEGACY_ADD_FIELD_ENABLED` if dead.
- Update `SPECIFICATION.md`: Concepts & Vocabulary, Component Architecture, FieldDefinition hierarchy now reference Element + storage terms; add Migration & Naming row (TreeNode/DataField → Element parallel to Template → FieldDefinition).
- Update `CLAUDE.md`: reflect `getElementService()` / `getElementQueries()` and the unified sort policy (already partially done).
- Update `ISSUES.md`: tick off the Refactor: Unified Element Model items.
- Update `LATER.md`: subtitle→child element demotion; renderer registry threshold per kind; history `property` enum evolution path.

## Critical Files

- `src/data/models.ts` — types
- `src/data/storage/db.ts`, `IDBAdapter.ts`, `firestoreAdapter.ts`, `storageAdapter.ts`, `historyHelpers.ts`
- `src/data/commands/{types,handlers,commandBus}.ts`
- `src/data/queries/{types,index}.ts`
- `src/data/services/index.ts`
- `src/state/appState.{types,transitions,selectors}.ts`
- `src/components/TreeNode/{TreeNode.tsx,types.ts,useTreeNodeFields.ts}`
- `src/components/DataField/DataField.tsx` + the four kind-specific subcomponents
- `src/constants.ts`

## Reused Existing Code

- `historyHelpers.createHistoryEntry()` / `computeNextRev()` — generalize, don't rewrite.
- `filterActive()` / `filterDeleted()` / `isSoftDeleted()` — unchanged.
- `CommandBus.register/execute` — unchanged; only command set changes.
- Dexie wipe-on-upgrade pattern from v3/v4/v5/v6 — reuse for v7.
- Storage event bus, StorageResult/StorageError plumbing — unchanged.

## Verification & Manual Test

Automated (gates each commit):
- `npm run typecheck`
- `npm run test`
- `npm run lint`

End-to-end manual test (after Commit 6, with cleared local IndexedDB and emulator):

1. `npm run dev`, open app — ROOT view should be empty. Open DevTools → Application → IndexedDB: confirm `elements`, `elementHistory`, `fieldDefinitions`, `syncQueue`, `syncMetadata` stores; no `nodes`/`fields`/`history` stores.
2. Create a root node "Truck 1". Verify it renders, persists across reload.
3. Create two child nodes "Engine" and "Brakes" under Truck 1. Verify they render in creation order (siblingOrder 1, 2).
4. Open Truck 1's DataCard, add three fields from the library: a text-kv "VIN", a number-kv "Odometer", an enum-kv "Status". Verify fields render in add order, edit each value once, confirm value persists.
5. In DevTools → IndexedDB → elementHistory: should see one `value` history row per edit, with `${elementId}:1` keys. Rename Truck 1 → verify a `name` history row appears.
6. Delete the Engine node (soft delete). Verify it disappears from the tree; in DevTools confirm `deletedAt` is set and child Engine elements are still present (no cascade).
7. Restart `npm run dev`, reload. State persists. Navigate ROOT → Truck 1 → Brakes and back via Up button.
8. With Firebase emulator running and `localStorage.setItem('USE_EMULATOR','true')`, force a sync. Inspect emulator UI: `elements/{id}` and `elementHistory/{id}` documents exist; no legacy collections.
9. Cypress: `npm run cypress` — full E2E suite passes against the emulator.

Expect: a clean rebuild experience. Any data created on the prior schema is gone (wipe-on-upgrade) — that's intentional and matches every previous schema bump.

## Project Context Management

After user verifies end-to-end:

1. **ISSUES.md** — tick off Refactor: Unified Element Model items (stores merge, column renames, history widen, uniform siblingOrder, SPEC reconciliation, Naming/Migration row).
2. **IMPLEMENTATION.md** — note the wipe-on-upgrade decision for v7, the composite `${elementId}:${rev}` history key, and that components keep TreeNode/DataCard/DataField names as UI roles distinct from the Element storage primitive.
3. **LATER.md** — record deferred: subtitle → child Element (`kind:"nodeSubtitle"`); renderer registry re-rooting threshold per kind; `property` enum evolution for computed values / reference edges (Phase 2); fractional `siblingOrder` keys if renumber-the-run shows pathological cost.
