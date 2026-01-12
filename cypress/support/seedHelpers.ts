/**
 * Cypress IDB Seeding Helpers
 * 
 * Directly seeds IndexedDB for E2E tests, bypassing Firestore entirely.
 * This eliminates race conditions from the visit → seed → reload pattern.
 */

import type { TreeNode, DataField } from '../../src/data/models';

// Fixed IDs for consistent test references
export const GOLDEN_IDS = {
  root: 'hvac-system',
  compressor: 'compressor-unit',
  motorAssembly: 'motor-assembly',
  refrigerantLines: 'refrigerant-lines',
  airHandler: 'air-handler',
  blowerMotor: 'blower-motor',
  ductwork: 'ductwork',
};

export const MINIMAL_IDS = {
  root: 'test-root',
};

const DB_NAME = 'complete-maintenance-management';

/**
 * Delete the database entirely to avoid version conflicts.
 * Dexie may have created the DB at a higher version - we need a clean slate.
 */
function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log('🗑️ Deleted existing database');
      resolve();
    };
    request.onerror = () => {
      console.warn('Failed to delete database, continuing anyway');
      resolve();
    };
    request.onblocked = () => {
      console.warn('Database delete blocked - connections still open');
      resolve();
    };
  });
}

/**
 * Open the IDB database with the app's schema.
 * Returns a Promise that resolves to the open database.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Use version 1 to match Dexie's version(1).stores() declaration
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    // Handle upgrade - creates the schema for a fresh database
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores matching db.ts schema
      if (!db.objectStoreNames.contains('nodes')) {
        const nodesStore = db.createObjectStore('nodes', { keyPath: 'id' });
        nodesStore.createIndex('parentId', 'parentId', { unique: false });
        nodesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('fields')) {
        const fieldsStore = db.createObjectStore('fields', { keyPath: 'id' });
        fieldsStore.createIndex('parentNodeId', 'parentNodeId', { unique: false });
        fieldsStore.createIndex('cardOrder', 'cardOrder', { unique: false });
        fieldsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('dataFieldId', 'dataFieldId', { unique: false });
        historyStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        historyStore.createIndex('rev', 'rev', { unique: false });
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('entityType', 'entityType', { unique: false });
      }

      if (!db.objectStoreNames.contains('syncMetadata')) {
        db.createObjectStore('syncMetadata', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Clear all data from IDB by deleting the database entirely.
 * This avoids version conflicts with Dexie.
 */
export async function clearIDB(): Promise<void> {
  await deleteDatabase();
}

