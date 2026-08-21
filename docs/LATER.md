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
- **Drop the `usePendingForms` auto-save backstop** — Persistence is now write-through in `setPendingValue$`/`togglePending$` (audit §2.5). The old reactive `useTask$` auto-save was removed; if write-through proves fully sufficient in practice, no action — this note just records that the backstop is gone intentionally.

### Config-as-Elements — remaining items

The blob is retired and config lives as a `library`-tree sub-field subtree (done 2026-06-27, IMPLEMENTATION.md). Deliberately out of scope that cluster:

- **Standalone-row UX for the config-only kinds** — `flag` and `string-list` render read-only one-liners; `compound` is authoring-only. Real editable renderers (a toggle, a chips list) are needed only if these kinds are ever offered as standalone Data-Card rows — see *Config-only kinds excluded from the picker* below. (Briefly un-deferred 2026-08-17 when the rejected Library-as-a-place design made config rows editable; re-deferred 2026-08-20 — the Library lens is read-only.)
- **Disposition honoring (cascade arbiter)** — `owned`/`delegated`/`pinned` is **encoded** on each `ConfigSubField` but nothing acts on it; everything reads live from the Definition. Copy-at-mint for `owned` and override-disable for `pinned` are the cascade arbiter's job (ISSUES Architecture #4). Edit-is-fork is the safety net meanwhile: a Definition never changes, so the live read is indistinguishable from the copy the disposition will eventually make — an arbiter tidy-up, not a brake anything is waiting on.
- **Per-sub-field reactive signals** — renderers assemble the whole config object on read via `getDefinitionById` keyed on `definitionId`. Under fork-never-mutate nothing propagates into a mounted instance, so per-sub-field signals are an optimisation with no current consumer; whole-config reassembly on read is correct and fast enough.
- **enum-kv `options` as repeatable child Elements** — modeled as one `string-list` value for now. The SPEC's "repeatable data = many children" (ChildrenSpec cardinality `many`) is the eventual shape; deferred until cardinality machinery exists.
- **Config-only kinds excluded from the picker via `mintVia`** — `FIELD_KINDS` filters on `mintVia === 'add-surface'`. `flag` and `string-list` are really the **boolean** and **list** field kinds (SPEC → *Phase 1 field kinds*), and `mintVia: 'config-only'` records where they have been used rather than what they are. "Greased ☑" is a fine field on a pump. Opening them up is a small change once they have editable renderers; deferred because the catalogue's shape is a product decision, not a mechanical one.

### Definition-binding seam — remaining items

