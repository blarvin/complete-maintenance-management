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
// DataField Component / Template / Instance
// ============================================================================

/**
 * Component type discriminator. Phase 1 Components per SPEC.
 */
export type ComponentType = "text-kv" | "enum-kv" | "measurement-kv" | "single-image";

// Per-Component config shapes
export type TextKvConfig = {
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
};

export type EnumKvConfig = {
  options: string[];
  allowOther?: boolean;
  default?: string;
};

export type MeasurementKvConfig = {
  units: string;
  decimals?: number;
  nominalMin?: number;
  nominalMax?: number;
  warnLow?: number;
  warnHigh?: number;
  absoluteMin?: number;
  absoluteMax?: number;
};

export type SingleImageConfig = {
  maxSizeMB?: number;
  requireCaption?: boolean;
  aspectHint?: string;
};

/**
 * Union of Template configs, discriminated externally by Template.componentType.
 * Narrow on `template.componentType === "text-kv"` etc. before accessing config.
 */
export type DataFieldTemplateConfig =
  | TextKvConfig
  | EnumKvConfig
  | MeasurementKvConfig
  | SingleImageConfig;

// Per-Component value shapes (a DataField's `value` is one of these, or null)
export type TextKvValue = string;
export type EnumKvValue = string;
export type MeasurementKvValue = number;
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
  | MeasurementKvValue
  | SingleImageValue;

/**
 * Template for a DataField kind.
 */
export type DataFieldTemplate = {
  id: ID;
  componentType: ComponentType;
  label: string;
  config: DataFieldTemplateConfig;
  updatedBy: UserId;
  updatedAt: number;
};

/**
 * Instance of a Template attached to a TreeNode. `fieldName` is snapshotted
 * from `Template.label` at creation time so later Template label edits don't
 * rewrite user-visible data.
 */
export type DataField = {
  id: ID;
  parentNodeId: ID;
  templateId: ID;
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

export type MeasurementKvHistory = DataFieldHistoryShared & {
  componentType: "measurement-kv";
  prevValue: MeasurementKvValue | null;
  newValue: MeasurementKvValue | null;
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
  | MeasurementKvHistory
  | SingleImageHistory;
