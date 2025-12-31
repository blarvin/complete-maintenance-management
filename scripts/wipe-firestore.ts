/**
 * Wipe all data from Firestore.
 * 
 * Run with: npx tsx scripts/wipe-firestore.ts
 * 
 * ⚠️  WARNING: This deletes ALL data from the production Firestore database!
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

// All collections in this Firestore database
const COLLECTIONS = ['treeNodes', 'dataFields', 'dataFieldHistory'];

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
    console.log('⚠️  WIPE FIRESTORE - This will delete ALL data!\n');
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
    process.exit(0);
}

main().catch((err) => {
    console.error('Wipe failed:', err);
    process.exit(1);
});
