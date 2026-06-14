# §4.5 Manifest Flag Cleanup

## Context

This is step 7 (final) of the `fable-code-audit-100626.md` refactor sequence — a warm-up for the
KINDS-SPECS registry generalization. The `KIND_REGISTRY` manifest seam (`src/kinds/`) already exists
and is the cleanest part of the codebase, but two per-kind `componentType` switches still live in the
dispatcher/UI layer instead of being owned by the manifest:

1. `DataField.tsx` compares `props.kind === 'single-image'` to suppress the label and pick a wrapper
   CSS class.
2. `DataFieldHistory.formatHistoryValue` re-implements value formatting with its own `switch (kind)`,
   which duplicates — and diverges from — what each kind already knows how to do. Today history shows
   naive `${value} ${units}` for number-kv while the live row (NumberKvField) shows fully-formatted
   values (decimals, affix position, currency, percent). They should agree.

Goal: every place the framework "learns a kind" routes through a manifest field, and value formatting
lives in exactly one place (`displayPreview`). Bullet 3 of §4.5 (TreeNodeConstruction's
`DEFAULT_FIELD_DEFINITION_IDS` seeds import) is **deferred** to LATER.md per decision — there's no
manifest home for default-field-set knowledge yet.

## Changes

### 1. Add manifest flags for label/layout (replaces `isImageVariant`)

**`src/kinds/types.ts`** — add two fields to `KindManifest`:
```ts
/** Suppress the dispatcher-rendered field label (e.g. single-image owns its own heading). */
hideLabel: boolean;
/** Value occupies a tall block rather than an inline run — pins the row chevron to the top. */
blockValueLayout: boolean;
```

**All four manifests** (`text-kv`, `enum-kv`, `number-kv`, `single-image` `.manifest.ts`) — add the
two booleans. Only `single-image` sets both `true`; the other three set both `false`.

**`src/components/DataField/DataField.tsx`**:
- Reuse a single `const manifest = getKindManifest(props.kind);` (line 56 already calls it for
  `displayPreview`).
- Delete `const isImageVariant = props.kind === 'single-image';` (line 58).
- Line 65: `manifest.blockValueLayout && styles.datafieldWrapperImage`.
- Line 82: `{!manifest.hideLabel && (<label …>)}`.
- Keep the CSS class name `datafieldWrapperImage` as-is (renaming is churn; it's just a class token).

### 2. Route history formatting through `displayPreview` (delete `formatHistoryValue`)

**Extract shared number formatting** — move `formatNumber` and `withAffix` (currently module-private
in `src/components/DataField/NumberKvField.tsx:38,75`) into the existing pure-logic module
`src/components/DataField/numberKvState.ts` and export them, plus a combined helper:
```ts
export function formatNumberKvDisplay(value: number, config: NumberKvConfig): string {
    return withAffix(formatNumber(value, config), config);
}
```
- `NumberKvField.tsx`: import these from `./numberKvState`, delete the local copies; line 234 becomes
  `formatNumberKvDisplay(currentValue.value, config)`.
- This keeps the live row's behavior identical and gives the manifest the same formatter.

**`src/kinds/types.ts`** — widen the signature (param is optional, so the other three manifests need
no change — a 1-arg function stays assignable):
```ts
displayPreview: (value: DataFieldValue | null, config?: FieldDefinitionConfig) => string | null;
```
(`FieldDefinitionConfig` is already imported in types.ts.)

**`src/kinds/number-kv.manifest.ts`** — use the shared formatter:
```ts
displayPreview: (v, config) =>
    v === null || v === undefined ? null
    : formatNumberKvDisplay(v as number, (config ?? {}) as NumberKvConfig),
```
`single-image`/`text-kv`/`enum-kv` `displayPreview` stay unchanged (single-image already returns
`caption ?? '[image]'` — history will now show captions, an intended consistency improvement).

**`src/components/DataFieldHistory/DataFieldHistory.tsx`**:
- Delete `formatHistoryValue` (lines 33-44) and `const units = props.units ?? '';` (line 60).
- Change props: replace `units?: string` with `config?: FieldDefinitionConfig`.
- Import `getKindManifest` from `../../kinds/registry` and `FieldDefinitionConfig` from models.
- Line 89: `const formatted = getKindManifest(props.kind).displayPreview(entry.newValue as DataFieldValue | null, props.config) ?? '';`
  (the `?? ''` preserves the `formatted !== ''` revert gate and the `formatted || <em>Empty</em>` fallback).

**`src/components/DataFieldDetails/DataFieldDetails.tsx`**:
- Remove the `units` computation (lines 91-93) and pass `config={definition.value?.config}` to
  `<DataFieldHistory>` instead of `units={units}`.
- Drop the now-unused `NumberKvConfig` import if nothing else uses it.

### Out of scope (noted, not changed)
- `DataField.tsx:56` `currentDisplayValue` is passed to `DataFieldDetails` as `currentValue` but never
  read there — pre-existing dead prop. Leave as-is; record as a LATER.md cleanup.
- TreeNodeConstruction `DEFAULT_FIELD_DEFINITION_IDS` → LATER.md (bullet 3).

## Critical files
- `src/kinds/types.ts`, `src/kinds/*.manifest.ts` (4 files)
- `src/components/DataField/DataField.tsx`
- `src/components/DataField/NumberKvField.tsx`, `src/components/DataField/numberKvState.ts`
- `src/components/DataFieldHistory/DataFieldHistory.tsx`
- `src/components/DataFieldDetails/DataFieldDetails.tsx`

## Tests
Add cases to `src/test/numberKvState.test.ts` for the extracted `formatNumberKvDisplay`:
decimals rounding, suffix vs prefix affix, percent (no doubled symbol), currency prefix default,
empty `unitsSymbol`. (Per project convention, Qwik components aren't unit-tested — this is the
testable logic.)

## Verification
1. `npm run typecheck` — the `satisfies Record<ComponentType, KindManifest>` clause forces every
   manifest to supply `hideLabel`/`blockValueLayout`; signature widening must compile.
2. `npm run test` — numberKvState suite (existing + new formatter cases).
3. `npm run dev` and manually (or via Chrome MCP):
   - number-kv field with `unitsSymbol` + non-default `decimals`/`displayFormat`: expand → open
     history → confirm history rows now render **identically** to the live row.
   - single-image field: confirm label still suppressed and image layout (chevron pinned top) intact;
     open its history → shows caption (or `[image]` when none).
   - text-kv / enum-kv: unchanged display and history.

## Project Context Management
After the user confirms it works:
1. **ISSUES.md** — mark §4.5 manifest-flag items (DataField + DataFieldHistory) done.
2. **IMPLEMENTATION.md** — note: `displayPreview` widened to `(value, config?)`; number formatting
   centralized in `numberKvState.formatNumberKvDisplay`, shared by NumberKvField and the manifest.
3. **LATER.md** — add: (a) §4.5 bullet 3 — move `DEFAULT_FIELD_DEFINITION_IDS` out of
   TreeNodeConstruction into manifests/registry (KINDS-SPECS follow-up); (b) remove dead
   `currentValue` prop on `DataFieldDetails` / `DataField.tsx:56`.
