import { initializeApp, getApps, getApp } from "firebase/app";
import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    persistentSingleTabManager,
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

// Use persistent IndexedDB in browser; memory cache in Node (scripts)
const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";
export const isBrowserEnv = isBrowser;

// Initialize Firestore only once (handle HMR gracefully)
function getDb() {
    try {
        return initializeFirestore(app, {
            localCache: isBrowser
                ? persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) })
                : memoryLocalCache(),
        });
    } catch {
        // Already initialized, just return the existing instance
        return getFirestore(app);
    }
}

export const db = getDb();
export const projectId = firebaseConfig.projectId;
