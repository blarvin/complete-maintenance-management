# LATER.md — Deferred Work

Work intentionally deferred beyond Phase 1. Grouped by theme. For active issues see ISSUES.md; for product scope see SPECIFICATION.md; for architectural notes on what *is* built see IMPLEMENTATION.md.

---

## Phase 1 Prototyping Simplifications

Scope exclusions that keep the Phase 1 MVP small:

- **Skip `virtualParents*`* — focus on basic parent-child relationships only
- **Skip `componentVersion`** — Template + `componentType` landed; version field deferred
- **Skip `customProperties`** — basic node and DataField types only
- **Skip `isRequired`** — no required-field validation
- **Skip `isEditable` and `isLocked`** — all fields editable, no locking
- **Text-only DataFields** — all field values treated as text strings
- **Client-assigned timestamps** — `updatedAt` set by client; server-assigned timestamps deferred
- **Single-user** — constant `updatedBy: "localUser"`; real user identity deferred
- **Leaf-only deletion** — only leaf nodes are deletable; cascade delete deferred
- **No background progressive loading** — breadth-first lazy loading deferred

---

## Data Model & Schema

### Unified Element refactor — remaining items

The storage stack is fully unified end-to-end, including the Dexie v8 store-drop (`REFACTOR-single-unified-data-model`). Follow-ups intentionally deferred:

- **Element-model leftovers → moved to ISSUES.** Leaf-prop name polish (`NodeTitle`/`NodeSubtitle`, `currentMaxCardOrder`), deriving the `Value` union from the registry, enforcing manifest key === `kind`, and the dead `currentValue` prop on `DataFieldDetails` now live in ISSUES (Architecture Migration / Tech Debt).
- **Renderer registry — now decided, build tracked in ISSUES.md** — The registry/manifest model is settled (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md): generalizing the key to full `Kind` incl. `node`, the `placement` field, `treeType` (the old `nature: data | reference`), and a manifest home for default-field-set knowledge are migration work items, not deferrals. (`Kind` itself is now registry-derived — done 2026-06-26.) Still genuinely deferred: the full `src/kinds/<kind>/` vertical-slice file move + `src/framework/` split, and lazy renderer loading for heavy kinds (canvas/video/iframe) — both wait on a second non-field surface forcing them.
- **History `property` enum evolution path** — Phase 2 computed values / reference edges will expand the enum beyond `{value, name, subtitle, parentId, siblingOrder}`. Leave the slot open.
- **Fractional `siblingOrder` keys** — Current policy is renumber-the-run on midpoint insert. If pathological cost shows up at scale, swap to fractional keys.
- **Composer discard → real command** — `FieldComposer` cancel rides `commitWithUndo` via a no-throw `execute$` (discard) + restore-callback undo, so its error branch is inert. When draft discard becomes a real command (e.g. `DISCARD_DRAFT`), it slots into the standard command/inverse path and the dead branch goes live.
- **Drop the `usePendingForms` auto-save backstop** — Persistence is now write-through in `setPendingValue$`/`togglePending$` (audit §2.5). The old reactive `useTask$` auto-save was removed; if write-through proves fully sufficient in practice, no action — this note just records that the backstop is gone intentionally.

### Config-as-Elements — remaining items

The blob is retired and config lives as a `library`-tree sub-field subtree (done 2026-06-27, IMPLEMENTATION.md). Deliberately out of scope that cluster:

- **Standalone-row UX for the config-only kinds** — `flag` / `compound` / `string-list` register with a shared **stub** `Renderer`/`ConfigForm` (`src/kinds/configFieldStub.tsx`) because in Phase 1 they only ever exist inside config subtrees, never as Data Card rows. Real renderers (a toggle, a 4-field threshold editor, a chips list) + editing/history land if/when config sub-fields are ever surfaced as editable rows.
- **Disposition honoring (cascade arbiter)** — `owned`/`delegated`/`pinned` is **encoded** on each `ConfigSubField` but nothing acts on it; everything reads live from the Definition. Copy-at-mint for `owned` and override-disable for `pinned` are the cascade arbiter's job (ISSUES Architecture Migration #4). Until then, edit-is-fork (new `definitionId`) already prevents a Definition change from rewriting existing instances.
- **Per-sub-field reactive signals** — renderers assemble the whole config object on read via `getDefinitionById` (a `useResource$` keyed on `definitionId`). Live propagation of an individual Definition sub-field edit into mounted instances is unneeded in Phase 1 (no Definition-edit UI; fork-not-mutate). Revisit if/when Definitions become live-editable.
- **enum-kv `options` as repeatable child Elements** — modeled as one `string-list` value for now. The SPEC's "repeatable data = many children" (ChildrenSpec cardinality `many`) is the eventual shape; deferred until cardinality machinery exists.
- **Config-only kinds excluded from the picker via `mintVia`** — `FIELD_KINDS` filters `mintVia === 'composer'`. If a richer authoring surface ever needs to offer a config-only kind directly, revisit.

