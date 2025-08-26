import { randomUUID } from "node:crypto";
import { enableNetwork, disableNetwork, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../src/data/firebase";

// Healthcheck: verifies emulator connectivity and offline queueing using a temp doc.
async function main() {
    const collectionName = "__healthcheck";
    const id = randomUUID();

    // Online write/read round-trip
    await enableNetwork(db);
    await setDoc(doc(collection(db, collectionName), id), {
        id,
        t: Date.now(),
        note: "online-write",
    });
    const onlineDoc = await getDoc(doc(db, collectionName, id));
    if (!onlineDoc.exists()) throw new Error("Healthcheck: online write not readable");

    // Offline queued write, then re-enable and confirm
    await disableNetwork(db);
    const offlineId = randomUUID();
    await setDoc(doc(collection(db, collectionName), offlineId), {
        id: offlineId,
        t: Date.now(),
        note: "offline-queued-write",
    });

    // Ensure local query sees both docs from cache
    const q = query(collection(db, collectionName), where("id", "in", [id, offlineId]), orderBy("id", "asc"));
    const snapWhileOffline = await getDocs(q);
    if (snapWhileOffline.docs.length < 1) throw new Error("Healthcheck: cache did not return docs while offline");

    // Come back online and confirm queued write reaches emulator
    await enableNetwork(db);
    const queuedDoc = await getDoc(doc(db, collectionName, offlineId));
    if (!queuedDoc.exists()) throw new Error("Healthcheck: queued offline write not persisted after re-enable network");

    console.log("Healthcheck OK: emulator reachable + offline queue works");
    process.exit(0);
}

main().catch(err => {
    console.error("Healthcheck FAILED:", err?.message || err);
    process.exit(1);
});


