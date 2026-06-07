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
export async function cleanupAllTestFixtures(): Promise<{ elements: number; elementHistory: number; fieldDefinitions: number }> {
    const [elements, elementHistory, fieldDefinitions] = await Promise.all([
        cleanupCollection(COLLECTIONS.ELEMENTS),
        cleanupCollection(COLLECTIONS.ELEMENT_HISTORY),
        cleanupCollection(COLLECTIONS.FIELD_DEFINITIONS),
    ]);

    return { elements, elementHistory, fieldDefinitions };
}

/**
 * Clean up test fixtures for a specific element subtree: the element itself,
 * its child elements, and all related element-history rows.
 */
export async function cleanupTestElement(elementId: string): Promise<void> {
    if (!isTestId(elementId)) {
        throw new Error(`cleanupTestElement called with non-test ID: ${elementId}`);
    }

    const batch = writeBatch(db);

    // Child elements (one level — Phase 1 deletes are leaf/shallow).
    const childrenSnap = await getDocs(query(
        collection(db, COLLECTIONS.ELEMENTS),
        where('parentId', '==', elementId),
    ));
    for (const childDoc of childrenSnap.docs) {
        batch.delete(doc(db, COLLECTIONS.ELEMENTS, childDoc.id));
    }

    // Element history for this element.
    const historySnap = await getDocs(query(
        collection(db, COLLECTIONS.ELEMENT_HISTORY),
        where('elementId', '==', elementId),
    ));
    for (const histDoc of historySnap.docs) {
        batch.delete(doc(db, COLLECTIONS.ELEMENT_HISTORY, histDoc.id));
    }

    // The element itself.
    batch.delete(doc(db, COLLECTIONS.ELEMENTS, elementId));

    await batch.commit();
}

/**
 * Wait for Firestore operations to settle (useful after writes)
 */
export function settle(ms = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
