import { initializeApp, getApps, getApp } from "firebase/app";
import {
    initializeFirestore,
    getFirestore,
    connectFirestoreEmulator,
    memoryLocalCache,
} from "firebase/firestore";
import { isEmulatorTarget } from "./syncTarget";
import { devLog } from "../utils/devMode";

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

export const db = getDb();
export const projectId = firebaseConfig.projectId;

// Connect to emulator if flag is set (must happen after db init, before any operations)
if (isBrowser && isEmulatorTarget && !emulatorConnected) {
    try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        emulatorConnected = true;
        devLog('🔥 Connected to Firestore Emulator (localhost:8080)');
    } catch {
        // Already connected (HMR scenario)
        emulatorConnected = true;
    }
}
