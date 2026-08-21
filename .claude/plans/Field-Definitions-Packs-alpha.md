# Field Definition Packs — minimal alpha

## Context

The seeded Definitions and the three things that point at them are hardcoded today:
`CONSTRUCTION_DEFAULT_DEFINITION_IDS` (`src/data/definitionIds.ts:38-42`), and the
module-private `LENS_NAMES` (`src/kinds/provisionPolicy.ts:33-36`) +
`LENS_POLICY_DEFINITIONS` (`:44-46`), the latter two folded into `PROVISIONED_LENSES`
(`:60-71`) **at import time** — before the first render, long before the DB opens.
LATER.md → *Definition Packs* already decided the destination (bindings as data,
eventually resolved by the config-tree cascade); the first staged step — the only one
that constrains anything — is the **resolver seam**.

This branch builds that alpha: the three selectors become resolver functions backed by
a **bundled pack** (decided with the user: compiled into the app, so loading cannot
fail and "never boot packless" holds by construction; `public/packs` + fetch +
first-run picker stay deferred). Along the way the starter Definition set is
re-authored — 30 Definitions covering general industrial maintenance, simple
manufacturing, and agricultural machinery, human-maintenance and manual-entry only —
which reconciles the SPEC-vs-SEEDS drift in ISSUES Tech Debt #7. A separate
**dev-only demo asset tree fixture** mints example assets through the command bus —
deliberately *not* part of the pack format.

**Decisions made with the user:**
- Pack is bundled inside the app (static import; nothing under `public/` this alpha).
- `constructionDefaults` is an **optional** pack key defaulting to empty; the shipped
  pack sets the three spec birth fields (`fd_type_of`, `fd_description`, `fd_tags`).
- Shipped pack keeps `lensPolicies: { logbook: fd_logbook_policy }` and lens names
  matching the manifests ('Jobs', 'Logbook').

**Out of scope, leave alone:** pack import/upload, seed upsert → put-if-absent, the
config tree, org/user layers, the cascade arbiter.

**Correction discovered while tracing:** stamp-if-resolvable lives in
`src/data/services/provisionLenses.ts:40-49`, not `handlers.ts` (which merely calls
`ensureProvisionedLenses` at `:25`). Four docblocks misattribute it; fixed below.

---

## 1. Pack module — `src/data/packs/` (new, component-free)

Imports limited to `src/data/models` types + `src/data/definitionIds`; no registry,
no manifests, no db — safe for the storage layer and `handlers.ts` to reach.

**`src/data/packs/types.ts`**
```ts
export type PackDefinitionRow = { id: string; kind: Kind; label: string; config: DefinitionConfig };
export type FieldDefinitionPack = {
  definitions: PackDefinitionRow[];
  constructionDefaults?: string[];        // default []
  lensPolicies?: Record<string, string>;  // lens kind → policy Definition id
  lensNames?: Record<string, string>;     // lens kind → container display name
};
```
`PackDefinitionRow` is the exported successor of seedDefinitions' private `SeedRow`.

**`src/data/packs/defaultPack.ts`** — the 30 rows (§4 tables) + bindings, as a TS
module with `satisfies FieldDefinitionPack`. **TS-with-satisfies over JSON**: strict
compile-time checking of `kind` and `config` unions for free, and the pack can
reference `DEFINITION_IDS`. JSON import would widen everything to `string` and need a
runtime validator — that's the deferred import/upload work's job. Well-known ids use
`DEFINITION_IDS`; pack-only rows use plain string literals (only
cross-layer-referenced ids earn a constant).

**`src/data/packs/activePack.ts`** — the resolver seam:
```ts
const activePack: FieldDefinitionPack = DEFAULT_PACK;   // no setter — bundled-only alpha

export function packDefinitions(): readonly PackDefinitionRow[];
export function constructionDefaults(): readonly string[];  // ?? []
export function lensPolicyFor(kind: Kind): string | null;   // ?? null
export function lensNameFor(kind: Kind): string | null;     // ?? null
```