function putItem(store: IDBObjectStore, item: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Seed the Golden Tree into IDB.
 * This is the HVAC system hierarchy with 7 nodes and 19 fields.
 */
export async function seedGoldenTree(): Promise<void> {
  const now = Date.now();

  const nodes: TreeNode[] = [
    {
      id: GOLDEN_IDS.root,
      nodeName: 'HVAC System',
      nodeSubtitle: 'Building A Rooftop Unit',
      parentId: null,
      updatedBy: 'testUser',
      updatedAt: now,
    },
    {
      id: GOLDEN_IDS.compressor,
      nodeName: 'Compressor Unit',
      nodeSubtitle: 'Carrier 38AKS016',
      parentId: GOLDEN_IDS.root,
      updatedBy: 'testUser',
      updatedAt: now + 1,
    },
    {
      id: GOLDEN_IDS.motorAssembly,
      nodeName: 'Motor Assembly',
      nodeSubtitle: '3-phase induction motor',
      parentId: GOLDEN_IDS.compressor,
      updatedBy: 'testUser',
      updatedAt: now + 2,
    },
    {
      id: GOLDEN_IDS.refrigerantLines,
      nodeName: 'Refrigerant Lines',
      nodeSubtitle: 'R-410A copper tubing',
      parentId: GOLDEN_IDS.compressor,
      updatedBy: 'testUser',
      updatedAt: now + 3,
    },
    {
      id: GOLDEN_IDS.airHandler,
      nodeName: 'Air Handler',
      nodeSubtitle: 'Indoor unit, mechanical room',
      parentId: GOLDEN_IDS.root,
      updatedBy: 'testUser',
      updatedAt: now + 4,
    },
    {
      id: GOLDEN_IDS.blowerMotor,
      nodeName: 'Blower Motor',
      nodeSubtitle: 'Variable speed ECM',
      parentId: GOLDEN_IDS.airHandler,
      updatedBy: 'testUser',
      updatedAt: now + 5,
    },
    {
      id: GOLDEN_IDS.ductwork,
      nodeName: 'Ductwork',
      nodeSubtitle: 'Supply and return plenums',
      parentId: GOLDEN_IDS.root,
      updatedBy: 'testUser',
      updatedAt: now + 6,
    },
  ];

  const fields: DataField[] = [
    // HVAC System (root) - comprehensive fields
    { id: 'field-hvac-type', fieldName: 'Type Of', fieldValue: 'HVAC System', parentNodeId: GOLDEN_IDS.root, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-hvac-desc', fieldName: 'Description', fieldValue: 'Primary cooling and heating for Building A', parentNodeId: GOLDEN_IDS.root, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },
    { id: 'field-hvac-tags', fieldName: 'Tags', fieldValue: 'critical, hvac, rooftop', parentNodeId: GOLDEN_IDS.root, cardOrder: 2, updatedBy: 'testUser', updatedAt: now + 2 },
    { id: 'field-hvac-status', fieldName: 'Status', fieldValue: 'In Service', parentNodeId: GOLDEN_IDS.root, cardOrder: 3, updatedBy: 'testUser', updatedAt: now + 3 },
    { id: 'field-hvac-installed', fieldName: 'Installed Date', fieldValue: '2023-06-15', parentNodeId: GOLDEN_IDS.root, cardOrder: 4, updatedBy: 'testUser', updatedAt: now + 4 },

    // Compressor Unit
    { id: 'field-comp-type', fieldName: 'Type Of', fieldValue: 'Compressor', parentNodeId: GOLDEN_IDS.compressor, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-comp-serial', fieldName: 'Serial Number', fieldValue: 'CMP-2023-001', parentNodeId: GOLDEN_IDS.compressor, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },
    { id: 'field-comp-power', fieldName: 'Power Rating', fieldValue: '5 HP, 460V 3-phase', parentNodeId: GOLDEN_IDS.compressor, cardOrder: 2, updatedBy: 'testUser', updatedAt: now + 2 },

    // Motor Assembly
    { id: 'field-motor-type', fieldName: 'Type Of', fieldValue: 'Motor', parentNodeId: GOLDEN_IDS.motorAssembly, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-motor-desc', fieldName: 'Description', fieldValue: 'Hermetic scroll compressor motor', parentNodeId: GOLDEN_IDS.motorAssembly, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },

    // Refrigerant Lines
    { id: 'field-refrig-type', fieldName: 'Type Of', fieldValue: 'Piping', parentNodeId: GOLDEN_IDS.refrigerantLines, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-refrig-note', fieldName: 'Note', fieldValue: 'Check for leaks quarterly', parentNodeId: GOLDEN_IDS.refrigerantLines, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },

    // Air Handler
    { id: 'field-ah-type', fieldName: 'Type Of', fieldValue: 'Air Handler', parentNodeId: GOLDEN_IDS.airHandler, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-ah-location', fieldName: 'Location', fieldValue: 'Mechanical Room 102', parentNodeId: GOLDEN_IDS.airHandler, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },

    // Blower Motor
    { id: 'field-blower-type', fieldName: 'Type Of', fieldValue: 'Motor', parentNodeId: GOLDEN_IDS.blowerMotor, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-blower-model', fieldName: 'Model', fieldValue: 'Genteq Evergreen IM', parentNodeId: GOLDEN_IDS.blowerMotor, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },

    // Ductwork (minimal fields - tests empty/sparse DataCards)
    { id: 'field-duct-type', fieldName: 'Type Of', fieldValue: 'Ductwork', parentNodeId: GOLDEN_IDS.ductwork, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
  ];

  // Delete database first to avoid version conflicts, then create fresh
  await deleteDatabase();

  const db = await openDatabase();
  const tx = db.transaction(['nodes', 'fields', 'syncMetadata'], 'readwrite');

  const nodesStore = tx.objectStore('nodes');
  const fieldsStore = tx.objectStore('fields');
  const metaStore = tx.objectStore('syncMetadata');

  // Seed nodes
  for (const node of nodes) {
    await putItem(nodesStore, node);
  }

  // Seed fields
  for (const field of fields) {
    await putItem(fieldsStore, field);
  }

  // Mark as synced (so sync manager doesn't try to push)
  await putItem(metaStore, { key: 'lastSyncTimestamp', value: Date.now() });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  console.log(`✅ Seeded Golden Tree: ${nodes.length} nodes, ${fields.length} fields`);
}

/**
 * Seed a minimal tree into IDB.
 * Just 1 root node and 2 fields - for creation and layout tests.
 */
export async function seedMinimalTree(): Promise<void> {
  const now = Date.now();

  const nodes: TreeNode[] = [
    {
      id: MINIMAL_IDS.root,
      nodeName: 'Test Root',
      nodeSubtitle: 'Minimal test node',
      parentId: null,
      updatedBy: 'testUser',
      updatedAt: now,
    },
  ];

  const fields: DataField[] = [
    { id: 'field-min-type', fieldName: 'Type Of', fieldValue: 'Test', parentNodeId: MINIMAL_IDS.root, cardOrder: 0, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-min-desc', fieldName: 'Description', fieldValue: 'Test description', parentNodeId: MINIMAL_IDS.root, cardOrder: 1, updatedBy: 'testUser', updatedAt: now + 1 },
  ];

  // Delete database first to avoid version conflicts, then create fresh
  await deleteDatabase();

  const db = await openDatabase();
  const tx = db.transaction(['nodes', 'fields', 'syncMetadata'], 'readwrite');

  const nodesStore = tx.objectStore('nodes');
  const fieldsStore = tx.objectStore('fields');
  const metaStore = tx.objectStore('syncMetadata');

  for (const node of nodes) {
    await putItem(nodesStore, node);
  }

  for (const field of fields) {
    await putItem(fieldsStore, field);
  }

  await putItem(metaStore, { key: 'lastSyncTimestamp', value: Date.now() });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  console.log(`✅ Seeded Minimal Tree: ${nodes.length} nodes, ${fields.length} fields`);
}
