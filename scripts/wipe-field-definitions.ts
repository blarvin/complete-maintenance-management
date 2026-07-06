/**
 * Wipe all FieldDefinitions from Firestore.
 *
 * Run with: npx tsx scripts/wipe-field-definitions.ts   (or: npm run wipe:fielddefs)
 *
 * Since Config-as-Elements, a FieldDefinition is a `library`-tree Element (plus
 * its config sub-field children) in the `elements` collection — there is no
 * separate `fieldDefinitions` collection. This deletes every `treeType: 'library'`
 * document from the production `elements` collection.
 *
 * ⚠️  WARNING: business (`treeType: 'business'`) elements and history are left
 * untouched (use wipe-elements.ts for those).
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

const ELEMENTS = 'elements';

async function deleteLibraryDefinitions(db: ReturnType<typeof getFirestore>): Promise<number> {
    const snapshot = await getDocs(collection(db, ELEMENTS));
    // Client-side filter for the library tree (Definitions + their config
    // sub-field children) — avoids needing a Firestore index for a one-off script.
    const libraryDocs = snapshot.docs.filter((d) => d.data().treeType === 'library');

    if (libraryDocs.length === 0) {
        console.log(`  ${ELEMENTS}: 0 library documents (already empty)`);
        return 0;
    }

    let deleted = 0;
    // Delete in batches of 500 (Firestore limit)
    for (let i = 0; i < libraryDocs.length; i += 500) {
        const batch = writeBatch(db);
        for (const docSnap of libraryDocs.slice(i, i + 500)) {
            batch.delete(doc(db, ELEMENTS, docSnap.id));
            deleted++;
        }
        await batch.commit();
    }

    console.log(`  ${ELEMENTS}: ${deleted} library documents deleted`);
    return deleted;
}

async function main() {
    console.log('⚠️  WIPE FIELD DEFINITIONS - This deletes all FieldDefinitions from Firestore!\n');
    console.log(`Project: ${firebaseConfig.projectId}`);
    console.log('');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const totalDeleted = await deleteLibraryDefinitions(db);

    console.log(`\n✅ Firestore FieldDefinitions wiped! Deleted ${totalDeleted} library documents.`);
    console.log('\n👉 To also clear the local IndexedDB copy, open the app and run in the');
    console.log('   browser console:');
    console.log('\n       await window.__wipeFieldDefinitions()\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
});