**`src/test/defaultPack.test.ts`** (new) — semantic validation `satisfies` can't do:
unique non-empty ids/labels; `enum-kv` options non-empty; `number-kv` has
`unitsSymbol`; `constructionDefaults` ⊆ definition ids and equals the three birth
fields; `lensPolicies` keys are provision-capable kinds (via `KIND_CAPABILITIES`,
component-free, allowed in tests) whose values reference pack rows of the same kind;
`lensNames` equals `{ jobs: 'Jobs', logbook: 'Logbook' }` pinned as **literals** with
a mirror comment — this replaces the registry import-time pickerLabel check, because
tests may not import `registry.ts`/manifests (no Solid JSX transform in Vitest, per
`.claude/rules/testing-conventions.md`).

## 2. Resolver call sites (all three selectors)

1. `src/hooks/useNodeCreation.ts:18,118` — swap the `CONSTRUCTION_DEFAULT_DEFINITION_IDS`
   import for `constructionDefaults`; `await seedPendingDraft(ucData.id, constructionDefaults())`.
2. `src/components/TreeNode/TreeNodeConstruction.tsx:16,108` — same swap
   (`initialDefinitionIds={constructionDefaults()}`; dormant composer surface, edited
   anyway so the constant can die; plain non-reactive read of static data — no
   `solid/reactivity` concern).
3. `src/data/definitionIds.ts` — delete `CONSTRUCTION_DEFAULT_DEFINITION_IDS` (:33-42);
   `DEFINITION_IDS` + `LIBRARY_CHROME_IDS` stay; module stays import-free.
4. `src/kinds/provisionPolicy.ts` — delete `LENS_NAMES` + `LENS_POLICY_DEFINITIONS`
   (and its `DEFINITION_IDS` import); import `lensNameFor`/`lensPolicyFor`.

## 3. Lazy schedule — `provisionPolicy.ts`

Replace the eager const with a function (no memo — ~16 kinds, called once per
CREATE_ELEMENT / backfill row):

```ts
export function getProvisionedLenses(): readonly ProvisionedLens[] {
  // same map/filter as today, but name: lensNameFor(kind) ?? kind,
  // definitionId: lensPolicyFor(kind)
}
```

- `PROVISIONED_KINDS` / `isProvisionedLens` **stay eager**, derived directly from
  `KIND_CAPABILITIES` (which kinds ARE lenses is pack-independent) →
  `KindAdornment.tsx` needs no edit.
- `src/data/services/provisionLenses.ts:19,36` — import + loop over
  `getProvisionedLenses()`.
- `src/kinds/registry.ts:18,105-112` — delete the import-time pickerLabel check (its
  premise dies when names are pack data); replacement is the pinned-literal test
  (§1). Drop list item 4 from the docblock at `:76`.
- `src/test/provisionPolicy.test.ts` — compute `const lenses = getProvisionedLenses()`
  once at describe scope; add teeth: logbook entry `definitionId === DEFINITION_IDS.logbookPolicy`,
  jobs entry `definitionId === null`.
- `src/test/provisionBackfill.test.ts:13,32` — `const SUFFIXES = getProvisionedLenses().map(l => l.suffix)`
  (module-level *call* of a pure function over static data — fine).

## 4. Seeding from the pack — `seedDefinitions.ts`

- Delete private `SeedRow` + `SEEDS` (:32-102); the seed loop reads
  `packDefinitions()`; body unchanged (`serializeConfig` etc.).
- `CHROME_SEEDS` and the chrome loop **stay in code** — chrome is app structure, not
  pack content.
- `SEED_VERSION` → **10 only in the stage that changes the row content** (the
  mechanical move ships identical data and must not force a reseed).
- `initStorage.ts` needs **no edit**: `seedDefinitions()` (`:90`) still runs before
  `initializeCommandBus` (`:105`), so no mint can precede pack seeding.
