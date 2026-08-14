/**
 * Wipe all FieldDefinitions from PRODUCTION Firestore.
 *
 * Run with: npm run wipe:fielddefs -- --yes
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
 * its working copy. This script clears the Firestore side; to clear the local
 * IDB side, open the app and run in the browser console:
 *
 *     await window.__wipeDefinitions()
 *
 * That helper clears the local copy and resets the seed-version key, so the dev
 * seeds re-seed on the next reload (a factory-default reset).
 */

import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    writeBatch,
    doc,
} from 'firebase/firestore';
import { PRODUCTION_FIREBASE_CONFIG, requireConfirmation } from './wipeShared';

const firebaseConfig = PRODUCTION_FIREBASE_CONFIG;

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
    requireConfirmation('delete every library Definition from production');

    console.log('⚠️  WIPE FIELD DEFINITIONS - This deletes all FieldDefinitions from Firestore!\n');
    console.log(`Project: ${firebaseConfig.projectId}`);
    console.log('');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const totalDeleted = await deleteLibraryDefinitions(db);

    console.log(`\n✅ Firestore FieldDefinitions wiped! Deleted ${totalDeleted} library documents.`);
    console.log('\n👉 To also clear the local IndexedDB copy, open the app and run in the');
    console.log('   browser console:');
    console.log('\n       await window.__wipeDefinitions()\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
});
