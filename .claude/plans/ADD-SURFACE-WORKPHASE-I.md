# ADD-SURFACE-WORKPHASE-I — The Add Surface, alongside

> Rename this file to `.claude/plans/ADD-SURFACE-WORKPHASE-I.md` on approval
> (plan mode assigned the generated name; the repo convention is
> `SOLIDJS-WORKPHASE-*`).

## Context

`ENABLED_ADD_FIELD_SURFACES` is empty (`6cea187`), so **there is currently no way
to add a field to an existing node.** Both legacy surfaces — the `FieldComposer`
checkbox batch and the single-pick `CreateDataField` dropdown — were scaffolding
that existed to get the data model and registry rebuilt, and were switched off
rather than deleted.

`cf3ada9` specced the replacement: **The Add Surface** (SPECIFICATION.md), a
tree-native picker where choosing a Definition mints the DataField immediately,
unfilled, with no batch, no Save and no preview. `674bbbe` cleared its one
blocker (real renderers for the config-only kinds). `71a4788` set the build
order: ship the new surface as a **third roster entry** so all three can be
compared in the running app, and delete the losers last.

**Phase I restores the missing capability and nothing more.** Authoring a new
Definition and the Field Details restructure are Phase II; deleting the composer
stack is Phase III. The SPEC is the spine — this plan does not restate it, and
where the two disagree the SPEC wins.

**Phase gate:** `typecheck` clean, `lint` clean, Vitest green (485 + new), and a
hand-test confirming a field can be added, multi-picked, and undone.

## Strategy decisions

1. **Third roster entry, not a replacement.** `addFieldSurfaces.ts:17-21` already
   documents the four steps and owns the `activeSurface` mutex, so the new
   surface coexists with `composer` and `legacy` and only one opens at a time.
   Ship Phase I with all three enabled — that A/B *is* the point; narrowing the
   roster is Phase III's job.
2. **Read-only config peek, no editing anywhere.** Phase I picks and mints. Every
   config sub-field is `delegated`, and the renderers landed in `674bbbe` are
   read-only by design (SPEC → Field Details).
3. **Coalescing belongs in the service, not the caller.** Emulating it by
   re-`show()`ing accumulated messages works until you ask what clears the batch,
   and the answer entangles with `onExpire`. One `coalesceKey` on `ToastInput`
   states the rule once (below).
4. **Component-free reads stay component-free.** The entailment gate reads
   `allowedChildKinds` (`childrenPolicy.ts`, already `KIND_CAPABILITIES`-backed);
   only the component may touch `FIELD_KINDS` from `registry.ts`, which pulls
   `.tsx`. No test may import either (testing-conventions).
5. **No new edit lifecycle.** Nothing in Phase I calls `useFieldEdit`. Minted
   fields are edited by the existing double-tap path, unchanged.

## Steps

### 1. Snackbar: add coalescing — commit

**Corrected during implementation.** The plan originally paired this with a fix
to replace semantics, on the claim that dropping the prior toast's `onExpire`
loses deferred delete-history rows. Both halves of that were wrong:

- **`onExpire` has no callers anywhere in `src/`.** `commitWithUndo` never passes
  one, so the deferral the SPEC describes is a seam with no consumer and the
  replace behaviour is currently moot in practice.
- **Delete history is written immediately**, not deferred —
  `IDBAdapter.softDeleteElement` writes the `action: 'delete'` row inline
  (`IDBAdapter.ts:402`). Nothing is lost on replace.

So `index.ts:53` is left alone: it is deliberate, it is locked by
`snackbarService.test.ts:75`, and reversing a tested decision to fix a
non-existent bug would be strictly worse. The real drift runs the other way and
is filed, not fixed here (see Project Context Management).

**The change is just `coalesceKey`.** `ToastInput` gains `coalesceKey?: string`,
carried onto `ActiveToast`. In `show()`: if the key is non-null and matches the
visible toast's, this is an **extension** — keep the toast id, swap message and
action, restart the timer. Everything else stays a replacement, unchanged.

Preserving the id is the whole point: `SnackbarHost` renders `<Show keyed>`, so a
plain re-`show()` remounts and re-animates the toast on *every* pick. Caller-side
accumulation would work but would flicker, and would leave SPEC → *Coalescing*
describing a behaviour the service doesn't have.

Extend `src/test/snackbarService.test.ts`: same-key extension preserves the id and
swaps the message; a different key (or no key) still replaces and increments;
extension restarts the timer. Leave the existing replacement test as-is.

### 2. Roster + entailment gate — commit

