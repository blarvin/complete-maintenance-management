/**
 * Vitest global setup - runs once before all tests.
 * Cleans up any leftover test fixtures from previous runs.
 */

export async function setup() {
    // Dynamic import to avoid issues with module resolution
    const { cleanupAllTestFixtures } = await import('./testUtils');
    
    console.log('\n[Test Setup] Cleaning up leftover test fixtures...');
    const cleaned = await cleanupAllTestFixtures();
    console.log(`[Test Setup] Cleaned: ${cleaned.nodes} nodes, ${cleaned.fields} fields, ${cleaned.history} history`);
}

export async function teardown() {
    const { cleanupAllTestFixtures } = await import('./testUtils');
    
    console.log('\n[Test Teardown] Final cleanup of test fixtures...');
    const cleaned = await cleanupAllTestFixtures();
    console.log(`[Test Teardown] Cleaned: ${cleaned.nodes} nodes, ${cleaned.fields} fields, ${cleaned.history} history`);
}
