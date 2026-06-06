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

export type TreeNode = {
  id: ID;
  nodeName: string;
  nodeSubtitle?: string;
  parentId: ID | null;
  updatedBy: UserId;
  updatedAt: number; // epoch ms
  deletedAt: number | null; // soft delete timestamp, null = active
};

// ============================================================================
// DataField Component / FieldDefinition / Instance
// ============================================================================

/**
 * Component type discriminator. Phase 1 Components per SPEC.
 */
export type ComponentType = "text-kv" | "enum-kv" | "number-kv" | "single-image";

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
 * Union of FieldDefinition configs, discriminated externally by FieldDefinition.componentType.
 * Narrow on `definition.componentType === "text-kv"` etc. before accessing config.
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
 * Union of DataField value types, discriminated by DataField.componentType.
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
  componentType: ComponentType;
  label: string;
  config: FieldDefinitionConfig;
  authorId: UserId;
  updatedBy: UserId;
  updatedAt: number;
  deletedAt: number | null;
};

/**
 * Instance of a FieldDefinition attached to a TreeNode. `fieldName` is
 * snapshotted from `FieldDefinition.label` at creation time so later
 * FieldDefinition label edits don't rewrite user-visible data.
 */
export type DataField = {
  id: ID;
  parentNodeId: ID;
  fieldDefinitionId: ID;
  componentType: ComponentType;
  fieldName: string;
  value: DataFieldValue | null;
  cardOrder: number;
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

type DataFieldHistoryShared = {
  id: string; // `${dataFieldId}:${rev}`
  dataFieldId: ID;
  parentNodeId: ID;
  action: "create" | "update" | "delete";
  property: "value";
  updatedBy: UserId;
  updatedAt: number;
  rev: number; // monotonic per dataFieldId, start 0 on create
};

export type TextKvHistory = DataFieldHistoryShared & {
  componentType: "text-kv";
  prevValue: TextKvValue | null;
  newValue: TextKvValue | null;
};

export type EnumKvHistory = DataFieldHistoryShared & {
  componentType: "enum-kv";
  prevValue: EnumKvValue | null;
  newValue: EnumKvValue | null;
};

export type NumberKvHistory = DataFieldHistoryShared & {
  componentType: "number-kv";
  prevValue: NumberKvValue | null;
  newValue: NumberKvValue | null;
};

export type SingleImageHistory = DataFieldHistoryShared & {
  componentType: "single-image";
  prevValue: SingleImageValue | null;
  newValue: SingleImageValue | null;
};

/**
 * Discriminated union on `componentType`. Per SPEC §Typed value fields.
 */
export type DataFieldHistory =
  | TextKvHistory
  | EnumKvHistory
  | NumberKvHistory
  | SingleImageHistory;

// ============================================================================
// Unified Element Model (in-progress refactor — see plan: unified-element-data-model)
// ============================================================================

/**
 * Element kind. `"node"` denotes a container (no value); the rest are
 * value-bearing kinds matching FieldDefinition componentTypes.
 */
export type Kind = "node" | ComponentType;

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

// ============================================================================
// View-model adapters (transition: UI still consumes TreeNode/DataField shapes)
// ============================================================================

/**
 * Project an Element with `kind === "node"` onto the legacy TreeNode shape so
 * existing components keep compiling while the data path migrates. Throws if
 * the element is a value-bearing kind.
 */
export function elementToTreeNode(e: Element): TreeNode {
  if (e.kind !== "node") {
    throw new Error(`elementToTreeNode: expected kind=node, got ${e.kind}`);
  }
  return {
    id: e.id,
    nodeName: e.name,
    nodeSubtitle: e.subtitle ?? "",
    parentId: e.parentId,
    updatedBy: e.updatedBy,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
  };
}

/**
 * Project a value-bearing Element onto the legacy DataField shape. Throws if
 * the element is a container node.
 */
export function elementToDataField(e: Element): DataField {
  if (e.kind === "node") {
    throw new Error(`elementToDataField: cannot project kind=node`);
  }
  if (!e.fieldDefinitionId) {
    throw new Error(`elementToDataField: element ${e.id} missing fieldDefinitionId`);
  }
  if (!e.parentId) {
    throw new Error(`elementToDataField: element ${e.id} has no parentId`);
  }
  return {
    id: e.id,
    parentNodeId: e.parentId,
    fieldDefinitionId: e.fieldDefinitionId,
    componentType: e.kind,
    fieldName: e.name,
    value: e.value,
    cardOrder: e.siblingOrder,
    updatedBy: e.updatedBy,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
  };
}
