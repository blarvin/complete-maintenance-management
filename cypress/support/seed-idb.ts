/**
 * IndexedDB Seeding for Cypress E2E tests.
 *
 * Seeds the Golden Tree directly into IndexedDB (Dexie database).
 * This avoids race conditions with Firestore → IDB migration.
 *
 * Advantages over Firestore seeding:
 * - No race condition (data is in IDB before components load)
 * - Tests the actual storage layer (IDB is primary in offline-first architecture)
 * - Faster (no migration overhead)
 * - More reliable
 */

// Golden Tree data (same as seed-data.ts but for IDB)
export const GOLDEN_IDS = {
    root: 'hvac-system',
    compressor: 'compressor-unit',
    motorAssembly: 'motor-assembly',
    refrigerantLines: 'refrigerant-lines',
    airHandler: 'air-handler',
    blowerMotor: 'blower-motor',
    ductwork: 'ductwork',
};

const now = Date.now();

// Tree nodes with realistic HVAC data
const GOLDEN_NODES = [
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

// DataFields for each node
const GOLDEN_FIELDS = [
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

/**
 * Seed the Golden Tree into IndexedDB.
 * This function runs in the browser context (Cypress.window()).
 */
export function seedIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
        const dbName = 'complete-maintenance-management';
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(request.error);

        request.onsuccess = async () => {
            const db = request.result;

            try {
                // Start transaction
                const tx = db.transaction(['nodes', 'fields'], 'readwrite');
                const nodesStore = tx.objectStore('nodes');
                const fieldsStore = tx.objectStore('fields');

                // Clear existing data
                await new Promise<void>((res, rej) => {
                    const clearNodesReq = nodesStore.clear();
                    clearNodesReq.onsuccess = () => res();
                    clearNodesReq.onerror = () => rej(clearNodesReq.error);
                });

                await new Promise<void>((res, rej) => {
                    const clearFieldsReq = fieldsStore.clear();
                    clearFieldsReq.onsuccess = () => res();
                    clearFieldsReq.onerror = () => rej(clearFieldsReq.error);
                });

                // Add nodes
                for (const node of GOLDEN_NODES) {
                    await new Promise<void>((res, rej) => {
                        const addReq = nodesStore.add(node);
                        addReq.onsuccess = () => res();
                        addReq.onerror = () => rej(addReq.error);
                    });
                }

                // Add fields
                for (const field of GOLDEN_FIELDS) {
                    await new Promise<void>((res, rej) => {
                        const addReq = fieldsStore.add(field);
                        addReq.onsuccess = () => res();
                        addReq.onerror = () => rej(addReq.error);
                    });
                }

                // Wait for transaction to complete
                tx.oncomplete = () => {
                    console.log(`✅ Seeded IDB: ${GOLDEN_NODES.length} nodes, ${GOLDEN_FIELDS.length} fields`);
                    db.close();
                    resolve();
                };

                tx.onerror = () => {
                    db.close();
                    reject(tx.error);
                };
            } catch (err) {
                db.close();
                reject(err);
            }
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object stores if they don't exist
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
                const syncQueueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
                syncQueueStore.createIndex('status', 'status', { unique: false });
                syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
                syncQueueStore.createIndex('entityType', 'entityType', { unique: false });
            }

            if (!db.objectStoreNames.contains('syncMetadata')) {
                db.createObjectStore('syncMetadata', { keyPath: 'key' });
            }
        };
    });
}
