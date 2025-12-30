/**
 * Seed data for Cypress E2E tests.
 * 
 * Creates a "Golden Tree" - a pre-seeded hierarchy for consistent testing.
 * Connects to Firebase Emulator when USE_EMULATOR is true.
 * 
 * Tree Structure (HVAC System concept):
 * 
 * HVAC System (root)
 * ├── Compressor Unit
 * │   ├── Motor Assembly
 * │   └── Refrigerant Lines
 * ├── Air Handler
 * │   └── Blower Motor
 * └── Ductwork
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    initializeFirestore,
    getFirestore,
    connectFirestoreEmulator,
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    writeBatch,
    memoryLocalCache,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBgVGwmf8o6eP7XRW-Jv8AwScIrIDPertA",
    authDomain: "treeview-blarapp.firebaseapp.com",
    projectId: "treeview-blarapp",
    storageBucket: "treeview-blarapp.firebasestorage.app",
    messagingSenderId: "1041054928276",
    appId: "1:1041054928276:web:f4804c9c7b35c66cd4d381",
};

// Initialize Firebase for seeding (Node.js context)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let db: ReturnType<typeof getFirestore>;
let emulatorConnected = false;

function getDb() {
    if (!db) {
        try {
            db = initializeFirestore(app, { localCache: memoryLocalCache() });
        } catch {
            db = getFirestore(app);
        }
    }
    
    // Connect to emulator (only once)
    if (!emulatorConnected) {
        try {
            connectFirestoreEmulator(db, 'localhost', 8080);
            emulatorConnected = true;
            console.log('🔥 Seed script connected to Firestore Emulator');
        } catch (e) {
            // Already connected
            emulatorConnected = true;
        }
    }
    
    return db;
}

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
    { id: 'field-hvac-type', fieldName: 'Type Of', fieldValue: 'HVAC System', parentNodeId: GOLDEN_IDS.root, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-hvac-desc', fieldName: 'Description', fieldValue: 'Primary cooling and heating for Building A', parentNodeId: GOLDEN_IDS.root, updatedBy: 'testUser', updatedAt: now + 1 },
    { id: 'field-hvac-tags', fieldName: 'Tags', fieldValue: 'critical, hvac, rooftop', parentNodeId: GOLDEN_IDS.root, updatedBy: 'testUser', updatedAt: now + 2 },
    { id: 'field-hvac-status', fieldName: 'Status', fieldValue: 'In Service', parentNodeId: GOLDEN_IDS.root, updatedBy: 'testUser', updatedAt: now + 3 },
    { id: 'field-hvac-installed', fieldName: 'Installed Date', fieldValue: '2023-06-15', parentNodeId: GOLDEN_IDS.root, updatedBy: 'testUser', updatedAt: now + 4 },
    
    // Compressor Unit
    { id: 'field-comp-type', fieldName: 'Type Of', fieldValue: 'Compressor', parentNodeId: GOLDEN_IDS.compressor, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-comp-serial', fieldName: 'Serial Number', fieldValue: 'CMP-2023-001', parentNodeId: GOLDEN_IDS.compressor, updatedBy: 'testUser', updatedAt: now + 1 },
    { id: 'field-comp-power', fieldName: 'Power Rating', fieldValue: '5 HP, 460V 3-phase', parentNodeId: GOLDEN_IDS.compressor, updatedBy: 'testUser', updatedAt: now + 2 },
    
    // Motor Assembly
    { id: 'field-motor-type', fieldName: 'Type Of', fieldValue: 'Motor', parentNodeId: GOLDEN_IDS.motorAssembly, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-motor-desc', fieldName: 'Description', fieldValue: 'Hermetic scroll compressor motor', parentNodeId: GOLDEN_IDS.motorAssembly, updatedBy: 'testUser', updatedAt: now + 1 },
    
    // Refrigerant Lines
    { id: 'field-refrig-type', fieldName: 'Type Of', fieldValue: 'Piping', parentNodeId: GOLDEN_IDS.refrigerantLines, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-refrig-note', fieldName: 'Note', fieldValue: 'Check for leaks quarterly', parentNodeId: GOLDEN_IDS.refrigerantLines, updatedBy: 'testUser', updatedAt: now + 1 },
    
    // Air Handler
    { id: 'field-ah-type', fieldName: 'Type Of', fieldValue: 'Air Handler', parentNodeId: GOLDEN_IDS.airHandler, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-ah-location', fieldName: 'Location', fieldValue: 'Mechanical Room 102', parentNodeId: GOLDEN_IDS.airHandler, updatedBy: 'testUser', updatedAt: now + 1 },
    
    // Blower Motor
    { id: 'field-blower-type', fieldName: 'Type Of', fieldValue: 'Motor', parentNodeId: GOLDEN_IDS.blowerMotor, updatedBy: 'testUser', updatedAt: now },
    { id: 'field-blower-model', fieldName: 'Model', fieldValue: 'Genteq Evergreen IM', parentNodeId: GOLDEN_IDS.blowerMotor, updatedBy: 'testUser', updatedAt: now + 1 },
    
    // Ductwork (minimal fields - tests empty/sparse DataCards)
    { id: 'field-duct-type', fieldName: 'Type Of', fieldValue: 'Ductwork', parentNodeId: GOLDEN_IDS.ductwork, updatedBy: 'testUser', updatedAt: now },
];

/**
 * Seed the Golden Tree into Firestore Emulator.
 * Clears existing data first to ensure clean state.
 */
export async function seedGoldenTree(): Promise<void> {
    const firestore = getDb();
    
    // Clear first
    await clearAllData();
    
    // Seed nodes
    const nodesRef = collection(firestore, 'treeNodes');
    for (const node of GOLDEN_NODES) {
        await setDoc(doc(nodesRef, node.id), node);
    }
    
    // Seed fields
    const fieldsRef = collection(firestore, 'dataFields');
    for (const field of GOLDEN_FIELDS) {
        await setDoc(doc(fieldsRef, field.id), field);
    }
    
    console.log(`✅ Seeded Golden Tree: ${GOLDEN_NODES.length} nodes, ${GOLDEN_FIELDS.length} fields`);
}

/**
 * Clear all data from Firestore Emulator.
 */
export async function clearAllData(): Promise<void> {
    const firestore = getDb();
    
    // Delete all nodes
    const nodesSnap = await getDocs(collection(firestore, 'treeNodes'));
    for (const docSnap of nodesSnap.docs) {
        await deleteDoc(doc(firestore, 'treeNodes', docSnap.id));
    }
    
    // Delete all fields
    const fieldsSnap = await getDocs(collection(firestore, 'dataFields'));
    for (const docSnap of fieldsSnap.docs) {
        await deleteDoc(doc(firestore, 'dataFields', docSnap.id));
    }
    
    // Delete all history
    const historySnap = await getDocs(collection(firestore, 'dataFieldHistory'));
    for (const docSnap of historySnap.docs) {
        await deleteDoc(doc(firestore, 'dataFieldHistory', docSnap.id));
    }
    
    console.log('🧹 Cleared all Firestore data');
}
