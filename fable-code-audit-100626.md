# Fable Code Audit — 2026-06-10

Scope: full read of `src/` (110 production files, ~9,250 lines TS/TSX, plus ~3,800 lines of tests and ~1,800 of CSS), with SPECIFICATION.md / KINDS-SPECS.md / LATER.md / ISSUES.md read for direction. Items already queued in ISSUES.md or LATER.md are not re-litigated here unless the code changed my view of them.

**Headline:** the codebase is in good shape — layering is real, the Element model is the right spine, and the kind-registry direction in KINDS-SPECS.md is exactly where the leverage is. The size problem is not over-engineering of any one piece; it is that **three architecture eras coexist** (pre-unified TreeNode/DataField, unified Element, kind-registry) and each migration left its predecessor's scaffolding alive. Almost everything below is some form of "finish the migration, delete the old era." I estimate ~20–25% of production code can be deleted with zero feature loss, and the conceptual surface shrinks more than the line count does.

---

## 1. What's genuinely good (keep doing this)

- **The Element/ElementHistory/FieldDefinition trio** is small, honest, and matches the spec. `historyHelpers.ts` is a model citizen: pure, shared, tested.
- **KIND_REGISTRY** (`src/kinds/`) with `satisfies Record<ComponentType, KindManifest>` is the best seam in the codebase. KINDS-SPECS.md's plan to widen the key to the full `Kind` union and derive the unions from the registry is correct — that's the plugin property, and the code is already 80% of the way there.
- The FSM (`appState.`*) is small, guarded, and tested. Don't grow it; don't shrink it either.
- Sync collaborators (`SyncPusher` / strategies / `ServerAuthorityResolver` / `SyncLifecycle`) are each genuinely single-purpose. The decomposition is right even if the layer as a whole is questioned below (§2.2).
- Test discipline: domain logic tested at the service/adapter layer, not through components.

---

## 2. Foundational findings (architectural simplification)

These are the "real change" items. Each one removes a *concept*, not just lines.

### 2.1 There is one write model, not two — stop maintaining the second

`FirestoreAdapter` (507 lines) implements **both** `StorageAdapter` (full CRUD with history diffing, rev minting, sibling-order minting, validation) **and** `RemoteSyncAdapter` (applySyncItem + pulls). In production, only the `RemoteSyncAdapter` half is ever reached: `initStorage.ts` wires the command bus and queries to `IDBAdapter` exclusively, and `FirestoreAdapter` is only handed to `SyncManager` and the one-time migration — both of which use only the sync surface.

