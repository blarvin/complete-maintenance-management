Setup

Two clients, both in emulator mode (?emulator=true), against npm run emulator + npm run dev.

They must be separate browser profiles (or one normal + one incognito). Two tabs in the same profile share IndexedDB — DB_NAME_BY_TARGET gives emulator mode one fixed database name — so B's write would appear in A's tree with no sync involved at all, and you'd be testing nothing.

Trigger it without waiting 10 minutes

The manager is pinned on globalThis (the ISSUES Bugs #2 fix), so from the observing client's console:

await __cmmSyncManager.syncDelta()

What you should see

[SyncManager] Starting delta sync cycle...
[SyncManager] Pull: Starting delta sync
[DeltaSync] Pulling changes since 178655734547
[DeltaSync] Pulled 1 elements
[DeltaSync] Complete: { elementsApplied: 1, elementHistoryApplied: 1 }

Before the fix that middle line was Pulled 0 e. That's your signal — Pulled 0 after a knownremote write means it's still broken.

Note [SyncManager] lines are import.meta.env.D not preview:pwa. The [DeltaSync] lines aren't
gated and show up either way.

Do both a create and a delete — soft delete bumps updatedAt, so a deletion should arrive through the same delta path as an edit.
Two trapsPrefer a second app client over hand-editing. and in the Emulator UI, updatedAt lands aswhatever type the UI writes. If that's a number, the delta query skips it — the exact type-scoping that caused the bug — and you'd wrongly conclude the fix failed. A real client writes serverTimestamp(). If you do hand-edit, set updatedAt explicitly as a timestamp.

Use the Emulator UI (http://127.0.0.1:4000/firestore), not the Firebase console, unless you deliberately want a productest — the console edits live data.

---                                                                                                                   One thing I noticed while reading this that I' since I haven't observed it: syncDelta() setsthe cursor with setLastSyncTimestamp(now()) — the local clock — while updatedAt on the documents comes from the server clock. On one machine against the emulator those are the same clock, so your test won't reveal anything. Against real Firestore, a client running fast would set a ctamps and permanently skip the rows written inthat window. Worth a thought before this ships, but it's separate from the fix you just took.