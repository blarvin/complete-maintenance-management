export type ID = string;

export type TreeNode = {
  id: ID;
  nodeName: string;
  nodeSubtitle?: string;
  parentId: ID | null;
  updatedBy: "localUser";
  updatedAt: number; // epoch ms
};

export type DataField = {
  id: ID;
  fieldName: string;
  parentNodeId: ID;
  fieldValue: string | null;
  updatedBy: "localUser";
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
  updatedBy: "localUser";
  updatedAt: number;
  rev: number; // monotonic per dataFieldId, start 0 on create
};