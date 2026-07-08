# SOLID-WORKPHASE-I — Boot & Spine (Qwik → SolidJS migration, Phase I)

## Context

Branch `MIGRATE-whole-app-move-to-SolidJS` executes the meta-plan in `SOLIDJS-MIGRATION.md`: a cutover from Qwik 1.16 to a plain **solid-js** SPA (no SolidStart, no SSR/SSG, no router — the FSM stays the navigation model). Prep (§4) is done on the Cypress side (3 behavior-contract specs); the QRL-alias funnel half was never done and is subsumed here.

**Phase I scope (meta-plan §6):** tooling swap; hand-written `index.html` + client mount; appState store/context in Solid (transitions lose their `$` wrappers); storage-init lifecycle; snackbar host; the manifest type spine flips to Solid component types; `eslint-plugin-solid` on as hard error. **The app boots to an empty shell.** Views/data hooks are Phase II; renderers are Phase III/IV.

**Phase gate:** `typecheck` clean, all **38 Vitest files green**, `lint` clean. Cypress specs are expected red until Phase II+ — not a gate. Feature freeze: no data-model/sync/schema changes.

## Strategy decisions

1. **Qwik npm packages stay installed until mop-up** (meta-plan §8 deletes deps there). Phase I removes Qwik only from the build graph, tsconfig JSX, and the entry. This keeps unported files resolvable for Vitest (`doubleTap.test.ts` → `src/hooks/useDoubleTap.ts` value-imports Qwik) and for tsc via import-following.
2. **Unported Qwik UI stays in place** — no quarantine moves. tsconfig gets `exclude: ["node_modules", "src/components", "src/hooks"]`. Excluded paths are only removed as *roots*; anything actually imported (ported `SnackbarHost`, Qwik-free `useSyncTrigger.ts` / `numberKvState.ts`, type-only-Qwik `TreeNode/types.ts` via `appState.types.ts`) is still typechecked by import-following. No Qwik `.tsx` is reachable from the ported graph (verified).
3. **ESLint ratchet:** `eslint-plugin-solid` (flat config, rules at **error**) + `no-restricted-imports` erroring on `@builder.io/qwik*`, scoped to `src/**` minus `src/components/**`/`src/hooks/**` (plus a second identical block re-including `src/components/Snackbar/**`). The ignores shrink each phase; deleted at mop-up.
4. **appState:** `createStore` + `setState(produce(...))` — each transition stays atomic (multi-field FSM writes never observable mid-transition), writes stay funneled through actions. `transitions/selectors/guards/uiPrefs/appState.types` ship **byte-identical** (verified: the Set-bearing toggles already reassign fresh `Set` instances — `appState.transitions.ts:108-148` — which is exactly what Solid's property-level tracking needs; Sets are never proxied).
5. **No JSX in test-reachable spine files.** Vitest has no Solid transform (`vitest.config.ts` is plugin-free and stays untouched). `appState.context.ts` stays `.ts` (provider JSX lives in `App.tsx`); the kinds stub becomes JSX-free `.ts` (a Solid component may return a thunk — `(props) => () => text` is a valid, reactive `JSX.Element`). Note: no *current* test runtime-imports the registry graph (only `useDefinitionDraft`/`useLensPolicy` hooks and `.tsx` components do; `models.ts` imports it type-only), so this is cheap insurance + explicit discipline, same as `retryFailedSync.ts`.
6. **Renderer prop contract flips now, renames included:** `$`-suffixed props drop the suffix (`onUpdated$`→`onUpdated`, `onChange$`→`onChange`); `rootRef` becomes a callback ref `(el: HTMLElement) => void` (Solid convention; parent picks reactivity) — **provisional until Phase III** where `useFieldEdit` is the real consumer.
7. Use **context7** during implementation for current `vite-plugin-solid` / `eslint-plugin-solid` flat-config idioms and versions (meta-plan §5).

## Steps

### 1. Install deps (tree stays green) — commit
- `npm i solid-js`; `npm i -D vite-plugin-solid eslint-plugin-solid`. Keep `@builder.io/qwik` + `@builder.io/qwik-city`.
- Verify `npm run typecheck && npm run test` still green.

### 2. Green-preserving QRL flips (tree stays green) — commit
A `QRL` is callable, so plain-function types still satisfy the old Qwik callers:
- `src/data/sync/syncManager.ts`: drop `qrl`/`QRL` imports; `retryFailedSyncQrl` → plain `const retryFailedSyncAction = async () => { const { retryFailedSync } = await import('./retryFailedSync'); await retryFailedSync(); }` (keep the dynamic import — a static one creates a module cycle with `retryFailedSync.ts` importing `getSyncManager` back). Update the toast `handler:` reference (~L216) and the stale optimizer doc comments here and atop `retryFailedSync.ts`.
- `src/services/snackbar/types.ts`: drop `QRL` import; `ToastAction.handler` / `onExpire` → `() => void | Promise<void>`.
- `src/test/snackbarService.test.ts`: delete the "QRL shim" comment + casts (~L14-16); pass `vi.fn()`s directly.
- Verify typecheck + tests (canaries: `syncManagerExhaustionToast.test.ts`, `snackbarService.test.ts`).

### 3. Tooling swap (red window opens)
- **tsconfig.json**: `"jsx": "preserve"`, `"jsxImportSource": "solid-js"`, `"exclude": ["node_modules", "src/components", "src/hooks"]`. Nothing else changes (no `paths`; the `~` alias lives only in vitest.config — leave alone).
- **vite.config.ts**: `[solid(), precachePlugin({ swSource: 'src/service-worker.ts' })]`; keep `server.allowedHosts` + `preview.headers` verbatim. `vite-plugin-precache.ts` internals untouched (its Qwik excludePatterns are inert on Solid output).
- **package.json scripts**: `dev: "vite"`, `build: "npm run build.types && vite build"`, `preview: "vite preview --open"`; delete `qwik`, `build.client`, `build.server`, `build.preview`, `deploy`. Keep `build.types`, `preview:pwa`, and all test/emulator/cypress/wipe scripts.
- **Moves/deletes**: `git mv src/routes/service-worker.ts src/service-worker.ts`; delete `src/root.tsx`, `src/entry.ssr.tsx`, `src/entry.preview.tsx`, `src/entry.dev.tsx`, `src/routes/index.tsx` (empty `src/routes/` goes away), `src/hooks/useInitStorage.ts` (logic moves into `App.tsx`; root.tsx was its only importer), `adapters/`.

### 4. Manifest type spine (`src/kinds/`, 12 files)
- `types.ts`: `import type { Component } from 'solid-js'`. `FieldRendererProps`: `rootRef: (el: HTMLElement) => void` (`// provisional until Phase III`), `onUpdated?: () => void`, `pendingMode.onChange: (value: DataFieldValue | null) => void`. `ConfigFormProps.onChange: (cfg: DefinitionConfig, error?: string | null) => void`.
- `registry.ts:12`: type-only `Component` import → `solid-js`.
- `configFieldStub.tsx` → **`configFieldStub.ts`**, JSX-free Solid stubs (Renderer returns a thunk of the formatted value; ConfigForm returns `null`); comment: kept JSX-free so Vitest (no Solid transform) can load the kinds graph. Importers use extensionless paths — no import edits.
- Re-point real-component value imports at the stubs with `// TODO(Phase III|IV): restore <RealComponent>` comments: `text-kv` (TextKvField/TextKvConfigForm), `enum-kv`, `number-kv` (**keep** `formatNumberKvDisplay` from `numberKvState`), `single-image`, `asset-doc` (Renderer only), `logbook` (ConfigForm only). `flag`/`compound`/`string-list` are already stub-wired — just drop the Qwik type import. Drop the now-unneeded `as unknown as Component<…>` casts. **Do not touch** the 14 policy files or 5 identity-only manifests.

### 5. `commitWithUndo` flip
`src/data/services/commitWithUndo.ts`: drop `$`/`QRL`; rename `execute$`/`undo$` → `execute`/`undo` (plain fn types); Undo handler becomes `handler: async () => { await opts.undo(result); }`; rewrite the QRL-archaeology doc comment. (Safe only after Step 3 excluded `src/hooks` — `useFieldEdit.ts` still calls the old names.)

### 6. appState store/context
- Rewrite `src/state/appState.context.ts` (stays `.ts`, no JSX): `createAppState()` factory — `const [state, setState] = createStore<AppState>(createInitialState())` + an `actions` object with the eleven transition names minus `$` suffix, each `(…args) => setState(produce(s => transitions.X(s, …args)))`. Export `AppStateContext = createContext<{ state: AppState; actions: … }>()`, `useAppState()`, `useAppTransitions()` (throw clearly if provider missing).
- Barrel `src/state/appState.ts`: swap `useProvideAppState` for `createAppState`; keep everything else (must stay Node-loadable — `appState.test.ts` imports it).

### 7. Snackbar host port (in place)
Rewrite `src/components/Snackbar/SnackbarHost.tsx` in Solid: `createSignal<ActiveToast | null>`; register a **signal-backed accessor object** (`{ get current() {…}, set current(v) {…} }`) via `registerSnackbarStore` in `onMount` — the service's plain `registeredStore.current = active` assignment stays reactive with zero service changes; window `keydown` Escape listener in `onMount` + `onCleanup`; `<Show when={current()} keyed>` reproduces `key={toast.id}` remount semantics (the service builds a fresh toast object per `show()` — verified); same DOM/classes/`role`/`aria-live`/`aria-atomic`, pointer/focus pause-resume, action button → `invokeActionAndDismiss()`. `src/services/snackbar/index.ts` untouched.

### 8. Boot: index.html, entry, App
- **`/index.html`** (new, repo root): head reproduced from old `root.tsx` (charset, viewport, favicon, `manifest.json` link, theme-color `#1a1a1a`, description, apple/mobile-web-app metas, apple-touch-icon) + `<title>CMM</title>` (deliberate micro-divergence: the Qwik app shipped no title); `<div id="app">`; `<script type="module" src="/src/entry.client.tsx">`.
- **`src/entry.client.tsx`** (new): import `./styles/tokens.css` + `./styles/global.css` (root.tsx was the only importer — don't lose these); `render(() => <App />, document.getElementById('app')!)`; SW registration `import.meta.env.PROD`-gated: `navigator.serviceWorker.register('/service-worker.js')` on `load` (drop the QwikBuild cache-cleanup line).
- **`src/App.tsx`** (new): `createAppState()` → `<AppStateContext.Provider>`; `onMount` carries the old `useInitStorage` body verbatim (`await initializeStorage()`, SW-ready log, network-state log, online/offline listeners — keep console strings); `<SnackbarHost />`; placeholder shell proving the store spine (old `routes/index.tsx` logic, text-only): `<Show when={selectors.isRootView(state)} fallback={…BRANCH placeholder…}>ROOT placeholder</Show>`. No data hooks, no views.

### 9. ESLint hard-error gate (red window closes)
`eslint.config.mjs`: keep global ignores + tseslint blocks; add (import path per context7):
1. Solid block `{ files: ['src/**/*.{ts,tsx}'], ignores: ['src/components/**', 'src/hooks/**'], …solid flat/typescript, rules: solid rules forced to 'error' (presets ship `solid/reactivity` at warn) }`
2. The same block for `files: ['src/components/Snackbar/**/*.{ts,tsx}']` (avoid negated global ignores — flat-config trap)
3. Qwik ratchet in both scopes: `'no-restricted-imports': ['error', { patterns: [{ group: ['@builder.io/qwik', '@builder.io/qwik*'], message: 'Ported code must not import Qwik (shrink ignores each phase; delete at mop-up).' }] }]`
Run `npm run lint`; fix violations in new/ported files.

### 10. Verification battery, then one cutover commit (steps 3–9)

## Verification

1. `npm run typecheck` → 0 errors.
2. `npm run test` → all 38 files green. Canaries: `appState.test.ts` (barrel loads Solid `createContext` under Node), `kindCoherence`/`placement`/`nodeLikeKinds` (kinds graph), `syncManagerExhaustionToast`, `snackbarService`, `doubleTap` (Qwik still resolvable), `uiPrefs`.
3. `npm run lint` → 0 errors. Spot-check the gate: `npx eslint --print-config src/App.tsx` shows `solid/*` at error; `--print-config` on an unported component shows none.
4. Ratchet grep: `grep -rl "@builder.io" src` → only `src/components/**` (minus Snackbar) and `src/hooks/**`.
5. **Dev boot** — first unregister any stale Qwik dev SW for `localhost:5173` (DevTools → Application). Boot with DevTools **Network → Offline** (skips `migrateFromFirestore` *and* startup `syncFull`, dodging ISSUES Bug #1: startup syncFull against empty Firestore wipes the seeded Library) or with `npm run emulator` + `http://localhost:5173/?emulator=true`. Never against production Firestore. Expect: ROOT placeholder renders; storage-init console logs, no red errors; IndexedDB `complete-maintenance-management` populated with 9 seeded Definitions; `window.__syncStatus()` defined; offline/online toggles log.
6. **Build + PWA smoke**: `npm run build` → clean; precache plugin logs SW compile + manifest injection; `dist/service-worker.js` begins with `const PRECACHE_MANIFEST=[…]` containing `/index.html` + `/assets/*`; `npm run preview:pwa` → shell loads at `:4173`, SW registers and activates. (SW's dead `/build/` prefix is harmless; full PWA pass is Phase V.)
7. Cypress: **not run** — red is expected until Phase II+.

## Project Context Management

After the coding work is believed complete, ask the user to run the Verification steps above (especially §5 dev boot and §6 PWA smoke). **Only if the user confirms it works:**

1. **SOLIDJS-MIGRATION.md** — mark Phase I done (note: QRL-funnel prep was subsumed into Phase I rather than done separately).
2. **ISSUES.md** — nothing to mark (migration is deliberately tracked in SOLIDJS-MIGRATION.md only).
3. **IMPLEMENTATION.md** — add short notes: tsconfig-exclude + import-following strategy for the unported Qwik tree; Qwik deps retained until mop-up; ESLint Qwik-import ratchet; JSX-free spine discipline for Vitest (context file + kinds stub); `rootRef` callback-ref contract provisional until Phase III.
4. **LATER.md** — nothing new deferred (stub re-pointing and hand-test checklists are already owned by meta-plan Phases III–V).
