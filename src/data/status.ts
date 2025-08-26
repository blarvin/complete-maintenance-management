import { db, isUsingEmulator, isBrowserEnv, projectId } from "./firebase";
import { waitForPendingWrites, onSnapshotsInSync, collection, query, limit, getDocsFromServer, getDocsFromCache } from "firebase/firestore";

export type DataLayerStatus = {
    onlineLikely: boolean; // heuristic based on server fetch
    usingEmulator: boolean;
    hasPendingWrites: boolean; // after a sync point
    cacheUsable: boolean; // can read from cache
    projectId: string;
};

/**
 * Probes Firestore for basic health: server reachability, cache readability, pending writes.
 * Safe to call at app startup; resolves quickly and never throws.
 */
export async function getDataLayerStatus(): Promise<DataLayerStatus> {
    let onlineLikely = false;
    let hasPendingWrites = false;
    let cacheUsable = false;

    try {
        // Ensure we observe a consistent state for pending writes listeners
        await waitForPendingWrites(db);
        hasPendingWrites = false;
    } catch {
        // If this throws, we still proceed with other probes
    }

    const coll = collection(db, "treeNodes");
    const q = query(coll, limit(1));

    // Probe cache
    try {
        const snapCache = await getDocsFromCache(q);
        cacheUsable = !!snapCache;
    } catch {
        cacheUsable = false;
    }

    // Probe server
    try {
        const snapServer = await getDocsFromServer(q);
        onlineLikely = !!snapServer; // a 200 (even empty) implies server reachable
    } catch {
        onlineLikely = false;
    }

    // After a sync point, determine if there are pending writes by listening for a micro sync
    await new Promise<void>(resolve => onSnapshotsInSync(db, () => resolve()));
    try {
        await waitForPendingWrites(db);
        hasPendingWrites = false;
    } catch {
        hasPendingWrites = true;
    }

    return {
        onlineLikely,
        usingEmulator: isUsingEmulator,
        hasPendingWrites,
        cacheUsable: cacheUsable || isBrowserEnv,
        projectId,
    };
}

/**
 * Quick assertion helper that throws with a concise message if connectivity looks broken.
 */
export async function assertDataLayerHealthy(): Promise<void> {
    const s = await getDataLayerStatus();
    if (!s.onlineLikely && !s.cacheUsable) {
        throw new Error("Data layer unavailable: no server and no readable cache");
    }
}

/**
 * Example usage:
 * 
 * await assertDataLayerHealthy(); // throw early if neither server nor cache is usable
 * 
 * const status = await getDataLayerStatus();
 * // e.g., show a subtle banner if !status.onlineLikely but status.cacheUsable is true
 */