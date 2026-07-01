import type { DataFieldValue, Definition, DefinitionConfig, Element, Kind } from '../models';

export type Command =
  | { type: 'CREATE_DEFINITION'; payload: { id: string; kind: Kind; label: string; config: DefinitionConfig } }
  | { type: 'CREATE_ELEMENT'; payload: { id?: string; kind: Kind; parentId: string | null; name: string; subtitle?: string | null; definitionId?: string | null; value?: DataFieldValue | null; siblingOrder?: number } }
  | { type: 'CREATE_ELEMENT_FROM_DEFINITION'; payload: { id?: string; parentId: string; definitionId: string; initialValue?: DataFieldValue | null; siblingOrder?: number } }
  | { type: 'UPDATE_ELEMENT_NAME'; payload: { id: string; name: string } }
  | { type: 'UPDATE_ELEMENT_SUBTITLE'; payload: { id: string; subtitle: string | null } }
  | { type: 'UPDATE_ELEMENT_VALUE'; payload: { id: string; value: DataFieldValue | null } }
  | { type: 'MOVE_ELEMENT'; payload: { id: string; parentId?: string | null; siblingOrder?: number } }
  | { type: 'DELETE_ELEMENT'; payload: { id: string } }
  | { type: 'RESTORE_ELEMENT'; payload: { id: string } };

export type CommandResultMap = {
  CREATE_DEFINITION: Definition;
  CREATE_ELEMENT: Element;
  CREATE_ELEMENT_FROM_DEFINITION: Element;
  UPDATE_ELEMENT_NAME: void;
  UPDATE_ELEMENT_SUBTITLE: void;
  UPDATE_ELEMENT_VALUE: void;
  MOVE_ELEMENT: void;
  DELETE_ELEMENT: void;
  RESTORE_ELEMENT: void;
};
