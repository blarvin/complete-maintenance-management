# DataField Components — text-kv Baseline Refactor

## Goal

Land the Component/Template/Instance spine as a **plumbing-only refactor**. No Templates are seeded — the `templates` table ships empty. A follow-up plan will add the 4 SPEC-defined Templates (and, with them, restore the ability to create fields).

**Intentional temporary UX gap** between this plan and the follow-up:
- `CreateDataField` dropdown will be empty.
- New nodes will be created with zero default fields.

This is acceptable; the next plan closes the gap.

See SPECIFICATION.md → "DataField Components, Templates, and Library".

## Scope (in)

- Introduce `DataFieldTemplate` entity, persisted in Dexie, **empty at boot**.
- Refactor `DataField`: drop `fieldValue`, add `templateId`, `componentType`, typed `value`.
- Refactor `DataFieldHistory`: discriminated union on `componentType`, rename `property` to `"value"`, widen `prevValue`/`newValue` shape.
- Adapter Template CRUD (the next plan uses it to create the 4 SPEC templates).
- Delete `DATAFIELD_LIBRARY` / `DEFAULT_DATAFIELD_NAMES` exports and all consumers.
- Update adapters, commands, queries, UI wiring to the new shape.

## Scope (out)

- No migration. Existing IndexedDB + Firestore emulator data is wiped (per user decision).
- No seeding of any kind. No `seedTemplates.ts`, no `nameToTemplateId()`, no seed guard key.
- No new Components yet (`enum-kv`, `measurement-kv`, `single-image` are follow-ups).
- No Template authoring UI.
- No `componentVersion`, `category`, or `builtIn` fields.

## Architecture note (plan vs. repo reality)

The original draft of this plan referred to `FieldService` / `NodeService`. The codebase has since moved to CQRS:

- **Writes** go through `CommandBus` (`src/data/commands/handlers.ts`), dispatched via `getCommandBus().execute({ type, payload })`.
- **Reads** go through `getNodeQueries()` / `getFieldQueries()` (`src/data/queries/index.ts`).
- Legacy `INodeService` / `IFieldService` are deprecated-type-only in `src/data/services/index.ts`.

This plan targets the CQRS layer, not the deprecated services.

---

## Implementation Steps

### 1. Types (`src/data/models.ts`)

- Add `type ComponentType = "text-kv"` (union; future variants extend here).
- Add `type DataFieldTemplate = { id, componentType, label, config, updatedBy, updatedAt }`. `config` typed via discriminated union keyed on `componentType`; for `text-kv`: `{ maxLength?: number; multiline?: boolean; placeholder?: string }`.
- Update `DataField`:
  - Remove `fieldValue`.
  - Add `templateId: ID`, `componentType: ComponentType`, `value: DataFieldValue | null`.
  - Keep `fieldName` (snapshot of Template `label` at creation time).
  - `DataFieldValue` is a union type; for Phase 1 it's just `string` (text-kv). Future variants widen it.
- Update `DataFieldHistory` as a discriminated union on `componentType`. Phase 1: single variant `{ componentType: "text-kv"; prevValue: string | null; newValue: string | null; ...shared }`. Add `componentType` to shared fields. Change `property` constraint from `"fieldValue"` to `"value"`.

### 2. Dexie schema (`src/data/storage/db.ts`)

- Add `templates!: Table<DataFieldTemplate, string>` to `AppDatabase`.
- Bump to `version(3)`. Since no migration is needed, the upgrade function clears all non-sync tables (`nodes`, `fields`, `history`, `templates`) and also clears `syncQueue` / `syncMetadata` so stale rows from the old shape don't poison the new one.
- New schema:
  ```
  nodes: 'id, parentId, updatedAt, deletedAt'
  templates: 'id, componentType, updatedAt'
  fields: 'id, parentNodeId, templateId, componentType, cardOrder, updatedAt, deletedAt'
  history: 'id, dataFieldId, parentNodeId, updatedAt, rev'
  syncQueue: 'id, status, timestamp, entityType'
  syncMetadata: 'key'
  ```
- Update `SyncOperation` union: add `'create-template' | 'update-template' | 'delete-template'`. Update `SyncQueueItem.entityType` union: add `'template'`.

### 3. Seeding — intentionally skipped

No seed module, no guard key, no `nameToTemplateId()`. The `templates` table exists (step 2) and ships empty. The follow-up "4 SPEC templates" plan will write the first rows via `adapter.createTemplate` in a one-shot script or boot hook of its own choosing.

### 4. Constants (`src/constants.ts`)

- **Delete** `DATAFIELD_LIBRARY` export, `DATAFIELD_LIBRARY_NAME` type, and `DEFAULT_DATAFIELD_NAMES` export.
- Leave a brief comment block in place of the deleted block, naming the previously-prototyped labels as historical reference only. No exported symbol.
- Add `COLLECTIONS.TEMPLATES = "dataFieldTemplates"` for the Firestore collection name.