### Definition-binding seam — remaining items

The seam landed 2026-07-01 (full `fieldDefinitionId → definitionId` type-family rename, placement-agnostic authoring contract, logbook's seeded policy Definition stamped at mint — IMPLEMENTATION.md → *Definition-binding seam*). Deliberately out of scope that cluster:

- **Re-root Definition authoring UI** — `LogbookConfigForm` exists (the lifted contract's first re-root instance) but nothing mounts it; the only logbook policy is the seed. The composer's authoring form is a *field* surface — where policy-container authoring lives (node details? a Library view? per-lens settings?) is an open UX decision; decide it when a second policy Definition (org staleness, jobs priority scheme) makes the shape visible.
- **`definitionId` → internal revision-pinned Edge (the #7 end-state)** — the column stays the binding + version pointer for now; the principled retirement models the instance→Definition link with the `internal-link` Edge machinery (internal scope, revision pin) once the Edges family (#6c) and the arbiter (#7) exist.
- **A `jobs` policy Definition** — jobs deliberately ships unbound (proving re-root binding is optional). When jobs wants config (child label, priority scheme, job-subtype vocabulary), it binds through the identical seam: a `JOBS_CONFIG_SCHEMA`, a seed row, one `LENS_POLICY_DEFINITIONS` entry.
- **Per-node policy variation + the config tree** — every `::logbook` lens binds the same seeded Definition today. Per-org/per-node policy (a different staleness on one subtree) is the cascade arbiter's job (#4), resolved through the `config` tree; the stamp-at-mint seam already supports pointing different lenses at different Definitions.
- **Wall-clock-reactive staleness** — the rollup's stale badge evaluates `Date.now()` at render, so it updates on writes/regathers, not by timer. Add a slow tick (or visibility-change check) only if the lag ever matters.
- **Legacy `fieldDefinitions` Firestore collection cleanup** — `COLLECTIONS.FIELD_DEFINITIONS`, `scripts/wipe-field-definitions.ts`, `npm run wipe:fielddefs`, and the test-cleanup sweep still name the pre-config-as-Elements collection. Retire them once remote data is confirmed clean.

### Capability descriptors — remaining items

The six-capability vocabulary + `coherence` landed as a component-free seam (2026-06-28, IMPLEMENTATION.md → *Capability descriptors (the seam)*). Carried per kind, read by nothing yet. Deliberately out of scope that cluster:

- **`RendererProps` generalization** — `FieldRendererProps` stays the inline contract; the placement-keyed `RendererProps` union (inline row | re-root view) lands with **chrome entailment (#5)**, where the node view Renderer first consumes it. Generalizing it now, with no re-root Renderer, is pure churn.
- **`ActionSpec` / `ArbiterSpec` / `ValiditySpec` full shape** — minimal placeholders today (no kind composes `Action`; arbitration/validity are the cascade's). `ActionSpec` firms up when the first `Action` kind lands (#6, built last); `ArbiterSpec`/`ValiditySpec` with the cascade arbiter (#7).
- **Descriptor leftovers → moved to ISSUES.** `node.allowedKinds` real allow-policy and per-kind `coherence` overrides now live in ISSUES (Architecture Migration); the `ValueSpec` → value-shape vocabulary is tracked in ISSUES #2 (chrome entailment remaining).

### `intrinsic-node-scalar` kind — parked

The node-like kind that *also* carries its own value — `Children + OwnValue` (flagged), re-root: a tank holding child fields *and* a primary reading or a cheap rollup. It was the cheapest entry in the minimal kind set (§6b — node shell + an inline value display) and the only one that would have *exercised* the `Children + OwnValue` coherence warning path.

**Parked because** its value/utility looks dubious (2026-06-28): a node that bears a scalar can already be modeled as a node with a single own-value field child, so the kind may not earn its registry slot. Pulled from the active minimal kind set — that set now builds `org` / `job` / `jobs` / `internal-link` (ISSUES Architecture Migration #3) and hands four-not-five distinct re-root shells to chrome entailment (#5).

**Framework left intact.** The `Children + OwnValue` = *valid-but-flagged* rule is framework-level (SPECIFICATION.md §589) and stays put: `checkCoherence` (`src/kinds/coherence.ts`) still warns on the co-occurrence and `kindCoherence.test.ts` still runs it over `KIND_CAPABILITIES`. No built or planned kind composes that subset, so the warning path is a **dormant guard** — already dormant before this park, and it greets the first `Children + OwnValue` kind that ever lands (this one revived, or another). Nothing to remove; the rule defends the invariant whether or not a kind exercises it.

**If revived:** restore the ELEMENT-MODEL.md catalogue row + spec section (composition `Children + OwnValue` (flagged), re-root, status `describe`). The coherence warning is already in place to greet it.

### §6b minimal kind set — deferred follow-ups

The four kinds (`org`/`job`/`jobs`/`internal-link`) + the rudimentary engine landed stub-grade (2026-06-28, IMPLEMENTATION.md → *#6b*). Deliberately out of scope:

- **`jobs` as container + the inline-yet-navigable placement** — ✅ **done (#5 container half, 2026-06-30):** `jobs` is now a **hybrid** — it owns its own DataFields *and* rolls up jobs. Each `job` is authored inside the container (parented to the owning node) and renders field-like (compact `NavigableRow` under a node; Node-like CHILD card when re-rooted into). The both-rollup-and-container shape (once parked for `logbook`) is proven here, so `logbook` (#6c) inherits it (IMPLEMENTATION.md → *#5 container half*). **Remaining sub-item:** *pick which descendant a job lands under* — Phase-1 parents every job created in a node's container to that node (the lens owner N); a UI to target a specific descendant is deferred.
- **Restrict/hide the create surface by `childrenSpec`** — ✅ **done (2026-06-29, #5 slice 1).** The node-create picker now reads `reRootCreateKindsFor(parent.kind)` (`job`→node/job, not org) and a content-free lens (`jobs`) offers no "Add"; the lens-aware shell drops the DataCard/chevron for content-free kinds (IMPLEMENTATION.md → *#5 slice 1*).
- **`jobs`/`logbook` lens lifecycle → moved to ISSUES.** Backfill onto pre-existing nodes, de-provision/GC when the last entry is removed, and hide-empty-lens are leftovers of in-flight lens work, so they now live in ISSUES (Architecture Migration #11), generic across all `PROVISIONED_LENSES`. The canonical **upward ancestor-walk provisioning** (ELEMENT-MODEL §lens) stays superseded by the per-node v1. Still genuinely deferred *here* (a not-yet-begun UI idea): a **collapsed lens-row count badge** — the rollup count lives inside the expanded card, and `KindAdornment` no longer chips the lens (it keeps only `org`'s descendant count).
- **Remaining §6b/§6c lens follow-ups → moved to ISSUES.** `capabilityEngine` ancestors/edges traversal, `internal-link` target picker + editing, field-composer restriction by `childrenSpec`, and the `job`-admits-`job` (sub-tasks vs subtypes) decision now live in ISSUES (Architecture Migration). Rich lens rows / the "primary line" are already tracked in ISSUES #2 (chrome entailment remaining).

### `subtitle` → optional `nodeSubtitle` child element

Today `Element.name` and `Element.subtitle` are columns. `name` is staying a column permanently — it's required identity, uniform across every kind (node Title / field Label), on the header hot path, and keeps the `elements` table human-readable for hand inspection ("not displayed by a renderer" ≠ "not stored"). `subtitle` is the one demotion candidate: it's node-only, semantically soft, and is the last node-only column. The pure-recursive move is to make it an optional child Element (`kind: "nodeSubtitle"`), so a node's subtitle joins the model its *fields* already live in (fields are already child Elements distinguished by `kind`) — which natively serves variable/editable/deletable headers and removes the temptation to overload `subtitle` for captions/usage-notes.

**Deferred because** it's Phase-2-shaped: it only pays off once variable/editable/deletable headers actually get built, and it carries real plumbing — atomic multi-element node creation (node + subtitle child), a kind-based header-vs-card render-region split, and a one-time migration. With deterministic child ids (`${nodeId}:subtitle`) and the eager child-load the card already does, the runtime cost is modest, but it's not worth paying while the column works.

**Phase-1 discipline that makes deferral safe:** do **not** overload `subtitle`. Captions live in the `single-image` value shape (`caption?`); usage-notes get their own representation when they arrive.

**Coupled decision:** if/when this lands, `"subtitle"` drops out of the `ElementHistory.property` enum (a subtitle edit becomes a `value` edit on the subtitle child). `"name"`, `"parentId"`, `"siblingOrder"` stay — the latter two are structural and can't be demoted to children.

### Phase 2 TreeNode Fields

- `virtualParents: string[]` — cross-references (cables, pipes, connections)
- `componentType: string` — special node types (settings, templates); rendering variants from an allowed list
- `componentVersion: string` — for debugging and compatibility
- `customProperties: string[]` — extensibility (API keys, sources)

### Phase 2 DataField Fields

- `componentVersion: string` — for debugging
- `customProperties: string[]` — extensibility
- `isRequired: boolean` — validation flag
- `isLocked: boolean` — edit protection
- `isEditable: boolean` — permission control

### Server-Assigned Timestamps

- `TreeNode.updatedAt` and `DataField.updatedAt` assigned by server on sync
- Client keeps local monotonic clock for UX; replaces with server timestamp on ack
- Until server ack, `updatedAt` treated as pending
- Phase 1 uses client-assigned `Date.now()` via `now()` helper (already mockable)

### Tree Partitioning → typed trees (decided)

Superseded by **typed trees** (SPECIFICATION.md → Data Model → Populations are typed trees): each tree is rooted at its own Element (`parentId: null`) and carries a `treeType` (`business` / `library` / `config` / `view-state`) that routes history/sync/visibility; per-viewer state layers at read time via `effectiveChildren(node, viewer)`, never written into the shared Element. **The seam landed** (2026-06-28, IMPLEMENTATION.md → *Typed trees (the seam)*): the full four-value axis, per-tree sync/history routing (`treePolicy.ts`), and the pass-through `effectiveChildren` chokepoint are in. Still deferred under this banner:

- **Per-viewer overlay merge** — replace the pass-through `effectiveChildren` body so a viewer's `config`/`view-state` layers sparsely onto canonical children. Needs viewer/auth + the cascade arbiter (ISSUES #4).
- **Personal `siblingOrder` overlay** — the canonical order is the column; a per-viewer reorder is a sparse overlay resolved in `effectiveChildren`.
- **view-state as Elements** — migrate expansion/ordering out of `uiPrefs` localStorage into `view-state`-tree Elements (currently the only `view-state` "store").
- **The `config` tree** — org/role/user prefs as `config`-tree Elements + the arbiter that reads them (app→org→role→user cascade).
- **Viewer/auth plumbing** — replace the constant `localUser` (`getCurrentUserId()`) with real identity so `effectiveChildren`/`config` have a viewer to resolve against.
- Cross-tree references and moves
- Per-tree settings and field libraries
- Multi-tree search and dashboards
- Startup migration: walk up to root and stamp `treeType` on any record missing it

### Breadcrumbs & Ancestor Path

Spec called for a breadcrumb in `TreeNodeDetails` (`"Ancestor1 / Ancestor2 / Parent / CurrentNode"`).

- Storage: denormalized `ancestorNamePath: string[]` on each node
- Root nodes: empty array; children inherit and append on create; recompute for descendants on reparent
- Rendering: join with `" / "` and append current `nodeName`

---

## DataField Components & FieldDefinition Library

The FieldComponent / FieldDefinition / DataField spine plus the 4 Phase-1 FieldComponents (`text-kv`, `enum-kv`, `number-kv`, `single-image`-as-stub) landed in Phase 1. The FieldDefinition Authoring UI + crowdsourced shared Library is specced in SPECIFICATION.md and tracked in ISSUES.md. Open Phase-1 FieldComponent work (multiline textarea, allowOther, real single-image with blobs, history preview/revert) is tracked in ISSUES.md.

### Phase-2 FieldComponents (not yet specced)

- `date-kv` — date/datetime picker
- `image-carousel` — multiple images, carousel UI
- `image-grid` — multiple images, grid UI
- `image-aggregator` — derived gallery across descendants
- `composite-kv` — recursive FieldDefinition configs (fields containing fields)

### Phase-2 FieldComponent features

- **Unit conversion** for `number-kv`
- **Option styling** (badges / colors) for `enum-kv`
- **Promote `enum-kv` "Other…" entries into the FieldDefinition config** — when `allowOther` is on and a user types a custom value, it's stored only as the field's value today. Capture distinct "Other" values back into the shared FieldDefinition's `config.options` so they become first-class picks for everyone (one user's "Other" grows the canonical list). Needs dedup against existing options, and a moderation/ownership story (FieldDefinitions are a crowdsourced global pool — see "User-facing edit & delete of FieldDefinitions" above), so it's coupled to the Phase-2 Library work rather than a quick add.

### FieldDefinition Library — Phase-2 enhancements

The Phase-1 model is "authoring is contributing": one global pool, all FieldDefinitions sync to every client, no scope toggle, no edit/delete by end users (see SPECIFICATION.md → "DataField Components, Field Definitions, and Library"). Beyond that:

- **`componentVersion` field** on FieldDefinition (per-FieldComponent contract versioning) — only relevant once FieldComponent config schemas evolve.
- **User-facing edit & delete of FieldDefinitions** with real ownership rules ("you can delete / edit your own"). Phase-1 edit semantics are "edit = fork → mint new FieldDefinition"; delete is admin-only via direct Firestore writes.
- **Label uniqueness, dedup, merge flows** — Phase 1 allows duplicate labels; the Composer's live-preview row is the disambiguation affordance.
- **Composer discovery UX**: typeahead filter, `category` grouping into collapsible sections, dropdown-flip behaviour, popularity ranking, "recently added" sort.
- **Moderation / promotion to canonical** for crowdsourced entries — flagged-content workflow, dev curation.
- **Dedicated Library view** (a TreeNode stack under the app's main menu) for browsing / managing FieldDefinitions outside the Composer.
- **Templates (composite sets of FieldDefinitions)** — e.g. "HPU with Accumulator". The reserved word "Template" is mortgaged for this future feature; distinct, larger scope than the FieldDefinition Library itself.
- **Firestore blob sync** — needed once real `single-image` lands (Phase-1 single-image is a display-only stub; see ISSUES.md).
- **Orphaned-blob GC** — needed once blobs are in play.

### `single-image` → `image` + `image-with-caption` (decided)

The old `single-image` kind crammed two independent edit intents (*change the image* and *edit the caption*) into one `value` object — a hardcoded `{ image, caption }` composite with no per-sub-value history and reference-equality bugs in the no-op/revert gates (the value object was minted fresh on every edit, so `!==` never matched structurally). **Resolved by decomposition** (SPECIFICATION.md → Field-kind specs; ELEMENT-MODEL.md): `image` carries only the blob metadata as its `OwnValue`; `image-with-caption` is `Children(template: image + text-kv)`, so the caption becomes a sibling `text-kv` sub-field. Each sub-value is then a primitive again (caption = string, image identity = `blobId`), so structural history *and* correct value-equality both come for free. Build rides in on the lens/`Edges`/sub-field migration work (ISSUES.md). (If over-capture noise bites the stub before then, a small structural-equality helper in `diffElementChanges` + the two `DataFieldHistory` gates is the throwaway patch.)

### Media / Image Fields

Media upload, preview, storage, and caching are out of scope for Phase 1. All fields treated as text.

### DataField Reordering UI

Spec calls for user-driven reordering within a DataCard (SPECIFICATION.md §DataField Reordering). UX TBD — drag handle, up/down buttons, or long-press + drag. Writes go through the adapter. This is the point at which persisted gaps from deletions get compacted. Algorithm note (a `computeCardOrderUpdates` helper existed at `src/data/utils/cardOrder.ts` until 2026-06-10, deleted as speculative): sort fields by current order, walk the run assigning sequential orders, and emit `{id, cardOrder}` updates only for rows whose order actually changes — minimal writes, stable for already-ordered input.

### ComposerRow check/uncheck slide-in animation

Spec (`§Field Composer → Layout`) calls for a ~200ms transition on the body when a row is checked/unchecked. The DataCard grid-template-rows trick doesn't compose with the existing kvField renderers (they wrap with `display: contents` so they can position into the FieldList subgrid, which can't be animated). Either flatten the kvField output for the composer (extra wrapper component per kind), or split the body into an animatable container that the kvField writes into. Until then the row's body appears/disappears immediately; the checkbox is still anchored in view via `scrollIntoView({ block: 'nearest' })` after toggle.

### cardOrder Compaction on Delete

Currently deleting a field leaves a gap in `cardOrder`. Display sorts ascending so the gap is invisible. Revisit only if accumulated gaps become user-visible or cause ordering surprises — then compact on delete, accepting the write cost.

---

## UI / UX

### Node Creation

**Rich Construction UI** (per spec): multiple default rows, five dropdowns for user-selected fields, Add button in row 10, Save/Cancel in row 11, empty rows skipped on save.

Phase 1 creation is minimal (Name + Subtitle); fields added post-creation from the DataCard.

**`typeOf` → suggested-fields service** — the behaviour-free domain typology (SPECIFICATION.md §584; ELEMENT-MODEL.md → What is *not* a kind) ships as forkable seed `typeOf` data (tag + default field bundle), read by **one generic service** that suggests fields from a node's `typeOf` during construction. The tag half exists (seeded `fd_type_of`, added at node mint); unbuilt are the seed bundles and the suggestion service itself. This is the mechanism that would populate the Rich Construction UI's default rows. (Node-*kind* choice in the create surface is separate and already shipped — the picker reads `reRootCreateKindsFor`.)

### Add-Field Surface A/B

Both add-field surfaces (FieldComposer and the legacy `CreateDataField` single-pick dropdown) ship side by side as a deliberate A/B experiment, coordinated by the `ActiveSurface` mutex and the `ENABLED_ADD_FIELD_SURFACES` roster in `src/constants.ts` (audit item 2.7, resolved as keep-both). Deferred:

- **More surface variants** — follow the contract in `src/components/FieldList/addFieldSurfaces.ts` (add id to `AddFieldSurfaceId`, build to contract, add to roster, render in FieldList).
- **Winner picking** — eventually decide which surface(s) earn their keep and delete the losers (component + CSS + roster entry + union member).

### Tree Decorations

**Tree-line and branch-lines** — non-interactive CSS-only decorations inside the children container. Vertical guide slightly left of child nodes (per `ASSET_view.svg`), derived from `--child-indent` with a `--tree-line-offset`. Each child row shows a short horizontal branch. No layout impact, no pointer events.

### Navigation Enhancements

- **UpButton double-tap** navigates all the way to ROOT view
- **UpButton caching** — store `parentId` in context at instance creation rather than recomputing on each click. Benchmark cache vs. lookup for snappiness.
- **Down-tree navigation** — counterpart to UpButton for descending without tap-by-tap
- **User-configurable double-tap** — threshold and enable/disable in a future User Settings view

### CreateNodeButton Clutter

Multiple inline "Create Here" buttons (n+1 between child rows) add visual noise and tab-stop pain. Consider a single "+ Add sub-asset" that inserts relative to a selected sibling, or appends by default. Defer in-between insertion UI.

### TreeNodeDetails Beyond Delete

Phase 1 offers delete only. Add Rename and Move later; until then, edits happen in the node header and card.

### DataCard Animation Robustness

Currently, DataCard expansion repositions siblings via layout reflow (not physical push). Works because of current grid/flex structure. If page structure changes significantly and layout glitches appear, move to a model where expansion explicitly drives sibling positioning.

### Node Metadata Surface

`updatedBy` and `updatedAt` for nodes belong in **TreeNodeDetails**, not as a DataField on the DataCard. Timestamps client-assigned until server timestamps land.

---



## Ideas and Thoughts
**Deep Copied Nodes and Fields Warning** If we ever have a deep-copy feature, we should warn the user that each pasted value has been copied over and should be verified. Also, the copied nodes and fields will not be linked to the original nodes and fields.

---



## Destructive Operations

### Cascade Delete

Spec: "Deleting a node must handle or cascade to all children." Phase 1 allows leaf-only deletion.

- Full cascade delete (or soft-delete with implicit hiding of descendants)
- Orphan cleanup job — children of deleted parents remain in IDB, implicitly hidden; future cleanup pass removes
- Cascade delete semantics for history: no new history entries appended on cascade (descendant history preserved but hidden)

### Delete UX

- Confirmation dialog before delete
- Toast notification after delete (Snackbar)
- Undo / restore within a window
- Clarify: does Undo survive navigation? Are deletes soft until the timer elapses, or applied immediately with a restore snapshot?

### Admin hard delete

No code path removes an element row any more (2026-08-13): retention is the
default and soft delete is the only delete channel. The one legitimate reason to
purge is an admin forcing a row out — a GDPR-style erasure request, or clearing
content that must not persist even as a tombstone. Deferred until there is an
admin role to hang it on; there is no auth or viewer identity in Phase 1, so
there is nobody to authorise it.

When it lands it needs to be a *distinct* operation, not a flag on the existing
delete — different authority, different audit expectation, and no undo window.
Note the hard part is not the local delete: it is propagating a purge to clients
that already hold the row, which soft delete gets for free (a tombstone syncs;
an absence does not). That likely means an explicit purge tombstone rather than
simply removing the document — i.e. the erasure itself has to sync.

### Recycle Bin / Audit-Preserving Delete

- Soft delete with restore window (user-visible recycle bin)
- Tombstone nodes that preserve history for audit
- Per-collection export before destructive ops
- Undo for last destructive action (session-level)

---

## History & Audit

Phase 1 implements minimal append-only history for `DataField.dataValue` in `dataFieldHistory`, keyed by `${dataFieldId}:${rev}` and indexed by `dataFieldId`, `updatedAt`.

### Phase 2 Expansion

- Record `fieldName` changes (label renames) with `property: "fieldName"` entries
- Optional history for other properties (e.g., `cardOrdering` moves)
- Rollback / restore to a given `rev`
- Pagination, filtering, and search within history
- Multi-user provenance with real user IDs and server-assigned timestamps
- Merge strategy guidance for sync conflicts (event-level dedupe via `id`, causal ordering)
- Pruning / archival policies for very long histories
- **Real single-image Component** — Replace the "Image upload coming soon" stub with: Dexie `imageBlobs` table, file picker, preview + full-size modal, MIME/size validation, caption input when `requireCaption`. Firestore blob sync and orphaned-blob GC are separate follow-ups (see LATER.md).

### Re-affirmation history (logging an unchanged value)

The no-op guard in `diffElementChanges` (`historyHelpers.ts`) drops any value update where `updates.value === existing.value`, so **re-setting a field to the value it already holds writes no history entry**. That's correct for incidental no-ops (blur with no real edit), but it forecloses *deliberate re-affirmation*: an inspection-style field — e.g. an `enum-kv` "Working?" repeatedly attested `pass → pass → pass` — cannot record "checked again on this date, still pass." The single equality guard conflates "no change, suppress noise" with "same value, deliberately re-attested" and always resolves to the former.

**Deferred approach:** make re-affirmation opt-in rather than changing the default dedupe. Either (a) a per-FieldDefinition config flag (e.g. `logUnchanged` / `reaffirmable`) that, when set, lets an explicit re-affirm action bypass the no-op guard and append a `value` history entry with `prevValue === newValue`; or (b) a dedicated FieldComponent kind for attestation/inspection fields that carries this semantics natively (and likely a distinct history `action` such as `'reaffirm'` so the audit log can distinguish a re-attestation from a real change). Incidental writes (no user intent) still get swallowed in both cases.

**Coupled:** the history-rendering layer (`DataFieldHistory`) currently hides the most-recent entry as a live-row duplicate and gates the revert button on `newValue !== liveValue`; a re-affirm entry equal to the live value needs those rules revisited so the re-attestation is actually visible. Decide intent in SPECIFICATION.md before building.

### getFieldHistory and Soft-Deleted Fields

Currently history for soft-deleted fields is only *implicitly* hidden (UI never requests it). Add explicit adapter check: `getFieldHistory(dataFieldId)` should return `[]` when the DataField's `deletedAt` is set. Needed for direct API use or a future restore/admin UI.

---

## Sync & Storage

### Breadth-First Quantized Background Lazy Loading

Fetch top-level TreeNodes + DataFields first, then children, then grandchildren. Each chunk is one TreeNode + its DataFields (fields fetched in parallel). Display what's loaded, continue in background. IndexedDB + browser cache for offline resilience.

Phase 1 loads eagerly; background progressive loading deferred.

### Sync Status & Pull-Applied Notifications

- Subtle sync-status indicator (e.g. "Synced · 2m ago" / "Offline" chip) — already noted in SPECIFICATION §Sync feedback.
- Snackbar toast when a background pull applies remote changes to an entity currently rendered (narrow rule to avoid chatty toasts). Successful pushes of the user's own writes stay silent.
- ~~Snackbar toast only when `SyncQueueManager` exhausts retries for an item — otherwise sync stays silent per Phase 1.~~ ✅ Implemented 2026-06-11 (audit §4.3): 5 retries riding existing sync cycles, error toast with Retry action on exhaustion, startup re-arm. See IMPLEMENTATION.md §Sync retry policy.
- Orphaned Firestore SDK mirror IndexedDB databases linger on devices that ran builds before the `memoryLocalCache()` switch (audit §2.2). No auto-cleanup built, by design — users run `clearFirebaseIndexedDB()` in the console.
- `applyRemoteElementHistory` does not emit on `storageEventBus` (audit §2.3 left this as-is), so a pull that applies only history rows won't refresh an open DataFieldDetails. Emit a history event if remote history-only refresh ever matters.
- The bus read-model hooks (`useElementChildren`/`useElementById`) deliberately export no `reload$` — every imperative reload site was redundant with a bus emission. Trivially added back if a real imperative need appears.

### Export / Import

- "Export Collection (JSON)" and "Import Collection" actions
- Per-collection export before destructive ops (see Destructive Operations)

### Emulator Round-Trip Sync Coverage

The Element refactor traded the live-emulator adapter/sync suite for mock-based unit tests (`fieldDefinitionSync.test.ts` / `SyncPusher.test.ts` mock `RemoteSyncAdapter`). The whole unit suite passes without the Firebase emulator, but nothing automatically verifies real Firestore push/pull against the Element model. Reinstate a round-trip suite (Vitest against the emulator, or Cypress E2E) covering `elements` + `elementHistory` + `fieldDefinitions`.

**Wiring needed before this is possible:** emulator connect in `src/data/firebase.ts` is gated on `isBrowser`, so Node/Vitest never connects — a round-trip Vitest run needs a Node connect path (e.g. honor `FIRESTORE_EMULATOR_HOST`) plus a separate vitest config + opt-in script so the default `npm test` stays emulator-free. Also: the `test:firestore` npm script currently points at a non-existent `src/test/firestoreAdapter.test.ts` — remove or repoint it as part of this work.

**Note (2026-06-11):** one Cypress E2E spec now exists again — `cypress/e2e/repro-create-node.cy.ts` (regression for the UC-TreeNode key collision, audit §2.3) plus a stub `cypress/support/e2e.ts`. It currently runs against the *live* Firestore config and writes real nodes; gate it to the emulator (`?emulator=true` / `USE_FIRESTORE_EMULATOR`) before wiring into any automated run.

### Extract Sync System as Standalone Package (Refactoring Audit 8.3)

Package the offline sync subsystem as a reusable module — provisional name `@blarvin/offline-sync`. The pieces are already reasonably decoupled and event-driven, so the extraction is mostly a packaging exercise rather than a rewrite.

**What would move:**

- `src/data/sync/SyncManager.ts` — orchestrator
- `src/data/sync/SyncPusher.ts` — local→remote push loop
- `src/data/sync/SyncLifecycle.ts` — online/offline/interval triggers
- `src/data/sync/SyncQueueManager.ts` — queue abstraction (already extracted from IDBAdapter)
- `src/data/sync/ServerAuthorityResolver.ts` — LWW conflict resolution
- `src/data/sync/strategies/` — `FullCollectionSync`, `DeltaSync`
- `src/data/syncSubscriber.ts` — event-bus bridge (or leave as app-side glue)

**What would stay app-side:**

- `StorageEventBus` and domain event types (the package would accept a generic event stream)
- `IDBAdapter` / `FirestoreAdapter` (the package would define adapter interfaces, not implementations)
- App-specific domain models (`TreeNode`, `DataField`, `DataFieldHistory`)

**Shape of the public API (sketch):**

```typescript
interface SyncableAdapter<T> {
  /* push, pull, applyRemote, etc. */
}
interface SyncQueue {
  enqueue;
  getPending;
  markSynced;
  markFailed;
}
interface SyncStrategy<T> {
  pull(since: number | null): Promise<T[]>;
}

createSyncManager({
  local,
  remote,
  queue,
  strategies,
  resolver,
  eventStream,
});
```

**Prerequisites before extracting:**

1. Generify types — sync code currently imports `TreeNode` / `DataField` directly; these must become type parameters.
2. Finalize the adapter contract — `SyncableStorageAdapter` is close but has a few domain-shaped methods (e.g., `applyRemoteHistory`) that should become generic.
3. Decide on event transport — either accept an injected `EventBus` interface or expose hook points for the host app to wire up.
4. Decouple from app-specific conflict resolution — `ServerAuthorityResolver` assumes LWW on `updatedAt`; expose as a pluggable strategy.

**Why defer:** The current inlined form is fine for Phase 1 and there's only one consumer (this app). Extraction pays off when (a) a second project needs the same sync primitives, or (b) the sync system becomes stable enough that versioning it separately is an advantage rather than friction.

**Effort:** Medium. Most of the work is genericizing types and tightening the adapter interface; the runtime logic is already in the right shape.

---

## Refactoring & Technical Debt

### CQRS Follow-ups

- Command logging / audit middleware on CommandBus (pre/post hooks)
- Query caching / materialized views (beyond existing `nodeIndex`)

### Second Storage Backend → ElementWriteService (Audit §2.1)

`IDBAdapter` is the sole write model; `FirestoreAdapter` was stripped to `RemoteSyncAdapter` (sync mirror only). If a second full storage backend is ever needed, do **not** resurrect a parallel CRUD adapter — build an `ElementWriteService` that owns the domain write logic (history diffing, rev minting, sibling ordering, sync-queue enqueue, event emission) over a dumb KV adapter interface, so the write model stays single-sited.

### Structured Logger (Refactoring Audit 7.5)

Replace ad-hoc `console.log` with a lightweight logger (`src/utils/logger.ts`). Level filtering to silence debug/info in production. ~137 console statements across 27 files already use consistent `[Tag]` prefixes — migration is mechanical. Low priority: current logging works fine for dev.

### Error Handling & Resilience

Surface view-layer data-load errors instead of swallowing them — the loader hooks and the error-catching `createResource` fetchers fall back to empty values, so a failed load is indistinguishable from no data. A small wrapper (fallback value + contextual logging + an error state in the two views) covers it; both the old `safeAsync()`/`withErrorHandling.ts` helper (audit §3) and `useAsyncOperation` (Solid mop-up) were deleted as dead code, and this should be rebuilt only when actually wired in. Low priority for Phase 1. Becomes valuable once:

1. Snackbar is implemented for user-facing error messages
2. Error monitoring (Sentry, etc.) is added
3. UI has explicit error/retry states

### File Organization Nits

- **Move `useSyncTrigger.ts`** from `src/hooks/` to `src/data/` — no longer UI-facing, only imported by `syncSubscriber.ts`. Works fine where it is; low priority.

### TailwindCSS (if adopted)

Limit to `@apply` within component CSS to keep markup uncluttered. Defer heavy utility-class usage.

### PWA & Build (deferred out of SolidJS Phase V)

- **Service-worker update affordance.** The SW takes over aggressively — `skipWaiting()` on install, `clients.claim()` on activate — so a new build controls the page on the next load with no prompt. Correct for a single-user prototype; a real "update available, reload?" affordance (listen for `updatefound` / `controllerchange` in `entry.client.tsx`, surface it through the snackbar) is the upgrade if this ever ships to other people.
- **`preview:pwa` depends on an undeclared `npx serve`.** Works, and is what the PWA has always been smoke-tested on, but it fetches a package that isn't in `devDependencies`. Drop-in replacement if that ever bites: `vite preview --port 4173 --strictPort` (already installed, and it honours `vite.config.ts`'s `preview.headers`).
- **HTML is network-first.** Every online launch waits on the network for `index.html` before the cached shell renders; on a flaky connection that's a slow start where stale-while-revalidate would be instant. Only worth changing if it's felt.
- **Desktop layout is a single centred column at `--container-max` (650px).** That's the whole responsive story since the `#app` width fix — fills a phone, caps on desktop, no breakpoints. Widening the token (720–768px reads more tablet-like) is a one-line change; anything richer on a wide screen — a two-pane tree/detail split, using the empty margins for lens rollups — is a real layout decision, not a token tweak.
- **Single 600 KB JS chunk.** The build warns about it. Untouched deliberately — code-splitting is a real decision (route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK), not a mop-up nicety.

---

## Resolved in Phase 1

### ✅ Accessibility & AI Agent Compatibility

Originally flagged as a risk: "Double-tap hurts accessibility/keyboard support."

Now implemented:

- Full keyboard navigation (Tab, Enter, Space, Escape)
- Semantic HTML (`<article>`, `<button>`, `<h2>`, `<label>`)
- ARIA attributes (`aria-expanded`, `aria-label`, `aria-labelledby`)
- `:focus-visible` styles for keyboard users
- AI agent compatibility — all elements appear in accessibility tree with descriptive names

See IMPLEMENTATION.md → Accessibility for details.

### ✅ Design Tokens

SPEC CSS variables implemented in `src/styles/tokens.css` with a three-layer system (primitives → semantic → component). See IMPLEMENTATION.md → CSS Architecture.