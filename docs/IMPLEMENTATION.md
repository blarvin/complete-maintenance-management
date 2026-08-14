## Phase 1 Implementation Notes

Technical implementation details and architectural patterns. For feature scope, see SPECIFICATION.md. For feature status and detailed breakdowns, see ISSUES.md. For deferred work, see LATER.md.

**What belongs here:** only decisions that are non-obvious, interesting, or ambiguous — where a future reader asks "why is it like this?" and the answer isn't in the code. Obvious choices need no note.

**Status convention** (ADR vocabulary, applied per `##` section; `###` subsections inherit their parent's status unless they carry their own):

- **Accepted** — decision and reasoning both still hold.
- **Accepted (rationale superseded)** — the choice stands, but the argument that produced it has expired; the note states the *current* reason. This is the dangerous case: the code looks deliberate and the stated motive is a fossil.
- **Superseded by _X_** — replaced by a later decision. Kept only when the supersession is itself instructive.
- **Deprecated** — the thing described is gone. Kept only to stop someone re-deriving it; delete on sight otherwise.

Inline `_(Superseded …)_` marks apply to a single paragraph or bullet inside an otherwise-Accepted section.

---

## Unified Element Model

**Status:** Accepted. _(Landed; the `REFACTOR-single-unified-data-model` branch is merged — the heading's old "in progress" qualifier is gone.)_

`TreeNode` and `DataField` are unified into a single `Element` primitive discriminated by `kind` (`"node"` for containers; the four field-kind literals for value-bearing kinds). One `elements` Dexie store and one `elementHistory` log replace the previous `nodes` / `fields` / `history` triple.

**Wipe-on-upgrade.** v7 introduces `elements` / `elementHistory` alongside the legacy stores; the legacy stores will be dropped in a v8 bump once the sync layer is retargeted. No migration path — matches the wipe pattern established by v3/v4/v5/v6.

**Composite history key.** Each `ElementHistory` row uses `${elementId}:${rev}` as its primary key with a `[elementId+rev]` compound index. `property` widens from the value-only enum to `value | name | subtitle | parentId | siblingOrder`, so renames, moves, and reorders are now logged — closing a long-standing audit gap. **Next-rev is an index seek (audit §4.2, done 2026-06-13):** `IDBAdapter.nextElementRev` reads the highest existing rev via a single `[elementId+rev]` range seek (`.between(...).last()`) rather than loading the element's whole history to take `max(rev)+1`; `createElement` skips the query entirely and writes rev 0 by construction (a fresh id has no prior history). The old `computeNextRev` array helper is gone.

**Element-shaped view props (done 2026-06-13, audit §2.4).** The view layer now speaks Element vocabulary end-to-end. The legacy `TreeNode` / `DataField` / `DataFieldHistory` types, the `elementToTreeNode` / `elementToDataField` mappers, and `projectValueHistory` are all deleted. View components consume `Element` / `ElementHistory` fields directly: `name`, `subtitle`, `siblingOrder`, `kind` (the `componentType` synonym survives only on `FieldDefinition` and `KindManifest`, where it's a real concept). Props are **flat**, not `{ element: Element }` — the construction branch (`TreeNodeConstruction`) has no persisted Element and `NodeHeader` is shared between display and construction, so a wrapper object would just be re-destructured immediately; flat renames removed every synonym with no destructuring churn. The component *names* `TreeNode` / `DataField` survive as renderer identifiers (per SPEC), only their data shapes changed.

**Uniform `siblingOrder`.** Every child (nodes and value-bearing kinds alike) is sorted by `siblingOrder` ascending. Mint assigns the next integer; midpoint insertion will renumber-the-run rather than use fractional keys (fractional deferred to LATER.md).

**FSM rename.** `ViewState.nodeId` → `elementId`, `editingFieldId` → `editingElementId`, `UnderConstructionData` gains `kind: Kind`. UIPrefs key bumped to `treeview:ui:prefs:v2` so any stale persisted expansion sets discard cleanly.

---

## Draft Store & commit-with-undo (audit §2.5/§2.6, done 2026-06-13)

**Status:** Accepted (rationale superseded) — see the `commitWithUndo` naming note below.

**Composer draft is the single commit source.** The pending-field batch was always persisted in `localStorage` keyed by nodeId (`pendingFields:${nodeId}`); the commit logic now lives in a plain module `src/data/services/pendingDraft.ts` (`commitPendingDraft(nodeId, baseOrder)` / `discardPendingDraft(nodeId)`), not in the mounted component. `usePendingForms` is a thin Qwik layer over it. This deleted the entire handle-threading graph — three handle types (`FieldComposerHandle`, `FieldComposerSlotHandle`, `FieldListHandle`), every `handleRef` prop, and the `afterNodeCreated$` callback relayed through `CreateNodePayload`/`useNodeCreation`.

**Construction commit moved into `useNodeCreation.complete$`.** That function already had the new node's id and already cleared the draft; it now commits the draft (`commitPendingDraft(id, -1)`) right after `CREATE_ELEMENT` succeeds. No component reaches into the composer anymore.

**Write-through persistence.** Because the construction commit reads localStorage from a *different* component than the mounted composer, `setPendingValue$`/`togglePending$` now write to localStorage synchronously rather than relying on a reactive `useTask$` auto-save (which could lag the Create click by a tick). The race — whether the last keystroke flushes before Create — is browser-timing-only, so it's covered by a Cypress spec, not a unit test (ISSUES.md Tech Debt).

**`commitWithUndo` is a plain function, deliberately not `$`-suffixed.** _(Rationale superseded — the `$`/QRL convention died with Qwik; `commitWithUndo` is now simply an ordinary `async function` in `src/data/services/commitWithUndo.ts`, and there is no naming decision left to defend. The paragraph is retained only because the **caller-scope capture** argument still explains why the options object holds callbacks built at each call site rather than being hoisted into a shared config.)_ It wraps *execute → success snackbar with Undo → error snackbar via `describeForUser(toStorageError(err))`* (six former copies). A `$` suffix makes the Qwik optimizer treat `commitWithUndo$({…})` as an implicit-QRL API and try to hoist the whole options object — but that object holds inline `$()` QRLs capturing local ids (`nodeId`, `prevVal`), which it can't. As a plain function, those `$()` args are captured in the *caller's* handler scope, exactly like the snackbar action handlers were before. The execute result is threaded into both the message builder and the undo handler, so the discard/restore variant (`FieldComposer` cancel) rides the same path as the command sites.

---

## Renderer Registry (`src/kinds/`)

**Status:** Accepted, with two internal supersessions (both marked in place below): `componentType` → `kind`, and `node` going from privileged-and-unregistered to a registered, placement-discriminated manifest.

The per-kind dispatch that used to be smeared across six `switch (componentType)` sites is consolidated into one manifest per value-bearing kind. `KIND_REGISTRY` (in `src/kinds/registry.ts`) maps each `ComponentType` to a `KindManifest` of `{ Renderer, ConfigForm, defaultConfig, displayPreview, pickerLabel }`, and is typed `satisfies Record<ComponentType, KindManifest>` so registering a kind and declaring it in the `ComponentType` union are checked as one act — forget a kind and it's a compile error. Consumers call `getKindManifest(type)` and render `<manifest.Renderer …>` / `<manifest.ConfigForm …>` dynamically.

**`node` is privileged, not registered.** The recursion and navigation logic is inseparable from the node kind, so `TreeNode` stays in the component layer rather than becoming just-another-renderer. The registry is keyed by the four value-bearing kinds only — node is deliberately absent.

**Uniform-props-via-cast seam.** Renderer props are near-uniform but not identical (`single-image` ignores `fieldDefinitionId`; only `number-kv` reads `updatedAt`) and config-form `onChange$` is 1-arg for text/single-image vs 2-arg `(cfg, error)` for enum/number. Rather than rewrite all eight components, each manifest bridges its component into the uniform `FieldRendererProps` / `ConfigFormProps` with one localized `as unknown as Component<…>` cast. Runtime is sound because the registry is keyed by the same discriminant that determines the value/config type; the small type-unsafety is confined to the manifest boundary.

**Files in place, no vertical-slice move (yet).** Manifests import the existing components where they already live (`components/DataField/*`, `components/FieldComposer/configForms/*`) — the cheap "name the seam" step. The full `src/kinds/<kind>/` vertical-slice reorg and the Phase-2 manifest fields (`placement` nest-vs-navigate, `nature` data-vs-reference, lazy renderers) are deferred until a second non-field surface (Logbook / Equipment Plate) forces them — see LATER.md.

**History routes through `displayPreview` (audit §4.5, done 2026-06-13).** `DataFieldHistory.formatHistoryValue`'s `switch (componentType)` is gone — history rows now call `getKindManifest(kind).displayPreview(value, config)`, the same formatter the live row uses, so the two can no longer diverge. To make this possible, `displayPreview` was widened to `(value, config?)` (the three config-free kinds ignore the second arg; a 1-arg function stays assignable), and the `number-kv` value formatting (`formatNumber` + `withAffix`) was lifted out of `NumberKvField` into `numberKvState.formatNumberKvDisplay` so both the renderer and the manifest share one implementation — history now shows fully-formatted numbers (decimals / affix / percent / currency) instead of raw `value units`. Two intentional behavior changes rode along: single-image history shows the manifest's `caption ?? '[image]'` (previously always `'[image]'`), and `DataFieldDetails` passes the FieldDefinition `config` down in place of the old precomputed `units` string.

**Label/layout are manifest flags, not kind comparisons.** `DataField`'s dispatcher previously compared `kind === 'single-image'` to suppress the label and pick the block-layout wrapper class. Those are now two `KindManifest` booleans — `hideLabel` and `blockValueLayout` — so the dispatcher learns each kind's framing from the manifest like everything else. Only `single-image` sets them `true`; the registry's `satisfies` clause forces every kind to declare both.

**`componentType` → `kind`, and `Kind` is registry-derived (done 2026-06-26).** The two-tier vestige is gone: the discriminant is named `kind` everywhere (`FieldDefinition`, `KindManifest`, the four manifests, the `DataField`/`ComposerRow` dispatch, command payloads, draft state, seed rows) — there is no longer a separate `componentType` field or `ComponentType` type. `Kind` (in `models.ts`) is now **derived from the registry**: `"node" | keyof typeof KIND_REGISTRY`, via a type-only `import type { KIND_REGISTRY }` (erased at runtime, so no `models → kinds` cycle). Adding a manifest widens `Kind` automatically — a kind can't drift from its manifest. `KIND_REGISTRY` is now typed `satisfies Record<string, KindManifest>` (it *is* the source of truth for the kind set, so it no longer checks against an external union). `node` is still absent from the registry (it has no manifest yet — superseded the next day, see below), so `getKindManifest(kind: Kind)` owns the one node-excluding cast internally (`KIND_REGISTRY[kind as keyof typeof KIND_REGISTRY]`); call sites pass `Kind` freely and `FieldList`'s old `as ComponentType` cast is gone. This supersedes the "maps each `ComponentType`", "`satisfies Record<ComponentType, …>`", and "node is privileged, not registered" phrasing above — node stays unregistered *for now*, but `Kind` is no longer a hand-declared union. Deferring the parallel **`Value`-union** derivation (it needs a separate type-level kind→value map) to the config/value rework — it landed 2026-07-05 as `KindValueMap`, see *#5 value-shape + registry consolidations* below.

**`node` registers; `KindManifest` is placement-discriminated (done 2026-06-27 — the "widen `KIND_REGISTRY`" work, *structural seam only* scope).** `node` now has a manifest (`src/kinds/node.manifest.ts`) and is a `KIND_REGISTRY` key like any other kind, so its privileged status is gone. `KindManifest` split into a `placement`-discriminated union: `InlineManifest` (field-like — keeps the full `Renderer`/`ConfigForm`/`defaultConfig`/`displayPreview`/`hideLabel`/`blockValueLayout` surface) `| ReRootManifest` (node-like — identity only: `kind`/`pickerLabel`/`mintVia`/`placement`). `Kind` (in `models.ts`) collapsed from `"node" | keyof typeof KIND_REGISTRY` to just `keyof typeof KIND_REGISTRY`, and `getKindManifest`'s node-excluding cast is gone. The five inline-only consumers (`DataField`, `DataFieldHistory`, `ComposerRow`, `FieldDefinitionAuthoringForm`, `useFieldDefinitionDraft`) now call a new `getInlineManifest(kind)` that narrows the union (throws on a re-root kind) so they keep the inline surface without hand-narrowing; `FIELD_KINDS` is derived by `placement === 'inline'` rather than hardcoded. Deliberately **out of scope** this cluster (no consumers yet): the six capability descriptors (`ownValue`/`children`/`edges`/`derivation`/`action`/`reads` + `SourceSpec`/`provision`/`container`/`coherence`) — built later with the lens / node-like kinds; and `node`'s manifest `Renderer` / `RendererProps` generalization — the Chrome-entailment cluster. This supersedes the "node is privileged, not registered" / "node is still absent from the registry" / internal-cast phrasing in the notes above.

**Dexie v9 — `fieldDefinitions` index `componentType` → `kind`.** The only store that indexed `componentType` was `fieldDefinitions` (the legacy `fields`/`templates` stores were dropped at v8); `elements` already indexed `kind`. v9 re-declares `fieldDefinitions: 'id, kind, authorId, updatedAt, deletedAt'` with the established clear-on-upgrade (no migration — prototype data wipes, syncMetadata clears so seeds re-run).

---

## Config-as-Elements (done 2026-06-27)

**Status:** Accepted (rationale superseded) — the component-free-module rule survives the Solid migration, but for a different reason; see that bullet below.

The `FieldDefinition.config` blob is retired. A Definition is now a **`library`-tree Element** (`treeType: 'library'`, `parentId: null`, `kind` = the kind it defines, `name` = the label, `value: null`) and its config **is its child sub-field subtree**. The standalone `fieldDefinitions` Dexie table and its `config` JSON column are gone (Dexie **v10**, clear-on-upgrade).

**`FieldDefinition` is now an assembled read-model view, not a stored row.** It keeps its `.config` field, but the adapter assembles it on read from the Definition's config sub-field children — there is **no persisted derived config object** (SPEC §599). The payoff: the value renderers (`TextKvField`/`EnumKvField`/`NumberKvField`) and the four `ConfigForm`s are **unchanged** — they still read/produce a plain config object through `getFieldDefinitionById(...).config`; only persistence and assembly moved. `authorId` folds into the Definition Element's `updatedBy` (`"appDeveloper"` for seeds).

**`treeType` is a minimal `business | library` axis** on `Element` (the full four-value axis landed later — see *Typed trees (the seam)* below). The only business-tree leak points were the `parentId: null` scans — `IDBAdapter.listRootElements` and `nextSiblingOrder(null)` now filter `treeType === 'business'` so library Definitions never surface as roots. `createElement` only mints `business` elements and validates `fieldDefinitionId` against the library Definition Element (not the dropped table); the `nodeIndex` already ignores non-`node` kinds, so Definitions never enter navigation.

**(De)serialize is `configSchema`-driven with deterministic ids.** Each field kind declares a `configSchema: ConfigSubField[]` (`{key, label, kind, disposition, options?, validate?, pack?, unpack?}`). `serializeConfig`/`assembleConfig`/`configChildId` (`src/kinds/configElements.ts`) map a config object ⇄ child Elements at id `${defId}::cfg::${key}` — deterministic, so seeds are idempotent and the inverse needs no id parsing. Sparse config stays sparse (only present keys emit a child). `pack`/`unpack` default to `config[key]` ⇄ `{[key]: value}`; only the **thresholds compound** overrides them, bundling the four flat `{lowLow,low,high,highHigh}` fields into one atomic `compound`-kind child (SPEC §596). `validateNumberKvConfig`'s threshold-ordering portion was extracted to `validateThresholds` and attached to that sub-field's `validate`; the composite validator stays in `NumberKvConfigForm` as the cross-field override.

**Three new config-only kinds — `flag` / `compound` / `string-list`.** Config decomposes into existing field kinds plus these (booleans; the thresholds object; enum `options` as one list value). They register like any kind but carry `mintVia: 'config-only'`, so `FIELD_KINDS` (now filtered by `mintVia === 'composer'`) excludes them from the authoring picker. In Phase 1 they only ever exist inside config subtrees, never as standalone Data Card rows, so their manifests use a shared stub `Renderer`/`ConfigForm` (`configFieldStub.tsx`) — full standalone-row UX is deferred (LATER.md).

**The schemas live in a component-free module (`src/kinds/configSchema.ts`), not behind the registry.** _(Rationale superseded, rule intact. The original reason was Qwik-specific: importing `registry.ts` pulled `component$` renderers in, and the Qwik optimizer didn't transform them under Vitest. Post-migration the constraint is **Vitest has no Solid JSX transform**, so anything test-reachable must still contain no JSX — the same prohibition, a different cause. The rule of thumb below is unchanged and still load-bearing.)_ Historical form: importing `registry.ts` pulls the `component$` renderers into whatever imports it, and the Qwik optimizer doesn't transform those under Vitest (`component$` throws "Optimizer should replace all usages of `$()`"). Because the storage layer (`configElements` → IDB adapter → seed) needs the schemas, they had to be component-free. `configSchema.ts` imports only types + the pure `numberKvState` helpers; the manifests re-expose the same arrays as `manifest.configSchema`, and `configElements` reads `CONFIG_SCHEMAS` directly. **Rule of thumb: never import `src/kinds/registry.ts` (or a `*.manifest.ts`) from the storage layer or a unit test.**

**`disposition` is encoded, not honored.** Each sub-field carries `owned | delegated | pinned`, but nothing acts on it yet — all config lives on the Definition and is read live (delegated-like, = current behaviour). Copy-at-mint for `owned` and override-disable for `pinned` land with the cascade arbiter (cluster 7).

**Sync — the FieldDefinition lane is retired.** Definitions are Elements, so they ride the element sync lane (`create/update-element` ops, `applyRemoteElement`, the element pull). The `create/update-fieldDefinition` ops, `pull*FieldDefinitions*`, `applyRemoteFieldDefinition`/`getAllFieldDefinitions`/`resolveFieldDefinition`, and the strategies' `fieldDefinitionsApplied` lane are all gone. `FIELD_DEFINITION_WRITTEN` survives as the "Library changed" UI signal the Composer subscribes to: emitted by `createFieldDefinition` and re-emitted by `applyRemoteElement` when a `library`/`parentId: null` Element arrives. Seeds still write directly (no enqueue, deterministic ids → identical per client); user-authored Definitions enqueue element ops and sync across devices.

---

## Typed trees (`treeType`) — the seam (done 2026-06-28)

**Status:** Accepted.

The `treeType` axis is widened from the minimal `business | library` to the full four-value `business | library | config | view-state` (SPEC → *Populations are typed trees*). This is a **seam only** — there are no Phase-1 producers for `config`/`view-state` elements (no viewer/auth; view-state lives in `uiPrefs` localStorage; the `config` tree needs the cascade arbiter, cluster 7), so the new values are inert for current content. Mirrors how the registry-widening and Config-as-Elements landed: build the structural seam, defer everything with no consumer.

**No Dexie bump.** Widening a string-literal union changes neither the persisted row shape nor the existing `treeType` index (added at v10). Pure type + routing change.

**Policy table is the single source of truth (`src/data/treePolicy.ts`).** `treeSyncMode` (`shared | per-user | none`) and `treeHistoryMode` (`business | library | overlay | none`) encode the SPEC table once; `shouldSyncTreeType` / `shouldLogHistory` are the binary gates derived from them. `view-state` is the only tree that neither syncs nor logs. Fully unit-tested (`treePolicy.test.ts`) so the table can't drift from the spec.

**Writes route through the policy (`IDBAdapter`).** Two private helpers — `enqueueIfSynced(treeType, params)` and `writeHistory(treeType, entry)` — replace the direct `syncQueue.enqueue` / `elementHistory.put` calls across all five write paths (`createElement`, `updateElement`, `softDeleteElement`, `restoreElement`, `createFieldDefinition`). For today's business/library content these are exact no-op gates (both always sync + log); a future `view-state` write would skip both, a `config` write would sync but file under overlay history. `treeType` is immutable, so `updateElement`/`softDeleteElement` route on the pre-update row's `treeType`. Visibility was **already** routed (`listRootElements`/`nextSiblingOrder(null)` scope to `business`) — unchanged.

**`effectiveChildren` is the per-viewer read chokepoint (`src/data/effectiveChildren.ts`), pass-through for now.** `effectiveChildren(canonical, viewer)` returns the canonical children unchanged (the adapter already deleted-filters + `siblingOrder`-sorts). It is wired into both branches of `useElementChildren` (THE view read model) so every viewer-facing tree read funnels through one place — the future per-viewer `config`/`view-state` overlay merge (incl. personal `siblingOrder`) lands by replacing this body, no caller changes. The signature takes already-fetched children rather than the work map's `(node, viewer)` to avoid a re-fetch. `viewer` is `getCurrentUserId()` (the constant `"localUser"` until auth). Identity contract pinned by `effectiveChildren.test.ts`.

**Deferred (LATER.md):** the real overlay merge, personal `siblingOrder` overlay, moving view-state out of `uiPrefs` into Elements, the `config` tree (org/role/user prefs) + arbiter wiring, and viewer/auth plumbing.

---

## Capability descriptors (the seam) — done 2026-06-28

**Status:** Accepted (rationale superseded) — same component-free-module case as Config-as-Elements: the rule holds, the Qwik reason does not.

The six-capability vocabulary (SPEC → *The six capabilities*) lands as TypeScript on the manifest. **Structural seam only**, like the registry-widening and typed-trees seams before it: the descriptors are carried per kind but **read by no consumer** — the lens / node-like kinds (#6) are the first readers, the cascade arbiter (#7) the second. Same discipline: build the type-level seam, defer everything with no consumer.

**Descriptors live on a shared `CapabilitySet`, intersected into `ManifestIdentity`.** `src/kinds/types.ts` gains the descriptor types and a `CapabilitySet` (`ownValue?`/`children?`/`edges?`/`derivation?`/`action?`/`reads?` + node-oriented `provision?`/`container?`/`arbiter?`), `&`-intersected into the shared `ManifestIdentity` base — so both arms of the `InlineManifest | ReRootManifest` union carry the capability fields (node-like and field-like are one composition space, SPEC §527). The union stays: the renderer/authoring surface still differs (inline carries `Renderer`/`ConfigForm`/…; re-root is identity-only until #5 gives `node` a Renderer). Collapsing to a single flat `KindManifest` is deferred to #5. `FieldRendererProps` is untouched — the placement-keyed `RendererProps` generalization is #5's, where a re-root Renderer finally consumes it.

**Two descriptor tiers, by how soon a kind composes them.** Tier A — full SPEC shape for what #6 imminently needs: `ValueSpec`, `ChildrenSpec`, `TargetSpec`, `SourceSpec`, `ProvisionSpec`, `Container`. Tier B — minimal placeholders for capabilities no current kind composes: `ActionSpec` (built last, SPEC §565), `ArbiterSpec`/`ValiditySpec` (the cascade, #7). `ValueSpec` is deliberately a thin validation marker — the `scalar | block | stream | composite` value-shape vocabulary that drives *layout* is #5's bullet, kept out so the cluster boundary stays clean (the current `hideLabel`/`blockValueLayout` flags are the layout debt #5 retires).

**Capability data is a component-free module the manifests spread (`src/kinds/capabilities.ts`).** The one non-obvious seam, and the *same* constraint already documented for `configSchema.ts` — _(and superseded the same way: the prohibition now comes from Vitest having no Solid JSX transform, not from the Qwik optimizer)_. Historical form: importing `registry.ts` or any `*.manifest.ts` pulls the `component$` renderers into the importer, which the Qwik optimizer doesn't transform under Vitest. The coherence test must read every kind's capability subset, and the SPEC's "degeneration anti-pattern is CI-lintable" (§584) needs the same component-free read. So the subsets live as pure data in `KIND_CAPABILITIES` (`satisfies Record<Kind, CapabilitySet>` — an entry per kind, enforced), and each `*.manifest.ts` spreads `...KIND_CAPABILITIES['<kind>']`. Single source of truth; the manifest is still the assembled whole. Reaffirms the rule: never import `registry.ts`/`*.manifest.ts` from a unit test or the storage layer.

**~~`node.allowedKinds` is provisional, hardcoded to dodge a cycle.~~ Superseded 2026-08-12 — see below.** `node` composes `Children(open)` + `container: 'physical'` (ELEMENT-MODEL §node). `open` is allowlist-constrained (never `open(any)`, SPEC §564), but the honest allowlist is "child `node`s + the field kinds" — derivable from `FIELD_KINDS`, which lives in `registry.ts`, which imports `capabilities.ts` → a cycle. So the list was a literal `['node', 'text-kv', …]` with a `TODO(#6)`.

**Child-kind allowlists are derived from a `mintVia` mirror (2026-08-12).** The cycle above is real, so the fix isn't to import `registry.ts` — it's a fourth component-free mirror, `KIND_MINT_VIA` (`mintVia.ts`), joining `placement.ts`/`capabilities.ts`/`childrenPolicy.ts`. `capabilities.ts` derives two bases from it: `FIELD_CHILD_KINDS` (`mintVia: 'composer'`) and `CONTAINER_CHILD_KINDS` (creatable node kinds + fields). The four kinds that used to repeat a literal array now spell out only what they *subtract*: `RECORD_CHILD_KINDS` = container set minus `org` (a people/role container inside a task or a log entry is a modelling accident — the one deliberate asymmetry, named once instead of omitted four times), and `job` subtracts itself on top (no sub-tasks, same date). `jobs`/`logbook` take `FIELD_CHILD_KINDS` alone. Net effect: adding a kind no longer means editing four arrays and hoping. Mirror order is load-bearing — it's the order a child kind appears in an allowlist — and the mirror's agreement with each manifest's `mintVia` is checked by the dev boot loop in `registry.ts`.

**`coherence` has teeth via a registry-wide test, not a runtime cost.** `src/kinds/coherence.ts`'s `checkCoherence(caps)` returns `{ errors, warnings }` — the two-tier SPEC §589 distinction (errors *reject*; warnings are *valid-but-flagged*). Three error rules (degeneration / capability-empty §584; `Derivation + reads.historyStream` stores nothing §589; `OwnValue + Derivation` contend → need an `arbiter` §589) and one warning (`Children + OwnValue` = the intrinsic node scalar, allowed knowingly §281). `kindCoherence.test.ts` runs it over `KIND_CAPABILITIES` so a future incoherent manifest fails CI before any consumer reads the capability. Pure type + test change — no Dexie bump, no behaviour move; the app renders identically.

**Per-kind coherence rules live in `KIND_COHERENCE`, not on the manifest (2026-08-12) — a deliberate divergence from SPEC §540.** The SPEC sketches `coherence?: (caps) => …` as a manifest field, and it was built that way. Nothing could ever call it: the only caller is `kindCoherence.test.ts`, which may not import a manifest (the `.tsx` renderers; no Solid JSX transform under Vitest — the same constraint that produced `capabilities.ts`/`placement.ts`), and the running app never checks coherence at all. A kind declaring a rule there would have been silently unchecked — worse than no hook, because it looks like a guard. The hook is now a `Partial<Record<Kind, …>>` table in `coherence.ts`, and `checkCoherence(caps, kind?)` folds it in; the test passes the kind, so a per-kind rule actually fires. The SPEC's *rule* (§589, per-kind overrides beyond the global table) is unchanged — only where a kind registers one, which the SPEC's manifest sketch couldn't anticipate because it doesn't model the test-reachability constraint. Table is empty on purpose: this is the wire, not a rule.

**#6b — the kind set's first consumers (the seam gets readers).** Clusters #2-#4 carried the capability vocabulary as declared-only data; #6b (2026-06-28, stub-grade) builds the first machinery that *reads* it. Non-obvious choices:

- **`placement.ts` is a component-free mirror, not a derivation.** The node-vs-field split (`isReRoot`/`isInline`) retired five hardcoded `kind === 'node'` checks (`IDBAdapter`, `initStorage`, `nodeIndexSubscriber`, `useElementChildren`, `BranchView`). It lives as pure data because the storage layer and unit tests can't import `registry.ts`/`*.manifest.ts` (the `component$` renderers throw under Vitest — the same constraint as `capabilities.ts`/`configSchema.ts`). Manifests keep their `placement` literal; `KIND_PLACEMENT` mirrors it. The value-match isn't test-enforceable (a test can't import the component-bearing registry), an accepted constraint identical to `KIND_CAPABILITIES`.
- **The capability engine is query-injected and children-only.** `src/data/services/capabilityEngine.ts` (`gatherDescendants` / `gatherBySource` / `resolveEdge`) takes an `IElementQueries` so it's component-free and unit-testable, building on existing `getChildren`/`getElementById` (no new adapter method). `ancestors`/`edges` traversal *throws* — declared on the descriptors, deferred to the cascade (#7) and the Edges family (#6c).
- **`jobs` provisioning is per-node, not the canonical upward ancestor-walk.** ELEMENT-MODEL §lens specs upward provisioning (a lens reconciled at every ancestor when a target appears). v1 instead mints a `jobs` lens child on *every* re-root node (deterministic `${id}::jobs`, idempotent `put`, recursion-guarded in the `CREATE_ELEMENT` handler), each gathering its own subtree. Same visible result (a rollup at every level) with no write-time ancestor-walk. **Decision: `jobs` is a pure rollup (lens) for now**; container behaviour (authoring jobs *in* the node as inline rows) waits on the placement-decoupling in #5. De-provision/GC, empty-lens hiding, and back-filling pre-existing nodes are deferred.
- **`job` earns its kind as the provision trigger, not via a distinct capability.** It composes only `Children(open)` (identical to `node`); status/lifecycle are ordinary Fields. What earns it is that the framework *reacts to its existence* (provisioning) — the SPEC §584-585 boundary, a documented call (ELEMENT-MODEL §job).
- **Two minimal seam extensions.** `mintVia: 'provision'` (a `jobs` lens is framework-materialized, off every user picker — `RE_ROOT_CREATE_KINDS` filters `node-create`); and `derivation.targetKind?` (the lens's "→ job" filter — `SourceSpec` carries relation×reach only). `KindAdornment` is the first consumer that *draws* from a capability (branches on `manifest.derivation`/`provision`, not kind strings) and renders in the node-header subtitle slot.

**#5 slice 1 — the create surface and shell read `childrenSpec` (2026-06-29).** The first consumer of `childrenSpec.allowedKinds` (carried since #2-#3, unread until now). Non-obvious choices:

- **`childrenPolicy.ts` is a third component-free module, paralleling `placement.ts`/`capabilities.ts`.** `allowedChildKinds(kind)` and `canHaveChildren(kind)` read `KIND_CAPABILITIES` directly so the create surface and the shell predicate stay unit-testable without importing the component-bearing registry. A local `capsOf = (k): CapabilitySet => KIND_CAPABILITIES[k]` widens the indexed access (a union of per-kind *literal* shapes, where `.children` isn't common to all members) back to the declared `CapabilitySet` — the same shape-vs-union friction `coherence.ts` handles.
- **The `placement`/`mintVia` filter stays in the registry; the allowlist read is delegated.** `reRootCreateKindsFor(parentKind)` (registry.ts) = `RE_ROOT_CREATE_KINDS` ∩ `allowedChildKinds(parentKind)`. Keeping the derivation split this way means the registry owns "which kinds are user-creatable re-root kinds" and `childrenPolicy` owns "what this parent admits" — no new `registry`→`capabilities` import cycle, and `reRootCreateKindsFor` (which lives with the components) needs no unit test of its own beyond the policy test + typecheck.
- **`CreateNodeButton` became dumb: an `availableKinds: Kind[]` prop, `null` when empty.** Views compute the list (`reRootCreateKindsFor(parent.kind)` at a branch, the full `RE_ROOT_CREATE_KINDS` at root — root is the universe, not a typed container). Empty ⇒ a content-free lens (`jobs`) offers no "Add" at all. `useSignal` runs before the early `return null` (Qwik hooks must be unconditional); `selectedKind` defaults to `availableKinds[0] ?? 'node'`.
- **Lens-aware shell via `canHaveChildren`.** `kind` is now threaded through `TreeNode → TreeNodeDisplay` (added to `TreeNodeDisplayProps`); `showDataCard = canHaveChildren(kind)` suppresses both the `<DataCard>` and (via a new `showChevron` prop on `NodeHeader`, default `true`) the expand chevron for content-free kinds. Construction is untouched — it drives the chevron through `chevronDisabled`, not `showChevron`. The `jobs` lens thus re-roots to just its `KindAdornment` rollup (job *names* as dead text — navigable rollup rows are the deferred inline-yet-navigable work).

**#5 slice 2 — navigable inline rollup rows (2026-06-29).** The render-location/navigability decoupling's first real consumer, done by **recomposition** (no schema axis added). `KindAdornment`'s `isLens && isParent` branch — the container seam where a lens decides to render its gathered children inline — swaps the dead `<li>{name}</li>` list for a new generic `NavigableRow` (`src/components/NavigableRow/`). The row's name re-roots via `navigateToNode$(id)` (the same path a CHILD card uses); a borrowed disclosure-chevron (CSS triangle copied from `DataField.module.css`, *not* the value-editing-welded `DataField` component) expands the child's own fields inline. Non-obvious choices:

- **Generic, not jobs-specific.** `NavigableRow` takes only `{ id, name }` — no `kind` check anywhere; the rows come from `manifest.derivation.targetKind`, so `logbook` (#6c) inherits the identical row for free. This genericity is exactly why slice 2 was parked behind "wait for a second container" — and it's gotten without the wait.
- **`navigateToNode$` from context, not a prop.** The row reads `useAppTransitions()` directly. Every current/planned consumer (`job`, `log-entry`) is a re-root kind, so navigate-to-node is the right activation; an optional `onActivate$` prop is the escape hatch if a non-navigable consumer ever appears (deferred, LATER.md).
- **`FieldList` gains `hideAddSurfaces?`.** The expand is a read-only *peek* — both add-field surfaces (composer + legacy) now gate on `!props.hideAddSurfaces`; default unchanged for every existing call site. Existing field *values* stay double-tap-editable (the peek suppresses *adding* fields, not editing); canonical field work is done by navigating into the job.
- **Local expand signal, self-contained CSS.** Per-row `useSignal(false)` (no `appState` FSM change — mirrors `DataFieldDetails`' local history toggle). `NavigableRow.module.css` replicates the triangle chevron rather than importing `DataField.module.css`: the codebase idiom (`FieldComposer` already copies `FieldList`'s grid), and importing would re-couple to a module welded to value-editing.
- **Still deferred for #5 (as of slice 2):** the value-shape vocabulary (`scalar | block | stream | composite`) and the row's *primary* line (status/lifecycle, waits on `Action`). *(The container half landed 2026-06-30 — see below.)*

**#5 container half — the `jobs` hybrid container (2026-06-30).** The render-location decouple's last half: a `job` is authored *inside* its node's `Jobs` container and renders field-like, never as a loose tree sibling. Non-obvious choices:

- **DataCard chrome decoupled from physical ownership.** The bug was `showDataCard = canHaveChildren(kind)` — conflating "renders a container card" with "owns children". A `DataCard` is *display chrome*, orthogonal to ownership. `TreeNodeDisplay` now renders it for a kind that owns children (`Children` → `FieldList`) **or** derives a typed rollup (a lens → `LensRollup`): `showDataCard = canHaveChildren ∥ isLens`, body = `FieldList` and/or the rollup. The `jobs` container is both.
- **`jobs` is a hybrid `Children + Derivation + Provision`.** It gains a `children` capability (field kinds only — sub-assets don't belong directly in it; jobs arrive via Derivation), so it owns its own DataFields *and* rolls up jobs. `checkCoherence` already admits the subset (the "both-rollup-and-container" shape once parked for `logbook` #6c, pulled forward). **Jobs stay derived / node-owned**: a job created here parents to the owning node (`lens.parentId`), never to the lens — no double-parenting. `FieldList` renders the lens's own fields unchanged (it's keyed only by `nodeId`, asserts nothing about kind).
- **`isLensSurfaced(kind)` is the one predicate.** `LENS_TARGET_KINDS` = every `derivation.targetKind` across `KIND_CAPABILITIES` (today `{'job'}`; `log-entry` joins free). It gates all three behaviours: hide-from-tree (a job never shows as a loose child — `BranchView`/`RootView` filter it), trim-from-picker (no "Job" in the create surfaces), and **no-Jobs-on-a-job** (`ensureJobsLens` skips lens-surfaced kinds, so a `job` no longer provisions its own `::jobs` lens).
- **Two render surfaces, one gather.** Under a node, the `Jobs` child-row's card shows the compact `LensRollup` (`NavigableRow`s) — gated `isLens && !isParent`. Re-rooted *into* the lens it "looks like a parent": the jobs render as Node-like CHILD `TreeNode`s in `BranchView` (each with its own expandable DataCard; click re-roots into the job), and the lens's own card holds only its DataFields (field details/history). Both read one `useLensGather(ownerId, targetKind)` — the `gatherDescendants` + filter + debounced subscription, extracted as a hook so the two surfaces agree.
- **`LensCreate` — local, name-only inline create.** A `job` has only a name at mint, so creation is a self-contained inline row (a quiet `LensCreateButton` → focused field-skinned input → `CREATE_ELEMENT` under the owner), *not* the global node-construction UC. Shared by both surfaces; the new job re-appears via the gather. Reuse-first throughout: `NavigableRow`, `FieldList`, `gatherDescendants`, `LensCreateButton`.

---

## #6c — `logbook`/`log-entry`, the lens's second target (done 2026-07-01)

**Status:** Accepted.

The lens (`Derivation(children/transitive) + Provision`) had exactly one consumer (`jobs → job`); this adds a second (`logbook → log-entry`) to prove it generalizes by target kind. **Minimal scope** — prove generalization + make the provisioner spec-driven; the authored-in policy Definition on `logbook` (which would force the `fieldDefinitionId → definitionId` binding seam) was deferred at the time; it landed 2026-07-01 — see *Definition-binding seam* below. Non-obvious choices:

- **The provisioner became spec-driven — the one real change.** Every lens surface was *already* generic (keyed off `derivation.targetKind`, not the string `'job'`): `LensRollup`/`LensCreate`/`useLensGather`, the lens branches in `BranchView`/`TreeNodeDisplay`, and `isLensSurfaced`/`LENS_TARGET_KINDS` all picked up the new kind for free (`log-entry` auto-joined `isLensSurfaced`). The *only* hardcoded-to-`jobs` code was the per-node provisioner. `ensureJobsLens` → `ensureProvisionedLenses` now loops `PROVISIONED_LENSES`, so creating a `node`/`org` provisions **both** a `::jobs` and a `::logbook` child; the old `parent.kind === 'jobs'` lens-on-lens special-case generalized to `isProvisionedLens(parent.kind)`.
- **`provisionPolicy.ts` is a fourth component-free mirror** (paralleling `placement.ts`/`capabilities.ts`/`childrenPolicy.ts`, same Vitest/`component$` constraint). `PROVISIONED_LENSES` is *derived* from `KIND_CAPABILITIES`: for every kind with a `provision` spec, `{ kind, suffix }` where `suffix` is parsed from `provision.idScheme` (`'${parentId}::jobs'` → `'jobs'`). Only the display `name` is carried explicitly (a small mirror of each manifest's `pickerLabel` — the same accepted cross-boundary duplication as `KIND_PLACEMENT`'s values). `provisionPolicy.test.ts` gives it teeth: every `provision`-declaring kind must appear, and each `suffix` must agree with its `idScheme`.
- **The last hardcode fell out too.** `KindAdornment`'s `org` descendant count excluded the `jobs` container via `e.kind !== 'jobs'`; now `!isProvisionedLens(e.kind)`, so `logbook` containers (and any future lens) drop out generically.
- **`logbook`/`log-entry` mirror `jobs`/`job` exactly.** `logbook` is the same hybrid `Children(open, field kinds) + Derivation(→ log-entry) + Provision`; `log-entry` mirrors `job` (`Children(open)` + `container`, details are ordinary Fields). Both pass `checkCoherence` unchanged. `log-entry` was added to the `allowedKinds` wherever `job` appears (model coherence; `CREATE_ELEMENT` does no allowlist check).
- **How it renders (no component code added).** Under a node, `Jobs` and `Logbook` are **child Node-like Element rows** — each a re-root container with its own header + chevron, *not* entries in the parent's DataCard. Expanding a row peeks its rollup (`LensRollup`); the row's name re-roots into the container. Both lenses ride the identical generic re-root shell.

---

## Definition-binding seam — `definitionId` + logbook's policy Definition (done 2026-07-01)

**Status:** Accepted.

The instance→Definition binding stopped being field-specific, forced by the concrete kind the docs said to decide it on: `logbook`, the first policy-container re-root that wants an authored-in config (entry label, staleness). Three commits, three moves:

- **(a) Full type-family rename** (user call: no half-renamed vocabulary): `Element.fieldDefinitionId → definitionId` plus `FieldDefinition → Definition`, `CREATE_FIELD_DEFINITION → CREATE_DEFINITION`, `FIELD_DEFINITION_WRITTEN → DEFINITION_WRITTEN`, queries/adapter methods/seeds/hooks/UI props/pendingDraft. Dexie **v11** renames the `elements` index (clear-on-upgrade; the v4–v10 historical declarations are replayed by Dexie and must never be edited — excluded from the mechanical replace). Sync needed zero code change (whole-object spread); history never logs the column. Seeded `fd_*` id prefixes deliberately kept — ids are opaque.
- **(b) The authoring contract lifted off `placement: 'inline'`.** `ConfigForm`/`defaultConfig`/`configSchema` moved to `ManifestIdentity` as optional (re-asserted required on the inline arm); `Renderer`/`displayPreview`/`hideLabel`/`blockValueLayout` stay inline-only (field-row-specific). New accessor `getDefinitionAuthoring(kind)` returns null for leaf re-roots (`node`, `job`) — the placement-agnostic counterpart to `getInlineManifest`. The create-time check was *already* placement-driven (`isInline && !definitionId` throws; re-root optional).
- **(c) Logbook binds a seeded policy Definition through the same seam fields use.** `LOGBOOK_CONFIG_SCHEMA` (`entryLabel` text-kv + `staleness` number-kv seconds, both delegated) joins `CONFIG_SCHEMAS` — `serializeConfig`/`assembleConfig` were already placement-blind. Seed v8 writes `fd_logbook_policy`; ids live in the new import-free `src/data/definitionIds.ts` so `provisionPolicy.ts` (component-free) can name the default policy per lens kind without a back-edge into services.
- **Stamp-if-resolvable, not unconditional.** `ensureProvisionedLenses` stamps the policy id onto a minted `::logbook` lens only after `getDefinition` confirms it exists — `createElement` validates non-null `definitionId` against the library and throws not-found, so unconditional stamping would break every unseeded create (tests, pre-seed). Unbound lenses fall back at render. `jobs` carries no policy — re-root binding is optional by design, and jobs-without-one proves it.
- **Policy resolution is a pure module + thin hook.** `src/kinds/lensPolicy.ts` (`resolveLensPolicy` fallback matrix, `isLensStale` boundary logic — unit-tested) + `useLensPolicy` (resolves the lens Element's `definitionId` via `getDefinitionQueries`, falls back to `getKindManifest(targetKind).pickerLabel`). No `DEFINITION_WRITTEN` subscription: Definitions are fork-not-mutate, no edit path. Consumers: `LensRollup` header + stale badge, `LensCreate` (optional `entryLabel` prop), `BranchView`'s re-rooted lens (where `parentEl` *is* the lens). The container name ("Logbook") is a separate axis and stays. Known accepted limitation: the stale check reads `Date.now()` at render — reactive to writes/regathers, not to wall-clock passage.
- **Three pollution guards were load-bearing** (first re-root row in the library tree): the composer + legacy add-field lists filter `isInline(def.kind)`; the node index scopes to `treeType === 'business'` at both seed time (`seedNodeIndexFromDb`) and live (`nodeIndexSubscriber` — a latent bug; `ELEMENT_WRITTEN` events now carry `treeType`).
- **Seed-only authoring**: `LogbookConfigForm` exists and typechecks (the lifted contract's first re-root instance) but nothing mounts it — where re-root policy authoring lives in the UI is deferred (LATER.md).

---

## #5 value-shape + registry consolidations (done 2026-07-05)

**Status:** Accepted.

The last §5 chrome-entailment vocabulary piece plus two ISSUES riders of the same seam shape — three pure consolidations, no behaviour change (pixel-identical), no Dexie bump. Non-obvious choices:

- **A kind picks a shape, never declares layout.** `ValueShape = 'scalar' | 'block' | 'composite'` is *required* on `ValueSpec.shape` (`src/kinds/types.ts`), authored as pure data in `capabilities.ts` and flowing through the manifest spread. The arrangement laws live in exactly one place — the `DataField` dispatcher: `scalar` → label shown, inline run, centred chevron; `block` → label shown, tall block, top-pinned chevron; `composite` → label suppressed (the renderer owns its sub-structure), tall block, top-pinned chevron. The per-kind `hideLabel`/`blockValueLayout` flags are deleted from `InlineManifest` (the layout debt the capability-seam note flagged for #5).
- **No `ownValue` → `scalar` default.** `internal-link` (then named `asset-doc`) bears no `ownValue` (its value is an Edge — the deliberate #6b call), so the dispatcher reads `manifest.ownValue?.shape ?? 'scalar'`: no own value renders as a scalar-shaped resolved read.
- **Assignments are behaviour-preserving.** `single-image` → `composite`; every other field kind → `scalar` — pixel-identical to the two old flags. `compound`/`string-list` get reassigned by essence only when a real consumer wants their own sub-structure. `stream` is named in the SPEC vocabulary but has no arrangement law (and a shape must carry a distinct one) — it joins the union with its first consumer; `block` ships *with* its law but its first consumer is `image` (map #8).
- **`renderMode.ts` is a fifth component-free selector** (same seam shape and rationale as `placement.ts`/`childrenPolicy.ts`/`provisionPolicy.ts`): `nodeRenderMode(kind)` returns a thin discriminated union — `{mode:'plain'} | {mode:'lens', targetKind} | {mode:'derivation-chip'}` — collapsing the triplicated provision/derivation pattern-match in `TreeNodeDisplay`/`BranchView`/`KindAdornment`. Faithful to all three prior sites: lens iff `provision && derivation?.targetKind`; chip iff `derivation && !provision`; a provisioned kind *without* a targetKind stays plain.
- **`KindValueMap` derives the value union.** Hand-declared type-level in `models.ts` (deriving from the manifests is circular — they import `DataFieldValue`), covering **every** kind with re-roots → `never`, so `DataFieldValue = KindValueMap[Kind]` collapses to exactly the old hand list (no downstream ripple); compile-time assertions make a missing or stray kind key an error, so a future kind can't land without declaring its value type.

---

## SolidJS migration Phase I — boot & spine (done 2026-07-08, SOLIDJS-MIGRATION.md §6-I, plan `.claude/plans/SOLIDJS-WORKPHASE-I.md`)

**Status:** Superseded by Phase V (mop-up). The migration mechanics below — the tsconfig exclusions, the retained Qwik deps, the ESLint import ratchet — were all scaffolding for a coexistence period that is over: Qwik is absent from `package.json`, from every `src/` import, from `eslint.config.mjs`, and `tsconfig.json` now excludes only `node_modules`. Kept because the *sequencing* is instructive if a comparable migration is ever attempted; nothing here describes current code.

Cutover of the build graph, entry, state spine, and manifest types to solid-js; the Qwik UI tree stays in place unported until Phases II–IV. Non-obvious choices:

- **tsconfig-exclude + import-following.** `exclude: ["node_modules", "src/components", "src/hooks"]` removes the unported Qwik tree only as tsc *roots*; anything the ported graph actually imports (ported `SnackbarHost`, Qwik-free `numberKvState.ts`, type-only `TreeNode/types.ts`) is still typechecked by import-following. No quarantine moves, so Phase II+ ports are `git mv`-free.
- **Qwik npm deps stay installed until mop-up** (SOLIDJS-MIGRATION.md §8): unported files must stay resolvable for Vitest (`doubleTap.test.ts` value-imports a Qwik hook) and for tsc.
- **ESLint Qwik-import ratchet**: `no-restricted-imports` errors on `@builder.io/qwik*` plus the `eslint-plugin-solid` flat/typescript preset with every enabled rule forced to `'error'` (it ships `solid/reactivity` at warn), scoped to `src/**` minus `src/components/**`/`src/hooks/**`, with an identical second block re-including `src/components/Snackbar/**` (negated patterns in flat-config global ignores are a trap). Ignores shrink each phase; deleted at mop-up.
- **JSX-free spine discipline**: Vitest has no Solid transform (`vitest.config.ts` untouched), so nothing test-reachable may contain JSX. `appState.context.ts` stays `.ts` (provider JSX lives in `App.tsx`); the kinds stub became `configFieldStub.ts` — its Renderer returns a reactive thunk, cast locally because solid-js's published JSX types omit `FunctionElement` from the `Element` union (runtime accepts thunks).
- **appState**: `createStore` + each action wrapping its unchanged transition in `setState(produce(...))` — multi-field FSM writes stay atomic, writes stay funneled through actions. `transitions/selectors/guards/types/uiPrefs` shipped byte-identical (the Set-bearing toggles already reassign fresh `Set` instances, which suits Solid's property-level tracking; Sets are never proxied).
- **Snackbar service unchanged**: `SnackbarHost` registers a signal-backed accessor object (`get/set current`) via `registerSnackbarStore`, so the service's plain property assignments stay reactive; `<Show keyed>` reproduces the old `key={toast.id}` remount semantics.
- **Renderer prop contract flipped now**: `$` suffixes dropped (`onUpdated`, `onChange`); `rootRef` is a callback ref `(el: HTMLElement) => void` — was **provisional until Phase III**, where `useFieldEdit` became the real consumer. _(Provisional status resolved; the contract is settled — see the Phase III notes.)_
- **Bug #1 fix rode along** (blocked dev-boot verification): `FullCollectionSync.syncElements` exempted seeded Library rows (`treeType: 'library'` ∧ `updatedBy: AUTHOR_ID_APP_DEVELOPER`) from delete-local-not-on-remote — seeds never sync by design, so server absence was not deletion evidence. User-authored library Definitions and business rows kept full server-authority semantics (`fullCollectionSync.test.ts`). _(Superseded 2026-08-13: the purge itself is gone and took the exemption with it — see *Retention over reconciliation* under Sync Architecture. `AUTHOR_ID_APP_DEVELOPER` now marks authorship only, with no reference anywhere under `src/data/sync/`.)_

---

## SolidJS migration Phase II — read path (done 2026-07-09, SOLIDJS-MIGRATION.md §6-II, plan `.claude/plans/SOLIDJS-WORKPHASE-II.md`)

**Status:** Accepted for the durable idioms (`Accessor<T>` in / accessors out, the `disposed` stale-async guard, `<For>` reference-keying, `solid/reactivity` shaping) — these describe how the code works today. The phase-scaffolding bullets are marked inline.

Data-read hooks, views, and the TreeNode display family on Solid, read-only; edit (III) and create/author (IV) surfaces are TODO-marked holes. Non-obvious choices:

- **Hook contracts: `Accessor<T>` in, accessors out.** Call sites pass thunks (`useElementById(() => props.parentId)`); each hook's `createEffect` reads the tracked accessors once into locals, subscribes to `storageEventBus` *before* the first load (events during startup sync must not be missed), and re-runs on navigation — fresh subscription + reload, the old Qwik `track` semantics. Hooks stay `.ts`/JSX-free (Vitest has no Solid transform).
- **`disposed`-flag stale-async guard**: Solid effects capture values (Qwik QRLs re-read `.value` at run time), so an in-flight load from a previous `parentId` could land after navigation. Each loader effect sets `disposed` in `onCleanup` and skips its `set*` calls when set.
- **`useAsyncOperation` not ported** _(Deprecated — resolved at mop-up; the symbol no longer exists anywhere in `src/`.)_ Its only Solid consumer would have been `useElementChildren`, which inlines a `createSignal(false)` + try/finally.
- **`window.__cmm` DEV seeding hook in `App.tsx`**: creation surfaces don't exist until Phase IV, so migration verification seeds via the console (`execute`/`queries` wrapping the registry getters). `import.meta.env.DEV`-gated; removed at mop-up. _(Deprecated — removal confirmed in Phase V. Note that `__cmmInitState` and `__cmmSyncManager` still exist in `initStorage.ts` / `syncManager.ts`; those are unrelated globals, not survivors of this hook.)_
- **`<For>` is reference-keyed**: bus reloads produce fresh `Element` objects, so all rows recreate per reload. Harmless read-only (expanded state lives in the FSM keyed by id; `NavigableRow`'s local `expanded` signal resets — within "roughly live" tolerance). Revisit with id-keyed mapping in Phase III if edit-focus churn appears.
- **DataField chevron is wired but panel-less** _(Deprecated — a Phase-II-only intermediate state; `DataFieldDetails` mounts as of Phase III.)_: it drives `toggleFieldDetailsExpanded` (FSM + uiPrefs persist, aria/classes flip) but no `DataFieldDetails` mounts until Phase III. Renderers arrive via `<Dynamic component={manifest().Renderer}>` with a no-op `rootRef`.
- **`solid/reactivity` lint shapes small idioms**: derived values off props are thunks, not consts (`labelId`, `lensTargetKind` — a `createMemo` accessor passed as a hook argument gets flagged, a plain thunk doesn't); the `types.ts` type guards renamed their parameter from `props` to `p` (the rule pattern-matches the name).

---

## Critical Architectural Patterns

**Status:** Accepted — these are the load-bearing patterns of the current codebase. Subsections inherit this unless they say otherwise.

### Module-Level Service Registry

**Pattern**: The command bus and query objects live at module scope (`getCommandBus()` in `src/data/commands/`, `getElementQueries()` / `getDefinitionQueries()` in `src/data/queries/`) rather than in framework context, and are looked up **at call time**:

```typescript
// Registry looked up when the handler runs, so an adapter swap is always visible
const load = async () => {
  await getElementQueries().getRootElements();
};
```

**Why it stays**: two reasons that outlive any framework choice.

1. **Test seams.** `setElementQueries(mock)` / `setCommandBus(mock)` swap the backend from a plain unit test with no render, no provider, and no component tree. The whole unit suite depends on this; moving the registry into Solid context would force component rendering into tests that currently render nothing.
2. **Non-component callers.** `initStorage.ts`, the sync stack, and `commitWithUndo` all need the bus without being inside a component.

**Origin note**: the pattern was originally forced by Qwik's serialization rules (context-provided services contain methods, which can't serialize). That constraint is gone — Solid context could hold services fine — but the two reasons above stand on their own, so the migration deliberately kept it (SOLIDJS-MIGRATION.md §8 lists the collapse to plain imports as optional and not required).

---

### Storage Adapter Abstraction

**Pattern**: All domain reads/writes go through the `StorageAdapter` interface, implemented solely by `IDBAdapter` (IndexedDB via Dexie) — the single write model owning history diffing, rev minting, and sibling ordering. `FirestoreAdapter` implements only `RemoteSyncAdapter` (`applySyncItem` + pull methods): Firestore is a sync mirror, not a second CRUD backend.

**How It Works**:

- Query objects are created from adapters via `elementQueriesFromAdapter()` / `fieldDefinitionQueriesFromAdapter()` factories (`src/data/queries/index.ts`); the command bus routes through the same adapter
- `initializeQueries(adapter)` / `initializeCommandBus(adapter)` wire the active adapter (see `initStorage.ts`)
- Swapping the adapter (or calling `setElementQueries()` in tests) redirects all reads/writes without touching components
- Component-facing query/command contracts remain unchanged

**Why This Matters**: Enables swapping storage backends (IndexedDB/memory for tests) without touching components. Critical for testing and future backend changes.

**StorageResult Metadata**: Adapters return `StorageResult<T>` with lightweight metadata (adapter id, optional cache flag, latency). Enables future optimizations and debugging.

**StorageError Contract**: Normalized error shape with codes (`not-found`, `validation`, `conflict`, `unauthorized`, `unavailable`, `internal`), retryable flag, and helpers. `IDBAdapter` normalizes all failures uniformly (see Error Handling below); surfaced to users via the Snackbar.

---

### State Management: FSM via Discriminated Unions

**Pattern**: ViewState uses `{ state: 'ROOT' } | { state: 'BRANCH'; nodeId: string }` rather than separate `view` and `currentNodeId` fields.

**Why**: TypeScript's discriminated unions prevent invalid states. You can't have `state: 'BRANCH'` without `nodeId`, or `state: 'ROOT'` with a `nodeId`.

**Selectors**: Components ask "what state am I in?" via selectors (`getTreeNodeState`, `getDataCardState`) rather than storing their own state. Single source of truth prevents state drift.

**Single-Field Editing**: `editingFieldId: string | null` in AppState ensures only one DataField edits at a time. `startFieldEdit$(fieldId)` overwrites any existing value (per SPEC: "If another DataField is already editing, it is cancelled").

---

### Discriminated Union Props

**Pattern**: TreeNode accepts `TreeNodeDisplayProps | TreeNodeConstructionProps`, discriminated on `nodeState`. Type guards (`isConstructionProps`, `isDisplayProps`) narrow the union.

**Why**: Prevents passing construction callbacks to display nodes or vice versa—TypeScript catches misuse at compile time:

```typescript
export type TreeNodeProps = TreeNodeDisplayProps | TreeNodeConstructionProps;

// Type guard narrows in component
if (isConstructionProps(props)) {
  // TypeScript knows: props.onCancel$, props.onCreate$ exist
}
```

**Component Split Strategy**: TreeNode orchestrates, delegates to:

- `TreeNodeDisplay.tsx` — renders persisted nodes, delegates fields to FieldList
- `TreeNodeConstruction.tsx` — renders in-situ creation form
- `FieldList.tsx` — orchestrates persisted fields + pending forms

Orchestrator picks sub-component based on state.

---

### CQRS: Command/Query Responsibility Segregation

**Status:** Accepted, but the **examples below use pre-Element vocabulary that no longer exists in `src/`** — `getNodeQueries()`, `getFieldQueries()`, `listRootNodes()`, `DELETE_NODE` all return zero hits. Read them as shape-only; the live names are `getElementQueries()` / `getDefinitionQueries()` and the element-shaped command types. Worth a rewrite pass.

**Pattern**: Thin CommandBus dispatcher + separate query interfaces. Not a full mediator — no middleware, no logging pipeline (yet).

**Write path**: UI hooks call `getCommandBus().execute({ type: 'DELETE_NODE', payload: { id } })`. The CommandBus routes to a handler registered in `src/data/commands/handlers.ts`. Handlers call `StorageAdapter` methods directly.

**Read path**: UI hooks call `getNodeQueries().getRootNodes()` or `getFieldQueries().getFieldsForNode(id)`. Query implementations in `src/data/queries/index.ts` unwrap `StorageResult<T>` from adapter methods.

**Event emission stays in IDBAdapter**: The adapter emits `StorageEvent` after writes. The CommandBus doesn't emit events — it delegates to the adapter which handles events + sync queue. This means `applyRemoteUpdate` (sync pull path) still keeps the node index current without extra work.

**Node Index as Event Subscriber**: The in-memory `nodeIndex` (read model used by `getAncestorPath`) is updated exclusively via `nodeIndexSubscriber.ts`, which subscribes to `StorageEventBus`. Adapters no longer call `upsertNodeSummary`/`removeNodeSummary` directly. Local writes and remote sync updates both flow through the same event → subscriber path, so the index stays consistent without the write path "knowing" about the read model.

**Query layer reads from adapter directly**: No materialized views yet (beyond the existing `nodeIndex`). Queries delegate to `StorageAdapter.listRootNodes()`, etc., same as the old service layer did.

**Initialization**: `initStorage.ts` calls `initializeCommandBus(idbAdapter)` and `initializeQueries(idbAdapter)` after creating the adapter, ensuring the command bus and queries share the same adapter instance that SyncManager uses.

**Legacy service layer removed**: the old `INodeService` / `IFieldService` interfaces and `getNodeService()` / `getFieldService()` registry are gone — all reads/writes now flow through the command bus and query objects above. `CreateNodeInput` lives in `commands/types.ts`.

---

## Non-Obvious Implementation Details

**Status:** Accepted. Subsections inherit this unless they say otherwise.

### DataCard Animation: Dual-Transition Technique

**Problem**: Need content-aware height animation without explicit heights, plus slide-in effect.

**Solution**: Two synchronized CSS transitions:

1. Wrapper: `grid-template-rows: 0fr → 1fr` (height animation)
2. Inner `.datacard`: `translateY(-100%) → none` (content slides in)

Both use identical `100ms cubic-bezier(0.4, 0, 0.2, 1)` timing. The grid technique avoids setting explicit heights while remaining content-aware. Transform uses `none` (not `translateY(0)`) to avoid creating a containing block for fixed-position descendants (dropdowns).

```css
.wrapper {
  grid-template-rows: 0fr;
  transition: grid-template-rows 100ms...;
}
.wrapperOpen {
  grid-template-rows: 1fr;
}
.datacard {
  transform: translateY(-100%);
  transition: transform 100ms...;
}
.datacardOpen {
  transform: none; /* Not translateY(0) */
}
```

**Why `none` instead of `translateY(0)`**: `translateY(0)` creates a containing block, which breaks fixed-position dropdowns. `none` removes the transform entirely.

---

### Double-Tap Detection Algorithm

**Pure Function Design**: `detectDoubleTap(state, x, y, now, threshold, slop)` is a pure function returning `[isDouble, newState]`. The hook (`useDoubleTap`) wraps it with plain closure state — nothing tracks the tap state, so no signal is warranted.

**Why Pure Function**: Enables direct unit testing without rendering anything. Pass deterministic timestamps and positions, assert on return values.

**Slop Distance**: Allows slight finger movement between taps. Uses Manhattan distance (`dx <= slop && dy <= slop`) rather than Euclidean—simpler and good enough for touch tolerance. Default: 6px slop, 280ms threshold.

**Suppression Window**: After double-tap-to-save while editing, `suppressCancelUntil` prevents immediate `onBlur` from canceling the save. Set to `Date.now() + 220` on input pointerdown. Without this, the blur event fires before the double-tap is recognized, canceling the edit.

---

### Soft Deletion Implementation

**Pattern**: Both `TreeNode` and `DataField` have `deletedAt: number | null`. When `deletedAt` is set, entities are filtered from normal queries.

**Implicit Hiding**: Children of soft-deleted nodes are implicitly hidden (not cascade soft-deleted). Queries filter by `deletedAt: null` and exclude children where `parent.deletedAt !== null`. This avoids recursive queries while maintaining referential integrity.

**Sync Behavior**: Soft deletes sync normally—`deletedAt` is just another field. Remote soft deletes are applied via LWW conflict resolution. This enables delta sync to detect deletions (a hard-deleted row wouldn't appear in an `updatedAt > since` query at all — absence is not a signal).

**Soft delete is the only delete (2026-08-13)**: no code path removes an element row. `IDBAdapter` has no local-delete method, `SyncableStorageAdapter` declares none, and there is no hard-delete event on `storageEventBus` — the union is `ELEMENT_WRITTEN` / `DEFINITION_WRITTEN`, and a deletion arrives as a write carrying `deletedAt`. See *Retention over reconciliation* under Sync Architecture for why the sync-side purge went.

**History**: DataFieldHistory entries remain linked but are implicitly hidden when the field is soft-deleted. No cascade deletion of history—preserves audit trail.

---

### The developer surface (2026-08-13)

**One gate: `DEV_TOOLS_ENABLED` in `src/utils/devMode.ts`** = `import.meta.env.DEV || isEmulatorTarget`. It governs both trace logging (`devLog`) and the `window.__*` console helpers.

The obvious gate — bare `import.meta.env.DEV` — is wrong here, and the reason is worth keeping: `DEV` is false for *everything* `vite build` produces, and that one artifact is served three ways. Netlify serves it, `npm run preview:pwa` serves it (the only way to exercise the service worker), and any emulator-mode hand-test runs it. A bare DEV gate would strip the tools from the two local cases, which are exactly where they get used. Cypress is unaffected either way — it drives the dev server on :5173. Same reasoning as `SyncTargetBadge`, which is deliberately not DEV-gated.

`devLog` wraps `console.log` only. `console.error`/`console.warn` stay bare everywhere: a real failure must be visible in a production session, which is the entire distinction. Before this, three conventions coexisted — DEV-guarded, unguarded, and silent — and ~40 unguarded trace lines shipped to Netlify.

**Console helpers** (`src/data/sync/devTools.ts`, registered behind the gate): `__sync()`, `__syncStatus()`, `__wipeDefinitions()`, `__wipeLocal()`. `__syncStatus` is load-bearing beyond debugging — Cypress's `freshVisit` waits on it as the storage-init readiness signal.

**`__wipeLocal()`** deletes the Dexie database and reloads. It exists to replace a workflow that used to come free from the sync purge (wipe server → restart → client clears itself). Making it explicit is the improvement: a local reset and a remote wipe are different intentions, and the old coupling meant a *production* wipe silently reached every client. `devTools.ts` importing `clearStorage` from `initStorage.ts` closes an import cycle (initStorage imports `initializeDevTools`); it is benign — both sides are function declarations resolved at call time, long after module evaluation.

**Removed the same day**, all verified dead rather than merely suspicious: `window.__CYPRESS_SEED_MODE__` (nothing set it — Cypress deletes the databases in `freshVisit`'s `onBeforeLoad` instead) and its self-asserting test; `window.clearFirebaseIndexedDB` (obsolete per its own docblock); and two `window` network listeners in `App.tsx` whose bodies were only `console.log`. `scripts/wipe-field-definitions.ts` also advertised `window.__wipeFieldDefinitions()`, which never existed — the helper is `__wipeDefinitions`.

**Wipe scripts point at production**, so `wipe:elements` and `wipe:fielddefs` now refuse without `--yes` (`scripts/wipeShared.ts`). `npm run wipe:emulator` is the safe default for a dev reset. Note that wiping the server no longer clears any client — that is the retention change working as intended, and it means a server wipe alone no longer gives a clean slate.

---

### Sync Architecture

**Bidirectional Sync**: Push-first (local→remote), then pull (remote→local). Ensures local changes are sent before applying remote changes.

**Sync Queue**: Local changes are enqueued in IndexedDB `syncQueue` table. Queue items processed sequentially. Failed items marked for retry. Queue survives page reloads.

**Conflict Resolution**: Last-Write-Wins (LWW) based on `updatedAt` timestamps. Server timestamps are authoritative when available. During sync, remote entity with higher `updatedAt` wins.

**Protect Pending Items**: `ServerAuthorityResolver` skips any remote row whose id is still in the sync queue, so an un-pushed local edit is never overwritten by the server copy it is about to replace. (This is distinct from the deletion guard that used to live in `FullCollectionSync` — see *Retention over reconciliation* below.)

**Sync Strategies**:

- **FullCollectionSync**: Pulls all entities (used on startup, ensures complete reconciliation)
- **DeltaSync**: Pulls only changes since last sync (faster, used periodically)

**The delta cursor is a high-water mark, not the clock (2026-08-13)**: `SyncStrategy` returns a `highWaterMark` — the newest `updatedAt` among the rows a pull actually received, across both lanes — and `SyncManager.advanceCursor` writes that. It used to write `now()`, which is the wrong quantity: `pullElementsSince` compares against `updatedAt`, stamped by `serverTimestamp()`, so a client clock running ahead of the server left a cursor past rows it had never pulled, invisible until the next startup `syncFull()`. Three consequences worth naming, because each looks like a defect from the outside: an empty pull leaves the cursor **unmoved** (advancing over an empty window is precisely what opened the gap); a full sync may move the cursor **backwards**, which is the repair path for a store still carrying a clock-stamped cursor; and the mark counts rows *received*, not *applied*, so a row the resolver skipped for a pending local edit still advances it — otherwise the cursor sticks behind that row and re-pulls it every cycle. Strict `>` in the query pairs with a max-based cursor exactly: no re-pull, no gap. Contract: `src/test/syncCursor.test.ts`.

**Retention over reconciliation (2026-08-13)**: `FullCollectionSync` is purely additive — it applies what the server has and removes nothing. It used to delete any local element missing from the pull, skipping rows still in the sync queue, with a further exemption for the dev seeds (which never sync, so their absence proved nothing).

Both guards were patches on an unfixable premise: **server absence is ambiguous**. Never-pushed, push-failed, admin-deleted and never-pushed-by-design all look identical from the client. The queue guard leaked in exactly the worst case — `getSyncQueue()` filters out retry-exhausted items, so a row whose push *permanently failed* dropped out of `pendingIds`, wasn't on the server, and got purged. The row least safe to lose was the one the purge was most likely to take. It was safe only by accident of ordering (`initStorage` calls `requeueFailed()` before `syncFull()`), and swapping those two lines would have turned it into silent data loss.

Removing the purge deletes the whole class: no `deleteElementLocal`, no `pendingIds` read, no seed exemption, no `SyncQueueManager` dependency on the strategy at all. The cost was a dev workflow that came free with it — wipe the server, restart, watch the client clear itself — now an explicit `window.__wipeLocal()`. Contract: `cypress/e2e/retention.cy.ts`.

**Post-Sync UI Refresh (audit §2.3 + §4.4, 2026-06-11)**: One reactive model — *writes emit; readers subscribe*. Every write (local command or remote sync apply via `applyRemoteElement`) emits a per-element event on `storageEventBus` from `IDBAdapter`. Views read through `useElementChildren`/`useElementById` (`src/hooks/useElementChildren.ts`), which subscribe to the bus and reload when a relevant event lands (relevance predicates in `src/data/storageEventRelevance.ts`; 30ms trailing debounce coalesces write bursts). The former window `storage-change` CustomEvent and the `onDeleted$`/`onCreated$`/`onCommitted$` reload-callback threading were deleted — no reload callbacks are threaded through props.

**The under-construction node renders twice unless it is filtered out**: the bus reload puts a newly created node into the view's list while the construction card is still mounted — `complete()` awaits `CREATE_ELEMENT` and the draft commit before `completeConstruction`, so for that window the node is both "under construction" and "a child". Both views drop it from the list they render (`displayNodes` in `RootView.tsx`, the inline filter in `BranchView.tsx`) and render the UC card from its own `<Show when={ucNode()} keyed>` position instead.

In **Qwik** the filter alone was not enough and the fix was a namespaced key (`uc-${id}`): sharing the raw element id let the keyed reconciler identity-match the UC `<TreeNode>` against the display one and *reuse the construction component instance* rather than unmounting it, so the card stuck on screen even though the FSM had cleared. **Solid needs no such key** — the UC card lives in a separate `<Show>` position and is never a candidate for `<For>` identity-matching, so the filter carries the whole guarantee. There is no `uc-` prefix anywhere in `src/`; the comment at `RootView.tsx` says the same thing at the site.

Contract: the post-condition inside `cy.createNode()` (`cypress/support/e2e.ts`) — it asserts `input[aria-label="Node name"]` no longer exists once the node appears, which is exactly "the construction card unmounted". Every spec that creates a node exercises it, `core-loop.cy.ts` first. (This note used to cite `cypress/e2e/repro-create-node.cy.ts`, which the SolidJS port dropped — the guarantee moved into the shared command rather than being lost.)

**Event-Driven Sync Triggering**: Sync is triggered via `StorageEventBus` rather than manual `triggerSync()` calls in UI code. `IDBAdapter` emits typed events (`ELEMENT_WRITTEN`, `DEFINITION_WRITTEN`) after local CUD operations. `syncSubscriber.ts` subscribes and calls `triggerSync()`, which debounces at 500ms. Remote-applied rows emit too — the UI must repaint either way — but carry `origin: 'remote'`, and the subscriber pushes only on `origin: 'local'`, so a pull cannot echo itself into another pull. UI code never calls `triggerSync()` directly.

**SyncQueueManager Extracted from IDBAdapter**: The sync queue (`getSyncQueue`, `enqueue`, `markSynced`, `markFailed`) lives in `src/data/sync/SyncQueueManager.ts` rather than on the adapter. `IDBAdapter` holds a `SyncQueueManager` instance and delegates to it. This keeps the adapter a pure storage adapter and makes the queue reusable across storage backends.

**Single offline cache (audit §2.2, 2026-06-11)**: Firestore is initialized with `memoryLocalCache()` unconditionally — Dexie + syncQueue is the app's only offline cache; Firestore is a dumb wire. (A `clearFirebaseIndexedDB()` console helper used to sit in `firebase.ts` to clear orphaned SDK mirror DBs left by pre-`memoryLocalCache` builds; removed 2026-08-13, since the SDK has not created one in a long time.)

**Sync retry policy (audit §4.3, 2026-06-11)**: No dedicated backoff machinery — failed queue items simply ride existing sync cycles (write-debounce, `online` event, 10-min timer) up to `MAX_SYNC_RETRIES = 5` attempts. `getSyncQueue()` returns pending + under-cap failed items; at the cap an item is parked as exhausted. On exhaustion `SyncManager` shows an error snackbar with a **Retry** action that re-arms (`requeueFailed()`: status→pending, retryCount→0, `lastError` kept for forensics) and syncs immediately. App startup also re-arms all failed items, so a missed toast isn't permanent.

**Fail-fast sync timeouts**: The Firestore SDK *never rejects* writes against an unreachable server — it buffers them and retries the transport forever — so an awaited `setDoc` hangs and would wedge the whole sync layer (`isSyncing` stuck true, every later cycle skipped). `SyncPusher` therefore races each `applySyncItem` against `SYNC_WRITE_TIMEOUT_MS` (10s); a `TimeoutError` is treated as connection-level failure and the rest of the queue is failed in lockstep (no per-item wait, items exhaust on the same cycle → one toast, not a drip-feed). Pull strategies are likewise wrapped in `SYNC_PULL_TIMEOUT_MS` (30s). Helper: `src/utils/withTimeout.ts`.

**Retry-action QRL without `$()`**: `ToastAction.handler` must be a QRL, but a module-level `$()` in `syncManager.ts` crashes every Vitest import (no Qwik optimizer in tests: "Optimizer should replace all usages of $()"). The handler lives in `src/data/sync/retryFailedSync.ts` and `syncManager.ts` wraps it with the runtime API: `qrl(() => import('./retryFailedSync'), 'retryFailedSync')` — works with and without the optimizer, captures nothing, resolves `getSyncManager()` at invoke time per the registry-getter pattern.

**One database per sync target (2026-08-11)**: production and the emulator open *different* Dexie databases. They cannot share one: `FullCollectionSync` deletes local elements absent from *its* remote, so on a shared database every flip between targets wipes the other target's data (observed: flipping to the emulator blanked the seeded tree; worse in an installed PWA, whose `start_url` carries no query string, so an online first load migrated straight from production). The alternative fix — gating the deletion pass behind a same-remote check — was rejected: it stops the wipe but leaves both remotes' rows interleaved in one store, trading a loud symptom for a subtler one.

Three details that look arbitrary and aren't:

- **Production keeps the unsuffixed name** (`complete-maintenance-management`); only the emulator moves to `…-emulator`. Suffixing both would be tidier but would orphan every existing local database behind a name nothing opens.
- **The target resolver is its own module** (`src/data/syncTarget.ts`), not an export of `firebase.ts`. `storage/db.ts` needs the target at construction time, and importing `firebase.ts` would drag the Firebase SDK into the storage layer and fire its import-time `initializeApp`. Both modules now read the one resolver, so they cannot drift. It resolves once at load — the target cannot change without a reload, since Dexie fixes its name at construction.
- **Cypress deletes both names** (`cypress/support/e2e.ts`). Specs visit `?emulator=true`, so the emulator-scoped database is the live one; deleting only the original would have let every spec boot against stale emulator state.

`SyncTargetBadge` is the legibility half of the same fix: scoping removes the loud symptom (data vanishes) and leaves a quiet one (an unfamiliar dataset), so a floating badge marks emulator sessions. Deliberately not DEV-gated — in a PWA the only way into emulator mode is `localStorage.USE_FIRESTORE_EMULATOR` on a production build, which is exactly when the marker earns its place.

---

### DataField Components / Templates / Instances

**Pattern**: DataField is split into three entities:

1. **Template** (`DataFieldTemplate`) — declares `componentType` (discriminated union over the 4 Phase-1 Components: `text-kv`, `enum-kv`, `number-kv`, `single-image`), a human label, and per-Component `config`. Stored in its own Dexie table and Firestore collection (`dataFieldTemplates`).
2. **Instance** (`DataField`) — attaches a Template to a TreeNode with a typed `value: DataFieldValue | null`. Snapshots `fieldName` and `componentType` from the Template at creation so later Template label edits don't rewrite persisted user data.
3. **History** (`DataFieldHistory`) — discriminated union on `componentType`; `property` is always `"value"`; `prevValue` / `newValue` carry the Component's value shape (string for text/enum, number for number-kv, image-metadata for single-image).

**Seeding on boot**: `src/data/services/seedTemplates.ts` writes 6 dev-Templates (Description, Type Of, Tags, Status, Weight, Main Image — one per componentType plus defaults) idempotently, guarded by a `syncMetadata.templatesSeededVersion` key. Seeds write directly to `db.templates` with no sync-queue enqueue: every client seeds identically, so propagating them as sync ops would be N redundant writes per N clients. Called from `initializeStorage()` after `initializeQueries()` but before `initializeSyncManager()` so queries are ready but the first-sync push doesn't see seed rows.

**Command shape**: writes go through `ADD_FIELD_FROM_TEMPLATE` (creates an instance of a Template on a node) and `CREATE_NODE_WITH_FIELDS` (whose `defaults` is `{ templateId }[]`). The older freeform `ADD_FIELD` is gone — there's no path to create a DataField without a Template.

**Schema v3 upgrade-clear**: `db.ts` `version(3)` upgrade function clears every table. `fieldValue` is gone from the row shape, and no migration path was worth writing for prototype data. Firestore emulator should be wiped alongside.

---

### DataField Component Dispatcher

**Pattern**: `DataField.tsx` is a thin dispatcher. It owns the row layout (chevron, label, details-expansion) and switches on `field.componentType` to render one of four per-Component renderers:

- `TextKvField.tsx` — text-kv
- `EnumKvField.tsx` — enum-kv (reuses CreateDataField's dropdown styles)
- `NumberKvField.tsx` — number-kv (with `numberKvState.ts` pure function for ok/warn/alarm state)
- `SingleImageField.tsx` — single-image stub (Phase 1 placeholder only)

Sub-components render their own value column only; the dispatcher wraps them.

**Shared `rootRef`**: outside-click cancel needs to cover the entire DataField row (chevron + label + value), not just the value column. The dispatcher creates a single `Signal<HTMLElement | undefined>` and passes it down to each sub-component, which passes it into `useFieldEdit`. This is why `useFieldEdit` takes `rootRef` as an option rather than creating its own.

**Component-specific Template config is fetched inside the renderer** via `getTemplateQueries().getTemplateById()` wrapped in `useResource$`. For renderers that need the Template to compute display (enum options, number units/ranges), the resource is tracked on `props.templateId` so it re-fetches if the field's Template changes (rare but possible post-Phase-1).

---

### Generic `useFieldEdit<T>`

**Pattern**: `useFieldEdit<T extends DataFieldValue>` is parameterized on the stored value type T. The edit buffer is always a `Signal<string>` (user types into a text input regardless of T); callers supply `parse: (raw: string) => T | null` to convert on save and `format: (value: T | null) => string` to render for display and seed the edit buffer on begin.

- **text-kv**: identity parse/format, with `trim() === ''` → `null`.
- **number-kv**: `parseFloat` parse (throws on NaN, caught in `save$` → Snackbar error), `toFixed(decimals)` format. Optional `validate: (value: T | null) => void` callback rejects out-of-absolute-range values.
- **enum-kv**: doesn't use `useFieldEdit` — the dropdown pick is a one-step save, not a text-buffer edit.
- **single-image**: stub, no edit flow.

The `save$` flow: parse → validate (if provided) → `getCommandBus().execute({ type: 'UPDATE_FIELD_VALUE', ... })` → Snackbar with Undo action. Parse/validate errors surface as a Snackbar error variant and leave edit mode open.

**Preview/revert from history was removed** during the Component split — it was tightly coupled to the old monolithic `useFieldEdit` and hoisting it across the Component boundary is deferred (see ISSUES.md).

---

### Add-Field Surfaces: A/B Roster + Mutex

**Pattern**: FieldList hosts multiple "add field" UX surfaces side by side as a deliberate A/B comparison (currently `FieldComposerSlot` and the legacy `CreateDataField` dropdown; more variants planned). Which surfaces render in display mode is controlled by the `ENABLED_ADD_FIELD_SURFACES` roster in `src/constants.ts` — adding/removing a surface is a roster edit, not new conditional logic.

Coordination is a single parent-owned mutex signal: `useSignal<ActiveSurface>('none')` in FieldList. Each surface is open iff `activeSurface.value === <its own id>`, opens by writing its own id, closes by writing `'none'` — last writer wins, so opening any surface implicitly closes the rest, and that property holds for any number of surfaces. The `ActiveSurface` / `AddFieldSurfaceId` types and the full surface contract (including the post-persist reload callback) live in `src/components/FieldList/addFieldSurfaces.ts`, deliberately neutral ground so no surface imports from a competitor. Construction mode bypasses the roster: the composer is always rendered there (locked-defaults flow requires it) and ignores the mutex.

---

### Data Model Conventions

**Root Nodes**: Use `parentId: null`, not sentinel value like `"ROOT"`. Adapter queries use `where('parentId', '==', null)` directly. TypeScript type is `parentId: string | null`.

**History ID Scheme**: `${elementId}:${rev}:${random}` (`createElementHistoryEntry`). The random tail is the load-bearing part; the prefix is for humans reading a raw row. `rev` is minted by `nextElementRev`, a max over *local* history, so it is a per-client sequence and **not** unique across clients — two clients editing the same element offline both reach rev 5. While the id was just `${elementId}:${rev}` that meant two distinct appends shared a key, and one destroyed the other: `setDoc` without merge pushing up, `put` keyed by id pulling down. Silent audit loss.

Because history rows are append-only and never updated in place, unique ids are the entire fix: the log is a grow-only set, so merging two clients is union, `put` is idempotent, and a full sync can re-apply everything safely. No coordination, no allocator, no schema change — nothing parses the id, so old two-part ids stay valid beside new ones. Display order is `compareHistory` (`storage/historyHelpers.ts`), shared by both readers: `rev`, then server-stamped `updatedAt`, then `id` as an unbreakable tiebreak. Deterministic rather than notionally-true — nothing can recover the real authoring order of two offline edits, but every client sorting identically is achievable and is what convergence needs. Contract: `src/test/historyConvergence.test.ts`.

**Timestamps**: `Date.now()` wrapped in `now()` from `src/utils/time.ts` for future mockability. Currently client-assigned; LATER.md tracks server-assigned timestamp migration.

**cardOrder**: Auto-assigned on creation based on `nextCardOrder(parentNodeId)`. Reflects creation order (via `updatedAt`) but allows future reordering without changing all fields.

**cardOrder compaction policy**: Gaps are tolerated; the UI sorts ascending so they're invisible. Compaction (via `computeCardOrderUpdates` in `src/data/utils/cardOrder.ts`) runs only at three points:

1. **Cancel during UC** — `usePendingForms.cancel$` / empty-name `save$` resequence in-memory pending forms starting from `maxPersisted + 1`. Free (no I/O).
2. **Incoming remote field sync** — `IDBAdapter.applyRemoteUpdate('field', ...)` resequences active siblings locally using `sortByCardOrder` (cardOrder asc, id asc tiebreak). Writes are IDB-only; not enqueued to the sync queue. Two clients independently converge on the same deterministic order.
3. **Reorder UI** (future) — will call the same helper.

**Not compacted on delete**: soft-delete leaves a gap; would cost N field writes + N sync ops per delete for no user-visible benefit.

**Construction-mode field creation races**: `CREATE_NODE_WITH_FIELDS` iterates `defaults` sequentially with explicit `cardOrder: i`. A prior `Promise.all(defaults.map(createField))` raced — every concurrent call saw an empty fields table in `nextCardOrder` and returned 0, collapsing all fields to cardOrder=0.

---

### Unified Element Model — Design Rationale

> Design decided on `REFACTOR-single-unified-data-model`; **not yet built**. Captures *why*, so the choices aren't re-litigated. Migration steps live in ISSUES.md; full deliberation in `opus_chat_unified_data_model.md`.

**One primitive, many renderers.** `TreeNode` and `DataField` collapse into one `Element`. The payoff is where complexity lands: with two primitives, every new kind of thing (Job, Logbook, Equipment Plate) risks a schema change; with one, variety lives in **renderers keyed by `kind`** — pure presentation, addable without touching storage. The schema stops being the axis that proliferates.

**Why `siblingOrder` is uniform (and not `updatedAt`).** Order is an explicit, addressable scalar on every element rather than an implicit "position in the parent's array." Two reasons: (1) an explicit scalar can be *shadowed* by a future per-user override (a sparse overlay layered at read time) — an implicit position can't, without duplicating the whole array per user; (2) stable positions beat the old `updatedAt` re-sort, which reshuffled a node's siblings every time it was edited. Cost: inserting between siblings can't use plain `max+1` — the strategy is **renumber-the-run** (reassign sequential integers to the affected siblings via `computeCardOrderUpdates`), not fractional keys.

**Why history keys to the element and spans all properties.** One append-only audit spine for the whole model, not just field values. Keying to `elementId` and widening `property` to `value | name | subtitle | parentId | siblingOrder` means renames, moves (a move *is* a `parentId` change), reorders, and structural deletes are all auditable and revertible through the existing `rev`/`prev`/`new` mechanism — no second system.

---

### UI Prefs Serialization

**Pattern**: Sets (`expandedCards`, `expandedFieldDetails`) stored as JSON arrays in localStorage. Converted on load/save in `uiPrefs.ts`.

**Why Arrays Not Sets**: localStorage only stores strings. Sets are converted to arrays on save, arrays converted back to Sets on load.

**Immediate Persistence**: Toggling always persists immediately—no debounce needed since localStorage writes are synchronous. No performance impact for this use case.

---

## Hook Patterns

**Status:** Accepted.

The house shape is **`Accessor<T>` in, accessors out** — call sites pass thunks so a hook re-reads on navigation instead of capturing a stale value at mount.

**useNodeCreation**: Extracts the duplicate creation flow from RootView/BranchView. Takes `parentId: Accessor<string | null>`, returns `{ ucNode, start, cancel, complete }`. `parentId` is read at `start()` time, so a long-lived BranchView can't parent a node under the view it already left. `complete` dispatches `CREATE_ELEMENT` via `getCommandBus()`, commits the pending draft, then closes the FSM's construction state.

**useDoubleTap**: Returns `{ checkDoubleTap }`, which takes `(x, y)` and returns a boolean. Caller decides what to do on double-tap. Tap state is plain closure state — synchronous, nothing tracks it.

**usePendingForms**: Owns the composer's pending batch and its localStorage persistence. Returns `{ forms, lastToggledId, togglePending, setPendingValue, commitAll, discardAll }`. Mutators write through to localStorage immediately so a commit from another component reads the current batch. `nodeId` is a mount-time constant by contract — the composer remounts per session via a keyed `<Show>`.

**useFieldEdit**: All edit state/interaction logic for DataField — FSM integration, double-tap detection, focus management, outside-click cancellation, and the composer's `pendingMode` (where click-away *commits* instead of cancelling). Returns refs, accessors, and handlers.

---

## CSS Architecture

**Status:** Accepted. The *Deliberate Non-Abstractions* subsection is the part that earns its place — it records two abstractions considered and rejected, which is exactly what stops someone re-proposing them.

**Three-Layer Token System** (`tokens.css`):

1. Primitives — raw color palette (`--color-gray-600: #666`)
2. Semantic tokens — purpose-mapped (`--text-muted: var(--color-gray-600)`)
3. Component tokens — specific overrides in CSS modules

Semantic tokens used throughout; primitives never referenced directly in components. Enables future theming by overriding semantic layer.

**Utility Classes** (`global.css`):

- `.no-caret` — prevents text cursor on interactive non-input elements
- `.btn-reset` — strips button defaults (background, border, padding)
- `.input-reset` — strips input defaults for inline editing
- `.input-underline` — common underline pattern with focus color change

**The mount element owns the container width** (`#app` in `global.css`, added 2026-08-10):

`body` is `display: flex; justify-content: center`, so `#app` is a flex item. A flex
item with no width is shrink-to-fit — sized by its *content*. For months `#app` had no
CSS at all, which meant `.view-root` / `.view-branch`'s `width: 100%` resolved against a
content-sized parent and their `max-width: var(--container-max)` was never reached: the
whole app grew and shrank with whatever the current view happened to contain (measured
at 559.81px on a 1536px viewport, and visibly narrower again two levels down the tree).
Navigating re-rooted the FSM, the content changed, and the app jumped width.

So `#app` carries `width: 100%; max-width: var(--container-max)` and the views inherit a
stable box. This is also the whole of the responsive story — `width: 100%` fills a phone,
`max-width` caps a desktop; there is no breakpoint and none is needed. **Don't remove the
rule on the grounds that the views already declare their own max-width.** They do, and it
does nothing without a parent that has a resolvable width.

Two riders from the same fix: `min-width: var(--container-min)` came off both views (it
forced overflow below 240px and bought nothing the content didn't already enforce — the
token lives on in `TreeNode` / `CreateNodeButton`), and `body` took `env(safe-area-inset-*)`
padding, paired with `viewport-fit=cover` in `index.html`, so an installed PWA clears the
notch. The insets resolve to 0 in a normal browser.

**Deliberate Non-Abstractions**: Evaluated and skipped these components:

- **ActionButtons component** — Cancel/Save patterns vary enough (different labels, sizing, slot usage, conditional rendering) that abstraction would be more complex than duplication.
- **Input component** — Utility classes (`.input-reset`, `.input-underline`) cover the patterns. A component would just wrap these without meaningful benefit.

---

## Testing Patterns

**Status:** Accepted.

**Service Testing**: Tests use the same registry abstraction as components (`getElementQueries()` / `getCommandBus()`). Tests can call `setElementQueries()` to swap a mock query object, or swap the adapter to redirect reads/writes. `SyncPusher.test.ts` mocks `RemoteSyncAdapter`. Two suites do exercise the real `FirestoreAdapter` against the emulator: `firestoreAdapter.test.ts` (the adapter lane — one `applySyncItem` or one pull at a time) and `syncManagerEmulator.test.ts` (the sync lane — push→pull cycles, server authority against a row genuinely sitting in the queue, cursor advance across cycles). Both mock `../data/firebase` with an emulator-bound instance, because `firebase.ts` gates its emulator connect on `isBrowser` — see *No `globalSetup` — deliberately* below.

**Pure Function Testing**: `detectDoubleTap` is exported separately from the hook for direct unit testing without rendering. Pass deterministic timestamps and positions, assert on return values.

**localStorage Mocking**: `uiPrefs.test.ts` uses a mock `localStorage` object. Tests verify Set↔Array conversion and persistence behavior.

**No `globalSetup` — deliberately (2026-08-11)**: `vitest.config.ts` has `setupFiles` (fake-indexeddb, the navigator stub) but *no* `globalSetup`, and must not regain one that touches `data/firebase`. The removed `src/test/globalSetup.ts` called `cleanupAllTestFixtures()`, which imports the real Firestore `db`; the emulator connect in `firebase.ts` is gated on `isBrowser`, so under Node it never fires and that `db` points at **production**. Every `npm run test` therefore read every document in `elements`, `elementHistory` and `fieldDefinitions` and batch-deleted any `TEST_`-prefixed id — reporting "Cleaned: 0" only because nothing mints `TEST_` ids any more (the Element refactor replaced the live-Firestore suite with mocks). It was also the long-standing "Vitest never exits" hang: `getDocs` opens a gRPC/HTTP2 session the Firestore SDK never closes and nothing called `terminate()`. The `hanging-process` reporter names it as `TCPWRAP`/`TLSWRAP`/`HTTP2SESSION`/`PendingRequest` inside `@grpc/grpc-js/build/src/transport.js` — and `TLSWRAP` is the giveaway that it was production rather than the plaintext emulator, not the SyncManager interval or a Dexie handle as long assumed.

`src/test/testUtils.ts` and `src/test/cleanup.ts` survive as the manual sweep (`npm run test:cleanup`), which is the right shape for something that writes to production: deliberate, never implicit. Reinstating any automatic remote setup would still need `firebase.ts` to gain a Node emulator-connect path — the two emulator suites sidestep its absence by mocking the module, which a `globalSetup` importing the real `db` could not do — otherwise it silently re-aims at production.

---

## Error Handling

**Status:** Accepted.

**StorageError Contract**: Normalized error shape enables consistent error handling at the write model. `IDBAdapter` wraps every public method in a single private `run()` helper implementing `try/catch → (isStorageError passthrough) → toStorageError({ code, retryable })`, with `mapDexieError` keying off the IndexedDB/Dexie `.name` (`QuotaExceededError → unavailable`, `ConstraintError → conflict`, `NotFoundError → not-found`, `DataError → validation`, etc.; unknown → `internal`). The `isStorageError` guard preserves hand-thrown `makeStorageError` validation/not-found errors from being re-wrapped. UI surfaces these via `describeForUser()` through the Snackbar (`useFieldEdit`, `DataField`). `FirestoreAdapter`'s sync methods throw raw Firestore errors; the sync layer (`SyncPusher`) catches per-item failures and marks the queue item failed rather than surfacing them to the UI.

---

## SolidJS Migration — Phase III edit-path notes (2026-07-10)

**Status:** Accepted. Despite the "migration" heading, these describe live edit-path behaviour — the pointerdown/detached-target and preventDefault guards, `suppressBlurUntil`, the always-on listeners. The Qwik references are comparative framing, not live constraints.

**`rootRef` is a read accessor passed down; the DataField dispatcher owns the row ref.** `FieldRendererProps.rootRef: Accessor<HTMLElement | undefined>` — the dispatcher holds the signal ref on its wrapper div so outside-click containment covers the whole row (chevron + label + value); renderers only read it. `onUpdated` was deleted from the contract rather than ported — zero producers existed pre-migration.

**`suppressBlurUntil` is a plain mutable box, deliberately not a signal.** Nothing tracks it; handlers read/write `.value` imperatively across the pointerdown/blur race. A signal would falsely promise reactivity at the call sites.

**Always-on document/window listeners with first-line FSM guards replace `useOnDocument`/`useOnWindow`.** Attached once at hook/component setup, removed in `onCleanup`; the guard (`editingElementId !== fieldId` / `!isOpen()`) makes them no-ops while inactive — same handler shape as Qwik, no attach/detach churn.

**The §10 Qwik-render workarounds are deleted, and two new Solid-timing guards took their place.** `FOCUS_DELAY_MS` and the four `setTimeout(0)`s are gone (Solid user effects run after render, so refs are ready). But Solid swapping display→input *synchronously inside the pointerdown dispatch* created two hazards Qwik's async QRLs never saw: (1) the outside-click document listener runs later in the same dispatch and sees the original tap target already detached — detached targets are now ignored (they cannot be an outside click); (2) the browser's compatibility-mousedown focus default action fires after the swap and steals focus from the just-focused editor — the double-tap branches call `ev.preventDefault()` (`useFieldEdit.valuePointerDown` and the EnumKvField trigger).

**EnumKvField's open effect tracks the options resource on purpose.** Positioning + first-option focus re-run when the IDB config fetch resolves, closing a Qwik-era race where the `setTimeout(0)` could fire before the options rendered; an `activeElement` guard prevents focus theft on re-runs.

**DataFieldDetails subscribes before its first fetch.** The bus subscription is registered ahead of the initial history/definition load (Phase II discipline), strictly closing the Qwik version's missed-event window between mount and the visible-task's first fetch.

## SolidJS Migration — Phase IV create/author notes (2026-08-09)

**Status:** Accepted. Same as Phase III — the keyed-`<Show>` remount mechanism, the accessor+setter prop pair, and the `createEffect(on(…))` untracked-callback argument are all live and load-bearing.

**A value-keyed `<Show>` is the successor to Qwik's `key=` remount idiom.** `FieldComposerSlot` wraps the composer in `<Show when={restoreSeed() ? 'restored' : 'fresh'} keyed>`: `keyed` recreates children whenever the `when` *value* changes, so a Snackbar-Undo restore flips `'fresh' → 'restored'` and remounts the composer, which is what re-runs `usePendingForms`' mount seed-loader against the restore seed. The remount — not any prop diff — is the mechanism, exactly as under Qwik. Children are plain JSX rather than a render function: Solid's keyed overload types the callback as `RequiredParameter`, so a zero-arg `() =>` fails typecheck and a one-arg one leaves an unused binding.

**An accessor + setter pair replaces a `Signal<T>` passed as a prop.** Solid has no writable-signal-prop idiom, so the `activeSurface` mutex is threaded as `activeSurface?: Accessor<ActiveSurface>` + `setActiveSurface?: (s) => void` (the `rootRef`-accessor precedent, not a smuggled tuple). FieldList owns the signal; last-writer-wins semantics are unchanged, so opening one add-field surface still implicitly closes the other.

**`createEffect(on(…))` where the tracking must be dependency-only.** BranchView cancels an in-flight construction when `parentId` changes. `on()` is load-bearing rather than stylistic: its callback runs *untracked*, so the `appState.underConstruction` read inside it never becomes a dependency. A plain `createEffect` would re-run when `startConstruction` fires and cancel the construction it had just opened. It calls the raw `cancelConstruction` transition (not the hook's `cancel`) so the localStorage draft survives navigation, matching pre-migration; it is defensive anyway, since `guards.notUnderConstruction` blocks navigation while UC is open.

**DataCard grew an `actions?: JSX.Element` prop, rendered after `children`.** The successor to Qwik's `<Slot name="actions"/>`, carrying TreeNodeConstruction's Cancel/Create row. DOM output is identical minus Qwik-internal `q:slot` attributes.

**The UC "namespaced key" rationale dissolves in Solid — a filter, not a key, prevents the dual render.** Qwik needed `key={`uc-${id}`}` so the reconciler wouldn't identity-match the construction vnode with the display TreeNode of the same id. In Solid the UC card renders in its own `<Show>` position and is never matched against the `<For>` rows. What still matters is the list filter (`RootView.displayNodes` / BranchView's children filter): the bus reload can land the created node in the list while `underConstruction` is still set, because `complete()` awaits CREATE_ELEMENT and `commitPendingDraft` before `completeConstruction`.

**`usePendingForms` dropped Qwik's `initialized` latch.** It existed to guard `useVisibleTask$` re-runs on remount; `onMount` runs exactly once, so the seed load uses the standard `disposed` guard around its await instead. Stored-draft-wins ordering is preserved verbatim: `loadPendingForms(nodeId)` first, and only an empty result runs `initialSeedLoader`. All mutators keep their write-through `savePendingForms` calls — now genuinely same-tick before any construction commit reads localStorage.

## SolidJS Migration — Phase V: PWA, build & mop-up (done 2026-08-09, plan `.claude/plans/SOLIDJS-WORKPHASE-V.md`)

**Status:** Accepted. This section is the supersession record for Phase I's scaffolding — it is what makes those bullets safe to read as history.

The closing phase: the PWA/build pass the cutover deferred, plus SOLIDJS-MIGRATION.md §8 mop-up. Non-obvious choices:

- **`CACHE_VERSION` is the eviction lever, so it had to move.** `activate` deletes only caches whose *name* differs from the current one, and the name is `cmm-app-shell-${CACHE_VERSION}`. Leaving it at `'v2'` across the framework change would have let a returning browser keep serving Qwik-era chunks out of the identically-named cache indefinitely. Bumped to `'v3'`; verified on the built app that `cmm-app-shell-v3` is the only cache present.
- **The precache plugin's defaults were pointing at a deleted file.** `swSource` still defaulted to `src/routes/service-worker.ts`, removed in Phase I — inert only because `vite.config.ts` passes the real path. Corrected, and the Qwik/SSG-specific `excludePatterns` (`q-manifest.json`, `bundle-graph.json`, `q-data.json`, `sitemap.xml`) replaced with `service-worker.js` + `.map`. The injected manifest is now the 8 real shipped files.
- **`server/` was a live directory, not a stale ignore entry.** Dropping `'server/**'` from the eslint global ignores made lint fail on 80 KB of minified Qwik City SSG output (`@qwik-city-plan.mjs`, `entry.ssr.mjs`, `q-*.js`) still sitting on disk from before the cutover. Untracked by git, so it was deleted rather than re-ignored.
- **`devTools.ts` survived mop-up; `window.__cmm` did not.** `window.__sync` / `__syncStatus` / `__wipeDefinitions` predate the migration and are un-gated project tooling. Only the `import.meta.env.DEV`-gated `__cmm` console-seeding hook (added in Phase II because creation surfaces didn't exist yet) was migration scaffolding, and it went with its `TODO(mop-up)`.
- **The Qwik-comment sweep was a rewrite, not a strip.** Several comments named Qwik while guarding a constraint that outlived it: the `src/kinds/*` and unit-test "keep this component-free" notes are still true because `vitest.config.ts` has no Solid JSX transform, and `useFocusManager` / `useFieldEdit` still need an explicit *don't re-add a timeout* warning. Those were restated in Solid terms; only pure "the Qwik version did X" comparisons were deleted. The dated Phase I–IV sections above are left as historical record.
- **Lint and typecheck scope collapsed to the whole tree.** The two-block eslint carve-out and the `no-restricted-imports` Qwik ratchet are gone — one Solid block now covers `src/**/*.{ts,tsx}` at error, which newly gates `useSyncTrigger.ts` (no findings). `tsconfig.json` is back to `"exclude": ["node_modules"]`; nothing new entered the program, since every component was already import-reachable from `entry.client.tsx`.
- **No first-paint splash.** Meta-plan §9 pre-approved a static shell in `index.html` if CSR's blank window read badly. It didn't on the built app, so nothing was added — the cheap fix stays available if it ever bites.

---

## Deployment — Netlify (`netlify.toml`, settled 2026-08-10)

**Status:** Accepted. Corrects a Phase V claim: that section was written from `firebase.json` (firestore-only) and concluded there was no hosting target. There is. The app has deployed to `complete-maintenance-management.netlify.app` on every merge to `master` for months.

`netlify.toml` had been Netlify's untouched example scaffold — build command and publish dir, SPA redirect commented out, no header rules, and a `functions = "netlify/functions"` pointing at a directory that doesn't exist (dropped). The three rules now in it are each load-bearing for a specific failure:

- **`Cache-Control: no-cache` on `/service-worker.js`.** The SW *is* the update mechanism: `activate` evicts old caches only when `CACHE_VERSION` changes, and that constant ships inside `service-worker.js`. If the CDN serves a stale copy of that file, the bump never executes and returning visitors keep being served the previous app shell out of the previous cache — a deploy that silently doesn't land, indistinguishable from a broken fix. This is the one rule not to remove.
- **Same header on `/index.html`.** The SW fetches HTML network-first (LATER.md), so an edge-cached shell defeats that path.
- **`/*` → `/index.html` at status 200.** Inert today: the FSM is the navigation model and puts nothing in the URL, so no deep link exists to 404 on. It's here so that stays true if a URL-bearing surface ever lands.

Deliberately still absent: build-time env vars (the Firebase config is committed), preview-deploy config, and any cache headers on the hashed `assets/*` bundles — Netlify's defaults are already correct for content-hashed filenames.
