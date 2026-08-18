/**
 * Test fixtures for the `library` tree (config-as-Elements). Seeds a Definition
 * in the shape the app writes: a `kind: node` Element under the Library Node,
 * self-referential on `definitionId` (the identity test), plus its config
 * sub-field children — so adapter/command paths that resolve a `definitionId`
 * find it.
 *
 * The Library Node is written alongside rather than assumed: a suite seeds one
 * Definition and nothing else, and a Definition with no parent row is a shape the
 * app never produces.
 */

import { db } from '../data/storage/db';
import type { Element, DefinitionConfig, Kind } from '../data/models';
import { serializeConfig } from '../kinds/configElements';
import { LIBRARY_ROOT_ID, LIBRARY_ROOT_NAME } from '../data/definitionIds';

export async function seedLibraryDefinition(
  id: string,
  kind: Kind,
  label = 'Test',
  config: DefinitionConfig = {},
): Promise<void> {
  const ts = Date.now();
  await db.elements.put({
    id: LIBRARY_ROOT_ID,
    kind: 'node',
    name: LIBRARY_ROOT_NAME,
    subtitle: null,
    value: null,
    parentId: null,
    siblingOrder: -1,
    definitionId: null,
    treeType: 'library',
    updatedBy: 'appDeveloper',
    updatedAt: ts,
    deletedAt: null,
  });
  const def: Element = {
    id,
    // `kind` names the kind this Definition *defines*; the Element is a node.
    kind: 'node',
    name: label,
    subtitle: null,
    value: null,
    parentId: LIBRARY_ROOT_ID,
    siblingOrder: 0,
    definitionId: id,
    treeType: 'library',
    updatedBy: 'appDeveloper',
    updatedAt: ts,
    deletedAt: null,
  };
  await db.elements.put(def);
  for (const child of serializeConfig(id, kind, config)) {
    await db.elements.put({ ...child, updatedBy: 'appDeveloper', updatedAt: ts, deletedAt: null });
  }
}
