# SOLIDJS-WORKPHASE-V — PWA, build & mop-up (Qwik → SolidJS migration, final phase)

> On approval: save this file as `.claude/plans/SOLIDJS-WORKPHASE-V.md` and commit it first (`PLAN: Solid migration phase V plan written`), per phase convention.

## Context

Branch `MIGRATE-whole-app-move-to-SolidJS`, meta-plan `SOLIDJS-MIGRATION.md`. Phases I–IV are done and user-verified: the app boots, navigates, displays, edits, creates, authors, and all 3 Cypress contract specs pass. Exactly **one** file still imports Qwik — `src/hooks/useAsyncOperation.ts`, with zero importers.

Two things have never been done against the Solid tree:

1. **The PWA/build pass** (meta-plan §6-V). The service worker and precache plugin still carry Qwik-shaped assumptions, and no production build has been installed or run offline since the cutover. Phase I's own verification said "full PWA pass is Phase V".
2. **Mop-up** (meta-plan §8). Qwik deps are still installed; the eslint Qwik-ratchet and tsconfig carve-outs still exist; ~23 src files and five docs still describe the app as a Qwik app.

**Scope decided with the user:** this plan is Phase V **plus** mop-up — the closing plan on the branch. Deploy target is **none**: `npm run build` → `dist/`, verified locally via `preview:pwa`; no hosting config is added (`firebase.json` stays firestore-only). Comment policy: **rewrite the load-bearing Qwik comments in Solid terms, delete the pure comparisons** — several of them guard constraints that outlived the framework.

**Feature freeze still holds.** Anything the PWA pass surfaces that is not a port regression goes to ISSUES.md, not into this branch.

## Findings (verified, and where they correct earlier notes)

