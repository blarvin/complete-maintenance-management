// Type-only import: erased at runtime, so no `models → registry` cycle. Used
// solely to derive the kind vocabulary from KIND_REGISTRY's keys below.
import type { KIND_REGISTRY } from '../kinds/registry';

export type ID = string;

/**
 * User ID type - currently constant, will be dynamic with auth
 */
export type UserId = string;

/**
 * Shared soft delete capability for entities that support soft deletion.
 * When deletedAt is set (non-null), the entity is considered deleted.
 */
export type SoftDeletable = {
  deletedAt: number | null;
};

// ============================================================================
// DataField Component / Definition / Instance
// ============================================================================

// Per-Component config shapes
export type TextKvConfig = {
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  /** When set, save rejects values whose word count exceeds this limit. */
  maxWords?: number;
};

export type EnumKvConfig = {
  options: string[];
  allowOther?: boolean;
  default?: string;
};

export type NumberKvAffixPosition = "prefix" | "suffix";
export type NumberKvDisplayFormat =
  | "decimal"
  | "scientific"
  | "engineering"
  | "percent"
  | "currency";
export type NumberKvNominalMode = "range" | "discrete";

/**
 * Configuration for `number-kv`. See SPEC §FieldComponent: number-kv for the
 * authoritative knob list and config invariants.
 *
 * Invariants enforced at authoring time by `validateNumberKvConfig`:
 *  - Range mode: LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH (provided subset).
 *  - Discrete mode: LL ≤ L ≤ (nominalValue − tolerance) AND
 *    (nominalValue + tolerance) ≤ H ≤ HH. tolerance ≥ 0.
 *  - decimals ≥ 0. expectedRefreshSeconds > 0 if set.
 *  - displayFormat === "currency" ⇒ currencyCode non-empty.
 */
export type NumberKvConfig = {
  unitsSymbol?: string;
  unitsLongForm?: string;
  affixPosition?: NumberKvAffixPosition; // default "suffix"
  decimals?: number; // default 2
  displayFormat?: NumberKvDisplayFormat; // default "decimal"
  currencyCode?: string; // required iff displayFormat === "currency"
  nominalMode?: NumberKvNominalMode; // default "range"
  nominalMin?: number; // range mode
  nominalMax?: number; // range mode
  nominalValue?: number; // discrete mode
  tolerance?: number; // discrete mode, ≥ 0
  low?: number; // L
  lowLow?: number; // LL
  high?: number; // H
  highHigh?: number; // HH
  /** Canonical seconds. If set, values older than this go stale on display. */
  expectedRefreshSeconds?: number;
};

export type SingleImageConfig = {
  maxSizeMB?: number;
  requireCaption?: boolean;
  aspectHint?: string;
};

/**
 * Policy config for the `logbook` container — the first re-root Definition
 * (the binding seam's forcing kind). Both knobs are lens-surface policy, not
 * field-value config.
 */
export type LogbookConfig = {
  /** The word for one new entry (the LensCreate/LensRollup label), e.g. "Entry".
   *  Replaces the targetKind pickerLabel reads when bound. */
  entryLabel?: string;
  /** Canonical seconds. If set (> 0), a rollup whose newest entry is older
   *  than this renders a stale indicator. Absent/0 = never stale. */
  staleness?: number;
};

/**
 * Union of Definition configs, discriminated externally by Definition.kind.
 * Narrow on `definition.kind === "text-kv"` etc. before accessing config.
 */
export type DefinitionConfig =
  | TextKvConfig
  | EnumKvConfig
  | NumberKvConfig
  | SingleImageConfig
  | LogbookConfig;

// Per-Component value shapes (a DataField's `value` is one of these, or null)
export type TextKvValue = string;
export type EnumKvValue = string;
export type NumberKvValue = number;
/** internal-link: an internal Edge — the value is the target Element's id (resolved live). */
export type InternalLinkValue = { targetId: string };
/** external-link: an external Edge — the value is a stored URL, never resolved. */
export type ExternalLinkValue = { url: string };
export type SingleImageValue = {
  blobId: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  caption?: string;
};

// Config sub-field value shapes (config-as-Elements). These kinds back the
// `library`-tree config subtree; in Phase 1 they only ever exist as config
// sub-fields (see `flag` / `compound` / `string-list` manifests), never as
// standalone Data Card rows.
export type FlagValue = boolean;
export type StringListValue = string[];
/** A small atomic co-varying object — the one object-valued config residue
 *  (e.g. number-kv thresholds `{lowLow, low, high, highHigh}`). */
export type CompoundValue = { [k: string]: number };

/**
 * Type-level kind → value map over every registry kind. Re-root (node-like)
 * kinds bear no own value → `never`, so they vanish from the derived union.
 * Hand-declared rather than derived from the manifests (they import
 * DataFieldValue — circular); the indexed access at `DataFieldValue` is the
 * enforcement: a kind added to KIND_REGISTRY without an entry here is a
 * compile error.
 */
export type KindValueMap = {
  'text-kv': TextKvValue;
  'enum-kv': EnumKvValue;
  'number-kv': NumberKvValue;
  'single-image': SingleImageValue;
  'internal-link': InternalLinkValue;
  'external-link': ExternalLinkValue;
  flag: FlagValue;
  compound: CompoundValue;
  'string-list': StringListValue;
  // re-root kinds: no own value
  node: never;
  org: never;
  job: never;
  jobs: never;
  'log-entry': never;
  logbook: never;
  library: never;
  definitions: never;
  kinds: never;
};

/**
 * Union of DataField value types, discriminated by Element.kind — derived from
 * the registry via KindValueMap (never-valued re-root kinds drop out).
 */
export type DataFieldValue = KindValueMap[Kind];

