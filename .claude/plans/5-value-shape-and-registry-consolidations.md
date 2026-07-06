# §5 value-shape vocabulary + registry consolidations (#9, #16) — the branch-closing pass

## Context

The last §5 chrome-entailment piece plus two ISSUES riders of the same seam shape, closing out this branch's registry/manifest charter.

**Design decisions (settled 2026-07-05):**
- **Shape home**: `ownValue.shape` per SPEC §569 (ValueSpec carries value shape), authored in `capabilities.ts` as pure data. A kind with no `ownValue` (asset-doc — its value is an Edge, the deliberate #6b call) defaults to `scalar`: *no own value → renders as a scalar-shaped resolved read*.
- **Assignments are behavior-preserving**: `single-image` → `composite`; every other field kind → `scalar`. Pixel-identical to today's two flags. `compound`/`string-list` get reassigned by essence only when a real consumer wants their own sub-structure.
- **Union is `'scalar' | 'block' | 'composite'`**: `stream` is named in the SPEC vocabulary but has no arrangement law, and the SPEC's own rule says a shape must carry a distinct law. It joins the union with its first consumer (ISSUES note). `block` ships *with* its law (tall + label + top chevron) but has no consumer until `image` (#8).
- **Arrangement laws** (SPEC §884, one place — the DataField dispatcher):
  | shape | label | layout | chevron |
  |---|---|---|---|
  | `scalar` | shown | inline run | centred |
  | `block` | shown | tall block | pinned top |
  | `composite` | suppressed (renderer owns its sub-structure) | tall block | pinned top |

**#9 / #16 shapes (per ISSUES prescriptions):** `nodeRenderMode(kind)` as a thin discriminated union carrying `targetKind` (two of three sites need it), component-free like `placement.ts`; `KindValueMap` hand-declared type-level in `models.ts` (deriving from manifests is circular — they import `DataFieldValue`), covering **every** kind with re-roots → `never`, so the derived union collapses to exactly today's `DataFieldValue`.

## Approach

### Part A — value shape (retire `hideLabel` / `blockValueLayout`)

1. **`src/kinds/types.ts`** — add `export type ValueShape = 'scalar' | 'block' | 'composite';` and make it required on `ValueSpec` (`shape: ValueShape` — a kind that bears a value *picks a shape*, never layout). Delete `hideLabel`/`blockValueLayout` from `InlineManifest`. Rewrite the `ValueSpec` doc comment (it currently says the shape vocabulary is "deliberately NOT introduced here" — this is the introduction) and note the no-`ownValue` → scalar default + the deferred `stream` member.
2. **`src/kinds/capabilities.ts`** — `ownValue: { shape: 'scalar' }` for `text-kv`/`enum-kv`/`number-kv`/`flag`/`compound`/`string-list`; `ownValue: { shape: 'composite' }` for `single-image`. `asset-doc` untouched (no `ownValue` — the default covers it). The manifests spread these entries, so the shape flows through with no manifest additions.
3. **The 8 inline manifests** (`text-kv`, `enum-kv`, `number-kv`, `single-image`, `asset-doc`, `flag`, `compound`, `string-list`) — delete the two flag lines each. Nothing else changes.
4. **`src/components/DataField/DataField.tsx`** — the one consumer becomes the one law table:
   ```ts
   const shape = manifest.ownValue?.shape ?? 'scalar'; // no ownValue (asset-doc) → scalar resolved read
   ```
   - wrapper class: `manifest.blockValueLayout && styles.datafieldWrapperImage` → `shape !== 'scalar' && styles.datafieldWrapperBlock`
   - label: `!manifest.hideLabel && …` → `shape !== 'composite' && …`
5. **`src/components/DataField/DataField.module.css`** — rename `.datafieldWrapperImage` → `.datafieldWrapperBlock` (kind-specific name → shape name; confirm exact class name in the module when editing).

### Part B — #9 `nodeRenderMode` (collapse the triplicated lens/plain/chip pattern-match)

6. **Create `src/kinds/renderMode.ts`** — component-free, reads `KIND_CAPABILITIES` (same seam shape and same rationale as `placement.ts`/`childrenPolicy.ts`):
   ```ts
   export type NodeRenderMode =
     | { mode: 'plain' }
     | { mode: 'lens'; targetKind: Kind }        // Provision + typed Derivation → LensRollup/LensCreate
     | { mode: 'derivation-chip' };              // Derivation, no Provision → org's count chip
   export function nodeRenderMode(kind: Kind): NodeRenderMode
   ```
   Faithful to all three sites today: **lens** iff `provision && derivation?.targetKind`; **derivation-chip** iff `derivation && !provision`; else **plain** (a provisioned kind *without* a targetKind stays plain, matching the current `provision ? derivation?.targetKind : undefined` reads).
7. **Rewire the three consumers** to the selector, deleting the ad-hoc derivations:
   - `src/components/TreeNode/TreeNodeDisplay.tsx:80-84` (`lensTargetKind`/`isLens`)
   - `src/components/views/BranchView.tsx:43-47` (the re-rooted gather's target)
   - `src/components/TreeNode/KindAdornment.tsx:40-46` and `:67-70` (the inverse `!derivation || provision` guard → `mode === 'derivation-chip'`)

### Part C — #16 `KindValueMap` (derive the Value union from the registry)

8. **`src/data/models.ts`** — declare the type-level map over every kind (re-roots → `never`), add two compile-time assertions (a missing kind key errors; a stray key errors), and derive the union:
   ```ts
   export type KindValueMap = {
     'text-kv': TextKvValue; 'enum-kv': EnumKvValue; 'number-kv': NumberKvValue;
     'single-image': SingleImageValue; 'asset-doc': AssetDocValue;
     flag: FlagValue; compound: CompoundValue; 'string-list': StringListValue;
     node: never; org: never; job: never; jobs: never; 'log-entry': never; logbook: never;
   };
   export type DataFieldValue = KindValueMap[Kind]; // never-members vanish → identical union
   ```
   The derived union equals the current hand list exactly, so no downstream ripple; a future kind added to the registry without a value-map entry is a compile error.

## Files

| Action | Path | What |
|---|---|---|
| Modify | `src/kinds/types.ts` | `ValueShape` + required `ValueSpec.shape`; drop the two flags from `InlineManifest` |
| Modify | `src/kinds/capabilities.ts` | per-kind `ownValue.shape` (composite for single-image, scalar elsewhere) |
| Modify | 8 × `src/kinds/*.manifest.ts` | delete `hideLabel`/`blockValueLayout` lines |
| Modify | `src/components/DataField/DataField.tsx` | shape-law table replaces the flag reads |
| Modify | `src/components/DataField/DataField.module.css` | class rename → `datafieldWrapperBlock` |
| Create | `src/kinds/renderMode.ts` | `nodeRenderMode(kind)` discriminated union |
| Modify | `TreeNodeDisplay.tsx` / `BranchView.tsx` / `KindAdornment.tsx` | read the selector |
| Modify | `src/data/models.ts` | `KindValueMap` + derived `DataFieldValue` |

No Dexie bump, no migration, no behavior change anywhere — three pure consolidations.

## Verification

1. `npm run typecheck` + `npm run test` — clean (the coherence registry test and treePolicy tests must pass untouched).
2. `npm run dev`, eyeball for pixel-identity:
   - text/enum/number rows: label shown, chevron centred (scalar law).
   - an image field: no generic label, chevron pinned top (composite law — was the two flags).
   - an `asset-doc` row: unchanged (default-scalar path).
   - config sub-field rows in Definition authoring (flag/compound/string-list): unchanged.
   - an `org` node still shows its descendant-count chip; a plain `node` shows none (#9 chip branch).
   - a node's `Jobs (N)` / `Logbook (N)` cards still roll up and create correctly (#9 lens branch, all three consumers).

## Project Context Management

After you confirm it works:
1. **ISSUES.md** — delete Architecture Migration #9 and #16; in #2 (chrome entailment) drop the value-shape item from "Remaining" (leaving rich lens rows + fuller shell regions); add a one-liner: *`stream` shape member + arrangement law — add with its first consumer (e.g. a logbook feed); `block` has its law, first consumer is `image` (#8)*.
2. **IMPLEMENTATION.md** — add a *#5 value-shape* note: the law table, the `ownValue.shape` home + no-`ownValue`→scalar default (asset-doc's Edge-valued row), behavior-preserving assignments, and `renderMode.ts` as the placement.ts-shaped seam.
3. **code-work-map.md** — tick the §5 value-shape bullet; ISSUES #9/#16 ride-alongs noted done; **also add the missing ✅ marker to cluster #3** (Config-as-Elements landed 2026-06-27, commit 16c58ed — found stale this session).
4. **LATER.md** — nothing (the `stream` leftover is in-flight §5 work → ISSUES, per the routing rule).
