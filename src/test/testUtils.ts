/**
 * Test utilities for integration tests against real Firestore.
 * All test records are tagged with TEST_PREFIX for easy identification and cleanup.
 */

import { db } from '../data/firebase';
import { collection, getDocs, doc, query, where, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../constants';

// All test fixture IDs start with this prefix
export const TEST_PREFIX = 'TEST_';

/**
 * Generate a test-tagged UUID
 */
export function testId(): string {
    return `${TEST_PREFIX}${crypto.randomUUID()}`;
}

/**
 * Check if an ID is a test fixture
 */
export function isTestId(id: string): boolean {
    return id.startsWith(TEST_PREFIX);
}

/**
 * Delete all test fixtures from a single collection
 */
async function cleanupCollection(collectionName: string): Promise<number> {
    const coll = collection(db, collectionName);
    const snapshot = await getDocs(coll);
    
    let deleted = 0;
    const batch = writeBatch(db);
    
    for (const docSnap of snapshot.docs) {
        const id = docSnap.id;
        if (isTestId(id)) {
            batch.delete(doc(db, collectionName, id));
            deleted++;
        }
    }
    
    if (deleted > 0) {
        await batch.commit();
    }
    
    return deleted;
}

/**
 * Clean up all test fixtures from all collections.
 * Call this in globalSetup/globalTeardown or after test suites.
 */
export async function cleanupAllTestFixtures(): Promise<{ nodes: number; fields: number; history: number }> {
    const [nodes, fields, history] = await Promise.all([
        cleanupCollection(COLLECTIONS.NODES),
        cleanupCollection(COLLECTIONS.FIELDS),
        cleanupCollection(COLLECTIONS.HISTORY),
    ]);
    
    return { nodes, fields, history };
}

/**
 * Clean up test fixtures for a specific node and its related records.
 * Useful for cleaning up after individual tests.
 */
export async function cleanupTestNode(nodeId: string): Promise<void> {
    if (!isTestId(nodeId)) {
        throw new Error(`cleanupTestNode called with non-test ID: ${nodeId}`);
    }
    
    // Delete fields for this node
    const fieldsQuery = query(
        collection(db, COLLECTIONS.FIELDS),
        where('parentNodeId', '==', nodeId)
    );
    const fieldsSnap = await getDocs(fieldsQuery);
    
    const batch = writeBatch(db);
    
    // Delete related history entries
    for (const fieldDoc of fieldsSnap.docs) {
        const fieldId = fieldDoc.id;
        const historyQuery = query(
            collection(db, COLLECTIONS.HISTORY),
            where('dataFieldId', '==', fieldId)
        );
        const historySnap = await getDocs(historyQuery);
        for (const histDoc of historySnap.docs) {
            batch.delete(doc(db, COLLECTIONS.HISTORY, histDoc.id));
        }
        batch.delete(doc(db, COLLECTIONS.FIELDS, fieldId));
    }
    
    // Delete the node itself
    batch.delete(doc(db, COLLECTIONS.NODES, nodeId));
    
    await batch.commit();
}

/**
 * Wait for Firestore operations to settle (useful after writes)
 */
export function settle(ms = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