### 5. Adapters

- **`StorageAdapter` interface** (`src/data/storage/storageAdapter.ts`):
  - Add Template ops: `listTemplates()`, `getTemplate(id)`, `createTemplate(input)`, `updateTemplate(id, updates)`.
  - Replace `StorageFieldCreate.fieldValue` with `templateId: ID` (and optional `value: DataFieldValue | null` for future; Phase 1 always null on create).
  - Replace `StorageFieldUpdate.fieldValue` with `value: DataFieldValue | null`.
  - Add `applyRemoteTemplate(template)` on `SyncableStorageAdapter` plus `getAllTemplates()` and `pullAllTemplates()` on `RemoteSyncAdapter`.
- **`src/data/storage/IDBAdapter.ts`**:
  - Implement Template CRUD against `db.templates`. `createTemplate` / `updateTemplate` enqueue sync ops **only** when called through normal API (seeding writes direct to `db.templates` and skips the queue, as noted above).
  - Update field CRUD: read/write `templateId`, `componentType`, `value` instead of `fieldValue`. On `createField`, fetch the Template, snapshot `fieldName := template.label` and `componentType := template.componentType`, initialize `value := null`.
  - Update history writes: include `componentType`, set `property: "value"`, use `prevValue` / `newValue` as `DataFieldValue | null`.
- **`src/data/storage/firestoreAdapter.ts`**: same shape changes. New Firestore collection `dataFieldTemplates`.
- `migrateFromFirestore()` in `initStorage.ts`: extend to pull templates too (`pullAllTemplates`) and `bulkPut` into `db.templates`.

### 6. CQRS layer

**Commands** (`src/data/commands/types.ts` + `handlers.ts`):

- Add `ADD_FIELD_FROM_TEMPLATE` command: `payload: { nodeId: string; templateId: ID; cardOrder?: number }`. Result: `DataField`.
  - Handler: fetch the Template via adapter.getTemplate, then call `adapter.createField({ id, parentNodeId: nodeId, templateId, cardOrder })`. Template snapshot (label → fieldName, componentType) happens inside the adapter.
- Keep `ADD_FIELD` in the union for now **but mark deprecated** — it's unused once `CreateDataField` is rewired. (We delete it in step 7 once the UI migration is in.)
- Update `UPDATE_FIELD_VALUE`: payload's `newValue` typed as `DataFieldValue | null`. Handler calls `adapter.updateFieldValue(id, { value })`.
- Update `CreateNodeInput.defaults`: change from `{ fieldName, fieldValue }[]` to `{ templateId: ID }[]`. Handler resolves snapshot inside `createField`. Callers that build `defaults` (see step 7) now pass template IDs resolved via `nameToTemplateId()`.

**Queries** (`src/data/queries/types.ts` + `index.ts`):

- Add `ITemplateQueries` interface: `listTemplates()`, `getTemplateById(id)`, `getTemplateByName(label)`.
- Add `templateQueriesFromAdapter(adapter)`, `getTemplateQueries()`, `initializeQueries()` wires it up, `setTemplateQueries()` / `resetQueries()` for tests.
- `IFieldQueries`: unchanged signatures; the returned `DataField` shape is just different.

**Init** (`src/data/storage/initStorage.ts`):

- No seed call. `initializeQueries(adapter)` now also builds template queries.
- `migrateFromFirestore()` extended to pull templates via `pullAllTemplates()` and bulkPut into `db.templates` (handles the case where templates already exist in Firestore from the follow-up plan having run elsewhere).

### 7. UI wiring

- **`CreateDataField`** (`src/components/CreateDataField/CreateDataField.tsx`):
  - Data source changes from `DATAFIELD_LIBRARY` (strings) to `getTemplateQueries().listTemplates()`.
  - Render `template.label`; on selection, dispatch `getCommandBus().execute({ type: 'ADD_FIELD_FROM_TEMPLATE', payload: { nodeId, templateId: template.id } })`.
  - With no templates seeded, the list renders empty — acceptable for this intermediate state.
- **`TreeNodeConstruction`** and anywhere `DEFAULT_DATAFIELD_NAMES` / `CreateNodeInput.defaults` is built: remove the default-field construction entirely. New nodes create with `defaults: []`.
- **`useNodeCreation.ts` / `usePendingForms.ts`**: strip references to `DEFAULT_DATAFIELD_NAMES` and default-field construction. Pending forms carry no default fields.
- **`DataField`** (`src/components/DataField/DataField.tsx`): replace reads of `field.fieldValue` with `field.value`. Type-narrow on `field.componentType`; Phase 1 only has a `text-kv` branch (string value), so behavior is unchanged.
- **`FieldList`** / **`DataFieldDetails`**: read `value` not `fieldValue`; history entries expose `prevValue` / `newValue` typed via the discriminated union — Phase 1 just renders strings.
- **`useFieldEdit.ts`**: update `UPDATE_FIELD_VALUE` payload field name from `newValue: string | null` to `newValue: DataFieldValue | null` (still a string at runtime for text-kv).
- **Snackbar undo**: closure captures previous value; no semantic change.
- **Delete `ADD_FIELD`** from the command union + handler once no callers remain. Grep to confirm.

