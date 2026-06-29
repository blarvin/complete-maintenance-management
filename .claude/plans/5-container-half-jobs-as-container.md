# §5 container half — `jobs`-as-container (create a job *inside* Jobs)

## Context

Slice 2 made the `Jobs` lens a usable surface (navigable `NavigableRow`s), but exposed a wart (ISSUES Features #1 / Tech Debt #7): a `job` created under node N persists as **both** a child card in N's tree *and* a row in N's Jobs rollup — shown twice. Today jobs are minted via the normal "+ Add Sub-Asset" picker (`node`/`org`/`job` all admit `job` in `capabilities.ts`; `RE_ROOT_CREATE_KINDS = [node, org, job]`).

The decided model (matches how you author a field *on* a Data Card, a reading *in* a Readings Section): **the `Jobs` container is the place you create jobs.** Jobs are created from inside the lens, parented to the lens's owning node, and no longer appear as loose siblings in the tree — they live in the lens. **Creation path: lens-only (single path)** — `Job` is removed from the normal picker; sub-jobs are created via a job's own Jobs lens.

The crux (the "context-aware" hard part): the `Jobs` lens is a **pure rollup/view, not a real container**. It gathers `gatherDescendants(el.parentId)` filtered to `kind === 'job'`. So "create a job inside Jobs" must mint the job as a child of the lens's **owning node** (`lens.parentId`), not the lens element. That's trivial in data — `useNodeCreation` already commits to `underConstruction.parentId`. The Phase-1-simple legibility answer: a job created from node N's Jobs lens parents to **N** (the lens owner); the "pick which descendant" UX is deferred.

Built generic (driven off the lens's `derivation.targetKind`), so `logbook`/`log-entry` (#6c) inherits the whole behavior with no new code.

## Approach

Five small edits. No model/schema/manifest changes.

### 1. `useNodeCreation.start$` gains an optional parent override
`src/hooks/useNodeCreation.ts` — change `start$(kind = 'node')` to `start$(kind = 'node', parentIdOverride?: string | null)` and use `const parentId = parentIdOverride !== undefined ? parentIdOverride : options.parentId;` when calling `startConstruction$`. `complete$`/`cancel$` are unchanged — they already read `appState.underConstruction.parentId`. Backward compatible: existing callers (`onClick$={start$}`) pass kind only.

### 2. `isLensSurfaced(kind)` — the generic "this kind lives in a lens" predicate
`src/kinds/childrenPolicy.ts` (component-free, already reads `KIND_CAPABILITIES`) — add:
```ts
const LENS_TARGET_KINDS: ReadonlySet<Kind> = new Set(
  (Object.keys(KIND_CAPABILITIES) as Kind[])
    .map((k) => capsOf(k).derivation?.targetKind)
    .filter((k): k is Kind => !!k),
);
export const isLensSurfaced = (kind: Kind): boolean => LENS_TARGET_KINDS.has(kind);
```
(`capsOf` is the existing union-widening helper.) Today `LENS_TARGET_KINDS = {'job'}`; `org`'s untyped derivation has no `targetKind` so it's correctly excluded, and `log-entry` joins automatically when `logbook` lands. This is the single source for both hiding (display) and picker-trimming (creation).

### 3. `BranchView` — lens-aware creation + hide lens-surfaced children
`src/components/views/BranchView.tsx`:
- **Detect a provisioning lens** from the re-rooted parent:
  ```ts
  const lensInfo = useComputed$(() => {
    const el = parentEl.value;
    if (!el) return null;
    const m = getKindManifest(el.kind);
    return m.provision && m.derivation?.targetKind
      ? { targetKind: m.derivation.targetKind, ownerId: el.parentId }
      : null;
  });
  ```
- **Owner name for the label** — fetch the lens's owning node so the button can name it:
  `const ownerIdSig = useComputed$(() => lensInfo.value?.ownerId ?? null);`
  then `const { element: ownerEl } = useElementById(ownerIdSig);` (guard the label with a fallback when `ownerEl.value` is null).
- **Two create branches** at the bottom of the children area:
  - **Lens** (`lensInfo.value`) → render `<LensCreateButton>` (edit 5): label `Create New ${getKindManifest(targetKind).pickerLabel} on ${ownerEl.value?.name ?? 'this asset'}`, `onClick$={() => start$(targetKind, lensInfo.value!.ownerId)}`. (Owner id read at click time — no async-at-hook-call problem.) The normal `CreateNodeButton` is **not** rendered here (`reRootCreateKindsFor('jobs')` is empty anyway).
  - **Normal node** → `<CreateNodeButton variant="child" availableKinds={reRootCreateKindsFor(parentNode.kind).filter((k) => !isLensSurfaced(k))} onClick$={start$} />` (unchanged component; just trimmed kinds).
- **Hide lens-surfaced children** from the tree list: add `.filter((child) => !isLensSurfaced(child.kind))` to the children `.map` (alongside the existing UC filter). The `jobs` lens card itself (`kind: 'jobs'`, not a `targetKind`) stays visible — it's the entry point.

The UC TreeNode + `complete$`/`cancel$` already render in BranchView and need no change: `complete$` commits to `underConstruction.parentId`, which `start$(kind, ownerId)` set to N. The new job then appears as a `NavigableRow` via `KindAdornment`'s re-gather (it gathers N's subtree).

> Deviation from the original sketch (KindAdornment): the create affordance is rendered by **BranchView**, not inside `KindAdornment`. Construction orchestration already lives in the view; pushing `start$` into a leaf header component would mean prop-drilling. The button renders in the children area directly beneath the rollup — functionally "in the lens view," just owned by the right layer.

### 4. `RootView` — same rules for consistency
`src/components/views/RootView.tsx`: `availableKinds={RE_ROOT_CREATE_KINDS.filter((k) => !isLensSurfaced(k))}` (no `Job` at root) and `displayNodes.filter((n) => !isLensSurfaced(n.kind))` (no stray job roots). Root is not a lens, so no lens-create branch here.

### 5. `LensCreateButton` — dedicated, add-field-styled create button
**Create** `src/components/LensCreateButton/LensCreateButton.tsx` + `.module.css`. A deliberately quiet affordance styled like the **"+ Add Fields"** trigger (`FieldComposerSlot`'s `.addButton`: `--text-sm`, weight 600, `--text-secondary`, no border/bg, underline on hover) — *not* the prominent `CreateNodeButton`. The button **names its target** so "where does this land" is never ambiguous:

- Props: `{ label: string; onClick$: QRL<() => void> }`.
- Renders one `<button type="button" class={styles.addButton}>{label}</button>` (e.g. **"Create New Job on Compressor #3"**).
- Self-contained module CSS replicating `.addButton` (drop its `grid-column: 1 / -1`, which is FieldList-subgrid-specific — this button sits in the plain children area). Codebase idiom: borrow the skin in a new module, don't import another component's CSS.

`CreateNodeButton` is **unchanged** — the normal-node branch just passes it trimmed `availableKinds`.

## Files
| Action | Path | What |
|---|---|---|
| Modify | `src/hooks/useNodeCreation.ts` | `start$` optional `parentIdOverride` |
| Modify | `src/kinds/childrenPolicy.ts` | `isLensSurfaced` + `LENS_TARGET_KINDS` |
| Modify | `src/components/views/BranchView.tsx` | lens-create branch (owner-named button) + hide lens-surfaced children |
| Modify | `src/components/views/RootView.tsx` | trim picker + hide lens-surfaced roots |
| Create | `src/components/LensCreateButton/LensCreateButton.tsx` (+ `.module.css`) | quiet "Create New {Kind} on {owner}" button, add-field skin |

No new domain logic beyond the pure `isLensSurfaced` predicate (add a case to the `childrenPolicy`/capabilities unit test if one exists; otherwise `npm run typecheck` + manual). No Dexie bump, no migration — existing jobs (already children of nodes) simply stop showing in the tree and show in the lens.

## Verification
1. `npm run typecheck` — clean.
2. `npm run dev`:
   - Existing jobs created before this change **no longer appear as child cards** in their node's tree, but **do appear** in that node's `Jobs (N)` rollup.
   - A node's "+ Add Sub-Asset" picker **no longer offers Job** (offers Node/Org); the root "Create New Asset" picker likewise drops Job.
   - Navigate into a node's **`Jobs (N)`** card → the lens view shows the `NavigableRow`s plus a quiet **"Create New Job on {owner name}"** button (add-field styled) beneath them.
   - Click it → the construction form opens; on Create the job is minted **under the owning node** (verify: navigate the new job's name → it re-roots, and its parent/Up returns to the owning node, not the lens) and appears as a new row in the rollup.
   - Inside a `job`, its own `Jobs` lens offers **"Create New Job on {that job's name}"** (sub-jobs parent to that job).
   - Regression: a normal node's DataCard fields + "+ Add Sub-Asset" (Node/Org) still work; cancel during construction still clears cleanly.

## Project Context Management
After you confirm it works:
1. **ISSUES.md** — resolve Features #1 (job-children fate decided: lens-only container) and Tech Debt #7 (cross-level duplication is reduced — raw job children no longer double-render; note any residual cross-*ancestor* rollup duplication that remains by design). Update Architecture Migration #2: the §5 *container half* shipped.
2. **IMPLEMENTATION.md** — add a `#5 container half` note: lens-only creation via `derivation.targetKind` + `lens.parentId`; `isLensSurfaced` as the one predicate for hide-from-tree + trim-from-picker; the `start$` parent override; why creation stays in the view (not `KindAdornment`).
3. **LATER.md** — record deferred: the "pick which descendant a job lands under" UX (Phase-1 parents to the lens owner N); the "create-anywhere / migrate-into-Jobs with animation" alternative (not chosen); residual cross-ancestor rollup duplication if it bites.
4. **code-work-map.md** — flip §5 to all-three-halves done; restate "Remaining" as just the value-shape vocabulary + the fuller manifest-driven shell regions; revisit the both-rollup-and-container shape on `logbook` (#6c).