The seam landed 2026-07-01 (full `fieldDefinitionId → definitionId` type-family rename, placement-agnostic authoring contract, logbook's seeded policy Definition stamped at mint — IMPLEMENTATION.md → *Definition-binding seam*). Deliberately out of scope that cluster:

- **Re-root Definition authoring UI** — `LogbookConfigForm` exists (the lifted contract's first re-root instance) but nothing mounts it; the only logbook policy is the seed. The Add Surface's authoring row is a *field* surface. **Where it mounts is now decided** (2026-08-14): on the lens's own DataCard, which already renders (`TreeNodeDisplay.tsx` — `ownsChildren() || isLens()`) — not in node details, not in a Library view, and deliberately *not* as a step in node creation, since lenses are created rarely and a nag step in the common path is the wrong trade. See UI/UX → *Config-tree UI*.
- **`definitionId` → internal revision-pinned Edge (the #7 end-state)** — the column stays the binding + version pointer for now; the principled retirement models the instance→Definition link with the `internal-link` Edge machinery (internal scope, revision pin) once the Edges family (#6c) and the arbiter (#7) exist.
- **A `jobs` policy Definition** — jobs deliberately ships unbound (proving re-root binding is optional). When jobs wants config (child label, priority scheme, job-subtype vocabulary), it binds through the identical seam: a `JOBS_CONFIG_SCHEMA`, a seed row, one `LENS_POLICY_DEFINITIONS` entry.
- **Per-node policy variation + the config tree** — every `::logbook` lens binds the same seeded Definition today. Per-org/per-node policy (a different staleness on one subtree) is the cascade arbiter's job (#4), resolved through the `config` tree; the stamp-at-mint seam already supports pointing different lenses at different Definitions.
- **Wall-clock-reactive staleness** — the rollup's stale badge evaluates `Date.now()` at render, so it updates on writes/regathers, not by timer. Add a slow tick (or visibility-change check) only if the lag ever matters.
- **Legacy `fieldDefinitions` Firestore collection cleanup** — `COLLECTIONS.FIELD_DEFINITIONS`, `scripts/wipe-field-definitions.ts`, `npm run wipe:fielddefs`, and the test-cleanup sweep still name the pre-config-as-Elements collection. Retire them once remote data is confirmed clean.

### Definition Packs — seeds and bindings as data

Decided in discussion 2026-08-14; supersedes the old ISSUES Tech Debt #7 ("are the dev seeds product content?"), which could not be answered as posed. The seeded Definitions were never the load-bearing thing — the **bindings** are. Three populations sit in one `SEEDS` array and differ only in what selects them: *nothing* selects `Status` / `Weight` / `Power Rating` (the user picks them); `CONSTRUCTION_DEFAULT_DEFINITION_IDS` (`src/data/definitionIds.ts`, read by `TreeNodeConstruction.tsx` and `useNodeCreation.ts`) selects the three construction defaults; `LENS_POLICY_DEFINITIONS` (`provisionPolicy.ts`) selects the logbook policy. Both selectors are `const`s in code. Once they are data, "dev seed" vs "product content" stops being a distinction — there is one population of Definitions and a separate question of what points at them.

**Destination:** bindings live in the `config` tree (SPECIFICATION.md → *Populations are typed trees*; the cascade's job #3, app→org→role→user), resolved by the arbiter (ISSUES Architecture #4). A **pack** is the app-layer end of that cascade, shipped as a file:

```json
{ "definitions": [ /* SeedRow[] */ ],
  "constructionDefaults": ["fd_type_of", "fd_description", "fd_tags"],
  "lensPolicies": { "logbook": "fd_logbook_policy" },
  "lensNames":    { "logbook": "Daybook" } }
```

The format is the existing `SeedRow[]` plus three binding maps — `serializeConfig()` already turns each row's config into its child subtree, so there is no import format to invent.

**Why it's wanted:** a client demo is unconvincing against a Library of generic fields. A pack makes a prospect's own vocabulary appear on every new asset in seconds, precisely because it carries bindings and not just a longer field list. It runs backwards too — configure a client's Library in a workshop, export the pack, use it as the starter for their next site.

**Staged, cheapest first:**

- **The resolver seam** — replace the two `const` selectors with `constructionDefaults()` / `lensPolicyFor(kind)`. Backed by the pack now, by the `config` tree later, without touching call sites. The only piece that must come first, and the only one that constrains anything.
- **Pack file + first-run picker** — `public/packs/*.json`, bundled default as the offline fallback. Buys the entire demo story with no cascade.
- **Config-tree UI** — see UI/UX → *Config-tree UI*.
- **Org / user layers, per-node override, source chips** — need the arbiter (#4).

**Constraints found while scoping (2026-08-14):**

- **Additive (put-if-absent), not upsert.** `seedDefinitions` upserts on a `SEED_VERSION` bump. That contradicts forked-never-mutated (SPECIFICATION.md §611) the moment Definitions become user-editable *or* packs become swappable: reloading a pack would rewrite a Definition that live instances are bound to.
- **Shipped packs bypass sync; imported packs are authoring.** Bypass-sync is only legitimate because seeds are byte-identical per client. A user-supplied pack is not, so import must go through `CREATE_DEFINITION` and sync as ordinary authored content — a path that already exists (`useDefinitionDraft.ts`).
- **Pack ids need a namespace** so two packs cannot collide. Author ids in the file; never generate them.
- **Boot ordering.** `provisionPolicy.ts` must stay component-free and sync-readable (`handlers.ts` imports it and cannot pull the registry), so a fetched pack must be fully loaded before the first mint. `initStorage.ts` currently seeds *after* the command bus initialises.
- **A failed fetch must not degrade silently.** `handlers.ts` stamps lens policy only if resolvable; with a fetched pack, that guard becomes the path a fetch failure takes, minting unbound lenses. Bundled fallback; never boot packless.
- **Grouping the Library by pack provenance** — the export sketch groups the Library into "From: <pack>" and "Authored here". As a *tag* grouped at render this is a view and blocked by nothing (the *Sections* reconciliation below); as real folders it hits the identity blocker — `parentId === null` is the Definition test, so a Definition cannot sit *under* something without ceasing to be one. Noticed 2026-08-14. (Briefly "unblocked" 2026-08-17 by the rejected `definitionId === id` identity move; that reversal died with the place-design, 2026-08-20.)

**Forcing kinds** (surfaced by sketching the UI, 2026-08-14):

- A **constrained reference kind** — `internal-link` restricted to the `library` tree with a kind filter — is needed twice over (every construction-default row, every policy row). ISSUES Architecture #11 already asks for exactly this picker.
- A **duration kind.** `staleness: 7 * 24 * 60 * 60` renders as `604800` the moment it is user-facing. Either a `duration` kind or `number-kv` with unit scaling.
- Nothing new for the container — `New Node Fields` is `Children` on a config node, existing machinery.

**Exemplary seed lenses.** Most users will not craft or customise a lens, so a pack's lens policies (and any starter lens content) carry far more weight than their volume suggests. They want deliberate authoring, not defaults-by-accident.

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
- **Is a Field a legal `internal-link` target? — and enforcing `TargetSpec.allowedKinds` at all.** `allowedKinds` is declared (`['node','org','job']`) and read by nobody, so a Field id pastes in and resolves happily. Reveal (2026-08-16) made that case *work* rather than dead-end, which removes the urgency but not the question: the spec decision comes first (ELEMENT-MODEL → `internal-link`), and only then is there something to enforce — in the editor, in the eventual target picker, or both. Enforcing today's declared list would break links the app now travels to perfectly well.
- **Remaining §6b/§6c lens follow-ups → moved to ISSUES.** `capabilityEngine` ancestors/edges traversal, `internal-link` target picker + editing, field-composer restriction by `childrenSpec`, and the `job`-admits-`job` (sub-tasks vs subtypes) decision now live in ISSUES (Architecture Migration). Rich lens rows / the "primary line" are already tracked in ISSUES #2 (chrome entailment remaining).

### Edges have no inverse — the reverse-index fork

An `internal-link` stores `{ targetId }` as opaque JSON in `elements.value`, and the Dexie schema indexes `id, parentId, kind, definitionId, treeType, siblingOrder, updatedAt, deletedAt` — nothing reaching into `value`. So the edge is one-way: given a link you can resolve its target, and given an element there is **no way to ask who points at it**. Every feature past truthful display of a single link needs that inverse — warn-before-delete, a "what links here" band, repoint/detach repair, `logical-container` membership, `other-end` overlays.

**The constraint that shapes all of it:** referential integrity as *enforcement* is not available here. Offline-first + LWW + convergent means a client can always delete a target while a partitioned peer creates a link to it, so "block the delete" is a global invariant no client can hold, and "cascade the delete" destroys data on the strength of an edge that may itself be stale. The model has to be **tolerant** — render honestly, let the user repair — which is the same reasoning already in the sync layer's retention rule. That rules out the FK-shaped design before it costs anything, and leaves `TargetSpec.valid?` / `ValiditySpec` with a realistic vocabulary of `dangle` (default) and `clear`.

Three forks for the inverse, rising in cost:

- **Scan on demand** — filter `db.elements` by `kind === 'internal-link'` and a parsed `targetId`. No schema change, no sync implication, O(n) per question. Honest at prototype scale and enough for both warn-before-delete and a backlinks band.
- **Index the extracted target** — a Dexie dotted keypath on `value.targetId` works, but it writes one kind's value shape into the shared table's schema, and every version bump in `db.ts` is clear-on-upgrade.
- **Edges become rows** — `{ sourceId, targetId, role }`, indexed both ways, synced and LWW'd like any Element. The real fork, and the reverse index falls out free.

**`internal-link` does not force the choice; `logical-container` does.** `Edges(members, multi)` cannot live in one scalar `value` slot, so that kind cannot be built without answering this, and `other-end` (authored from either end, one overlay edge) pushes the same way. Defer until one of them is picked up.

**Not a kind.** A backlinks / "referenced by" surface is framework chrome on every Element, not a registry entry — SPEC → *Earning a kind* is explicit that being an Edges target is a use of a kind, never a behaviour it composes. Repoint-all *is* a kind's business, but the imperative kind: bulk repointing is the `cross-tree action` archetype, so it waits on `Action` with the rest.

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
- **The `config` tree** — org/role/user prefs as `config`-tree Elements + the arbiter that reads them (app→org→role→user cascade). Its first two concrete tenants are the construction-default and lens-policy bindings — see Data Model → *Definition Packs* and UI/UX → *Config-tree UI*.
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

**Parsing the canonical element address.** The grammar is fixed (SPEC → *Canonical element address*) and the `A / B / C` join is rendered, but nothing reads one back: no `parseAddress`, and the `.value` / `/config` / `[]` terminals are reserved vocabulary only. Parsing is what a command layer, a downloads/pack format, or an address bar would need, and each of those brings the hard half with it — names are not unique, so resolution needs a disambiguation rule (nearest match? error on ambiguity? ids in the address?) that display never had to answer. Deferred 2026-08-16 with reveal.

---

## DataField Components & FieldDefinition Library

The FieldComponent / FieldDefinition / DataField spine plus the 4 Phase-1 FieldComponents (`text-kv`, `enum-kv`, `number-kv`, `single-image`-as-stub) landed in Phase 1. The FieldDefinition Authoring UI + crowdsourced shared Library is specced in SPECIFICATION.md and tracked in ISSUES.md. Open Phase-1 FieldComponent work (multiline textarea, allowOther, real single-image with blobs, history preview/revert) is tracked in ISSUES.md.

### Phase-2 FieldComponents (not yet specced)

- `date-kv` — date/datetime picker
- `image-carousel` — multiple images, carousel UI
- `image-grid` — multiple images, grid UI
- `image-aggregator` — derived gallery across descendants
- `composite-kv` — recursive FieldDefinition configs (fields containing fields)
- **`mirror` — the transclusion twin of `internal-link`** — where `internal-link` renders the target's *name* and offers a way to go there, a mirror renders the target's **value** in place, here. Same Edge, opposite reading: a pointer versus a transclusion. Explicitly out of scope when reveal landed (2026-08-16) because it is not a variation on the link renderer — it needs staleness/pin semantics, a live-vs-snapshot decision, and a cycle guard, which is cascade-arbiter territory (SPEC → *The cascade*).

### Phase-2 FieldComponent features

- **Unit conversion** for `number-kv`
- **Option styling** (badges / colors) for `enum-kv`
- **Promote `enum-kv` "Other…" entries into the FieldDefinition config** — when `allowOther` is on and a user types a custom value, it's stored only as the field's value today. Capture distinct "Other" values back into the shared FieldDefinition's `config.options` so they become first-class picks for everyone (one user's "Other" grows the canonical list). Needs dedup against existing options, and a moderation/ownership story (FieldDefinitions are a crowdsourced global pool — see "User-facing edit & delete of FieldDefinitions" above), so it's coupled to the Phase-2 Library work rather than a quick add.

### FieldDefinition Library — Phase-2 enhancements

The Phase-1 model is "authoring is contributing": one global pool, all FieldDefinitions sync to every client, no scope toggle, no edit/delete by end users (see SPECIFICATION.md → "DataField Components, Field Definitions, and Library"). Beyond that:

- **`componentVersion` field** on FieldDefinition (per-FieldComponent contract versioning) — only relevant once FieldComponent config schemas evolve.
- **User-facing edit & delete of FieldDefinitions** with real ownership rules ("you can delete / edit your own"). Phase-1 edit semantics are "edit = fork → mint new FieldDefinition" (SPEC → *Edit / Delete Semantics*); delete is admin-only via direct Firestore writes.
- **Label uniqueness, dedup, merge flows** — Phase 1 allows duplicate labels, and cheap authoring means it *expects* them (SPEC → The Add Surface → *Proliferation is intended*). Curation is the deferred half of that bargain: dedup, merge, and any manager-gating of what reaches the shared Library.
- **Search in the Add Surface's name slot** — typing a name should search the Library before it commits to authoring a new Definition, so finding an existing one is the fast path rather than walking to its kind. The single largest brake on duplicate-coining, and the reason the Kind band is only the *interim* route to the Library. Specced under SPEC → The Add Surface → Deferred.
- **Library discovery UX**: popularity ranking, "recently added" sort. **Grouping by kind is not deferred** — it ships as a view (the Kind band), needing no re-parenting. *Arbitrary user-authored groups* stay blocked on identity: `parentId === null` is the Definition test, so a Definition cannot sit under a folder Node without ceasing to be one. The identity question comes first; the grouping UI (folder kind, drop targets, empty-group rule) after.
- **Editing a picked Definition's config from the Add Surface** — the row shows a picked Definition's config read-only, and its name goes `readOnly` too, because rewriting either would change shared meaning from a surface whose job is to add. Under fork-never-mutate the shape this wants is a **link plus a fork**: tap through to the Definition's entry in the Library lens to inspect it (the same affordance ISSUES → Features #8 wants from a persisted Field's Config band), and any actual change mints a successor Definition. Until either exists the escape hatch is Cancel and retype. Raised 2026-08-15; reframed 2026-08-20 (the 2026-08-17 edit-in-place reframing died with the place-design).
- **A keyboard model for the Add Surface** — deferred by SPEC → Keyboard & Accessibility, which states the intended bindings and why they are unbuilt (the row's two text inputs sit inside a tree that would own the arrow keys). Worth knowing there is **prior art**: the retired `LibraryPicker`/`DefinitionAuthoring` pair shipped a complete roving-tabindex tree — `[role="treeitem"]` rows read from the live DOM rather than a `<For>` index, Up/Down bubbling to the tree while rows owned Enter/Space and Left/Right, and focus moving into the tree on open. It was deleted with those components on 2026-08-15 rather than half-ported onto a surface whose shape was still moving; recover it from the commit that removed them.
- **Moderation / promotion to canonical** for crowdsourced entries — flagged-content workflow, dev curation.
- ~~**Dedicated Library view**~~ — **no longer deferred, and not a "view".** Specced 2026-08-20 as SPEC → *The Library*: a lens — a seeded `Field Library` root pinned on ROOT with `Field Definitions` and `Kinds` lens children whose listings are gathered, never stored. Not a stack under a main menu and not a second view layer — one tree, ordinary re-rooting. **Read-only**: browsing and comparing, not managing; edit stays fork-only and unbuilt. (A 2026-08-17 place-in-the-tree version — Definitions re-parented under a Library Node, editable in place — was prototyped and rejected; SUPERSEDED.)
- **Templates (composite sets of FieldDefinitions)** — e.g. "HPU with Accumulator". The reserved word "Template" is mortgaged for this future feature; distinct, larger scope than the FieldDefinition Library itself. Note the adjacency to *Definition Packs*: same data shape, different verb — a pack **populates the Library**, a Template **applies to a node**. Keep the word free, and keep the pack file format clean enough that Templates can reuse it.
- **Firestore blob sync** — needed once real `single-image` lands (Phase-1 single-image is a display-only stub; see ISSUES.md).
- **Orphaned-blob GC** — needed once blobs are in play.

### `single-image` → `image` + `image-with-caption` (decided)

The old `single-image` kind crammed two independent edit intents (*change the image* and *edit the caption*) into one `value` object — a hardcoded `{ image, caption }` composite with no per-sub-value history and reference-equality bugs in the no-op/revert gates (the value object was minted fresh on every edit, so `!==` never matched structurally). **Resolved by decomposition** (SPECIFICATION.md → Field-kind specs; ELEMENT-MODEL.md): `image` carries only the blob metadata as its `OwnValue`; `image-with-caption` is `Children(template: image + text-kv)`, so the caption becomes a sibling `text-kv` sub-field. Each sub-value is then a primitive again (caption = string, image identity = `blobId`), so structural history *and* correct value-equality both come for free. Build rides in on the lens/`Edges`/sub-field migration work (ISSUES.md). (If over-capture noise bites the stub before then, a small structural-equality helper in `diffElementChanges` + the two `DataFieldHistory` gates is the throwaway patch.)

### Media / Image Fields

Media upload, preview, storage, and caching are out of scope for Phase 1. All fields treated as text.

### DataField Reordering UI

Spec calls for user-driven reordering within a DataCard (SPECIFICATION.md §DataField Reordering). UX TBD — drag handle, up/down buttons, or long-press + drag. Writes go through the adapter. This is the point at which persisted gaps from deletions get compacted. Algorithm note (a `computeCardOrderUpdates` helper existed at `src/data/utils/cardOrder.ts` until 2026-06-10, deleted as speculative): sort fields by current order, walk the run assigning sequential orders, and emit `{id, cardOrder}` updates only for rows whose order actually changes — minimal writes, stable for already-ordered input.

### cardOrder Compaction on Delete

Currently deleting a field leaves a gap in `cardOrder`. Display sorts ascending so the gap is invisible. Revisit only if accumulated gaps become user-visible or cause ordering surprises — then compact on delete, accepting the write cost.

---

## UI / UX

### Node Creation

**Rich Construction UI** (per spec): multiple default rows, five dropdowns for user-selected fields, Add button in row 10, Save/Cancel in row 11, empty rows skipped on save.

Phase 1 creation is minimal (Name + Subtitle); fields added post-creation from the DataCard.

**`typeOf` → suggested-fields service** — the behaviour-free domain typology (SPECIFICATION.md §584; ELEMENT-MODEL.md → What is *not* a kind) ships as forkable seed `typeOf` data (tag + default field bundle), read by **one generic service** that suggests fields from a node's `typeOf` during construction. The tag half exists (seeded `fd_type_of`, added at node mint); unbuilt are the seed bundles and the suggestion service itself. This is the mechanism that would populate the Rich Construction UI's default rows. (Node-*kind* choice in the create surface is separate and already shipped — the picker reads `reRootCreateKindsFor`.)

### Config-tree UI (the tree *is* the settings screen)

Decided in discussion 2026-08-14, alongside Data Model → *Definition Packs*. `config` is already a `treeType`, and the cascade already models config layers as "prefs being Fields on a Node" (SPECIFICATION.md §609). So the config UI is the existing TreeNode / DataCard / FieldList renderers — no new view layer.

**Amended 2026-08-17: there is no switcher, and no FSM state parameterised by `treeType`.** There is one app and one tree, and the tree *is* the switcher. `treeType` is a routing tag on the Element (which audit log, whether it syncs), not a navigational partition, so a `config`-tagged subtree simply hangs off a Node you walk to — exactly as the Library now does (SPEC → *The Library → One tree, no switcher*). The original three-way switcher sketch is in SUPERSEDED.

- **`App Defaults` as a Node you re-root into**, pinned near the Library. When both exist, an app-level parent Node holding them raises the one open question the tag model leaves: what `treeType` a container of mixed subtrees carries (ELEMENT-MODEL → Open Questions).
- **`App Defaults` as an ordinary node** whose fields are the bindings. `New Node Fields` is a container whose children are references to Definitions, so dragging to reorder *is* reordering the fields every new node is born with — `siblingOrder` already means that. No new interaction primitives.
- **Provenance is a link.** A default field arrives with no account of why it is there. Give it a tappable source and it navigates to the config node that set it: set *there*, used *here*. Worth more than an explanation — it **defers permissions**, because "who may change this" becomes a property of the place you land rather than a role check at the field. The authoring side eventually picks among options (Default / Locked Default / Manager-Locked Default / …). (Reframed 2026-08-14: the old version hung this on the composer's *locked checked rows*, which no longer exist — the defaults are now ordinary fields, so the affordance is provenance rather than a lock. Same destination, and it now serves the Field Details config rows too.)
- **Lens policy overrides on the lens's own DataCard** — see *Definition-binding seam → Re-root Definition authoring UI*, whose open UX question this answers.
- **Inherited-value chrome** — ghosted value + source chip + tap-to-override + revert-to-inherited. One widget serves all three cascade jobs (business inheritance, Definition specificity, config). Needs the arbiter, and needs "this value is delegated" to be *manifest-readable* rather than inferred, since chrome entailment runs one way (SPECIFICATION.md §626).

### Config authoring: progressive disclosure

Removed 2026-08-16 after shipping it — see SUPERSEDED → *number-kv progressive disclosure* for the original spec text and why it went. `ConfigSubField.group`, the `ConfigGroup` type, `CONFIG_GROUPS` and the collapsible group row in `ConfigRows` are all deleted; config authors as one flat list in schema order.

**What would bring it back**, in rough order of how much it would take:

- **A kind whose config is long enough to need it.** `number-kv` has ~12 knobs and reads fine flat; the tiers were solving a problem it did not have. A kind with 25+ would be a real trigger, and none is planned.
- **A category that cannot be folded into the labels.** The rule that replaced grouping is that a load-bearing category belongs in the sub-field's own `label` (`Low low` → `Threshold LL`). That works while categories are shallow and few; a config with two orthogonal axes would defeat it, because the label would have to carry both.
- **Sections landing first** (see *Sections — the lightweight grouping primitive* below). If it comes back it should come back as an instance of that primitive — a tag on the sub-field, grouped at render — not as a second bespoke grouping mechanism. That is most of why removing it now is cheap: the version worth having is not the version that was deleted.

Note the interaction with **flat is also what makes the Add Surface's Config band and Field Details' Config band comparable** — `ConfigSummary` already drew the Definition's config flat, so the two surfaces now agree in shape for the first time. Reintroducing depth on the authoring side alone would re-open that divergence.

### Sections — the lightweight grouping primitive ("the Great Flattener")

Named in a claude.ai design chat and reconciled against the code 2026-08-16, working through why `DetailBands` exists. The *conclusion* was already in the spec as a single table row — SPECIFICATION.md → *Manifest → chrome*: `Section header | a grouping tag on the items | nothing (a render grouping, not a node)` — and ISSUES Architecture #2 has it queued unbuilt as *grouping-tag → section header*. What was missing is the concept behind the row, and the fact that the app already implements something adjacent to it three times under three names.

**A section is a labelled, collapsible, ordered container that is not an Element and earns no kind.** It is organisation on a display surface — nothing to do with what it draws or where that content lives. It has a label, a chevron, an open state, a position, and children it does not own. The *section* stores nothing: no id, no `treeType`, no `placement`, no sync row, no history, no LWW, no cascade-delete. Membership is a property of the **items**.

**Naming, decided.** `section` in code — the platform-conventional term (iOS table sections, RecyclerView section headers). **No user-facing name**: the user sees the divider's label ("Electrical", "Activities"), never the word "section". If it ever must be named in help text, "sections" reads fine; if a flat-vs-nested toggle ever surfaces, name it *Flat view / Nested view*, not after the concept. "The Great Flattener" is the internal name — commit messages and war stories, never a tooltip.

**Two orthogonal systems, same primitive.** Both are optional sugar; `siblingOrder` alone is often enough, and plenty of trees want no sections at all.

- **Child-node sections** — grouping a node's children in the tree: `── Physical ──` / `── Activities ──` over the child rows.
- **Card-field sections** — grouping a node's Fields inside its DataCard: `── Identity ──` / `── Electrical ──` over the field rows.

**Membership is self-declared, and the unified Element makes it one column.** Each item owns its section via a `section: string` tag on itself; the section is a `groupBy` over that tag. Consequences that fall out for free: **empty sections vanish** (a section exists only because items declare it), and **drag-and-drop is a write to the item** — dragging across a divider sets the dragged item's tag, with section headers as drop targets, identically for child nodes and card fields. Nothing about the section itself is written, which is the clearest possible evidence it is not an Element.

Two notes on translating this into the current model. The source discussion predates the unified Element and put `section` on `TreeNode` *and* `DataField`; today that is **one nullable column on `Element`** serving both systems at once — an unlooked-for dividend of the unification. And it proposed a `nodeKind` classifier to derive default sections from (`activity` → "Activities"); `kind` + `placement` already are that classifier, so the derivation is "default the tag from `kind`, explicit tag overrides".

**Housekeeping the mechanism needs**: normalise the tag on save (lowercase, trim) so typos don't mint near-duplicate sections; ship a hardcoded default section order (Physical → Activities → Documents → Other) before any user-ordering exists.

**Two flavours, one render contract** — the part the spec row under-states:

- **Grouping by tag**, over homogeneous items. Membership is *derived*: the items carry a tag and the section is a `groupBy` over it. This is the spec row's "a grouping tag on the items", and it is what both systems above want. **Not yet built** — the nearest thing is `ConfigSubField.group` + `CONFIG_GROUPS[kind]` + `ConfigRows.ParentRow`, which renders the same way but takes membership from a per-kind *schema* rather than a stored tag on the item, so it has no drag-to-reassign and no empty-vanishing.
- **Declared slots**, over heterogeneous sources. Membership is *declared*: History draws `ElementHistory`, Config draws the Definition's child subtree, Tools draws buttons. Nothing tags itself into a band.

Same descriptor either way — `{ id, label, collapsible, defaultOpen, order }` — differing only in whether it names **a tag to group by** or **a source to draw**. One descriptor carrying either absorbs both, and collapse / order / persistence then get written once instead of per surface.

**Already implemented three times**, each a label + chevron + local open signal + nested `<Show>`, with no shared code:

- `ConfigRows.ParentRow` — the tag flavour, with a real grouping tag.
- `DetailBands` — the slot flavour (History · Config · Tools for a persisted Field; Config · Kind · Tools for the Add Surface).
- `AddFieldSurface.KindRow` — the tag flavour in disguise: Definitions grouped by their `kind`, explicitly a view and never a re-parenting (SPECIFICATION.md → *Listing under the Kind band*).

Collapsing these is **modelling, not DRY** — they are one concept, and naming it is what makes the extraction obviously right rather than opportunistic. The chevron CSS is duplicated on the same seam: `styles/disclosure.module.css` and `DetailBands.module.css`'s `.sectionChevron*` carry byte-identical border math.

**Why it is not an Element, stated once.** `jobs` and `logbook` *are* regions that are Elements, and they earn it by composing `Derivation(children/transitive) + ProvisionSpec` (SPECIFICATION.md → *Earning a kind*). A section composes nothing from the six capabilities, so the same rule excludes it. The cost side is concrete: `placement` is a two-value vocabulary (`inline | re-root`) that `useElementChildren` binarises in one line — `(filter === 'nodes') === isReRoot(e.kind)` — so a third flavour of Element needs a decision at every site that enumerates children (`FieldList`, `ConfigSummary`, the derivation gathers, the create pickers, the provisioner). A section costs none of that.

**Persistence without Elements is already specced.** Open state belongs where card and field expansion already live: `uiPrefs.ts` (`expandedCards` / `expandedFieldDetails`), matching SPECIFICATION.md → *Manifest → chrome*, which files expand/collapse as device-local view state. Per-user order and membership belong in the per-viewer overlay, which SPECIFICATION.md → *Populations are typed trees* already names for exactly this — "the canonical order is the column; a personal reorder is a sparse per-viewer overlay". So "saveable per user, with `siblingOrder` and the reordering UI" needs no new mechanism, only the overlay (ISSUES Architecture #1). **Phase 1 keeps sections as shared data** — one `section` tag per item, the same for everyone — and defers per-user overrides until there is a real User model to hang them on.

**The discipline to hold.** Once sections are user-authorable, orderable, collapsible and drawn to look like tree rows, pressure to promote them to Elements returns from the other direction — nesting them, dragging items between them, sharing them. The answer is the same test: a grouping that composes no behaviour stays a grouping, and a behaviour-free kind is the CI-lintable degeneration anti-pattern (SPECIFICATION.md → *Earning a kind*). Worth stating explicitly for sections, because the resemblance will keep making the case.

**Consequence worth checking — the Library pack-grouping blocker looks over-stated.** *Definition Packs* above says grouping the Library by pack provenance "hits the same blocker as categories", needing a Definition to sit *under* something while `parentId === null` is the storage layer's identity test. But *FieldDefinition Library → Phase-2 enhancements* says grouping **by kind** is explicitly not blocked, because it ships as a view. Pack provenance would be a tag on the Definition, so grouping by it is the tag flavour above — a view, needing no re-parenting, blocked by nothing. Only *arbitrary user-authored groups* need the identity move. Reconcile the two entries when this is picked up.

**Build order, when it is picked up.** Build the **tag flavour first** — it is the one with a user-facing payoff and the one that defines the real shape (stored tag, drop targets, empty-vanishing, name normalisation). Only then ask whether `DetailBands` and `ConfigRows`' groups collapse into it. Extracting a shared component *before* that would abstract over two near-misses and miss the seam: neither existing implementation takes membership from a tag, which is the whole mechanism.

**Open.** The declared-slot flavour is the newer half of this write-up — the source discussion is entirely about the tag flavour, and whether the two genuinely want one descriptor or merely look alike is unsettled until the tag flavour exists to compare against. Also unresolved: whether a section may nest (the source discussion assumes flat, and flat is the point of the name).

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

- Surface name-change history. **Recording landed** with the unified `ElementHistory` — `diffElementChanges` writes `property: "name"` (not the `"fieldName"` this line used to name) — but nothing dispatches `UPDATE_ELEMENT_NAME`, and `DataFieldDetails` filters the History band to `value` rows by design. What is deferred is the *display*, once renaming is reachable at all (ISSUES → Architecture).
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