### 8. Tests

- `src/test/testUtils.ts` factories: `makeDataField` produces a text-kv instance with a `templateId`; add `makeTemplate`.
- Adapter tests (`idbAdapter.test.ts`, `firestoreAdapter.test.ts`): cover Template CRUD and the new DataField shape. Drop `fieldValue` assertions.
- Command-handler tests (`commandHandlers.test.ts`): new `ADD_FIELD_FROM_TEMPLATE` case; update `CREATE_NODE_WITH_FIELDS` to use `templateId`s (tests will insert a Template row in setup since no seeding runs).
- `createNodeService.test.ts` / `serviceLayer.test.ts`: rework for the new command payloads. If the tests target the deprecated services only and don't gate CI-relevant behavior, acceptable to delete and rely on command-handler coverage.
- `dbSchema.test.ts`: add assertion for `templates` table existence + new field indexes.
- Sync tests (`FullCollectionSync.test.ts`, `DeltaSync.test.ts`, `syncManager.test.ts`, `ServerAuthorityResolver.test.ts`): extend to cover templates collection.
- `appState.test.ts`: update any `fieldValue` assertions.
- Cypress: no spec changes expected (UX unchanged). Before running E2E, wipe the emulator DB since the shape changed.

### 9. Typecheck + lint

- `npm run typecheck` clean.
- `npm run lint` clean.

---

## Verification (user smoke test)

This is a plumbing refactor with an intentional UX gap. Verification checks that nothing is broken, not that existing UX is preserved.

Run `npm run dev`, open the app, then:

1. **Wipe local data first.** In devtools → Application → IndexedDB, delete the `complete-maintenance-management` DB (version 3's clear-on-upgrade should also handle this, but start clean to be sure).
2. **App loads** without console errors. Root view renders.
3. **Create a new asset** at ROOT. Confirm the node is created with **no default fields** (expected — nothing to seed from).
4. **Open the `+` field-add menu.** Confirm it renders as an empty list (expected).
5. **Reload the app.** Confirm the node persists, still has no fields, no errors.
6. **DevTools → Application → IndexedDB** → confirm `templates` table exists and is empty, `fields` table is empty, `nodes` table has the created node with the new shape (no `fieldValue` field on fields).
7. **`npm run typecheck` and `npm run lint`** pass.
8. **Unit tests pass** (`npm run test`).

Pass criteria: steps 2–8 all clean. The UX gap (no defaults, empty dropdown) is expected and is closed by the follow-up plan.

---

## Risks & Mitigations

- **Firestore emulator data stale**: wipe the emulator before running Cypress or any sync tests.
- **Adapter + command changes must land together**: handlers will break if only IDBAdapter is updated. Do both adapters and both command/query updates in the same commit.
- **Intentional UX gap**: between this plan and the follow-up, users can't create fields. Keep the two plans temporally close (don't ship this one alone to production).
- **History discriminated union typing pain**: widening `prevValue` / `newValue` to a union means existing narrow `string | null` checks need to narrow via `componentType`. Phase 1 has only one variant, so the union is trivially discriminated — keep narrowing helpers colocated with the type.
- **Legacy `ADD_FIELD` command removal**: delete only after grep confirms zero callers. Stale references in deprecated service files are fine to delete along with the commands if they're already unused.

---

## Project Context Management

After verification is complete, update project documentation:

1. **ISSUES.md** — Mark off completed work items related to the Components/Templates spine.
2. **IMPLEMENTATION.md** — Add a short note explaining the Template/Instance split, the `ADD_FIELD_FROM_TEMPLATE` command, the deliberate no-seed starting state (templates created only by the follow-up plan), and the discriminated-union shape of `DataField.value` and `DataFieldHistory.prevValue`/`newValue`.
3. **LATER.md** — Add deferred items surfaced during implementation:
   - `componentVersion` field (Template versioning, contract versioning)
   - User-authored Templates + Template-builder UI
   - Firestore blob sync (needed once `single-image` lands)
   - Orphaned-blob GC
   - Template sharing scope (private / workspace / global) and moderation
   - Composite Component (`composite-kv`) and recursive Template configs
   - Additional Components identified but not yet specced: `number-kv`, `date-kv`, `image-carousel`, `image-grid`, `image-aggregator`
   - Unit conversion for `measurement-kv`
