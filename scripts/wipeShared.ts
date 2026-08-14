/**
 * Shared pieces for the wipe scripts.
 *
 * These scripts point at **production** by default, which is the whole reason
 * this module exists: `npm run wipe:elements` is one typo away from deleting
 * real data, and it used to run the moment you typed it. Now it refuses without
 * an explicit `--yes`.
 *
 * There is a third copy of the Firebase config in `src/data/firebase.ts`. It
 * stays there on purpose — `src/` is a browser bundle and these run under tsx,
 * and coupling them would drag Firebase app initialization (a module side
 * effect in firebase.ts) into a Node script.
 */

export const PRODUCTION_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBgVGwmf8o6eP7XRW-Jv8AwScIrIDPertA",
    authDomain: "treeview-blarapp.firebaseapp.com",
    projectId: "treeview-blarapp",
    storageBucket: "treeview-blarapp.firebasestorage.app",
    messagingSenderId: "1041054928276",
    appId: "1:1041054928276:web:f4804c9c7b35c66cd4d381",
};

export const EMULATOR_HOST = 'http://localhost:8080';

/**
 * Refuse to run a destructive script unless `--yes` was passed. Exits the
 * process rather than throwing — these are one-shot CLIs, not library code.
 */
export function requireConfirmation(description: string): void {
    if (process.argv.includes('--yes')) return;

    console.error(`\n⚠️  REFUSING TO RUN — this would ${description}.`);
    console.error(`   Project: ${PRODUCTION_FIREBASE_CONFIG.projectId} (PRODUCTION)\n`);
    console.error('   Re-run with --yes if that is really what you want:\n');
    console.error(`       npx tsx ${process.argv[1] ?? '<script>'} --yes\n`);
    console.error('   To reset local data instead, open the app and run:\n');
    console.error('       await window.__wipeLocal()\n');
    console.error('   To reset the emulator instead:\n');
    console.error('       npm run wipe:emulator\n');
    process.exit(1);
}
