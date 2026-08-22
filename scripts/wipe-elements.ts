/**
 * Wipe Elements and history from PRODUCTION Firestore.
 *
 * Run with: npm run wipe:elements -- --yes
 *
 * ⚠️  WARNING: This deletes ALL elements and element history from the
 * production Firestore database. Since config-as-Elements, Library Definitions
 * are `treeType: 'library'` rows in the `elements` collection, so any synced
 * Definitions are wiped too — the client reseeds its Library locally on next
 * launch (the `library-*` bootstrap populations, revision-gated). The legacy `fieldDefinitions`
 * collection is not in the list; scripts/wipe-field-definitions.ts clears it.
 *
 * Wiping the server no longer clears any client: full sync stopped purging
 * local rows (IMPLEMENTATION.md → *Retention over reconciliation*), so clients keep everything they hold. That is
 * the point — but it means this script alone will not give you a clean slate.
 * For that, prefer `npm run wipe:emulator` plus `window.__wipeLocal()`.
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

// Element-model data (incl. Library Definitions, which live in `elements`
// since config-as-Elements). The legacy `fieldDefinitions` collection has its
// own wipe script. Legacy (pre-Element-model) element collections are included
// so leftover pre-refactor data also gets wiped.
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
    requireConfirmation('delete every element and history row from production');

    console.log('⚠️  WIPE ELEMENTS - This deletes all elements + history (incl. Library Definitions)!\n');
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
    console.log('   The client reseeds its Library locally on next launch.');
    console.log('   Existing clients keep their local data — full sync does not purge.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
});
