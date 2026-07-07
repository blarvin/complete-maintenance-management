# SOLIDJS-MIGRATION.md — Meta-Plan

**Branch:** `MIGRATE-whole-app-move-to-SolidJS`. Target: a plain **solid-js** SPA (no SolidStart). This is a map, not a plan — each Work Phase becomes its own plan when picked up. Facts below are from a full-codebase survey (2026-07-06).

---

## 1. Architecture & Intentions (the end-state)

- The same product with a byte-identical domain core: local-first offline PWA; tree UI; IndexedDB (Dexie) primary with Firestore as a dumb sync mirror; append-only history; the registry/manifest kind architecture. Nothing user-visible changes.
- A **client-only Solid SPA**: hand-written `index.html`, one client mount, no SSR/SSG, no router — view switching stays FSM-driven (appState), exactly as today.
- **One reactive vocabulary end-to-end**: Solid signals/memos/effects replace the `$`-boundary; event handlers are plain closures; the QRL/serialization seam ceases to exist as a concept.
- The kind registry keeps its shape; only the per-kind Renderer/ConfigForm entries and the renderer prop contract change framework type. The capability/policy layer is untouched.
- Deployment shape unchanged: static `dist/` + the existing hand-written service worker + precache manifest, served statically (`preview:pwa` still works).
- Qwik workarounds become *optional* simplifications, not obligations: the module-getter service registry (born as a Qwik-serialization workaround) is plain TS and stays as-is through the migration.



## 2. Non-Goals / Scope Guards

- No SolidStart, no SSR/SSG, no URL router — the FSM stays the navigation model.
- **Feature freeze on this branch**: no ISSUES work, no mixed feature + migration commits. No feature work, no data-model or schema changes, no touches to the Dexie/Firestore/sync stack.
- 1:1 component port: same DOM structure, same CSS modules, same aria surface; redesign is out of scope.
- No new test frameworks; no component-render unit tests introduced during the migration.
- Keep DOM structure, aria-labels, and visible text stable through the port so those specs and the CSS modules carry unchanged.
- **P**ort the single-image stub as-is; do not couple the image / image-with-caption decomposition (ELEMENT-MODEL) to this migration.



## 3. Analysis (what the app is)

**Essential features — the behavior contract to preserve:**

- FSM navigation: ROOT ↔ BRANCH re-rooting, Up button, breadcrumbs; no URL state.
- In-situ node creation (construction card, kind picker restricted by children policy, pending-draft persistence across reload).
- DataCard expand/collapse; DataField editing (double-tap / Enter/Space, save/cancel, click-away) via per-kind renderers (text / enum / number / single-image stub / asset-doc).
- Field composer + legacy add-field surface (deliberate A/B, mutexed); Definition authoring config forms (number-kv progressive disclosure is the rich case).
- Lenses: jobs/logbook rollup, in-lens creation, bound policy Definition (entry label + staleness badge); NavigableRow peek; KindAdornment.
- Field details/history (append-only, revert); soft delete + undo snackbar.
- Offline-first sync: write → IDB → syncQueue → Firestore push/pull, retry-exhaustion toast, emulator mode.
- uiPrefs persistence (localStorage); seeded Library Definitions; PWA install + offline operation.

**Nature — the coupling map (survey results):**

- 74 of ~186 src files import Qwik: all 45 component/entry files plus 29 plain `.ts`.
- **Pure and migration-inert**: `src/data` (storage, commands, queries, sync, services — two small exceptions), the appState machine (types/transitions/selectors — one exception: the context file), the kinds policy layer (14 files, deliberately Qwik-free), utils, constants, the snackbar service (one type-only exception).
- **The Qwik surface is concentrated**: 22 component directories; 13 of 15 hooks; the appState context file; the manifest type spine (the shared manifest types + registry + type-only component imports in the inline manifests + one stub renderer file); root/entry/route files.
- **Qwik City is vestigial**: one route, no loaders/actions/server functions/links; used only for the provider, outlet, service-worker registration, and the static (SSG) adapter.
- No `noSerialize`, no `isServer` anywhere; browser gates are plain `typeof window` checks; QRL leaks into non-UI code at exactly four sites, always as a handler *type*, never for reactivity.
- Sizing census: ~97 components, ~86 signals, ~146 inline `$` handlers, 35 visible-tasks (lifecycle/bus subscriptions), 21 computeds, 10 resources, 2 Slot users, ~22 files with Qwik-typed callback props.
- Heaviest rewrites: the enum field renderer, the number-kv config form, the field composer, and the field-edit lifecycle hook (~250 lines).
- **All 38 Vitest files are framework-independent** (none render a component); exactly one Cypress spec drives the DOM.
- PWA: hand-written service worker (framework-free logic) + custom precache Vite plugin; Qwik's only role is registering it.



