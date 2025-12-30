/**
 * Cleanup script for Firestore - removes nodes created by Cypress tests.
 * 
 * Run with: npx tsx cypress/support/cleanup-firestore.ts
 * 
 * This deletes nodes with names matching common test patterns:
 * - "Test Asset", "Test Node", "My First Asset", etc.
 */

import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    deleteDoc,
    doc,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBgVGwmf8o6eP7XRW-Jv8AwScIrIDPertA",
    authDomain: "treeview-blarapp.firebaseapp.com",
    projectId: "treeview-blarapp",
    storageBucket: "treeview-blarapp.firebasestorage.app",
    messagingSenderId: "1041054928276",
    appId: "1:1041054928276:web:f4804c9c7b35c66cd4d381",
};

// Test node name patterns that Cypress creates
// Includes exact matches and prefixes for timestamped names
const TEST_NODE_EXACT_NAMES = [
    'Test Asset',
    'Test Node',
    'My First Asset',
    'HVAC Unit',
    'Parent Node',
    'Parent',
    'Root Asset',
    'Card Test',
    'Child Component',
    'Child',
    'Nested Child',
    'ShouldNotExist',
    // Old manual test data spotted in screenshots
    'HMS Titanic',
    'Engine',
    'M/V Grey Seas Under',
    'Untitled',
    'Multi Data Fields',
];

// Prefixes for timestamped unique test names
const TEST_NODE_PREFIXES = [
    'NavTest_',
    'CardTest_',
    'LayoutRoot_',
    'LayoutParent_',
    'LayoutChild_',
    'LayoutCard_',
    'FirstAsset_',
    'HVAC_',
    'Parent_',
    'Child_',
    'Nested_',
];

async function main() {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('Finding test nodes to delete...');
    
    // Get all nodes
    const nodesRef = collection(db, 'treeNodes');
    const snapshot = await getDocs(nodesRef);
    
    const nodesToDelete: string[] = [];
    
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const nodeName = data.nodeName;
        
        const isTestNode = TEST_NODE_EXACT_NAMES.includes(nodeName) ||
            TEST_NODE_PREFIXES.some(prefix => nodeName.startsWith(prefix));
        
        if (isTestNode) {
            nodesToDelete.push(docSnap.id);
            console.log(`  Found: "${nodeName}" (${docSnap.id})`);
        }
    }
    
    if (nodesToDelete.length === 0) {
        console.log('No test nodes found. Database is clean!');
        process.exit(0);
    }
    
    console.log(`\nDeleting ${nodesToDelete.length} test nodes and their related data...`);
    
    // Delete in batches of 500 (Firestore limit)
    let deletedNodes = 0;
    let deletedFields = 0;
    let deletedHistory = 0;
    
    for (const nodeId of nodesToDelete) {
        const batch = writeBatch(db);
        
        // Delete fields for this node
        const fieldsQuery = query(
            collection(db, 'dataFields'),
            where('parentNodeId', '==', nodeId)
        );
        const fieldsSnap = await getDocs(fieldsQuery);
        
        for (const fieldDoc of fieldsSnap.docs) {
            // Delete history for this field
            const historyQuery = query(
                collection(db, 'dataFieldHistory'),
                where('dataFieldId', '==', fieldDoc.id)
            );
            const historySnap = await getDocs(historyQuery);
            
            for (const histDoc of historySnap.docs) {
                batch.delete(doc(db, 'dataFieldHistory', histDoc.id));
                deletedHistory++;
            }
            
            batch.delete(doc(db, 'dataFields', fieldDoc.id));
            deletedFields++;
        }
        
        // Delete the node
        batch.delete(doc(db, 'treeNodes', nodeId));
        deletedNodes++;
        
        await batch.commit();
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${deletedNodes} nodes, ${deletedFields} fields, ${deletedHistory} history entries`);
    
    process.exit(0);
}

main().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