- `addFieldSurfaces.ts`: add `'add-surface'` to `AddFieldSurfaceId`.
- `constants.ts`: `ENABLED_ADD_FIELD_SURFACES = ['add-surface', 'composer', 'legacy']`,
  with a comment that the roster narrows to one in Phase III.
- `FieldList.tsx` takes a new `kind: Kind` prop (`TreeNodeDisplay.tsx:127` already
  holds `props.kind`; pass it rather than re-reading the element) and computes
  `allowedChildKinds(props.kind).filter(k => FIELD_KINDS.includes(k))`. Render
  the new surface only when that is non-empty **and** the roster includes it.
  **Verify first** that `node`'s allowlist actually contains the field kinds
  (`capabilities.ts` → `FIELD_CHILD_KINDS` / `CONTAINER_CHILD_KINDS`); if the gate
  computes empty for `node`, the bug is in the reading, not the allowlist.

### 3. `AddFieldSurface` — the collapsed row

New `src/components/AddFieldSurface/AddFieldSurface.tsx` + `.module.css`.

Model the mutex wiring on `CreateDataField.tsx:33-49` — open iff
`activeSurface() === 'add-surface'`, toggle writes its own id or `'none'`. Escape
closes and returns focus to the button. Collapsed it is one quiet `+ Add Field`
row beneath the persisted fields (the lens create row, `LensCreate.tsx`, is the
visual precedent — a button that becomes its own surface in place).

Owns the pick-batch state: an array of minted element ids, and the sibling-order
counter (step 5).

### 4. `LibraryPicker` — the rows

New `src/components/AddFieldSurface/LibraryPicker.tsx`.

- Definitions via `getDefinitionQueries().listDefinitions()` in a `createResource`,
  reusing `CreateDataField`'s `FAILED` sentinel idiom (`createResource` has no
  rejected branch) and its `isInline(d.kind)` filter, plus the admitted-kinds
  filter from step 2. Sort by `label`.
- Each row: a chevron that expands the **config peek**, and the name, which picks.
- **Peek data comes from the Definition's children**, not from `def.config` —
  config *is* Elements, so the peek reads the subtree.
  `useElementChildren(() => def.id, 'fields')` on the expanded row only; an
  unexpanded row issues no query. Borrow the disclosure shape from
  `NavigableRow.tsx`.
- **Corrected during implementation: values are drawn with `displayPreview`, not
  with each kind's `Renderer`.** A Renderer *is* the editable surface — mounting
  `TextKvField` for a Definition's `placeholder` would make it double-tap
  editable inside a picker, which is wrong for a peek and wrong for Phase 1
  (config is delegated and read-only until the arbiter). `displayPreview` is
  read-only by construction and already exists for exactly this.
  **Phase II inherits this problem**: SPEC → Field Details says the Config
  section draws rows "by their own kinds' Renderers", which has the same
  editability hole for the `text-kv`/`number-kv`/`enum-kv` sub-fields. Phase II
  needs either a `readOnly` prop on `FieldRendererProps` or the same
  `displayPreview` treatment — decide it there, not here. (The config-only
  renderers from `674bbbe` are unaffected: they have no edit path, and their
  formatters are what `displayPreview` calls.)
- Empty Library → the picker still offers its (Phase II) authoring row; until then
  say so rather than rendering nothing.

### 5. Mint on pick

In `AddFieldSurface`, per pick:

```
commitWithUndo({
  execute: () => bus.execute({ type: 'CREATE_ELEMENT_FROM_DEFINITION',
                               payload: { parentId, definitionId, siblingOrder } }),
  undo:    () => /* DELETE_ELEMENT for every id in the batch */,
  message: () => n === 1 ? 'Field added' : `${n} fields added`,
})
```
passed `coalesceKey: 'field-added'` from step 1.

Two things to get right:

- **`siblingOrder` must not be re-derived per pick.** `FieldList` computes
  `maxPersistedCardOrder` from `fields()`, which reloads asynchronously off the
  storage bus — two quick picks would both read the same max and collide. Seed a
  local counter from the max when the picker opens and increment it per pick.
- **`undo` needs the new element id** — resolved: `CommandResultMap` types
  `CREATE_ELEMENT_FROM_DEFINITION: Element` (`commands/types.ts:17`), so
  `commitWithUndo` already threads the created Element into `undo`. No fix needed;
  accumulate `result.id` per pick.
- The picker stays open across picks. **No autofocus on the minted row** (SPEC → it
  does not take focus, and multi-pick is why).

### 6. `isUnfilled` — the derived visual state

