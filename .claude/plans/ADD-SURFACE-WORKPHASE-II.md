# ADD-SURFACE-WORKPHASE-II — Authoring and Field Details

> Rename to `.claude/plans/ADD-SURFACE-WORKPHASE-II.md` on approval (plan mode
> assigns a generated name; the repo convention is `*-WORKPHASE-*`).

## Context

Phase I (`beeeceb`) restored adding a field: the Add Surface picks a Definition
from the Library and mints the DataField immediately. Two specced surfaces are
still missing, and they are the two that make the Library *grow* rather than
just be consumed:

- **Authoring a Definition** — the picker's `+ New Field Definition` row. Today
  the only authoring UI is `DefinitionAuthoringForm`, which lives inside the
  dormant composer and is unreachable. Without it a user can only pick from what
  is already there, which contradicts the Library's whole premise
  (SPEC → *the kinds of fact the app understands are grown by the people using
  it*).
- **Field Details** — still a metadata line, a history chevron and Delete. SPEC
  now specifies History / Config / Tools with the sections entailed by the kind,
  and it is the app's first surface to render a **delegated** value.

Phase II also settles two decisions parked during Phase I: ISSUES #8 (the
`mintVia: 'composer'` rename) and ISSUES #10 (how read-only config renders).

**Phase gate:** `typecheck`, `lint`, Vitest green, and a hand-test authoring a
Definition of each kind and using it in one motion.

## Strategy decisions

1. **Authoring reuses the pick path exactly.** `useDefinitionDraft.save()`
   already returns the new Definition, and Phase I's `pick()` already mints an
   instance from one. So commit is `const def = await save(); if (def) await
   pick(def)` — authoring and using become literally the same act, including
   the coalesced toast, rather than a parallel flow that resembles one.
2. **`ConfigForm` becomes an optional override** (confirmed). Presence means "this
   kind carries cross-field invariants a row list cannot express"; absence means
   the generic rows. That is exactly what SPEC claims, and it makes a new thin
   kind need no form at all.
3. **Read-only config renders via `displayPreview`** (confirmed), shared with the
   Phase I peek through one extracted component, so the two surfaces cannot
   drift. A `readOnly` prop on `FieldRendererProps` is what the arbiter's
   override work will force later; it buys nothing Phase 1 can use.
4. **Field Details sections are a data-driven list.** Stacking is deliberately
   unsettled (SPEC → *Stacking is open*), so the arrangement must be cheap to
   change — one array, not three nested components.
