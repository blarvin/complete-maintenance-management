/**
 * Standalone cleanup script - removes all test fixtures from Firestore.
 * Run with: npm run test:cleanup
 */

import { cleanupAllTestFixtures } from './testUtils';

async function main() {
    console.log('Cleaning up all test fixtures...');
    const cleaned = await cleanupAllTestFixtures();
    console.log(`Cleaned: ${cleaned.elements} elements, ${cleaned.elementHistory} history, ${cleaned.fieldDefinitions} field definitions`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
