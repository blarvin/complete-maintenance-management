# Reveal: navigating *to* an Element that isn't a re-root

## Context

`internal-link` now has an edit path and a `→` travel affordance (commit `674c27a`),
and Element ids are shown and copyable (commit `7e49f95`), so the working loop is
*navigate to the target, copy its id, paste into the link field*.

Three things are wrong or missing, all found hand-testing that loop on 2026-08-16:

1. **`→` on a Field target navigates to a dead view.** `TargetSpec.allowedKinds`
   (`['node','org','job']`) is declared and **enforced nowhere**, so a Field id
   pastes in and resolves happily. Clicking `→` calls `navigateToNode(fieldId)`;
   `BranchView` does `isReRoot(el.kind) ? el : null`, so the branch renders with no
   parent node. This is a live bug introduced by the `→` button.
2. **Nothing can navigate *to* a Field**, and it shouldn't be a re-root when it can.
   Revealing means *show it where it already lives*: bring its owner into view,
   expand that card, centre the row, flash it on arrival.
3. **A link's value shows only the target's name**, which is not unique — every pump
   has a "Pressure", every asset a "Color". Decided: show `Tony / Color`.

Decided in discussion, and not to be re-litigated:

- **`→` always reveals.** No per-kind branching. Revealing a node brings it into
  view and flashes it; the user can then tap to re-root. One glyph, one behaviour,
  and it doesn't cost you your place. (The alternative — node re-roots, field
  reveals — gives one affordance two meanings depending on what's behind it, which
  is exactly what we removed from `external-link` earlier the same day.)
- **Pointer only.** The *mirror* case (rendering the target's **value** here rather
  than its name) is a different kind and feature set — cascade arbiter territory.
  Explicitly out of scope. What ships shows the target's *name*, like any hyperlink.
- **Commandable someday, not commanded now.** Keep every navigation act a
  transition with a **serializable payload and no DOM in its signature**. Don't
  build a command layer; just don't build anything a command layer couldn't drive.

## Canonical element address (display now, parsing later)

One form, used for breadcrumbs, reveal, and eventually commands / downloads / pack
data. Segments joined by ` / `, root first:

```
Node / sub-Node / sub-sub-Node / Field        the element
Node / … / Field.value                        its value
Node / … / Field/config.units                 a config sub-field's value
Node / … / Field/config.options[]             an array-valued config sub-field
```

**This pass implements only the `A / B / C` join for display.** The `.value` /
`/config` / `[]` terminals are reserved vocabulary — write them into the doc so the
grammar is fixed, parse nothing. Record in `docs/SPECIFICATION.md` beside the
existing breadcrumb material; it is product vocabulary, not an implementation note.

---

## Step 2 — `revealElement` transition + ephemeral state

**Files:** `src/state/appState.types.ts`, `appState.transitions.ts`,
`appState.context.ts`, `appState.selectors.ts`, `src/test/appState.test.ts`

Add to `AppState` (top level, **not** inside `ui`):

```ts
/** The element to centre and flash on arrival. Ephemeral: a flash that
 *  survived a reload would be a bug, which is why this is not a `ui` set. */
revealedElementId: string | null;
```

`ui` is the persisted half — every field in it round-trips through `uiPrefs.ts`.
`revealedElementId` must never reach `saveUIPrefs`. `createInitialState()` seeds it
`null`.

Two transitions:

- `revealElement(state, { elementId, branchId })`
  - `branchId === null` → `view = { state: 'ROOT' }`; otherwise
    `view = { state: 'BRANCH', elementId: branchId }` and add `branchId` to
    `state.ui.expandedCards` (reassign a fresh `Set` — Sets are never proxied; see
    the note in `appState.context.ts`) so the owner's DataCard is open when the row
    arrives. This one *does* persist, correctly: card expansion is device-local
    view state.
  - set `revealedElementId = elementId`
  - `persistUIPrefs(state)` for the card set only
- `clearReveal(state)` → `revealedElementId = null`. Also call it from
  `navigateToNode` / `navigateUp` / `navigateToRoot` so a stale flash can't outlive
  the view it belonged to.

Selector: `isRevealed(appState, elementId): boolean`.

Bind both in `appState.context.ts`'s `AppActions` exactly like the existing toggles.

**Why the caller passes `branchId`.** Transitions are synchronous and pure. A
Field is not in the node index (`getAncestorPath('field')` returns `[]`, asserted in
`src/test/initStorage.test.ts:222`), so the branch cannot be derived inside the
transition. Resolution is the caller's job; the transition stays two strings wide,
which is exactly the shape a command layer would hand it later.

**Tests** (`src/test/appState.test.ts`, mirroring the `toggleBandOpen` block):
root target → ROOT view; field target → BRANCH on the owner + owner card expanded;
`clearReveal` and navigation both clear it; `revealedElementId` is absent from what
`saveUIPrefs` receives.

## Step 3 — Reveal on arrival

