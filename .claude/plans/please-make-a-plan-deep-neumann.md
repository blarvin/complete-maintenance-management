# Refactor Audit Phase 3: Single Cache (§2.2) + Failed-Queue Retries & Alert (§4.3)

## Context

Phase 3 of the sequence in `fable-code-audit-100626.md` §6. Two items:

1. **§2.2 — Two offline caches.** `firebase.ts:60-71` initializes Firestore with `persistentLocalCache` in the browser, so every element is persisted in IndexedDB twice (Dexie's `complete-maintenance-management` DB + the Firestore SDK mirror) and two write queues exist. The bespoke Dexie+syncQueue+SyncManager layer is the spec-blessed one; Firestore should be a dumb wire. Fix: `memoryLocalCache()` everywhere.

2. **§4.3 — Failed sync items are stranded forever.** `SyncQueueManager.markFailed` sets `status: 'failed'`, but `getSyncQueue()` only fetches `'pending'`, so a failed item is never retried and never surfaced — silent data-loss-to-the-server. `retryCount` exists but can never exceed 1.

**User decisions (confirmed via Q&A):**
- Bounded auto-retry: **5 attempts**, riding existing sync cycles (write-debounced, `online` event, 10-min timer) — no new backoff machinery.
- On exhaustion: **error snackbar with a "Retry" action** that re-arms the items and syncs immediately.
- **App startup re-arms** all failed items (fresh launch = fresh retry budget), so a missed toast isn't permanent.

This matches the decision already recorded in LATER.md §"Sync Status & Pull-Applied Notifications": *"Snackbar toast only when SyncQueueManager exhausts retries for an item — otherwise sync stays silent per Phase 1."*

---

## Part A — Single cache (§2.2)

**File: `src/data/firebase.ts`**

- In `getDb()` (lines 60-71): replace the `isBrowser ? persistentLocalCache(...) : memoryLocalCache()` ternary with unconditional `localCache: memoryLocalCache()`.
- Remove now-unused imports `persistentLocalCache`, `persistentMultipleTabManager`.
- Replace the multi-tab leader-election comment block (lines 54-59) with a short note: *IDB persistence intentionally disabled — Dexie + syncQueue is the app's only offline cache (audit §2.2); Firestore is a dumb wire.*
- **Keep** `clearFirebaseIndexedDB()` and its window exposure — it's now the cleanup tool for the orphaned SDK mirror DBs lingering on existing devices (mention in code comment).

## Part B — Failed-queue retries + alert (§4.3)

### B1. Retry constant — `src/constants.ts`

Add `MAX_SYNC_RETRIES = 5` (hardcoded values live here per CLAUDE.md).

### B2. `src/data/sync/SyncQueueManager.ts`

- `getSyncQueue()`: fetch `db.syncQueue.where('status').anyOf('pending', 'failed')`, then JS-filter out `status === 'failed' && retryCount >= MAX_SYNC_RETRIES`, keep the timestamp sort. (`status` is already indexed; no Dexie schema change.)
- `markFailed(id, error)`: change return type `Promise<void>` → `Promise<boolean>` — returns `true` when the increment makes the item exhausted (`retryCount + 1 >= MAX_SYNC_RETRIES`). Logic otherwise unchanged.
- New method `requeueFailed(): Promise<number>` — resets all `status: 'failed'` items to `{ status: 'pending', retryCount: 0 }` (keep `lastError` for forensics), returns how many were re-armed. Used by both the Retry action and startup re-arm.
- Update the `SyncQueueManager` interface accordingly.
- Optional micro-cleanup while here: the `SyncQueueItem.status` union in `src/data/storage/db.ts` includes `'syncing' | 'synced'` which nothing ever sets (`markSynced` deletes the row). Narrow to `'pending' | 'failed'` after a grep confirms no references.

### B3. `src/data/sync/SyncPusher.ts`

- Extend `PushResult` with `exhausted: number`.
- In the catch branch: `const isExhausted = await this.syncQueue.markFailed(item.id, err); if (isExhausted) exhausted++;`
- Return it; empty-queue early return includes `exhausted: 0`.

### B4. Exhaustion alert — `src/data/sync/syncManager.ts`

- Store `syncQueue` as a private field on `SyncManager` (currently only passed to collaborators in the constructor).
- In both `syncDelta()` and `syncFull()`: capture `const pushResult = await this.pusher.push();` and call a shared private `this.notifyIfExhausted(pushResult)`.
- `notifyIfExhausted`: if `exhausted > 0`, `getSnackbarService().show({ message: \`${n} change(s) failed to sync\`, variant: 'error', action: { label: 'Retry', handler: retryFailedSyncQrl } })`.
- **QRL wrinkle:** `ToastAction.handler` is a `QRL` (`src/services/snackbar/types.ts:5-8`), so the handler must be a **module-level** `$()` in `syncManager.ts`:
  ```ts
  export const retryFailedSyncQrl = $(async () => {
    await getSyncManager().retryFailed();
  });
  ```
  and a public `SyncManager.retryFailed()` that does `await this.syncQueue.requeueFailed(); await this.syncOnce();`. The QRL captures only the imported module-level `getSyncManager` — serialization-safe, consistent with the registry-getter pattern in CLAUDE.md.
- Toast chattiness is self-limiting: items only *become* exhausted once (they then drop out of `getSyncQueue()`), so the toast fires on that one cycle, not every cycle.
- Existing service: `getSnackbarService()` from `src/services/snackbar/index.ts` — module-level, callable outside components, mockable via `setSnackbarService()`.

### B5. Startup re-arm — `src/data/storage/initStorage.ts`

In `doInitializeStorage()`, right after `const syncQueue = new IDBSyncQueueManager();` (line 86): `await syncQueue.requeueFailed();` — before the initial `syncFull()` so re-armed items ride the startup push.

### B6. Tests (Vitest, existing patterns)

- **`src/test/SyncPusher.test.ts`** (update): `PushResult` shape gains `exhausted`; mock `markFailed` resolving `true`/`false`; assert exhausted tally.
- **New `src/test/SyncQueueManager.test.ts`** (fake-indexeddb, like `idbAdapterErrors.test.ts`): `getSyncQueue` includes failed items under the cap and excludes items at the cap; `markFailed` returns `true` exactly when the cap is reached; `requeueFailed` resets status/retryCount and returns the count.
- **SyncManager toast** (add to a sync test or small new file): with `setSnackbarService(mock)`, a push producing `exhausted > 0` shows one error toast with a Retry action; `exhausted === 0` shows nothing. Per testing conventions, test at the service layer, not components.

---

## Verification

1. `npm run test`, `npm run typecheck`, `npm run lint`.
2. Manual / emulator (the §2.2 "retesting the emulator flows" the audit calls for):
   - `npm run emulator` + `npm run dev`, open with `?emulator=true`.
   - Confirm normal flow: create/edit elements, `window.__sync()`, data appears in emulator UI; reload page — data still loads (from Dexie) with no Firestore IDB mirror recreated (DevTools → Application → IndexedDB shows no `firestore/...` DB after clearing old ones).
   - Failed-path: stop the emulator (with the flag still on), make 5+ edits triggering sync cycles (each write triggers a debounced push) until retries exhaust → error snackbar appears with Retry; restart emulator, click Retry → items sync, queue drains (`window.__syncStatus()`).
   - Restart-re-arm: exhaust an item, reload the app with the emulator back up → item syncs without any toast interaction.
3. Cypress E2E suite if the emulator flows above look healthy (`npm run cypress`).

## Project Context Management

After the user confirms the implementation works:

1. **fable-code-audit-100626.md** — annotate §2.2 and §4.3 with `✅ RESOLVED 2026-06-10` + one-line outcome (same pattern as §2.7), and tick step 3 in §6.
2. **ISSUES.md** — no existing sync/cache items found; nothing to mark.
3. **IMPLEMENTATION.md** — short note: retry policy (5 attempts riding sync cycles, no dedicated backoff), exhaustion toast with Retry QRL pattern, startup re-arm rationale.
4. **LATER.md** — update §"Sync Status & Pull-Applied Notifications": the exhausted-retries snackbar bullet is now implemented; the status chip + pull-applied toasts remain deferred. Note the orphaned Firestore mirror DBs on existing devices are cleanable via `clearFirebaseIndexedDB()` (no auto-cleanup built, by design).
