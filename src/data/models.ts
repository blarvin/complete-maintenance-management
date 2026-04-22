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
 * Component type discriminator. Phase 1 ships only `text-kv`.
 * Future: `enum-kv`, `measurement-kv`, `single-image`, `composite-kv`, etc.
 */
export type ComponentType = "text-kv";

/**
 * Per-component config shape. Discriminated on `componentType` so future
 * variants can widen this union without breaking `text-kv` callers.
 */
export type TextKvConfig = {
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
};

export type DataFieldTemplateConfig = TextKvConfig;

/**
 * Template for a DataField kind. Seeding is intentionally skipped in this
 * plan; templates are written only by the follow-up SPEC templates plan.
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
 * Typed value of a DataField. Phase 1 only has string (text-kv).
 * Future components widen this union.
 */
export type DataFieldValue = string;

/**
 * Instance of a Template attached to a TreeNode. `fieldName` is snapshotted
 * from `Template.label` at creation time so later label edits don't rewrite
 * user-visible data.
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

/**
 * Check if an entity has been soft deleted.
 */
export function isSoftDeleted(entity: SoftDeletable): boolean {
  return entity.deletedAt !== null;
}

/**
 * Filter to only active (non-deleted) entities.
 */
export function filterActive<T extends SoftDeletable>(entities: T[]): T[] {
  return entities.filter(e => e.deletedAt === null);
}

/**
 * Filter to only soft-deleted entities.
 */
export function filterDeleted<T extends SoftDeletable>(entities: T[]): T[] {
  return entities.filter(e => e.deletedAt !== null);
}

// ============================================================================
// History
// ============================================================================

/**
 * Shared fields across all history variants.
 */
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

/**
 * History entry for text-kv fields.
 */
export type TextKvHistory = DataFieldHistoryShared & {
  componentType: "text-kv";
  prevValue: string | null;
  newValue: string | null;
};

/**
 * Discriminated union on `componentType`. Phase 1 has only the text-kv
 * variant; future variants extend the union here.
 */
export type DataFieldHistory = TextKvHistory;