- **Cypress constraint**: four specs (`add-surface`, `core-loop`, `retention`,
  `lens-loop`) reference the existing seed ids/labels — the 9 current rows are kept
  byte-stable; the new set is purely additive (the tables below honor this).

### The pack data: 30 Definitions

Kinds used are only those the app has today: `text-kv`, `enum-kv`, `number-kv`,
`single-image`, `internal-link`, `logbook`. Dates stay `text-kv` (ISO) per SPEC
("date-kv [Phase 2+]"). Ids are authored, never generated.

**Core — the specced starter 14 (closes Tech Debt #7):**

| # | id | Label | kind | config |
|---|----|-------|------|--------|
| 1 | `fd_description` | Description | text-kv | `{ multiline: true }` |
| 2 | `fd_type_of` | Type Of | text-kv | `{ maxWords: 2 }` |
| 3 | `fd_tags` | Tags | text-kv | `{}` |
| 4 | `fd_location` | Location | text-kv | `{}` |
| 5 | `fd_serial_number` | Serial Number | text-kv | `{}` |
| 6 | `fd_part_number` | Part Number | text-kv | `{}` |
| 7 | `fd_manufacturer` | Manufacturer | text-kv | `{}` |
| 8 | `fd_model` | Model | text-kv | `{}` |
| 9 | `fd_status` | Status | enum-kv | `{ options: ['In Service', 'Maintenance', 'Retired'] }` |
| 10 | `fd_installed_date` | Installed Date | text-kv | `{}` (ISO date) |
| 11 | `fd_weight` | Weight | number-kv | `{ unitsSymbol: 'kg', unitsLongForm: 'kilograms', decimals: 2, affixPosition: 'suffix' }` |
| 12 | `fd_power_rating` | Power Rating | number-kv | `{ unitsSymbol: 'W', unitsLongForm: 'Watts', decimals: 1, affixPosition: 'suffix' }` |
| 13 | `fd_note` | Note | text-kv | `{ multiline: true }` |
| 14 | `fd_main_image` | Main Image | single-image | `{ requireCaption: false }` |

**Carried over from current seeds (code-only survivors of the drift):**

| # | id | Label | kind | config |
|---|----|-------|------|--------|
| 15 | `fd_internal_link` | Linked Doc | internal-link | `{}` |
| 16 | `fd_logbook_policy` | Logbook Policy | logbook | `{ entryLabel: 'Entry', staleness: 604800 }` (7 days) |

**Maintenance & service:**

| # | id | Label | kind | config |
|---|----|-------|------|--------|
| 17 | `fd_hours_reading` | Hours Reading | number-kv | `{ unitsSymbol: 'h', unitsLongForm: 'hours', decimals: 1, affixPosition: 'suffix' }` |
| 18 | `fd_last_service_date` | Last Service Date | text-kv | `{}` (ISO date) |
| 19 | `fd_service_interval` | Service Interval | number-kv | `{ unitsSymbol: 'h', unitsLongForm: 'hours', decimals: 0, affixPosition: 'suffix' }` |
| 20 | `fd_criticality` | Criticality | enum-kv | `{ options: ['Critical', 'High', 'Medium', 'Low'] }` |
| 21 | `fd_condition` | Condition | enum-kv | `{ options: ['Good', 'Fair', 'Poor', 'Out of Service'] }` |
| 22 | `fd_safety_notes` | Safety Notes | text-kv | `{ multiline: true }` (lockout points, PPE) |
| 23 | `fd_supplier` | Supplier | text-kv | `{}` (who to call for parts/service) |

**Fluids, consumables & spares:**

| # | id | Label | kind | config |
|---|----|-------|------|--------|
| 24 | `fd_fuel_type` | Fuel Type | enum-kv | `{ options: ['Diesel', 'Gasoline', 'Electric', 'LPG'] }` |
| 25 | `fd_lubricant_type` | Lubricant Type | text-kv | `{}` (e.g. "SAE 15W-40") |
| 26 | `fd_oil_capacity` | Oil Capacity | number-kv | `{ unitsSymbol: 'L', unitsLongForm: 'litres', decimals: 1, affixPosition: 'suffix' }` |
| 27 | `fd_filter_part_number` | Filter Part Number | text-kv | `{}` |
| 28 | `fd_grease_points` | Grease Points | text-kv | `{ multiline: true }` (where and how often) |

**Nameplate & operating values (manual gauge/nameplate reads, not SCADA):**

| # | id | Label | kind | config |
|---|----|-------|------|--------|
| 29 | `fd_operating_pressure` | Operating Pressure | number-kv | `{ unitsSymbol: 'bar', unitsLongForm: 'bar', decimals: 1, affixPosition: 'suffix' }` |
| 30 | `fd_tire_pressure` | Tire Pressure | number-kv | `{ unitsSymbol: 'psi', unitsLongForm: 'pounds per square inch', decimals: 0, affixPosition: 'suffix' }` |

**Shipped bindings:**
```ts
constructionDefaults: [DEFINITION_IDS.typeOf, DEFINITION_IDS.description, DEFINITION_IDS.tags],
lensPolicies: { logbook: DEFINITION_IDS.logbookPolicy },
lensNames: { jobs: 'Jobs', logbook: 'Logbook' },  // mirror of manifest pickerLabels, pinned by test
```

## 5. Demo asset tree — `src/data/fixtures/demoTree.ts` (new; dev-only, NOT pack content)

`window.__mintDemoTree()`, registered in `src/data/sync/devTools.ts` beside the other
helpers (module already gated on `DEV_TOOLS_ENABLED` at `:27`; extend the roster log
`:110-112` and header comment). Mints entirely through the command bus so it exercises
what the UI exercises: `CREATE_ELEMENT` for nodes (lens containers auto-provision +
policy-stamp), `CREATE_ELEMENT_FROM_DEFINITION` for fields with `initialValue`,
`kind: 'job'` under `${nodeId}::jobs`, `kind: 'log-entry'` under `${nodeId}::logbook`.
All ids deterministic (`demo_*`); idempotency = existence check on the first root →
re-run returns "already minted — run __wipeLocal() to re-mint". Demo mints DO enqueue
sync (correct: it's ordinary user-shaped data; dev sessions run against the emulator).
No unit test (dev tooling; payload shapes covered by handler tests).

Content — three business roots, one per pack domain (~8 assets, one nested level):

- **Workshop & Utilities** (general industrial)
  - *Air Compressor* — Status: In Service; Criticality: High; Hours Reading: 12450;
    Operating Pressure: 8.5; Oil Capacity: 2.4; Filter Part Number: AF-2251;
    Service Interval: 500; Last Service Date: 2026-07-02; Safety Notes (drain before
    service). Logbook: "Drained condensate", "Oil change at 12,400 h". Job: "Replace
    intake filter".
  - *Backup Generator* — Status: In Service; Fuel Type: Diesel; Power Rating: 45000;
    Hours Reading: 322.5; Supplier. Logbook: "Monthly test run OK".
- **Production Line** (simple manufacturing)
  - *Conveyor 1* — Status: In Service; Condition: Fair; Criticality: Critical;
    Lubricant Type: Lithium EP2; Service Interval: 250. Job: "Track belt drift".
    - child *Drive Motor* — Manufacturer: WEG; Model: W22; Power Rating: 7500; Serial Number.
  - *Filling Machine* — Status: Maintenance; Condition: Poor; Note (waiting on seal
    kit); Supplier. Logbook: "Seal leak found on line 2".
- **Farm Machinery** (agricultural)
  - *Tractor — John Deere 6120M* — Hours Reading: 3841.2; Fuel Type: Diesel;
    Tire Pressure: 24; Oil Capacity: 19.5; Grease Points (multiline list);
    Last Service Date; Criticality: High. Logbook: "Greased front axle", "Replaced
    fuel filter". Job: "600 h service due".
    - child *Front Loader* — Part Number; Condition: Good; Grease Points.
  - *Grain Auger* — Condition: Good; Safety Notes (guard check); Lubricant Type.

Text/number/enum values only — no image blobs; `Main Image`/`Linked Doc` stay unfilled.

## 6. Docblock fixes (stamp-if-resolvable misattribution)

`handlers.ts` → `provisionLenses.ts` in: `provisionPolicy.ts:41` (dies with the
deleted const; new docblock says provisionLenses.ts), `seedDefinitions.ts:96`
(comment migrates to the pack row, corrected), `src/kinds/lensPolicy.ts:7`,
`src/hooks/useLensPolicy.ts:5`. Rewrite the `seedDefinitions.ts` and
`provisionPolicy.ts` header docblocks for the pack-backed world.

## 7. Implementation stages (each green on typecheck/lint/test; Commit with brief message. User will commit again after manual verification.)

1. **Pack module + seeder reads it** (mechanical, zero behavior change): `packs/types.ts`,
   `packs/defaultPack.ts` with the current 9 rows verbatim, `packs/activePack.ts`;
   `seedDefinitions.ts` reads `packDefinitions()`; new `defaultPack.test.ts`.
   `SEED_VERSION` untouched.
2. **Construction-defaults resolver**: `useNodeCreation.ts`, `TreeNodeConstruction.tsx`,
   delete the constant from `definitionIds.ts`.
3. **Lazy schedule**: `provisionPolicy.ts`, `provisionLenses.ts`, registry check
   removal, both provision tests, docblock fixes.
4. **Re-authored data set** (the 30 rows) + `SEED_VERSION = 10`; run Cypress here —
   the four seed-coupled specs are the regression canaries.
5. **Demo tree fixture** + `devTools.ts` registration.

## 8. Verification

Automated: `npm run typecheck`; `npm run lint`; `npm run test` (separate PowerShell
calls). After stage 4: `npm run emulator` + `npm run dev`, then Cypress.

Hand-test (dev server, browser console):
1. `await window.__wipeLocal()` — fresh profile, reload re-seeds from the pack.
2. Library → Field Definitions shows the 30-row set (minus chrome/policy exclusions
   per the lens's own rules).
3. New node is born with exactly Type Of, Description, Tags.
4. Node shows Jobs + Logbook containers with those names; a Logbook create affordance
   says "Entry" (policy bound — or inspect `<nodeId>::logbook`.definitionId ===
   `fd_logbook_policy` in DevTools → IndexedDB).
5. `await window.__mintDemoTree()` — tree appears; navigate nodes/fields/job/entries.
   Run again → "already minted", no duplicates.
6. Reload without wiping — no reseed churn (version gate), everything persists.

## Project Context Management

After the user verifies the implementation works:

1. **docs/ISSUES.md** — delete Tech Debt #7 (drift reconciled) and the stale part of
   Tech Debt #6's comment concern if the seeder comments were rewritten; append the §9
   observations to the bottom of their sections, one line each with provenance
   ("surfaced planning/building Field-Packs").
2. **docs/SPECIFICATION.md** — update the starter-Library table (§~649) to the
   authored 30-row set (or point it at `defaultPack.ts`), and note the bindings now
   live in the bundled pack.
3. **docs/IMPLEMENTATION.md** — short notes: resolver seam + bundled pack
   (TS-with-satisfies, why not JSON yet), lazy `getProvisionedLenses()` and why
   `PROVISIONED_KINDS` stayed eager, the registry check → pinned-literal test move.
4. **docs/LATER.md** — tick off the *Definition Packs* staged items now done (resolver
   seam; bundled pack, noting `public/packs`+fetch+picker still deferred); leave the
   rest of the entry intact.