1. **`devTools.ts` is not migration scaffolding and must survive mop-up.** `window.__sync` / `__syncStatus` / `__wipeDefinitions` are pre-migration project tooling wired from `initStorage.ts:112`, un-gated (they run in prod too). Only **`window.__cmm`** (`App.tsx:26-32`, `import.meta.env.DEV`-gated, carries `TODO(mop-up): remove`) is Phase-II migration scaffolding. This corrects the Phase IV plan's §7 note, which lumped `__syncStatus` in with the mop-up removals.
2. **Phase I's reason for keeping the Qwik deps is spent.** It kept them so `doubleTap.test.ts` could value-import a Qwik hook; `useDoubleTap.ts` was ported in Phase II and neither it nor any other test-reachable file imports Qwik now. `cypress/` is entirely Qwik-free. `npm uninstall` is safe for Vitest and tsc.
3. **The eslint collapse is nearly a no-op.** The brace-list already covers every component directory and 12 of 14 hooks; collapsing to `src/**/*.{ts,tsx}` newly lints exactly two files — `useAsyncOperation.ts` (deleted) and `useSyncTrigger.ts` (a module-level debounce: no JSX, no props, no reactive reads — expect zero findings, but it is the one place lint could bite).
4. **The tsconfig collapse adds no new typecheck roots that matter.** Every `src/components/**` and `src/hooks/**` file is already import-reachable from `entry.client.tsx` → `App.tsx`; `useAsyncOperation.ts` is the only orphan, and it is deleted in the same commit.
5. **`vite-plugin-precache.ts` still defaults `swSource: 'src/routes/service-worker.ts'`** — a path deleted in Phase I. Inert (vite.config.ts overrides it), but it is a live trap. Its `excludePatterns` are half Qwik-specific (`q-manifest.json`, `bundle-graph.json`, `q-data.json`) plus `sitemap.xml` from the retired SSG.
6. **`service-worker.ts:156` still special-cases `/build/` (Qwik chunks)** — dead; `/assets/` (Vite's output dir) is already handled on the same line.
7. **`CACHE_VERSION` is still `'v2'`** — the same cache name the Qwik build used. `activate` only deletes caches whose name differs, so a returning user's `cmm-app-shell-v2` keeps its stale Qwik chunks indefinitely. Bumping to `'v3'` is the one-line fix.
8. **The emulator gate is unusable from an installed PWA.** `firebase.ts:32-49` reads `localStorage.USE_FIRESTORE_EMULATOR` first, then `?emulator=true`; an installed PWA launches `start_url: "/"` with no query string. The install/offline pass must therefore set the localStorage key on the origin first, or run purely offline.
9. **Service workers need a secure context.** `http://<LAN-IP>:4173` will not register one — a phone test over LAN HTTP silently tests a non-PWA. Use `chrome://inspect` port forwarding (the device sees `localhost:4173`, which *is* a secure context).
10. **Nothing to fix in the web manifest.** `background_color: #ffffff` matches `--bg-surface: var(--color-white)` (`tokens.css:40`), so the splash screen does not flash against the app; `theme_color: #1a1a1a` is the deliberate dark toolbar. Icons, `display: standalone`, and `start_url` are all correct for the Solid build.
11. **No README.md exists** in the repo (meta-plan §8's docs sweep names one). `.claude/METAPROCESS.md` is a *dated audit report*, not live guidance — left as-is on purpose.
12. **ISSUES.md's two Qwik mentions are accurate history** ("Pre-existing — same in the Qwik original", bugs #1 and #3) and stay.

## Strategy decisions

1. **Excise Qwik first, rewire the SW second, run the one expensive user pass last.** The built bundle is byte-equivalent either way (Qwik was never in the Vite graph), but the offline/install/device walk is the costly, user-run step and should happen exactly once, against the final shipping tree.

2. **Comment sweep is a rewrite, not a strip.** Three categories:
   - **Rewrite — the constraint survives, only the reason changed.** The `src/kinds/{configSchema,placement,provisionPolicy,childrenPolicy,capabilities}.ts` and `src/test/{kindCoherence,configElements}.test.ts` "kept Qwik-free so Vitest can load this" comments become "kept JSX-free / registry-free: `vitest.config.ts` has no Solid JSX transform, so nothing test-reachable may import `registry.ts` or a `*.manifest.ts`". Still true, still load-bearing.
   - **Rewrite — keep the warning, drop the comparison.** `useFocusManager.ts:9` (no focus delay — *don't re-add one*), `useFieldEdit.ts:21` (autoFocus mounts without a `setTimeout(0)`), `EnumKvField.tsx:9,12,198,225` (the open-effect tracks the options resource on purpose; the `activeElement` guard prevents focus theft), `DataFieldDetails.tsx:12` (subscribe-before-first-load), `useElementChildren.ts:45` / `AssetDocField.tsx:25` (the `disposed` stale-async guard), `useFieldValueSync.ts:17` (`fieldId` deliberately non-reactive), `TreeBreadcrumbs.tsx:12` (nodeIndex staleness), `App.tsx:36` (dev registers no SW). Each keeps its *why*, loses "the Qwik version…".
   - **Delete or reduce.** `pendingDraft.ts:2` / `storageEventRelevance.ts:6` ("no-Qwik" → "framework-free"), `appState.context.ts:11`, `FieldComposerSlot.tsx:60` and `DataCard.tsx:17` (keep the mechanism sentence, drop the `key=` / `<Slot>` reference — both are already recorded in IMPLEMENTATION.md), and `service-worker.ts:155`, whose comment dies with the `/build/` branch it labels.

3. **eslint collapses to a single Solid block; the Qwik ratchet is deleted.** One `{ files: ['src/**/*.{ts,tsx}'], plugins: solidPreset.plugins, rules: { ...solidRulesAtError } }` replaces the two blocks; `qwikRatchetRules` and its comment go (the deps are gone — a Qwik import would fail to resolve). Keep the `solidRulesAtError` escalation helper verbatim: it is what holds `solid/reactivity` at error. Also drop the now-dead `'server/**'` from the global ignores (Qwik City's static-adapter output dir).

4. **tsconfig drops both carve-outs**: `"exclude": ["node_modules"]`. Everything under `src/` becomes a root, which changes nothing in practice (finding 4).

5. **`preview:pwa` stays `npx serve dist -l 4173`** — unchanged, already documented in CLAUDE.md, and it is what the PWA has always been smoke-tested on. If `npx` friction or header behaviour gets in the way, the drop-in is `vite preview --port 4173 --strictPort` (already installed, honours `vite.config.ts`'s `preview.headers`). Do not change it speculatively.

6. **CSR first paint: measure, then decide.** Meta-plan §9 pre-approved "a static splash in `index.html`" as the cheap fix *if it visibly hurts*. Judge it during V-4 on the built app (cold cache, then warm/SW-served). If the blank window is not perceptible, ship nothing — do not add markup on principle.

7. **The SW's aggressive update posture is kept as-is** (`skipWaiting` in install + `clients.claim` in activate): a new SW takes over on the next load, no update prompt. Correct for a single-user prototype; an "update available" affordance is a LATER item, not Phase V scope.

8. **Cypress stays a gate** (promoted in Phase IV). It runs against the dev server, so nothing here should move it — which is exactly why it is worth running after the eslint/tsconfig/deps surgery.

## Steps

### V-1 — `MIGRATE(V-1): excise Qwik — deps, useAsyncOperation, eslint ratchet, tsconfig carve-outs`

- Delete `src/hooks/useAsyncOperation.ts` (zero importers, verified).
- `npm uninstall @builder.io/qwik @builder.io/qwik-city` (commit the `package-lock.json` churn).
- `eslint.config.mjs` per decision 3: two Solid blocks → one over `src/**/*.{ts,tsx}`; delete `qwikRatchetRules` + its comment; drop `'server/**'` from the global ignores.
- `tsconfig.json`: `"exclude": ["node_modules"]`.
- `.claude/settings.local.json`: drop the `"Bash(npx qwik:*)"` permission entry.
- Remove the `window.__cmm` block from `App.tsx:25-32` (its `TODO(mop-up)` comes due) — keep `devTools.ts` untouched (finding 1).
- Gate: `npm run typecheck` + `npm run lint` + `npm run test`. Ratchet: zero `@builder.io` hits anywhere outside `node_modules`; `npm ls @builder.io/qwik` empty. Commit.

### V-2 — `MIGRATE(V-2): comment sweep — Qwik archaeology out, surviving constraints restated`

- The three-category sweep of decision 2 across the 23 remaining files. Comments only — **no behaviour change in this commit**, which is what makes the diff reviewable.
- Gate: `npm run typecheck` + `npm run lint` + `npm run test` (should be untouched — a green run here proves the sweep stayed comment-only). Commit.

### V-3 — `MIGRATE(V-3): service worker + precache rewire for the Vite/Solid output`

- `src/service-worker.ts`: `CACHE_VERSION` `'v2'` → `'v3'` (finding 7); delete the `/build/` branch and its comment in `isStaticAsset` (finding 6); refresh the file header's caching-strategy note (it still says "Qwik chunks").
- `vite-plugin-precache.ts`: default `swSource` → `'src/service-worker.ts'` (finding 5); `excludePatterns` reduced to what the Solid build can actually emit — keep `/service-worker\.js$/`, drop `q-manifest.json`, `bundle-graph.json`, `q-data.json`, `sitemap.xml`; tidy the doc comment.
- Leave `vite.config.ts`, `index.html`, `entry.client.tsx`, and `public/manifest.json` alone — all already correct (findings 10, and Phase I's entry work).
- Gate: `npm run build` clean; the plugin logs SW compile + "Precache manifest injected"; `dist/service-worker.js` starts with `const PRECACHE_MANIFEST=[…]` listing `/index.html`, `/assets/*.js`, `/assets/*.css`, `/manifest.json`, `/favicon.png`, `/icon-192.png`, `/icon-512.png` and **not** `/service-worker.js`. Commit.

### V-4 — PWA / offline / install pass *(verification-led; commit only if it produces a fix)*

Run the full Verification battery below. Two possible code outcomes:

- **Splash** (decision 6) — only if first paint visibly hurts: a minimal static shell inside `#app` in `index.html`, replaced on mount. `MIGRATE(V-4): static first-paint shell in index.html`.
- **Port regressions** found by the pass — fixed here, in the phase, one commit each.

Anything else the pass surfaces (pre-existing bugs, polish, the SW update affordance) → ISSUES.md / LATER.md, not this branch.

### V-5 — MCP re-index

`index_folder` on the working directory via jcodemunch-mcp (meta-plan §8) — the file set changed materially across five phases. Not a commit.

*(Docs are a separate commit after user verification — see Project Context Management.)*

## Verification

**Per-commit gates (V-1…V-3):** `npm run typecheck` → 0 errors; `npm run lint` → 0 errors; `npm run test` → the Phase IV baseline green (39 files / 419 tests).

1. **Ratchet closes at zero.** Search `@builder.io` across the repo excluding `node_modules` → **no hits** (was 1 file at Phase IV close). `npm ls @builder.io/qwik @builder.io/qwik-city` → empty. Meta-plan §7's "grep proves zero Qwik imports remain" is satisfied here.
2. **Lint scope spot-check.** `npx eslint --print-config src/hooks/useSyncTrigger.ts` now shows `solid/*` at error (the file was previously outside every Solid block); `--print-config src/App.tsx` unchanged; no config anywhere still carries `no-restricted-imports`.
3. **Cypress — still a gate.** Prereqs: `npm run emulator` (:8080) and `npm run dev` (:5173). `npm run cypress:run` → all 3 specs green (`core-loop`, `lens-loop`, `offline-sync`). Failures after V-1/V-2 would mean the sweep was not comment-only. **Do not edit specs to pass.**
4. **Build.** `npm run build` → clean, no warnings about missing entries. `dist/` contains `index.html`, `assets/*`, `service-worker.js`, `manifest.json`, the three icons. Confirm the injected manifest per V-3's gate.
5. **Preview + service worker.** `npm run preview:pwa` → `http://localhost:4173`. **First: unregister any stale service worker for `localhost:4173` and clear its Cache Storage** (DevTools → Application) — a Qwik-era SW would otherwise serve the old shell. Then expect: app renders; DevTools → Application → Service Workers shows `service-worker.js` **activated and running**; Cache Storage has **`cmm-app-shell-v3`** (and only that) populated with the precached list; console shows `[SW] Precaching N assets…` / `All assets precached successfully` and `[App] ServiceWorker registered: http://localhost:4173/`.
6. **Offline pass (built app).** With the SW active, DevTools → Network → **Offline**, hard-reload: the shell loads from cache; the tree renders from IndexedDB; create a node and edit a field — both persist and enqueue (`await window.__syncStatus()` shows a non-empty queue). Back online → the queue drains.
7. **Install pass (desktop).** Chrome omnibox install icon at `localhost:4173` → install → launch the standalone window: correct name/icon, white background matching `--bg-surface`, dark title bar (`theme_color`). Repeat §6's offline check inside the installed window (system-level airplane mode, not just DevTools).
8. **Install pass (device).** `chrome://inspect` → Port forwarding → `4173 → localhost:4173`, so the phone resolves it as `localhost` and gets a **secure context** (finding 9 — a LAN IP will not register a SW). Install from the phone's Chrome menu, launch, then airplane mode: shell + IDB data must survive.
9. **Sync discipline during §6–8.** Never against production Firestore. Offline is the default. If a sync round-trip against the emulator is wanted, set `localStorage.setItem('USE_FIRESTORE_EMULATOR','true')` on the origin *before* launching (finding 8 — an installed PWA cannot carry `?emulator=true`), and do not flip modes mid-session: ISSUES bug #2 (one IndexedDB, two remotes) will wipe the other mode's data.
10. **First-paint judgement** (decision 6): cold-cache load, then SW-served load. Note the blank-window duration; add the static shell only if it reads as a flash of nothing.
11. **Behaviour contract re-walk (abbreviated).** The full §10 checklist was walked in Phases III–IV; here just confirm the *built* artifact behaves like the dev build on one loop per meta-plan §3: create a node → add a field via the composer → edit it → history/revert → delete + undo → lens create + rollup. Anything that differs between dev and prod builds is a Phase V finding.
12. `window.__syncStatus()` still defined (kept — finding 1); `window.__cmm` **gone** (removed in V-1, and it was DEV-gated anyway).

## Project Context Management

After the coding work is believed complete, ask the user to run Verification §4–11 (build, preview, offline, both install passes). **Only if the user confirms it works** — docs land as their own commit, per phase convention:

1. **SOLIDJS-MIGRATION.md** — mark Phase V done in §6 and §8 Mop-up complete; record: ratchet closed at 0; `devTools.ts` deliberately kept (not Qwik archaeology) while `window.__cmm` was removed; `CACHE_VERSION` bumped to v3 so Qwik-era caches are purged on activate; no hosting config added (deploy target: local `preview:pwa`); the first-paint splash decision as taken.
2. **CLAUDE.md** — the stack sweep: Framework line (Qwik 1.16 → solid-js 1.9, client-only SPA, no SSR/router); the Context7 library list; the two CQRS bullets that justify the module-getter registry by Qwik serialization (`useContextProvider` `Code(3)`, `noSerialize`) → the honest Solid reason (plain TS, and `setCommandBus`/`setElementQueries` are the test seams); "Qwik idioms" → Solid idioms (no destructured props, accessors in/out, `<Show keyed>` for remounts); `npm run dev # Dev server (SSR mode)` → client-only Vite dev server.
3. **SPECIFICATION.md** — 4 sites: the snackbar `ToastAction.handler` / `onExpire` QRL types (§218-220) → plain function types; "Qwik signal store" (§225) → the signal-backed store `<SnackbarHost>` registers; "Qwik cannot serialize methods — a framework fact" (§516) → the manifest is module-level because behaviour is code, never persisted onto an Element.
4. **IMPLEMENTATION.md** — rewrite the "Qwik Resumability and Service Registry" section (§209-230) as "Module-level service registry": what it solves now (DI + test seams), with one line of origin history and why meta-plan §8 keeps it; fix the `useDoubleTap` notes that still claim "Qwik signals" (§346, 348, 505, 541); **leave the dated Phase I–IV migration sections as the historical record**; append a short Phase V section (SW cache-version bump, precache defaults corrected, the mop-up inventory, any splash decision).
5. **`.claude/rules/testing-conventions.md`** — line 10 → "Solid components are not unit-tested here: `vitest.config.ts` has no Solid JSX transform, so test the logic they call, not the component."
6. **`.claude/skills/meta-report/SKILL.md`** — line 82's project-fit list (Qwik → solid-js).
7. **ISSUES.md** — nothing to mark off (the migration is tracked in SOLIDJS-MIGRATION.md only); add whatever the PWA pass surfaced that is not a port regression.
8. **LATER.md** — add what this phase deliberately left: a service-worker update affordance (currently `skipWaiting` + `clients.claim`, no user prompt); `preview:pwa`'s undeclared `npx serve` dependency (drop-in: `vite preview --port 4173`); hosting/deploy config if the app ever needs to ship somewhere; the network-first HTML strategy's cost on a flaky connection.

Left deliberately untouched: `.claude/METAPROCESS.md` (a dated audit report, not live guidance) and ISSUES.md's two "same in the Qwik original" provenance notes.
