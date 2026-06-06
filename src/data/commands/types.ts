import type { ComponentType, DataField, DataFieldValue, FieldDefinition, FieldDefinitionConfig, TreeNode, Element, Kind } from '../models';

export type Command =
  | { type: 'CREATE_EMPTY_NODE'; payload: { id: string; parentId: string | null } }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: { nodeName?: string; nodeSubtitle?: string } } }
  | { type: 'DELETE_NODE'; payload: { id: string } }
  | { type: 'ADD_FIELD_FROM_DEFINITION'; payload: { nodeId: string; fieldDefinitionId: string; cardOrder?: number; initialValue?: DataFieldValue | null } }
  | { type: 'CREATE_FIELD_DEFINITION'; payload: { id: string; componentType: ComponentType; label: string; config: FieldDefinitionConfig } }
  | { type: 'UPDATE_FIELD_VALUE'; payload: { fieldId: string; newValue: DataFieldValue | null } }
  | { type: 'DELETE_FIELD'; payload: { fieldId: string } }
  | { type: 'RESTORE_FIELD'; payload: { fieldId: string } }
  | { type: 'RESTORE_NODE'; payload: { id: string } }
  // ---- Unified element commands ----
  | { type: 'CREATE_ELEMENT'; payload: { id?: string; kind: Kind; parentId: string | null; name: string; subtitle?: string | null; fieldDefinitionId?: string | null; value?: DataFieldValue | null; siblingOrder?: number } }
  | { type: 'CREATE_ELEMENT_FROM_DEFINITION'; payload: { id?: string; parentId: string; fieldDefinitionId: string; initialValue?: DataFieldValue | null; siblingOrder?: number } }
  | { type: 'UPDATE_ELEMENT_NAME'; payload: { id: string; name: string } }
  | { type: 'UPDATE_ELEMENT_SUBTITLE'; payload: { id: string; subtitle: string | null } }
  | { type: 'UPDATE_ELEMENT_VALUE'; payload: { id: string; value: DataFieldValue | null } }
  | { type: 'MOVE_ELEMENT'; payload: { id: string; parentId?: string | null; siblingOrder?: number } }
  | { type: 'DELETE_ELEMENT'; payload: { id: string } }
  | { type: 'RESTORE_ELEMENT'; payload: { id: string } };

export type CommandResultMap = {
  CREATE_EMPTY_NODE: TreeNode;
  UPDATE_NODE: void;
  DELETE_NODE: void;
  ADD_FIELD_FROM_DEFINITION: DataField;
  CREATE_FIELD_DEFINITION: FieldDefinition;
  UPDATE_FIELD_VALUE: void;
  DELETE_FIELD: void;
  RESTORE_FIELD: void;
  RESTORE_NODE: void;
  CREATE_ELEMENT: Element;
  CREATE_ELEMENT_FROM_DEFINITION: Element;
  UPDATE_ELEMENT_NAME: void;
  UPDATE_ELEMENT_SUBTITLE: void;
  UPDATE_ELEMENT_VALUE: void;
  MOVE_ELEMENT: void;
  DELETE_ELEMENT: void;
  RESTORE_ELEMENT: void;
};