5. **Nothing is deleted.** The composer stack stays dormant and intact
   (ISSUES #11). Where Phase II supersedes a form, the old one is left in place
   and simply stops being referenced by its manifest.

## Steps

### 1. `mintVia: 'composer'` → `'add-surface'` (ISSUES #8) — commit

Mechanical, first, so the rest of the phase reads in the right vocabulary. The
value appears in `types.ts` (`MintVia`), `mintVia.ts` (six kinds), the six
manifests themselves, `registry.ts` (`FIELD_KINDS` filter), `capabilities.ts`
(`kindsMintedVia('composer')` → `FIELD_CHILD_KINDS`), and one LATER.md mention.
The dev-boot mirror check in `registry.ts` catches any miss immediately.

### 2. `ConfigSummary` — extract the read-only rows — commit

Lift `ConfigPeek` out of `LibraryPicker.tsx` into
`src/components/ConfigSummary/ConfigSummary.tsx`, unchanged in behaviour:
`useElementChildren(() => definitionId, 'fields')`, one row per sub-field,
value via `getInlineManifest(kind).displayPreview(value)`.

It takes an optional `source?: string` for the Definition's name, rendered as
the provenance chip Field Details needs (the picker passes nothing — inside a
Definition's own row the source is obvious). `LibraryPicker` imports it; the CSS
moves with it.

### 3. `ConfigDraftForm` — the generic authoring rows

New `src/components/ConfigDraftForm/ConfigDraftForm.tsx`: schema-driven editable
rows, the default authoring UI.

- Reads `CONFIG_SCHEMAS[kind]` (`configSchema.ts`, already component-free) and
  renders one row per `ConfigSubField`, bound to `useDefinitionDraft`'s **flat
  config object** — not to Elements. Nothing exists to parent a sub-field
  Element to until the Definition commits; `serializeConfig` builds the subtree
  at commit time as it already does.
- Control per `sub.kind`: `flag` → checkbox, `number-kv` → number input,
  `text-kv` → text input, `enum-kv` → `<select>` over `sub.options`. `compound`
  and `string-list` are **not** reachable here — they appear only in the two
  schemas that keep a ConfigForm — so they get an explicit "not authorable
  generically" guard rather than a silent fallthrough.
- Emits through the existing `ConfigFormProps` shape (`onChange(cfg, error)`) so
  it is a drop-in wherever a ConfigForm was.

### 4. Make `ConfigForm` optional

- `types.ts`: `InlineManifest.ConfigForm` required → optional.
- `registry.ts`: split the authoring contract. `defaultConfig` is always
  required, so `getDefinitionAuthoring` must stop returning `null` when only
  `ConfigForm` is absent — today it gates on both, which would make
  `defaultConfigFor` throw for every generic kind (`useDefinitionDraft.ts:28`).
  Return `{ defaultConfig, configSchema, ConfigForm?: … }`.
- Drop `ConfigForm` from `text-kv.manifest.ts` and `single-image.manifest.ts`.
  **The two form files stay on disk**, unreferenced, per ISSUES #11's posture.
- `number-kv` and `enum-kv` keep theirs — the threshold chain and
  `default ∈ options` are the invariants that earn an override.

### 5. The authoring row in the Add Surface

`LibraryPicker` gains a first row, `+ New Field Definition`, expanding in place
into `src/components/AddFieldSurface/DefinitionAuthoring.tsx`:

- Kind segmented control over `FIELD_KINDS`, label input (max 50), then either
  the kind's `ConfigForm` or `ConfigDraftForm` — chosen by presence, via
  `<Dynamic>`. `DefinitionAuthoringForm.tsx` is the reference for the
  segmented-control and `<Dynamic>` wiring; **read it, don't import it** (it
  belongs to the dormant surface).
- State is `useDefinitionDraft` unchanged — already ephemeral, already not
  persisted, which is what SPEC calls for.
- Commit → `save()` then the existing `pick()`. Dismiss → `cancel()`, nothing
  written.
- The row is a `treeitem` like the others, so roving focus covers it for free.

### 6. Field Details → History / Config / Tools

Rewrite `DataFieldDetails.tsx` around a **section list**, each entry
`{ id, present, collapsible, render }`:

| Section | Present when | Default |
| --- | --- | --- |
| History | the kind stores a value — `caps.ownValue \|\| caps.edges` | open, not collapsible |
| Config | `CONFIG_SCHEMAS[kind]` is non-empty | collapsed, own chevron |
| Tools | always | collapsed, own chevron |

- **History always-open is the working default** (your "1+2 inside of 1"), which
  changes today's behaviour: the chevron currently gates it and is disabled
  below two entries. Empty history renders "No changes yet" rather than a dead
  control. Swapping any section to collapsible is a one-line edit in the list —
  that is the point of the list.
- **Config** renders `ConfigSummary` with `source={definition()?.label}`, inert,
  and the section's docblock must say *why* (delegated; the override is the
  arbiter's job — SPEC → Field Details), or the next reader will "fix" it.
- **Tools** holds the existing Delete.
- The `caps` read must come from `childrenPolicy`/`capabilities` (component-free),
  never by importing a manifest into anything test-reachable.
- Config genuinely discriminates today: `internal-link` and `external-link` have
  no `configSchema`, so they show two sections, not three.

### 7. Verification battery, then commit

## Verification

1. `npm run typecheck`, `npm run lint`, `npm run test` → green. Canaries:
   `kindCoherence`, `placement`, `nodeLikeKinds`, `configElements` (step 1 touches
   the mirrors those assert on).
2. **Dev boot** (`npm run dev`, offline or `?emulator=true` — never production
   Firestore):
   - `+ New Field Definition` is the picker's first row and reachable by arrow keys.
   - Author a **text-kv** — generic rows (max length, multiline checkbox,
     placeholder, max words). Save → the Definition appears *and* an unfilled
     field of it lands on the card in one motion, with the usual toast.
   - Author a **number-kv** — the rich ConfigForm, threshold chain validated,
     Save blocked while a chain is broken.
   - Author an **enum-kv** — options list, and the default select constrained to
     the options entered.
   - Dismiss mid-authoring → nothing written; reopen → a clean draft.
   - Expand a field's details: History open with entries, Config collapsed and
     inert with the Definition named as source, Tools holding Delete.
   - Expand an `external-link` field → **no Config section at all**, not an empty one.
3. **Regression:** the Phase I flows still work — pick, multi-pick coalescing,
   the config peek, Escape, roving focus.
4. Cypress `core-loop.cy.ts` still green.

## Out of scope

Reordering, the cascade arbiter (and therefore *editable* config on an
instance), the tree switcher / Library view, and Definition editing —
authoring only ever adds (SPEC → Edit / Delete Semantics).

## Project Context Management

After the coding work is believed complete, ask the user to run the Verification
steps. **Only if the user confirms it works:**

1. **docs/ISSUES.md** — delete #8 (`mintVia` rename, done in step 1) and #10
   (read-only config, decided and built). Renumber.
2. **docs/IMPLEMENTATION.md** — notes in the bulleted voice: `ConfigForm` as an
   optional override and what earns one; the draft-bound generic rows vs
   Element-bound config, and why authoring cannot use Elements; the Field
   Details section list and that stacking is deliberately swappable.
3. **docs/SPECIFICATION.md** — if the hand-test settles *Stacking is open*,
   replace that subsection with the decision. That is the one spec edit Phase II
   is expected to earn.
4. **docs/LATER.md** — whatever the hand-test defers.