## 4. Prep / Groundwork (before touching the framework)

- **Write the E2E behavior contract first**: a handful of Cypress specs against the *current* app covering the core loops (create node → add field → edit → history → delete/undo; lens create + rollup; offline queue drain). Aria-label/text selectors only — these become the migration's acceptance tests. Today there is exactly one spec.
- Funnel the four QRL-type leak sites through one local handler-type alias, so the Solid swap is a one-line type change per site.
- Nothing else — no component refactors; the rewrite subsumes them.



## 5. Locked-in Decisions Relevent to Migration

- **Accept CSR**: drop the SSG prerender.



## 6. Resources (tooling swap)

- **Add**: `solid-js`, `vite-plugin-solid`;`eslint-plugin-solid`.
- **Remove**: `@builder.io/qwik`, `@builder.io/qwik-city`, the static-adapter config, the three entry files, the root file, the routes directory (the service-worker source moves out of it).
- **Change**: tsconfig JSX settings to Solid's; scripts collapse to plain `vite` / `vite build` / `vite preview`; service-worker registration becomes one explicit line.
- **Keep**: Vite, Vitest (config untouched), Cypress, Dexie, Firebase, fake-indexeddb, the precache plugin (re-pointed at the moved SW source), the web manifest, CSS modules + tokens.
- Use context7 for current solid-js documentation during the work.



## 7. Work Phases (each becomes its own plan)

A cutover on this branch, not a strangler — two JSX runtimes in one Vite build isn't worth it. Invariant at every phase boundary: **typecheck clean, all 38 unit tests green**; the UI regains surfaces phase by phase.

- **I — Boot & spine**: tooling swap; `index.html` + mount; appState store/context in Solid (transitions lose their `$` wrappers); storage-init lifecycle; snackbar host; the manifest type spine flips to Solid component types. App boots to an empty shell. IMPORTANT: Turn on eslint-plugin-solid as a hard error in Phase I. It flags destructured props and untracked reactive reads at lint time.
- **II — Read path**: the data hooks (element children / by-id, lens gather + policy, value sync) on Solid primitives; RootView/BranchView; the TreeNode display family; DataCard / FieldList / NavigableRow / KindAdornment / breadcrumbs, read-only. App navigates and displays everything.
- **III — Edit path**: the DataField dispatcher + the five field renderers; the field-edit lifecycle (double-tap, focus, click-away); details / history / revert; delete + undo.
- **IV — Create & author path**: node construction + pending drafts; the create surfaces; the field composer + config forms + Definition drafts; lens creation.
- **V — PWA & build**: service-worker registration + precache rewire; production static build; offline/install pass; `preview:pwa` restored.

Phases III–IV hold the heavy rewrites; budget accordingly.

## 8. Verification

- Continuous: unit suite green (it never touches the UI, so a regression here means domain breakage), typecheck, lint.
- Against the **Analysis feature list**: walk every behavior-contract bullet on the dev build; run the prep-phase Cypress specs against the Solid app.
- Sync round-trip against the Firestore emulator; airplane-mode pass on the built PWA; a real device install.
- Against **Architecture & Intentions**: grep proves zero Qwik imports remain; the deployment shape matches (static dist + SW + precache manifest).



## 9. Mop-up

- Delete Qwik deps, configs, and the workaround archaeology: the runtime-qrl construction in the sync retry path, handler-type aliases, "Qwik-free so Vitest can transform" comments.
- Docs sweep: CLAUDE.md (stack, Qwik idioms, serialization warnings), IMPLEMENTATION.md notes that explain Qwik workarounds, ISSUES/LATER items that reference Qwik mechanics, README.
- Optional simplifications, each its own decision, none required: module-getter registry → plain imports or context (keep the test seams); drop the dangling firestore-test script.
- Re-index the code-lookup MCP.



## 10. Risks and Potential Snags

- **Reactivity model shift**: Qwik signals port mechanically, but Solid punishes destructured props and untracked reads — pervasive small changes rather than hard ones; the three big files carry most of the risk.
- **Mid-branch broken app**: phases II–IV run with a partially restored UI; the unit suite + phase discipline are the safety net, and master stays releasable throughout.
- **Timing-sensitive UI code**: the bus-driven refresh loops, debounces, focus management, and double-tap windows will surface any latent re-render-timing assumptions in phase III; budget verification time there. Site-by-site inventory and the hand-test checklist: §11.
- **First-paint change** (CSR): revisit only if it visibly hurts; a static splash in `index.html` is the cheap fix.