`DataField.tsx` adds a wrapper class when the value is absent, and
`DataField.module.css` renders it de-emphasised (muted label, placeholder rule
where the value sits — *not* a colour; SPEC → Style Guide).

Absence is `value === null` **or** `''` — `parseText` (`TextKvField.tsx:34`) writes
`null` for a blank, but a cleared value arriving from elsewhere may be `''`. Put
the predicate in one place; nothing else may re-derive it.

### 7. Keyboard model

Roving focus inside the picker, per SPEC → Keyboard: ArrowUp/Down move between
Definition rows, Enter picks, ArrowRight/Left expand and collapse the peek,
Escape dismisses and restores focus to the `+ Add Field` button. One `tabindex=0`
row at a time, the rest `-1`. This is genuinely new — the legacy dropdown had only
ArrowDown/Enter/Escape — and it is a gate, not a follow-up, because accessibility
is a stated quality bar (SPEC → Keyboard & Accessibility).

### 8. Verification battery, then commit

## Verification

1. `npm run typecheck`, `npm run lint` → clean.
2. `npm run test` → green. Canaries: `snackbarService.test.ts` (step 1),
   `configValueFormat.test.ts`, `kindCoherence`/`placement`/`nodeLikeKinds`.
3. **Dev boot** (`npm run dev`, offline or `?emulator=true` — never production
   Firestore, per DEVELOPING.md):
   - A node's card shows `+ Add Field`; expanding lists the seeded Definitions
     alphabetically.
   - A row's chevron reveals its config read-only — check `Description`
     (`multiline → Yes`), `Status` (`options → In Service, Maintenance, Retired`),
     and a `number-kv` (thresholds as `lowLow=…`, not JSON).
   - Picking mints the field immediately, in place, unfilled and de-emphasised.
     The picker stays open; focus does not jump.
   - Pick three in a row → one toast reading `3 fields added`; Undo removes **all
     three**. Pick one → `Field added`; Undo removes it.
   - Reload mid-pick: everything picked is still there.
   - Double-tap a minted field and enter a value — the ordinary edit path, and the
     unfilled styling resolves.
4. **Coalescing:** pick three fields, then let the toast expire without undoing —
   confirm it did not re-animate between picks, and that all three fields remain.
5. **A/B:** with all three roster entries live, confirm the mutex — opening any one
   closes the others — and compare the flows.
6. **Keyboard:** reach `+ Add Field` by Tab, open with Enter, traverse rows with
   arrows, expand a peek, pick with Enter, dismiss with Escape, and confirm focus
   returns to the button. No mouse.
7. Cypress: `core-loop.cy.ts` still green (it runs on `Description`, a construction
   default, and does not touch an add surface).

## Out of scope

Authoring a Definition, Field Details as History/Config/Tools, reordering, and
the `mintVia: 'composer'` rename (ISSUES #8) — Phase II.

**There is no Phase III.** The plan originally ended by deleting the composer
stack; that is now a standing option rather than a scheduled step (ISSUES #11).
The surfaces are dormant and restorable, and nothing about Phase I obliges
removing them.

## Project Context Management

After the coding work is believed complete, ask the user to run the Verification
steps above (especially §3 dev boot and §4 the audit regression). **Only if the
user confirms it works:**

1. **docs/ISSUES.md** — delete Tech Debt #9 (Snackbar coalescing, done in step 1);
   its description of current `onExpire`-on-replace behaviour is wrong and should
   not be inherited. **File the drift found while doing it:** SPEC → Undo
   semantics §233 says a delete's history row is deferred via `onExpire` "so that
   undone deletes leave no audit trace", but `onExpire` has no callers and
   `IDBAdapter.softDeleteElement` writes the row inline — so an **undone delete
   leaves a `delete` history row today**, the opposite of what the SPEC promises.
   Decide there whether the SPEC or the code is right; the deferral is real work
   (it needs `commitWithUndo` to pass an `onExpire` and the adapter to split the
   write), so this is a decision, not a mop-up.
2. **docs/IMPLEMENTATION.md** — short notes in the existing bulleted voice: the
   `coalesceKey` extension-vs-replacement rule and why the two cannot share a
   branch; the local sibling-order counter and the async-reload race it avoids;
   the entailment gate as the first `allowedChildKinds ∩ FIELD_KINDS` consumer.
3. **docs/LATER.md** — add whatever the hand-test defers (likely candidates: the
   peek's per-row query cost if a large Library drags, and picker discovery UX if
   the flat list already feels long).
4. **docs/SPECIFICATION.md** — only if the build contradicts it. The SPEC is the
   spine here; a divergence is a spec bug to fix, not a note to append.
