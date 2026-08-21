# DEVELOPING.md — how to run, reset, and test

Task-shaped companion to the script list in `CLAUDE.md`. Covers the choices that
aren't obvious from `package.json`: which mode to run in, which reset to reach
for, and what each test layer actually owns.

## The three run modes

One `vite build` artifact is served three ways, and they differ only in whether
the **dev gate** (`DEV_TOOLS_ENABLED` = `import.meta.env.DEV || isEmulatorTarget`)
is open. The gate governs `devLog` tracing and the `window.__*` helpers.

| Mode | Command | Syncs against | Dev gate |
|---|---|---|---|
| Dev server | `npm run dev` → :5173 | production Firestore | **open** |
| Built app | `npm run preview:pwa` → :4173 | production Firestore | **shut** |
| Built app, emulator | same, + `?emulator=true` | emulator :8080 | **open** |

`npm run dev` registers no service worker — `preview:pwa` is the only way to
exercise the PWA. An installed PWA's `start_url` carries no query string, so
emulator mode there needs `localStorage.setItem('USE_FIRESTORE_EMULATOR','true')`.
The **EMULATOR** badge is on screen whenever you are pointed at :8080; if you
expected it and don't see it, you are talking to production.

**Work against the emulator whenever you touch sync.** `npm run emulator`, then
`?emulator=true`. Each target gets its own IndexedDB, so switching modes doesn't
mix data.

## Resets

Retention is the default — **a sync never deletes a local row** — so clearing
the server no longer clears any client. The two sides reset independently, which
is the point: pick the one you actually mean.

| I want to… | Do this |
|---|---|
| Clear this browser's data | `await window.__wipeLocal()` (deletes the DB, reloads) |
| Clear the emulator | `npm run wipe:emulator` |
| Re-seed the Library from the pack | `await window.__wipeDefinitions()` (drops the Library, reloads) |
| Fully clean slate | `npm run wipe:emulator`, then `__wipeLocal()` |
| A tree to look at, on a clean slate | `__wipeLocal()`, then `await window.__mintDemoTree()` |

The console helpers need the gate open, so run them on :5173 or in emulator mode.

**One wipe you don't ask for: `npm run test`.** `firestoreAdapter.test.ts` clears
the whole emulator project in `beforeEach`, and it sits in the default suite —
so a plain test run clears the emulator whenever one happens to be up (it skips,
and says so, when one isn't). Deliberate, and safe in the way that matters: the
suite mocks `../data/firebase` with an emulator-bound Firestore, so it has no
path to production. But it means **hand-seeded emulator state does not survive a
test run** — reach for `wipe:emulator` when you mean it, and don't leave data you
care about sitting there while you run the suite. Cypress is the same bargain
(`cy.freshVisit()`, every spec), just an expected one.

## Console helpers

`__sync()` runs a cycle now. `__syncStatus()` returns the sync queue with each
item's status, retry count and last error — the first thing to check when a
"changes failed to sync" toast appears. `__wipeDefinitions()` and `__wipeLocal()`
are the resets above.

### The two you'll reach for most: wipe, then mint

```js
await window.__wipeLocal()     // deletes this browser's DB and reloads
await window.__mintDemoTree()  // ~60 Elements: three roots of example assets
```

**`__wipeLocal()`** is the honest fresh-profile test. It deletes the whole local
database and reloads, so the app re-inits from nothing: the bundled pack re-seeds
(30 Definitions + the Library chrome), the node index rebuilds, lenses get
provisioned as nodes arrive. Reach for it after **anything that changes seeded
data** — a population `revision` bump, an edit to `src/data/packs/defaultPack.ts`,
a new kind — because each bootstrap population is revision-gated and an unchanged
revision means your edit is simply never written. It **never touches the server**: a local reset and
a remote wipe are different intentions (see the table above). Each sync target
has its own database, so wiping in emulator mode leaves your production-mode data
alone, and vice versa.

**`__mintDemoTree()`** fills the empty tree with something worth looking at:
Workshop & Utilities, Production Line and Farm Machinery, ~8 assets with filled
fields, a few jobs and logbook entries, one nested child on two of them. Use it
when you want a populated app in one command — checking a rendering change,
demoing, or eyeballing a pack edit against real values instead of "Empty" rows.

It mints through the **command bus**, exactly like the UI: lenses provision
themselves, the logbook policy gets stamped, each field snapshots its
Definition's label. So it is also a smoke test — if `__mintDemoTree()` throws,
something on the create path is broken. Fixture data, deliberately *not* part of
the pack format (`src/data/fixtures/demoTree.ts` says why).

Ids are deterministic (`demo_*`), so it is idempotent by refusing: a second call
returns *"already minted — run `__wipeLocal()` to re-mint"* rather than
duplicating or overwriting rows you may have edited. To get the tree back to its
authored state, wipe first. Demo rows **do** enqueue sync, which is correct —
they are ordinary user-shaped data — so mint in emulator mode unless you actually
want them in production Firestore.

## Tests

Four layers, each owning something the others structurally cannot reach:

- **`npm run test`** — Vitest. Domain logic at the service/adapter layer.
  Components are never unit-tested (no JSX transform in `vitest.config.ts`).
  The emulator-backed specs run only when the emulator is up, skipping visibly
  (yellow, with a warning naming the port) when it is down — so a green run does
  not on its own mean they ran. `npm run test:firestore` runs one of them alone.
  **This clears the emulator** — see Resets.
- **`npm run cypress`** — behaviour contracts, on the dev server. Needs the
  emulator **and** `npm run dev` running; every spec's `cy.freshVisit()` wipes
  the emulator and deletes the app's IndexedDB first, so specs are hermetic.
- **`/offline-test`** — the service worker. Skill, run by hand: builds, serves,
  then **stops the server** and reloads to prove the shell serves from cache.
  Cypress can't do this — it drives the dev server, which has no SW.
- **`npm run typecheck` / `npm run lint`** — both gate a commit. `lint` runs
  `eslint-plugin-solid` at error, including `solid/reactivity`.

`npm run build` runs the typecheck itself, then compiles the SW and injects the
precache manifest. Free port 4173 before building — a running preview server
locks `dist/service-worker.js`.

## Danger zone

`wipe:elements` and `wipe:fielddefs` hit **production Firestore**. They refuse
without an explicit flag:

```bash
npm run wipe:elements -- --yes
```

There is almost always a better option above. Note these no longer clear any
client, so a production wipe alone does not give you a clean slate.
