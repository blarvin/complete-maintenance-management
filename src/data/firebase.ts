import { initializeApp } from "firebase/app";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentSingleTabManager,
    memoryLocalCache,
    connectFirestoreEmulator,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "dev-placeholder",
    authDomain: "dev-placeholder.firebaseapp.com",
    projectId: "treeview-blarapp",
};

const app = initializeApp(firebaseConfig);

// Use persistent IndexedDB in browser; memory cache in Node (scripts)
const isBrowser = typeof window !== "undefined" && typeof indexedDB !== "undefined";
export const isBrowserEnv = isBrowser;
export const db = initializeFirestore(app, {
    localCache: isBrowser
        ? persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) })
        : memoryLocalCache(),
});

// Dev/emulator check that works in both Node and browser (no bundler needed)
const isDev =
    (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") ||
    (typeof window !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1"));

if (isDev) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// These are used by the data layer status checker.
export const isUsingEmulator = isDev;
export const projectId = firebaseConfig.projectId;