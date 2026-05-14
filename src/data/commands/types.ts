import type { DataField, DataFieldValue, TreeNode } from '../models';

export type CreateNodeInput = {
  id: string;
  parentId: string | null;
  nodeName: string;
  nodeSubtitle: string;
  /** FieldDefinition IDs to instantiate as default fields. */
  defaults: { fieldDefinitionId: string }[];
};

export type Command =
  | { type: 'CREATE_NODE_WITH_FIELDS'; payload: CreateNodeInput }
  | { type: 'CREATE_EMPTY_NODE'; payload: { id: string; parentId: string | null } }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: { nodeName?: string; nodeSubtitle?: string } } }
  | { type: 'DELETE_NODE'; payload: { id: string } }
  | { type: 'ADD_FIELD_FROM_DEFINITION'; payload: { nodeId: string; fieldDefinitionId: string; cardOrder?: number; initialValue?: DataFieldValue | null } }
  | { type: 'UPDATE_FIELD_VALUE'; payload: { fieldId: string; newValue: DataFieldValue | null } }
  | { type: 'DELETE_FIELD'; payload: { fieldId: string } }
  | { type: 'RESTORE_FIELD'; payload: { fieldId: string } }
  | { type: 'RESTORE_NODE'; payload: { id: string } };

export type CommandResultMap = {
  CREATE_NODE_WITH_FIELDS: void;
  CREATE_EMPTY_NODE: TreeNode;
  UPDATE_NODE: void;
  DELETE_NODE: void;
  ADD_FIELD_FROM_DEFINITION: DataField;
  UPDATE_FIELD_VALUE: void;
  DELETE_FIELD: void;
  RESTORE_FIELD: void;
  RESTORE_NODE: void;
};
