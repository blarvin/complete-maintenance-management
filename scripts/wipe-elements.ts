/**
 * Wipe Elements and history from Firestore — leaves FieldDefinitions intact.
 *
 * Run with: npx tsx scripts/wipe-elements.ts   (or: npm run wipe:elements)
 *
 * ⚠️  WARNING: This deletes ALL elements and element history from the
 * production Firestore database. FieldDefinitions are deliberately preserved.
 * To also clear FieldDefinitions, use scripts/wipe-field-definitions.ts.
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

// Element-model data only. fieldDefinitions is intentionally NOT in this list.
// Legacy (pre-Element-model) element collections are included so leftover
// pre-refactor data also gets wiped.
const COLLECTIONS = [
    'elements',
    'elementHistory',
    // Legacy (pre-Element-model) collections:
    'treeNodes',
    'dataFields',
    'dataFieldHistory',
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
    console.log('⚠️  WIPE ELEMENTS - This deletes all elements + history (FieldDefinitions preserved)!\n');
    console.log(`Project: ${firebaseConfig.projectId}`);
    console.log('');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    let totalDeleted = 0;

    for (const collectionName of COLLECTIONS) {
        const count = await deleteCollection(db, collectionName);
        totalDeleted += count;
    }

    console.log(`\n✅ Wipe complete! Deleted ${totalDeleted} documents total.`);
    console.log('   FieldDefinitions were left untouched.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
});