That means roughly 300 lines of `firestoreAdapter.ts` (lines 78–145, 277–506: `listRootElements`, `createElement` with history writes, `updateElement` with `diffElementChanges`, `softDeleteElement`, `restoreElement`, `nextSiblingOrder`, `nextElementRev`, …) are **dead in production and, worse, are a second copy of the domain write model** that must be kept in lockstep with `IDBAdapter` forever. Every future write-model change (composites' atomic multi-element create from KINDS-SPECS is coming!) currently costs 2×.

**Recommendation:** declare the architecture what it actually is — *IDB is the write model; Firestore is a sync mirror.* Strip `FirestoreAdapter` down to `RemoteSyncAdapter` only (~150 lines). Update CLAUDE.md's "Adapter Pattern" framing: the swappable-backend story is served by `RemoteSyncAdapter`, not by two parallel CRUD implementations. This also makes the upcoming composite-creation transaction a single-site change.

(If you ever truly need a second full backend, the right shape is an `ElementWriteService` that owns diff/rev/order/queue/event logic over a dumb KV adapter — but don't build that now; deleting the duplicate is the Phase-1 move.)

### 2.2 You are running two offline caches and two sync engines

**✅ RESOLVED 2026-06-11** — Firestore now uses `memoryLocalCache()` unconditionally; Dexie + syncQueue is the only offline cache. Orphaned SDK mirror DBs on existing devices are cleanable via `clearFirebaseIndexedDB()` (kept, re-documented).

`firebase.ts:62-66` initializes Firestore with `persistentLocalCache` — the SDK's own IndexedDB offline cache with queued writes and reconciliation — while the app's actual offline layer is Dexie + syncQueue + SyncManager. Every element is therefore persisted in IndexedDB **twice** (once in `complete-maintenance-management`, once in Firestore's mirror), and two write queues exist (yours, and the SDK's).

The bespoke sync layer is the spec-blessed, backend-agnostic one — keep it. But then Firestore should be a dumb wire: switch to `memoryLocalCache()` in the browser too. You get one cache, one queue, and you eliminate a whole class of "which layer answered this read?" confusion (the SDK cache can serve stale pulls into your delta sync). One-line change plus retesting the emulator flows.

(The radical alternative — delete the custom sync layer (~600 lines + 5 test files) and lean on Firestore offline persistence — is real, but it forfeits backend independence and server-authority semantics the spec wants. Naming it so it's a decision, not an accident.)

### 2.3 Four change-propagation mechanisms; one would do

**✅ RESOLVED 2026-06-11** (with §4.4) — collapsed to the bus: `useElementChildren`/`useElementById` subscribe to `storageEventBus` with pure relevance predicates (`storageEventRelevance.ts`) and a 30ms trailing debounce. Deleted: `storageEvents.ts`, `useStorageChangeListener`, all `dispatchStorageChangeEvent()` sites, and the `onDeleted$`/`onCreated$`/`onCommitted$` reload threading. `useFieldValueSync` kept as the per-field specialization of the same model. Found during verification: the UC TreeNode needed a namespaced key (`uc-${id}`) because the bus reload surfaces the new node while construction is still open, and a shared key made Qwik's reconciler reuse the construction instance instead of unmounting it (the old post-completion reload had masked this).

Today, "data changed → UI updates" travels by four distinct routes:

1. `storageEventBus` (in-memory pub/sub) → nodeIndex, sync trigger, `useFieldValueSync`, FieldComposer refresh, DataFieldDetails refresh.
2. `dispatchStorageChangeEvent()` → window `CustomEvent('storage-change')` → `useStorageChangeListener` → view reloads (fired only by SyncManager and init).
3. Callback-prop threading: `onUpdated$` / `onDeleted$` / `onCreated$` / `onCommitted$` → `reload$` chains through DataField → FieldList → TreeNode → views.
4. `useFieldValueSync` per-field bus subscription that **bypasses props entirely** because, per its own comment, the props chain "doesn't reliably propagate in time."

Route 4's existence is the tell: the renderers seed `currentValue` from `props.value` once and then ignore props, so the component tree's data flow has already been abandoned where it matters. Meanwhile routes 2 and 3 both exist to trigger the same `getChildren()` reloads.

**Recommendation:** collapse to the bus. Make `useStorageChangeListener` subscribe to `storageEventBus` (the SyncManager already emits per-element events via `applyRemoteElement`; the window event adds nothing the bus doesn't know), and let the three data hooks (`useRootViewData`, `useBranchViewData`, `useTreeNodeFields`) reload on relevant bus events. Then delete: `storageEvents.ts`, the window-event plumbing, and most of the `onUpdated$`/`onDeleted$`/`onCreated$` threading (DataField's delete no longer needs to tell FieldList anything — the bus already announced it). One mental model: *writes emit; readers subscribe.*

This is the single biggest conceptual cleanup available in the UI layer, and it's also the prerequisite that makes future kinds (derived/aggregator fields from KINDS-SPECS) sane — those will need exactly this subscription model.

### 2.4 Retire the legacy TreeNode/DataField data vocabulary ✅ *(done 2026-06-13)*

> **Resolved.** The three legacy types (`TreeNode`, `DataField`, `DataFieldHistory`), both `elementTo*` mappers, and `projectValueHistory` are deleted. View props are now flat Element vocabulary (`name`, `subtitle`, `siblingOrder`, `kind`) — chosen over `{ element: Element }` because the construction branch has no persisted Element and `NodeHeader` is shared display/construction. The history viewer consumes `ElementHistory` directly. See IMPLEMENTATION.md → "Unified Element Model".

The unified Element model landed in storage, but the view layer still speaks the old language through transitional adapters:

- `models.ts`: legacy `TreeNode`, `DataField`, `DataFieldHistory` types + `elementToTreeNode` / `elementToDataField` mappers (explicitly marked "transition").
- `DataFieldDetails.tsx:139-159`: `projectValueHistory` re-projects `ElementHistory` back into the legacy `DataFieldHistory` shape just to render it.
- Field renderers and hooks juggle `cardOrder`/`siblingOrder`, `parentNodeId`/`parentId`, `fieldName`/`name` synonyms.

Per SPEC, the component *names* (TreeNode, DataField) rightly survive as renderer identifiers — but the *prop shapes* can now be Element-shaped. Have `TreeNode` take `{ element: Element }` (kind `node`), `DataField` take the element row, and `DataFieldHistory` consume `ElementHistory` directly. Then delete the three legacy types, both mappers, and `projectValueHistory`. This removes the last era-1 vocabulary and ends the per-feature "which name does this layer use?" tax. (~150 lines plus real conceptual load.)

### 2.5 The composer's handle-threading can be deleted — the data is already external ✅ *(done 2026-06-13)*

> **Resolved.** Commit/discard moved to a plain module `src/data/services/pendingDraft.ts`; construction commit runs in `useNodeCreation.complete$` (reads localStorage by nodeId after the node exists). All handle types (`FieldComposerHandle`/`FieldComposerSlotHandle`/`FieldListHandle`), both `handleRef` props, the `afterNodeCreated$` relay, and the render-time handle wiring are deleted. Persistence is now write-through in `usePendingForms` so the draft is current at Create time. See IMPLEMENTATION.md → "Draft Store & commit-with-undo".

The hairiest object graph in the app is: `TreeNodeConstruction` → `FieldList` (`handleRef`) → `FieldComposerSlot` (`FieldComposerSlotHandle`, built during render — a side effect Qwik won't love) → `FieldComposer` (`FieldComposerHandle` via `useVisibleTask$`) → `usePendingForms`. Three handle types and four files exist so the node's Save button can reach into a mounted composer and call `commitAll$`.

But `usePendingForms` already persists the draft in **localStorage keyed by nodeId** (that's its whole feature — drafts survive navigation). The commit operation needs nothing from the mounted component: it reads rows, executes `CREATE_ELEMENT_FROM_DEFINITION` per row, clears the draft.

**Recommendation:** move `commitPendingDraft(nodeId, baseOrder)` and `discardPendingDraft(nodeId)` into a plain module (e.g. `src/data/services/pendingDraft.ts`) that reads/writes the localStorage draft directly. `TreeNodeConstruction.handleCreate$` calls it after the node exists; the composer keeps using the same functions internally. Delete `FieldComposerSlotHandle`, `FieldComposerHandle`, both `handleRef` props, the `afterNodeCreated$` callback relay in `useNodeCreation`/`CreateNodePayload`, and the render-time handle wiring in `FieldComposerSlot.tsx:73-90`. The remaining composer is just UI over a draft store — which is what it conceptually is.

### 2.6 One commit-with-undo helper instead of six copies ✅ *(done 2026-06-13)*

> **Resolved.** `src/data/services/commitWithUndo.ts` — a *plain* (deliberately non-`$`-suffixed) async helper now backs all six sites, including the discard/restore variant (execute result is threaded into the message builder and undo handler so cancel rides the same path). Naming it `commitWithUndo$` made the Qwik optimizer try to QRL-ify the options object and its captured ids — hence plain. See IMPLEMENTATION.md → "Draft Store & commit-with-undo".

The pattern *execute command → success snackbar with Undo (inverse command) → error snackbar via `describeForUser(toStorageError(err))`* is hand-rolled in at least six places:

- `useFieldEdit.save$` (useFieldEdit.ts:154-175)
- `EnumKvField.pick$` (EnumKvField.tsx:98-134)
- `DataFieldHistory.revert$` (DataFieldHistory.tsx:67-99)
- `DataField.handleDelete$` (DataField.tsx:46-68)
- `TreeNodeDisplay.handleDeleteNode$` (TreeNodeDisplay.tsx:53-74)
- `FieldComposer.handleCancel$` (discard/restore variant)

Extract one `commitWithUndo$({ message, execute, undo })` service-layer QRL. Each call site collapses to ~5 lines, undo semantics become uniform by construction, and ISSUES.md's "pendingMode boilerplate" item gets smaller for free. This also pulls EnumKvField — currently the one renderer that bypasses `useFieldEdit` entirely and re-implements outside-click/save/undo by hand — most of the way back into the shared flow; what's legitimately unique to it (popover positioning, option keyboard nav) stays.

### 2.7 The two add-field surfaces: decide

**✅ RESOLVED 2026-06-10 — decision: keep both.** The composer has *not* won; the surfaces are a deliberate A/B comparison and more variants are planned. Instead of deleting, the coordination was generalized to scale to N surfaces: `ActiveSurface` moved to a neutral home (`src/components/FieldList/addFieldSurfaces.ts`, which also documents the surface contract), and the `LEGACY_ADD_FIELD_ENABLED` boolean was replaced by an `ENABLED_ADD_FIELD_SURFACES` roster in `src/constants.ts`. The mutex signal in FieldList is unchanged — one signal, last-writer-wins, opening one surface closes the rest. Winner-picking deferred to LATER.md §Add-Field Surface A/B.

---

## 3. Dead and test-only code (safe deletions)

Verified by grep — no production references:


| Item                                                                                                                       | Evidence                                                                                                                                       | Action                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/data/services/withErrorHandling.ts` (`safeAsync`, `safeAsyncVoid`, `withSafeAsync`)                                   | only referenced by its own test                                                                                                                | delete file + `errorHandling.test.ts`                                                                               |
| `src/data/utils/cardOrder.ts` (`computeCardOrderUpdates`, `sortByCardOrder`)                                               | test-only; reorder UI is deferred in LATER.md                                                                                                  | delete with its test, or park the algorithm note in LATER.md — speculative code rots faster than a paragraph        |
| `uiPrefs.ts:61-100` (`isCardExpanded`, `isFieldDetailsExpanded`, `toggleCardExpanded`, `toggleFieldDetailsExpanded`)       | production goes through appState transitions; only `uiPrefs.test.ts` calls these                                                               | delete the four helpers + their test blocks                                                                         |
| `usePendingForms.restoreAll$`                                                                                              | restore happens via remount + `restoreSeed`; nothing calls it                                                                                  | delete                                                                                                              |
| `useFieldDefinitionDraft.phase` / `start$`                                                                                 | `FieldDefinitionAuthoringForm` never calls `start$` or reads `phase`                                                                           | delete both; the hook shrinks nicely                                                                                |
| `detectDoubleTap` (useDoubleTap.ts:25-46)                                                                                  | exported "for testing", but `checkDoubleTap$` **duplicates the logic inline instead of calling it** — tests exercise a copy, not the real path | make `checkDoubleTap$` call `detectDoubleTap` (one source of truth) or delete the export and test the hook          |
| `useAsyncOperation.error`                                                                                                  | set on every failure, **read nowhere** — load errors silently vanish and views just look empty                                                 | either render it (a one-line error state in the two views) or remove the signal; current state is the worst of both |
| Commands `UPDATE_ELEMENT_NAME`, `UPDATE_ELEMENT_SUBTITLE`, `MOVE_ELEMENT`; queries `getChildrenByKind`, `nextSiblingOrder` | handlers/tests only; rename UI is ISSUES #3, reorder deferred                                                                                  | fine to keep (spec'd, cheap, tested) — just know they're unwired                                                    |


Deleting the first three rows also deletes three whole test files — the suite gets faster and stops certifying dead code.

---

## 4. Mechanical simplifications (same behavior, less code)

**4.1 Adapter try/catch boilerplate.** Every method in `IDBAdapter` (18×) and `FirestoreAdapter` repeats the identical `catch → isStorageError → mapDexieError → toStorageError` block. One private helper:

```ts
private async run<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (err) {
    if (isStorageError(err)) throw err;
    const { code, retryable } = mapDexieError(err);
    throw toStorageError(err, { code, retryable });
  }
}
```

cuts ~150 lines and makes the actual storage logic readable. Do it after §2.1 so you only do it once.

**4.2 `nextElementRev` is O(history) per write — and called on creates.** Both adapters fetch *all* history rows for an element to compute `max(rev)+1`. The Dexie schema already has the `[elementId+rev]` compound index — query its upper bound and take the last row instead of `toArray()`. And `createElement` calls it for a brand-new element where the answer is always 0 — skip the query there. (The Firestore copy does an unbounded `orderBy('rev','desc')` fetch with no `limit(1)` on every update — same fix, or it disappears with §2.1.)

**4.3 Failed sync items are stranded forever.** **✅ RESOLVED 2026-06-11** — bounded auto-retry (5 attempts riding existing sync cycles), error snackbar with Retry action on exhaustion, startup re-arm of failed items. Plus fail-fast timeouts on push writes and pulls — discovered during verification that the Firestore SDK never rejects writes against an unreachable server, so without timeouts nothing ever failed at all. `SyncQueueManager.markFailed` sets `status: 'failed'`, but `getSyncQueue()` only ever fetches `'pending'` — a failed item is never retried and never surfaced. `retryCount` exists but can never exceed 1. Either re-fetch `pending OR (failed AND retryCount < N)`, or explicitly document failed-means-dead and surface it (LATER.md's "Sync Status" item is the natural home). Right now it's silent data-loss-to-the-server.

**4.4 Consolidate the three data-loading hooks.** **✅ RESOLVED 2026-06-11** (with §2.3) — `useRootViewData`/`useBranchViewData`/`useTreeNodeFields` replaced by `useElementChildren(parentIdSig, 'nodes' | 'fields')` + `useElementById`; returns raw `Element[]`, callers map via the legacy mappers in `useComputed$` (so §2.4 stays a small diff). The loadVersion dance, BranchView's manual load task, and the `enabled` option all folded away; `cancelConstruction$` now fires on navigation only, not on every reload. `useRootViewData`, `useBranchViewData`, and `useTreeNodeFields` are the same hook three times: query children → filter by kind → map → signal + isLoading + storage-change reload. Root is just `parentId = null`. One `useElementChildren(parentIdSig, kindFilter)` covers all three (BranchView additionally fetches the parent element — a param or second tiny hook). `useTreeNodeFields`' prop-sync/loadVersion dance and its duplicated load body (`reload$` and the visible task are character-identical) fold away in the rewrite. Pairs naturally with §2.3.

**4.5 Per-kind switches that the registry should own.** The manifest seam exists; finish routing through it:

- `DataField.tsx:75,99`: `isImageVariant = componentType === 'single-image'` controls label suppression and wrapper class — should be a manifest flag (`hideLabel` / layout hint), not a kind comparison in the dispatcher.
- `DataFieldHistory.formatHistoryValue` switches on `componentType` — that's `displayPreview`'s job. Bonus: today history shows raw numbers while the live row shows formatted ones (number-kv `displayPreview` is just `String(v)`); pushing real formatting into `displayPreview` fixes the inconsistency in one place.
- `TreeNodeConstruction`'s `DEFAULT_FIELD_DEFINITION_IDS` import from seeds is fine for Phase 1, but it's the kind of framework-knows-a-kind wiring KINDS-SPECS wants in manifests eventually.

**4.6 appState file count overstates the machinery.** Five files (`appState.ts` barrel, `.types`, `.transitions`, `.selectors`, `.context`, plus `guards.ts`) for an ~80-line FSM. The barrel and `guards.ts` (two one-line predicates) can fold into neighbors without loss. Also `useAppTransitions` mints 11 fresh QRLs per consumer; harmless at this scale, but consumers could import `transitions` and call with `useAppState()` directly.

**4.7 Logging.** ~80 `console.log` calls in production paths (every adapter write, every sync step, every reload). LATER.md already holds the structured-logger item; until then, at minimum strip the per-write logs in `IDBAdapter` — noisiest, least informative.

---

## 5. Risks noticed in passing (not refactors, but you should know)

**5.1 History revisions collide across clients.** `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally from local history. Two offline clients editing the same element will mint the same `${id}:${rev}`, and the sync upsert (`applyRemoteElementHistory` / `setDoc`) silently overwrites one client's audit row with the other's. For an *append-only audit log*, that's a real integrity hole once multi-device becomes real. Phase-2 fix candidates: random history ids ordered by `(elementId, updatedAt)`, or client-scoped rev (`${elementId}:${clientId}:${rev}`). Worth a LATER.md entry now so the eventual fix is a column-add, not a migration.

**5.2 `coerceTimestamps` only handles `updatedAt`/`deletedAt`** — fine today, but a silent trap for any future timestamp column (`createdAt` in ISSUES #2, KINDS-SPECS' approval pins). A "coerce all `*At` keys" rule would be self-maintaining.

**5.3 Qwik + offline-first is a tension you're paying for, not benefiting from.** Every data read happens in `useVisibleTask$` (client-only, post-hydration); SSR renders "Loading..." shells; and the framework's serialization rules forced the module-level service-getter workaround documented in CLAUDE.md. You're carrying resumability's constraints without using its payoff (server-rendered content). Not a recommendation to switch — the codebase is built and works — but recording it because you asked for foundational candor: this is the deepest "we'd choose differently today" item I found, and also the most expensive to act on. A cheaper middle path if the friction grows: run Qwik in pure-CSR/SSG mode so the SSR/serialization constraints stop mattering.

---

## 6. Suggested sequence

Ordered for compounding payoff and low risk; each step is independently shippable.

1. ✅ **Deletions** (§3): zero behavior change, ~600+ lines and three test files gone, every later diff gets smaller. *(done 2026-05-11)*
2. ✅ **Strip FirestoreAdapter to RemoteSyncAdapter** (§2.1) + adapter `run()` helper (§4.1): the write model becomes single-sited *before* composites land. *(done 2026-05-11)*
3. ✅ **Single cache** (§2.2, one line) + **failed-queue decision** (§4.3). *(done 2026-06-11)*
4. ✅ **Bus-only change propagation** (§2.3) + **data-hook consolidation** (§4.4): one reactive model; do together since they touch the same hooks. *(done 2026-06-11)*
5. ✅ **Element-shaped view props** (§2.4): delete the legacy vocabulary. *(done 2026-06-13)*
6. ✅ **Draft-store commit functions** (§2.5) + **commitWithUndo** (§2.6): the UI layer's two worst tangles. *(done 2026-06-13)*
7. **Manifest flag cleanup** (§4.5) as a warm-up for the KINDS-SPECS registry generalization, which this sequence leaves you cleanly positioned for.

The through-line: every era of this codebase was built well, and each refactor was *almost* finished. Finishing them is cheaper than it looks, and the KINDS-SPECS future you're heading toward — manifests as the only place the framework learns a kind — gets dramatically easier on the far side of steps 2, 4, and 5.