# Field-Packs branch — finish: per-population bootstrap + seed-reliability fixes

## Context

The Field-Packs branch landed the pack seam (`activePack.ts` resolvers, the bundled
30-row `DEFAULT_PACK`, lazy lens schedule, construction defaults from the pack).
The prior session identified the "next half": the **mechanism** — a seeder that
handles many populations instead of one — plus four follow-on moves that belong
to the future Users/config branch.

Decisions taken (2026-08-21, with the user):

- **Build move 1 only** (per-population seeder). Moves 2–5 (identity resolvers,
  the four config trees, general pack format, arbiter) are **deferred** and get
  recorded in LATER.md so the analysis isn't lost.
- **Include the `mode` field now** (`upsert` vs put-if-absent) — the load-bearing
  half of the design, even though every current population is upsert.
- **Prune retired seed rows** (closes Tech Debt #13 — the lingering `library_root`).
- **Fold in the four leftovers filed from this branch's own work**: Bugs #4, #5,
  #6 and Tech Debt #15.

### Vocabulary (for the reader)

- **Population** — one named batch of rows the app writes at boot, with its own
  version number. Today there are two: the Library chrome trio, and the pack's
  30 Definitions. Today both share ONE version key (`SEED_VERSION = 10`), which
  is what breaks when a third population arrives.
- **`upsert`** — a re-seed overwrites the row (right for app-owned rows nobody edits).
- **`ensure`** (put-if-absent) — a re-seed only fills gaps, never touches an
  existing row (required the day a seeded tree is user-editable, e.g. "My App
  Settings"). No population uses it yet; the field exists so the Users branch
  doesn't have to reopen the seeder.

---

## Work items

### 1. Per-population bootstrap seeder

Rework `src/data/services/seedDefinitions.ts` into `src/data/services/bootstrap.ts`
(only 3 importers: `initStorage.ts`, `devTools.ts`, the test file).

**Types** (in the new module):

```ts
type BootstrapPopulation = {
  id: string;                       // 'library-chrome' | 'library-definitions'
  revision: number;                 // per-population; fresh namespace, starts at 1
  mode: 'upsert' | 'ensure';
  rows: () => Element-shaped rows;  // a function, so pack resolution stays lazy
  retiredIds?: readonly string[];   // ids this population used to ship; deleted on the pass
};
```

**Runner** `runBootstrap()`:

- Legacy-key migration: if syncMetadata still holds `definitionsSeededVersion`,
  delete it. Both populations then run their first pass (idempotent upsert, so
  a one-time double-write on old profiles is harmless — and it's exactly what
  makes the prune reach them).
- Per population: read `seeded:<id>` from `db.syncMetadata`; skip if stored
  revision ≥ `revision`. Otherwise, in one `rw` transaction over
  `[db.elements, db.syncMetadata]`: write rows (`put` for upsert; get-then-put
  for ensure), `bulkDelete` the `retiredIds`, write the key. Same audit stamping
  as today (`updatedBy: AUTHOR_ID_APP_DEVELOPER`, `updatedAt: now()`), same
  no-sync-enqueue rationale (byte-identical per client) — keep the docblock.

**Populations registered:**

- `library-chrome` — `mode: 'upsert'`, the `CHROME_SEEDS` trio (stays in code:
  chrome is app structure, not pack content). `retiredIds: ['library_root']`
  (the pre-`lib_root` row — closes Tech Debt #13).
- `library-definitions` — `mode: 'upsert'`, rows from `packDefinitions()`
  expanded through `serializeConfig()` (extract the current loop body into a
  small helper).

**Consumers to update:**

- `initStorage.ts` — call `runBootstrap()` where `seedDefinitions()` is called
  (same position: before `seedNodeIndexFromDb`).
- `devTools.ts` `__wipeDefinitions` — delete both `seeded:<id>` keys (export the
  key helper or the population ids from `bootstrap.ts`); update the docblock's
  "pin it" note to the new keys.
- The dead `export { DEFINITION_IDS }` re-export does not survive the move —
  nothing imports it from this file.

**Tests** — rework `src/test/seedDefinitions.test.ts` (→ `bootstrap.test.ts`):
per-population keys written; revision gate skips; `upsert` overwrites a changed
row; `ensure` leaves an existing row untouched; retired ids pruned; legacy-key
migration triggers a reseed. Reuse the existing test's fixtures/DB setup.

### 2. Bug #4 — a failed storage init reports success

`initStorage.ts:139-143`: the catch logs, sets `initialized = true`, and the app
runs packless with every write throwing.

- Add `degraded: boolean` to `InitState`; the catch sets it (keep
  `initialized = true` — the app should still render offline-empty).
- Export `getBootState(): 'pending' | 'ok' | 'degraded'`.
- Surface it: at the app level (beside the snackbar host in `App`), after
  `await initializeStorage()` (memoized, safe to call again), raise a persistent
  error toast via the existing snackbar service — "Storage failed to initialize —
  reload to retry" with a Reload action. No gating of create surfaces (that's
  Bug #7, not taken).

### 3. Bug #5 — a lens minted with `definitionId: null` is never re-stamped

New `restampUnboundLenses(elements)` in `provisionLenses.ts`, called from
`initStorage.ts` right beside `backfillProvisionedLenses`:

- For each element where `isProvisionedLens(el.kind)`, `definitionId === null`,
  `deletedAt === null`: resolve the lens spec's policy id (same
  `getProvisionedLenses()` + `getDefinition` if-resolvable check the mint does);
  if it now resolves, stamp it.
- Write via direct `db.elements.update(id, { definitionId, updatedBy: AUTHOR_ID_APP_DEVELOPER, updatedAt: now() })` —
  **not** the adapter: `StorageElementUpdate` deliberately has no `definitionId`,
  and the stamp is deterministic per-client (every client converges from the same
  pack), the same bypass-sync reasoning as the seeder. Document that in the
  docstring; the remote mirror catches up when each client boots.
- The startup-only entry point is what keeps `ensureProvisionedLenses` (the
  CREATE_ELEMENT path) untouched and adapter-only.

### 4. Bug #6 — unresolvable construction defaults are silently dropped

`pendingDraft.ts:89-91` + `useNodeCreation.complete`:

- `seedPendingDraft` returns `{ forms, missingIds }` instead of bare forms
  (collect ids `getDefinitionById` missed; `console.warn` them). Update its
  callers (`useNodeCreation.complete`; the dormant composer's mount call
  compiles against the new shape but gets no new behavior).
- In `complete()`: when `missingIds.length > 0`, raise an error toast — "N
  default fields couldn't be added — Library unavailable". The node is still
  created; the loss is *reported*, no retry machinery (Phase 1).

### 5. Tech Debt #15 — `__wipeDefinitions()` doesn't reload

Add the same `window.location.reload()` `__wipeLocal()` does, and say so in the
docblock. Together with item 3, this closes the null-stamp window the issue
describes.

---

## Deferred — record, don't build

After user verification (see below), append to **LATER.md** so the prior
session's analysis isn't lost. Under *Definition Packs* / *typed trees*:

- **Identity resolvers** (move 2): `USER_ID = "localUser"` wants the activePack
  treatment — `currentUser()` / `usersRoster()` resolvers (seam module), fake
  users as a fixture beside `demoTree` in `src/data/fixtures/`. First step of
  the Users branch; `getCurrentUserId()` (`src/context/userContext.ts`) is the
  existing stub it grows from.
- **The four trees** (move 3): skeleton roots are *seeded* populations; per-person
  subtrees (colleague profile/settings) are **provisioned** at `${userId}::settings`
  — the existing `ProvisionSpec` machinery with a non-node-create trigger, not new
  seeding. Fixed ids only for genuine singletons; per-entity ids derive from the owner.
- **First real `treeType: 'config'` producer warning**: `treePolicy.ts`'s config
  guards (per-user sync, overlay history) have never had a row flow through them —
  land the first config rows local-only, turn sync on deliberately.
- **Pack-format generalisation** (move 4) waits for the second concrete instance;
  **the arbiter** (move 5) stays ISSUES Architecture #4, blocked on identity.
- Amend the *Definition Packs → Constraints* bullet "Additive (put-if-absent),
  not upsert": the mechanism (`mode`) now exists; what remains is switching
  populations to `ensure` as they become user-edited.

---

## Verification

1. `npm run typecheck`, `npm run lint`, `npm run test`.
2. Hand-test on the **existing dev profile** (the one carrying `library_root`):
   boot once → legacy `definitionsSeededVersion` key gone, `seeded:library-chrome`
   / `seeded:library-definitions` present, Definitions index shows exactly 30,
   `library_root` deleted from IndexedDB.
3. Any lens row with `definitionId: null` in that profile is stamped after boot
   (inspect IndexedDB, or check the logbook header no longer uses the fallback label).
4. `__wipeDefinitions()` → page reloads itself → Library re-seeded.
5. Degraded boot: temporarily throw at the top of `doInitializeStorage`'s try
   (or block IndexedDB in devtools) → app renders + persistent error toast appears.
6. Cypress (`npm run emulator` + `npm run dev`, then `npm run cypress`) — the
   seed-coupled specs still pass (`cy.freshVisit()` wipes IndexedDB, so the new
   keys seed from scratch every spec).

## Project Context Management

After the user confirms the implementation works:

1. **docs/ISSUES.md** — delete Bugs #4, #5, #6, Tech Debt #13, Tech Debt #15.
2. **docs/IMPLEMENTATION.md** — short note under the Definition Packs entry:
   per-population bootstrap (`seeded:<id>` keys, `mode`, retired-id pruning,
   legacy-key migration), and why the lens re-stamp writes `db.elements` directly.
3. **docs/LATER.md** — the "Deferred — record, don't build" section above.
