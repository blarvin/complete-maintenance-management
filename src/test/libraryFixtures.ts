/**
 * Test fixtures for the `library` tree (config-as-Elements). Replaces the old
 * `db.fieldDefinitions.put(...)` setup: seeds a Definition as a `library`-tree
 * Element plus its config sub-field children, so adapter/command paths that
 * resolve a `definitionId` find it.
 */

import { db } from '../data/storage/db';
import type { Element, DefinitionConfig, Kind } from '../data/models';
import { serializeConfig } from '../kinds/configElements';

export async function seedLibraryDefinition(
  id: string,
  kind: Kind,
  label = 'Test',
  config: DefinitionConfig = {},
): Promise<void> {
  const ts = Date.now();
  const def: Element = {
    id,
    kind,
    name: label,
    subtitle: null,
    value: null,
    parentId: null,
    siblingOrder: 0,
    definitionId: null,
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
