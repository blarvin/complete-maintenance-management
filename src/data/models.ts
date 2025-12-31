export type ID = string;

/**
 * User ID type - currently constant, will be dynamic with auth
 */
export type UserId = string;

export type TreeNode = {
  id: ID;
  nodeName: string;
  nodeSubtitle?: string;
  parentId: ID | null;
  updatedBy: UserId;
  updatedAt: number; // epoch ms
};

export type DataField = {
  id: ID;
  fieldName: string;
  parentNodeId: ID;
  fieldValue: string | null;
  cardOrder: number;
  updatedBy: UserId;
  updatedAt: number;
};

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