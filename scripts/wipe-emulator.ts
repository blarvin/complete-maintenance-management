/**
 * Wipe every document from the local Firestore emulator.
 *
 * Run with: npm run wipe:emulator   (needs `npm run emulator` up)
 *
 * The safe sibling of wipe-elements.ts: same job, but scoped to localhost, so
 * it needs no confirmation flag. This is the reset to reach for by default —
 * point the app at the emulator (`?emulator=true`), wipe here, and production
 * is never in the blast radius.
 *
 * Hits the emulator's own clear-data endpoint, the same one Cypress uses in
 * `cy.clearEmulator()`.
 */

import { EMULATOR_HOST, PRODUCTION_FIREBASE_CONFIG } from './wipeShared';

const PROJECT_ID = PRODUCTION_FIREBASE_CONFIG.projectId;
const CLEAR_URL =
    `${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function main() {
    console.log(`Clearing the Firestore emulator at ${EMULATOR_HOST}...`);

    let response: Response;
    try {
        response = await fetch(CLEAR_URL, { method: 'DELETE' });
    } catch {
        console.error(`\n❌ Could not reach the emulator at ${EMULATOR_HOST}.`);
        console.error('   Start it first:  npm run emulator\n');
        process.exit(1);
    }

    if (!response.ok) {
        console.error(`\n❌ Emulator refused the clear: ${response.status} ${response.statusText}\n`);
        process.exit(1);
    }

    console.log('✅ Emulator cleared.');
    console.log('   The app keeps its local IndexedDB — full sync no longer purges it.');
    console.log('   To clear the client too, open the app and run: await window.__wipeLocal()');
    process.exit(0);
}

main().catch((err) => {
    console.error('Emulator wipe failed:', err);
    process.exit(1);
});