/**
 * Definition: a Library entry naming a fully-configured field kind.
 *
 * This is an **assembled read-model view**, no longer a stored row. A Definition
 * lives as a `library`-tree `Element` (`kind` = the kind it defines, `name` = the
 * label) whose config **is** its child sub-field Element subtree (see
 * `src/kinds/configElements.ts` and SPEC → Config is Elements). `config` here is
 * assembled on read from those children — there is no persisted config blob.
 *
 * `authorId` mirrors the Definition Element's `updatedBy` (`"appDeveloper"` for
 * seeds); `deletedAt` is admin-only soft-delete (no end-user UI in Phase 1).
 */
export type Definition = {
  id: ID;
  kind: Kind;
  label: string;
  config: DefinitionConfig;
  authorId: UserId;
  updatedBy: UserId;
  updatedAt: number;
  deletedAt: number | null;
};

// ============================================================================
// Soft Delete Helper Functions
// ============================================================================

export function isSoftDeleted(entity: SoftDeletable): boolean {
  return entity.deletedAt !== null;
}

export function filterActive<T extends SoftDeletable>(entities: T[]): T[] {
  return entities.filter(e => e.deletedAt === null);
}

export function filterDeleted<T extends SoftDeletable>(entities: T[]): T[] {
  return entities.filter(e => e.deletedAt !== null);
}

// ============================================================================
// Value presence
// ============================================================================

/**
 * Whether a field-like Element holds no value yet — the `isUnfilled` state
 * (SPEC → DataField States).
 *
 * **Derived, never stored.** An unfilled field is a *recorded intention* ("this
 * pump has a serial number; nobody has read the plate yet"), not an unfinished
 * form, so it is read off the value rather than tracked — it resolves the moment
 * a value lands and returns if one is cleared.
 *
 * `''` counts alongside `null`: `parseText` writes `null` for a blank
 * (`TextKvField.tsx`), but an empty string can still arrive from a sync pull or
 * an older row, and an empty-string field is just as unfilled to a reader.
 * Single definition on purpose — nothing else may re-derive this.
 */
export function isUnfilled(value: DataFieldValue | null | undefined): boolean {
  return value === null || value === undefined || value === '';
}

// ============================================================================
// History
// ============================================================================

// ============================================================================
// Unified Element Model (in-progress refactor — see plan: unified-element-data-model)
// ============================================================================

/**
 * Element kind. Derived from KIND_REGISTRY's keys, so a kind can never drift from
 * its manifest and adding a manifest widens this union automatically. `"node"` is
 * the container kind (no value, `placement: re-root`); the rest are value-bearing
 * field kinds. There is no privileged kind — `node` registers like any other.
 */
export type Kind = keyof typeof KIND_REGISTRY;

/**
 * Which tree an Element belongs to (SPEC → Populations are typed trees). The axis
 * routes sync / history / visibility per tree via `src/data/treePolicy.ts`:
 *  - `business`   — the navigable asset tree (shared sync, business history)
 *  - `library`    — Definitions + their config subtree (shared sync, Library history)
 *  - `config`     — org/role/user prefs (shared-or-per-user sync, overlay history)
 *  - `view-state` — per-viewer expansion/ordering overlays (never synced, no history)
 *
 * `config` and `view-state` have no Phase-1 producers yet (view-state lives in
 * `uiPrefs` localStorage; config needs the cascade arbiter), so the values exist
 * to make the policy table and the `effectiveChildren` read chokepoint complete
 * ahead of those consumers. Per-viewer overlay merge is deferred (see LATER.md).
 */
export type TreeType = 'business' | 'library' | 'config' | 'view-state';

/**
 * Unified primitive replacing TreeNode + DataField. Phase 1 columns only.
 * - `name` is required (max 100 chars), stays denormalized for header hot path.
 * - `subtitle` is node-scoped Phase 1 (demotion to child element deferred).
 * - `value` is null for re-root (node-like) kinds; typed by `kind` otherwise.
 * - `siblingOrder` is uniform across all children; renumber-the-run on insert.
 * - `definitionId` binds the instance to its Definition. Inline kinds require
 *   it; re-root kinds may carry one (policy containers, e.g. logbook) or null
 *   (leaf re-roots: node, job) — "not yet", not "can't carry".
 * - `treeType` partitions business vs library; root/sibling queries scope by it.
 */
export type Element = {
  id: ID;
  kind: Kind;
  name: string;
  subtitle: string | null;
  value: DataFieldValue | null;
  parentId: ID | null;
  siblingOrder: number;
  definitionId: ID | null;
  treeType: TreeType;
  updatedBy: UserId;
  updatedAt: number;
  deletedAt: number | null;
};

/**
 * Unified history log replacing dataFieldHistory. Captures structural changes
 * (name, subtitle, parentId, siblingOrder) in addition to value edits.
 *
 * Primary key: `${elementId}:${rev}:${random}`. Append-only and never updated
 * in place, so unique ids make the log a grow-only set — two clients merge by
 * union, with no coordination and nothing overwritten (IMPLEMENTATION.md →
 * *History ID Scheme*).
 * Order for display is `compareHistory` in `storage/historyHelpers.ts`; `rev`
 * on its own is only a per-client sequence.
 */
export type ElementHistoryProperty =
  | "value"
  | "name"
  | "subtitle"
  | "parentId"
  | "siblingOrder";

export type ElementHistory = {
  id: string; // `${elementId}:${rev}:${random}` — the tail is what makes appends converge
  elementId: ID;
  rev: number; // per-client sequence, start 0 on create. NOT unique across clients
  action: "create" | "update" | "delete";
  property: ElementHistoryProperty;
  prevValue: unknown;
  newValue: unknown;
  updatedBy: UserId;
  updatedAt: number;
};