## 11. Timing-Sensitive Code: Inventory & Phase-III Checklist

Every timeout in the codebase is one of two kinds. **Human/UI constants** (gesture windows, debounces, animation waits) port unchanged. **Qwik-render workarounds** (`setTimeout(0)` / small delays that wait for Qwik's *asynchronous* DOM update before touching a just-mounted element) must be **deleted**, not ported — Solid updates the DOM synchronously, so after a signal set the element already exists. Porting them mechanically is cargo cult at best, broken focus at worst.

### Site inventory (survey 2026-07-07)


| Site                                                             | Delay            | What it is                                            | Verdict                                       |
| ---------------------------------------------------------------- | ---------------- | ----------------------------------------------------- | --------------------------------------------- |
| `useDoubleTap.ts`                                                | 280ms / 6px slop | Gesture window (pure fn, tested)                      | Keep as-is                                    |
| `useFocusManager.ts` `FOCUS_DELAY_MS`                            | 10ms             | Wait for Qwik async render before focusing            | **Delete** — focus in an effect; ref is ready |
| `useFocusManager.ts` `BLUR_SUPPRESS_WINDOW_MS`                   | 220ms            | Native pointerdown/blur race padding                  | Keep; re-verify width in phase III            |
| `useFieldEdit.ts` autoFocus task                                 | `setTimeout(0)`  | Wait for input to mount (composer autoFocus)          | **Delete**                                    |
| `EnumKvField.tsx` ×3 (`startOther$`, auto-open, open-transition) | `setTimeout(0)`  | Wait for popover to mount before position+focus       | **Delete**                                    |
| `useElementChildren.ts` `RELOAD_DEBOUNCE_MS`                     | 30ms             | Coalesce write bursts into one reload                 | Keep; preserve *subscribe-before-first-load*  |
| `useLensGather.ts` / `KindAdornment.tsx`                         | 50ms             | Same debounce pattern for rollups                     | Keep                                          |
| `useSyncTrigger.ts`                                              | 500ms            | Batch edits before server push (module-level, tested) | Keep, untouched                               |
| `ComposerRow.tsx` scroll anchor                                  | 220ms            | Wait out CSS animation before `scrollIntoView`        | Keep (animation constant, not Qwik)           |
| `SingleImageField.tsx` flash                                     | 180ms            | Cosmetic flash                                        | Keep                                          |




### Known ordering hazards (phase III)

- **Synchronous updates cut both ways**: Qwik handlers are async QRLs, so state lands a beat after the event; in Solid an outside-click handler closes the edit field *mid-event*, before the trailing blur/click are delivered. The outside-click cancel + `inputBlur$` + blur-suppress interplay is where latent ordering assumptions will surface.
- **Event delegation ordering**: Solid delegates `pointerdown` through one document listener; the manual `document.addEventListener` outside-click cancel may order differently than under Qwik. Escape hatch if it bites: `on:pointerdown` (native, non-delegated).
- Free win, not a hazard: double-tap timestamps move from async-QRL execution time to synchronous event time — detection gets slightly *more* reliable.



### Phase-III hand-test checklist

The unit suite renders no components, so this checklist **is** the coverage for the timing risk. Walk it on the dev build at the end of phase III (composer rows again in phase IV):

- [ ] Double-tap a field value → enters edit, input focused, cursor at end
- [ ] Double-tap *while editing* → cancels back to display
- [ ] Single tap on a field value → does nothing (no accidental edit)
- [ ] Enter/Space on a focused field value → enters edit
- [ ] Enter while editing → saves; Escape → cancels and restores display value
- [ ] Click away while editing → cancels (normal mode)
- [ ] Click away on a composer pending row → **commits** the typed value (pendingMode inverts click-away)
- [ ] Pointerdown inside an already-focused input → does not close the editor (blur suppression)
- [ ] Save/cancel → focus lands somewhere sane; no focus loops or double-focus flicker
- [ ] Enum: double-tap trigger → popover opens positioned at trigger, first option focused
- [ ] Enum: composer tick → auto-open + focus first option; seeded rows steal no focus
- [ ] Enum: scroll/resize while open → popover tracks trigger; outside click closes; Escape returns focus to trigger
- [ ] Composer: tick a tall-preview row → checkbox stays anchored on screen after the animation
- [ ] Rapid edits to several fields → one sync push after the 500ms window (watch network/emulator)
- [ ] Composer commit (multi-field write burst) → one reload per view, no flicker storm
- [ ] Edit a field visible in a lens rollup → rollup and KindAdornment counts update within ~a beat