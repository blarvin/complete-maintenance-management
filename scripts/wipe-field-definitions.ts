/**
 * Wipe all FieldDefinitions from Firestore.
 *
 * Run with: npx tsx scripts/wipe-field-definitions.ts   (or: npm run wipe:fielddefs)
 *
 * ⚠️  WARNING: This deletes ALL FieldDefinitions from the production Firestore
 * database. Elements and history are left untouched (use wipe-elements.ts for those).
 *
 * NOTE: A Node script cannot reach the browser's IndexedDB, where the app keeps
 * its working copy of FieldDefinitions. This script clears the Firestore side;
 * to clear the local IDB side, open the app and run in the browser console:
 *
 *     await window.__wipeFieldDefinitions()
 *
 * That helper clears the local copy and resets the seed-version key, so the 7
 * dev seeds re-seed on the next reload (a factory-default reset).
 */

import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    writeBatch,
    doc,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBgVGwmf8o6eP7XRW-Jv8AwScIrIDPertA",
    authDomain: "treeview-blarapp.firebaseapp.com",
    projectId: "treeview-blarapp",
    storageBucket: "treeview-blarapp.firebasestorage.app",
    messagingSenderId: "1041054928276",
    appId: "1:1041054928276:web:f4804c9c7b35c66cd4d381",
};

const COLLECTIONS = [
    'fieldDefinitions',
];

async function deleteCollection(db: ReturnType<typeof getFirestore>, collectionName: string): Promise<number> {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
        console.log(`  ${collectionName}: 0 documents (already empty)`);
        return 0;
    }

    let deleted = 0;
    const docs = snapshot.docs;

    // Delete in batches of 500 (Firestore limit)
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);

        for (const docSnap of chunk) {
            batch.delete(doc(db, collectionName, docSnap.id));
            deleted++;
        }

        await batch.commit();
    }

    console.log(`  ${collectionName}: ${deleted} documents deleted`);
    return deleted;
}

async function main() {
    console.log('⚠️  WIPE FIELD DEFINITIONS - This deletes all FieldDefinitions from Firestore!\n');
    console.log(`Project: ${firebaseConfig.projectId}`);
    console.log('');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    let totalDeleted = 0;

    for (const collectionName of COLLECTIONS) {
        const count = await deleteCollection(db, collectionName);
        totalDeleted += count;
    }

    console.log(`\n✅ Firestore FieldDefinitions wiped! Deleted ${totalDeleted} documents.`);
    console.log('\n👉 To also clear the local IndexedDB copy, open the app and run in the');
    console.log('   browser console:');
    console.log('\n       await window.__wipeFieldDefinitions()\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
});
