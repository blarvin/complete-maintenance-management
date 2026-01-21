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

export type DataField = {
  id: ID;
  fieldName: string;
  parentNodeId: ID;
  fieldValue: string | null;
  cardOrder: number;
  updatedBy: UserId;
  updatedAt: number;
  deletedAt: number | null; // soft delete timestamp, null = active
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

export type DataFieldHistory = {
  id: string; // `${dataFieldId}:${rev}`
  dataFieldId: ID;
  parentNodeId: ID;
  action: "create" | "update" | "delete";
  property: "fieldValue";
  prevValue: string | null;
  newValue: string | null;
  updatedBy: UserId;
  updatedAt: number;
  rev: number; // monotonic per dataFieldId, start 0 on create
};