import { initializeApp, getApps, getApp } from "firebase/app";
import {
    initializeFirestore,
    getFirestore,
    connectFirestoreEmulator,
    memoryLocalCache,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBgVGwmf8o6eP7XRW-Jv8AwScIrIDPertA",
    authDomain: "treeview-blarapp.firebaseapp.com",
    projectId: "treeview-blarapp",
    storageBucket: "treeview-blarapp.firebasestorage.app",
    messagingSenderId: "1041054928276",
    appId: "1:1041054928276:web:f4804c9c7b35c66cd4d381",
    measurementId: "G-EKFEGPTXL2",
};

// Prevent re-initialization on HMR
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";
export const isBrowserEnv = isBrowser;

// Track emulator connection state
let emulatorConnected = false;

/**
 * Check if we should use the Firestore Emulator.
 * Reads from localStorage (set by Cypress) or URL param.
 */
function shouldUseEmulator(): boolean {
    if (!isBrowser) return false;
    
    try {
        // Check localStorage (set by Cypress before page load)
        if (localStorage.getItem('USE_FIRESTORE_EMULATOR') === 'true') {
            return true;
        }
        // Check URL param (alternative for manual testing)
        const params = new URLSearchParams(window.location.search);
        if (params.get('emulator') === 'true') {
            return true;
        }
    } catch {
        // Ignore errors (SSR, security restrictions)
    }
    return false;
}

// Initialize Firestore only once (handle HMR gracefully).
// IDB persistence intentionally disabled — Dexie + syncQueue is the app's
// only offline cache (audit §2.2); Firestore is a dumb wire.
function getDb() {
    try {
        return initializeFirestore(app, {
            localCache: memoryLocalCache(),
        });
    } catch {
        // Already initialized, just return the existing instance
        return getFirestore(app);
    }
}

/**
 * Clear all Firebase IndexedDB databases.
 * The SDK no longer creates these (memory cache only), but orphaned mirror
 * DBs linger on devices that ran older builds with persistentLocalCache —
 * this is the cleanup tool for them.
 *
 * To use: Call `clearFirebaseIndexedDB()` in the browser console.
 */
export async function clearFirebaseIndexedDB(): Promise<void> {
    if (!isBrowser || !indexedDB.databases) {
        console.warn('IndexedDB not available or databases() not supported');
        return;
    }

    try {
        const databases = await indexedDB.databases();
        const firebaseDbs = databases.filter(db => 
            db.name?.includes('firebase') || db.name?.includes('firestore')
        );

        if (firebaseDbs.length === 0) {
            console.log('No Firebase IndexedDB databases found');
            return;
        }

        console.log(`Clearing ${firebaseDbs.length} Firebase IndexedDB database(s)...`);
        
        await Promise.all(
            firebaseDbs.map(db => {
                return new Promise<void>((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(db.name!);
                    request.onsuccess = () => {
                        console.log(`✅ Deleted: ${db.name}`);
                        resolve();
                    };
                    request.onerror = () => {
                        console.error(`❌ Failed to delete: ${db.name}`);
                        reject(request.error);
                    };
                });
            })
        );

        console.log('✅ All Firebase IndexedDB databases cleared. Please refresh the page.');
    } catch (error) {
        console.error('Failed to clear IndexedDB:', error);
    }
}

// Expose to window for easy console access
if (isBrowser) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).clearFirebaseIndexedDB = clearFirebaseIndexedDB;
}

export const db = getDb();
export const projectId = firebaseConfig.projectId;

// Connect to emulator if flag is set (must happen after db init, before any operations)
if (isBrowser && shouldUseEmulator() && !emulatorConnected) {
    try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        emulatorConnected = true;
        console.log('🔥 Connected to Firestore Emulator (localhost:8080)');
    } catch {
        // Already connected (HMR scenario)
        emulatorConnected = true;
    }
}
