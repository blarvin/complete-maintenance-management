/**
 * Scrub (delete) ALL data from Firestore.
 * Run with: npm run db:scrub
 * 
 * WARNING: This deletes everything! Only use in dev.
 */

import { db } from '../src/data/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { COLLECTIONS } from '../src/constants';

async function scrubCollection(collectionName: string): Promise<number> {
    const coll = collection(db, collectionName);
    const snapshot = await getDocs(coll);
    
    if (snapshot.empty) {
        return 0;
    }
    
    // Firestore batch limit is 500
    const BATCH_SIZE = 500;
    let deleted = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnap of snapshot.docs) {
        batch.delete(doc(db, collectionName, docSnap.id));
        batchCount++;
        deleted++;
        
        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
        }
    }
    
    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }
    
    return deleted;
}

async function main() {
    console.log('🔥 Scrubbing ALL Firestore data...\n');
    
    const collections = [
        COLLECTIONS.NODES,
        COLLECTIONS.FIELDS,
        COLLECTIONS.HISTORY,
    ];
    
    let total = 0;
    
    for (const collName of collections) {
        const count = await scrubCollection(collName);
        console.log(`  ${collName}: ${count} docs deleted`);
        total += count;
    }
    
    console.log(`\n✅ Done. ${total} documents deleted.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Scrub failed:', err);
    process.exit(1);
});

