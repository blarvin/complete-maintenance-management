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
// DataField Component / FieldDefinition / Instance
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
 * Union of FieldDefinition configs, discriminated externally by FieldDefinition.kind.
 * Narrow on `definition.kind === "text-kv"` etc. before accessing config.
 */
export type FieldDefinitionConfig =
  | TextKvConfig
  | EnumKvConfig
  | NumberKvConfig
  | SingleImageConfig;

// Per-Component value shapes (a DataField's `value` is one of these, or null)
export type TextKvValue = string;
export type EnumKvValue = string;
export type NumberKvValue = number;
export type SingleImageValue = {
  blobId: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  caption?: string;
};

/**
 * Union of DataField value types, discriminated by Element.kind.
 */
export type DataFieldValue =
  | TextKvValue
  | EnumKvValue
  | NumberKvValue
  | SingleImageValue;

/**
 * FieldDefinition: a Library entry naming a fully-configured field kind.
 * Persisted form of "what kind of field this is."
 *
 * `authorId` carries the user (or `"appDeveloper"` for seeds) that created the
 * row; `deletedAt` is admin-only soft-delete (no end-user UI in Phase 1, but
 * the field exists for forward compatibility and admin tombstones).
 */
export type FieldDefinition = {
  id: ID;
  kind: Kind;
  label: string;
  config: FieldDefinitionConfig;
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
 * Unified primitive replacing TreeNode + DataField. Phase 1 columns only.
 * - `name` is required (max 100 chars), stays denormalized for header hot path.
 * - `subtitle` is node-scoped Phase 1 (demotion to child element deferred).
 * - `value` is null for `kind === "node"`; typed by `kind` otherwise.
 * - `siblingOrder` is uniform across all children; renumber-the-run on insert.
 * - `fieldDefinitionId` is null for nodes.
 */
export type Element = {
  id: ID;
  kind: Kind;
  name: string;
  subtitle: string | null;
  value: DataFieldValue | null;
  parentId: ID | null;
  siblingOrder: number;
  fieldDefinitionId: ID | null;
  updatedBy: UserId;
  updatedAt: number;
  deletedAt: number | null;
};

/**
 * Unified history log replacing dataFieldHistory. Captures structural changes
 * (name, subtitle, parentId, siblingOrder) in addition to value edits.
 *
 * Primary key: `${elementId}:${rev}`.
 */
export type ElementHistoryProperty =
  | "value"
  | "name"
  | "subtitle"
  | "parentId"
  | "siblingOrder";

export type ElementHistory = {
  id: string; // `${elementId}:${rev}`
  elementId: ID;
  rev: number; // monotonic per elementId, start 0 on create
  action: "create" | "update" | "delete";
  property: ElementHistoryProperty;
  prevValue: unknown;
  newValue: unknown;
  updatedBy: UserId;
  updatedAt: number;
};