**Files:** new `src/hooks/useRevealOnArrival.ts`; `src/components/DataField/DataField.tsx`;
`src/components/TreeNode/TreeNodeDisplay.tsx`; the two `.module.css` beside them

The hook, given an id accessor and an element accessor:

```ts
useRevealOnArrival(() => props.id, rootEl);
```

On `isRevealed(id)` becoming true: `scrollIntoView({ block: 'center', behavior: 'smooth' })`,
set a local `flashing` signal, and `setTimeout(clearReveal, ~1400)`; `onCleanup`
clears the timer. Return the `flashing` accessor so the host adds its own class.

**The effect must live in the row, not in the transition.** Navigation, card
expansion and `FieldList`'s async load mean the target row is usually *not mounted*
when the state is set. A row that checks on mount fires whenever it appears; a
scroll driven from the transition would target nothing. This is also why the hook
takes an element accessor rather than the transition taking a ref — DOM handles
can't be serialised, and keeping them out of the payload is the whole "commandable
someday" constraint.

`DataField` already owns `rootEl` (`setRootEl`), so it has the element to hand.
`TreeNodeDisplay` needs a ref added to its `styles.nodeWrapper` div.

CSS: one `@keyframes` outline/background pulse per host, wrapped in
`@media (prefers-reduced-motion: reduce)` to drop to a static outline that the
timeout still clears.

## Step 4 — Path context on the link's value

**Files:** `src/components/DataField/InternalLinkField.tsx`, `DataField.module.css`

The resolver currently stores only `resolvedName`. Change it to hold the whole
`Element` (`setTarget`) — the reveal needs `parentId` and `kind`, and the path
needs `name`.

Path, synchronously, from the existing in-memory index:

```ts
// getAncestorPath is nodes-only, so a Field's path is its owner's path plus itself.
const segments = isReRoot(t.kind)
    ? getAncestorPath(t.id).map((s) => s.name)
    : [...getAncestorPath(t.parentId ?? '').map((s) => s.name), t.name];
```

Render **nearest ancestor + name** inline (`Tony / Color`), full path in `title`.
The full breadcrumb does not fit the value cell — the metadata column already owns
the right end and its alignment is itself unsettled (ISSUES → UI #3). Reuse
`getAncestorPath` from `src/data/nodeIndex.ts`; do **not** reuse the
`TreeBreadcrumbs` component (it renders navigable buttons and its own nav chrome).

Wire `→` to `revealElement({ elementId: t.id, branchId: isReRoot(t.kind) ? t.parentId : t.parentId })`
— which is the same expression either way, so simply `t.parentId`. A root node
target yields `null` → ROOT view. Keep the existing rule that `→` is withheld when
the target does not resolve.

**Fixes bug 1 as a consequence:** travel is no longer `navigateToNode(fieldId)`, so
the dead-view case disappears without needing a kind guard.

---

## Out of scope

- Enforcing `TargetSpec.allowedKinds` anywhere. It stays declared-and-unread; that
  is a separate ELEMENT-MODEL decision about whether a Field is a legal link target
  at all. Reveal works regardless of how that lands.
- The mirror / transclusion kind.
- Parsing the canonical address form.
- Any target picker.

## Verification

1. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` — all green.
   Baseline before this work: **524 tests passing, 16 skipped**.
2. `npm run dev`, then in the browser:
   - Open a node's details → copy its id → paste into an `internal-link` field on a
     *different* node → the value reads `Owner / Name`, hover shows the full path.
   - Click `→`: the view lands on the target's owner, its card is open, the target
     row is centred and flashes once, then the flash clears.
   - Repeat with a **Field** target — the case that was a dead view before.
   - Repeat with a **root** node target — should land on ROOT view, flashed there.
   - Reload immediately after a reveal: **no flash**, and the id is not in
     `localStorage` under `treeview:ui:prefs:v2`. This is the ephemeral-state check.
3. Delete the target while the link is on screen — the row falls back to
   `(unresolved: …)`, confirming the live resolver still works after the refactor
   from `resolvedName` to `target`.

Note for browser verification: a re-rooted node shows **three** Add Surfaces (the
node's own plus the Jobs and Logbook lens cards), so scope DOM queries to one
`datafieldWrapper` rather than taking the first match — this cost real time
previously.

## Project Context Management

After verification is complete, and only once the user confirms it works:

1. **docs/ISSUES.md** — delete Features #14 (name disambiguation) and #15
   (navigate-to-a-Field); both are resolved by this work. Check whether UI #3
   (value/metadata alignment) is affected by the path text.
2. **docs/SPECIFICATION.md** — record the canonical element address grammar, and
   that `→` reveals rather than re-roots.
3. **docs/IMPLEMENTATION.md** — add: why `revealedElementId` sits outside `ui`
   (ephemeral vs persisted), and why the reveal effect lives in the row rather than
   the transition (rows mount after the state is set; DOM handles can't be
   serialised).
4. **docs/LATER.md** — add deferred items found: parsing the canonical address,
   enforcing `allowedKinds`, and the mirror kind.
