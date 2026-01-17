---
description: Test PWA offline functionality with browser automation
allowed-tools: Bash, mcp__claude-in-chrome__*, AskUserQuestion, TodoWrite
---

# PWA Offline Test

Test that the app works offline after service worker caches all chunks.

**IMPORTANT NOTES:**
- This test uses server termination (not DevTools offline mode) to simulate network failure
- The app may have orphan nodes from cancelled construction - these don't appear until refresh
- All verifications use DOM inspection (`read_page`) + console logs, not just screenshots
- **Screenshots:** When you see "Take screenshot #N", the image will appear in the conversation output immediately after the tool call. Always caption it clearly (e.g., "Screenshot #1 - Baseline state showing 5 root nodes")
- **Console logs are critical:** This test relies heavily on structured console output for verification. Look for EXACT log messages as specified in each step:
  - `[App]` prefix - Application-level events (network, service worker)
  - `[SW]` prefix - Service worker cache operations
  - `[IDBAdapter]` prefix - IndexedDB write confirmations
  - `[SyncManager]` prefix - Sync queue operations
  - `[Storage]` prefix - Storage initialization
  - `[useRootViewData]` prefix - Data loading operations

---

## Phase 1: Offline Functionality

### 1. Build and Serve

```bash
npm run build
npm run preview:pwa  # background task on port 4173
```

**Verification:**
- Build must complete without errors
- Server responds to `curl http://localhost:4173`

---

### 2. Baseline State (Online)

**Actions:**
1. Navigate to http://localhost:4173
2. Wait 2 seconds for app initialization
3. **Take screenshot #1 (initial state) - show to user with caption**
4. Use `read_page` to get DOM structure
5. Read console messages (pattern: "App.*ServiceWorker|App.*network|Storage.*IDB|useRootViewData.*Fetched")

**Verification - Look for these EXACT logs:**
- `[App] ServiceWorker registered: <scope>` - Confirms SW is ready
- `[App] Initial network state: ONLINE` - Confirms network detection working
- `[Storage] IDB has N nodes, using existing data` - Get IDB count
- `[useRootViewData] Fetched N root nodes` - Get fetched count
- Count nodes visible in DOM using `read_page`
- **Record baseline count** (e.g., "5 root nodes before test")

**Output to user:**
```
Baseline state verified:
- Service worker: ✅ registered at <scope>
- Network state: ONLINE
- IndexedDB: N nodes
- Fetched: N root nodes
- Visible in DOM: X nodes
- Node names: [list from DOM]
```

---

### 3. Create Test Node (Online)

**Actions:**
1. Click "Create New Asset" button
2. Wait 1 second for form to appear
3. Enter "Offline Test Node" in name field
4. Click "Create" button
5. Wait 2 seconds for node to appear and state to settle
6. Take screenshot #2 (with new node)
7. Use `read_page` to verify node in DOM
8. Read console messages (pattern: "IDBAdapter.*Node created|useRootViewData")

**Verification - Look for these EXACT logs:**
- `[IDBAdapter] Node created in IDB: <id> Offline Test Node` - Confirms persistence
- `[useRootViewData] Fetched N root nodes` - Should now be X+1
- Node "Offline Test Node" appears in DOM (use `find` or `read_page`)
- Node count increased by 1
- No console errors

**Output to user:**
```
Test node created:
- IDB write confirmed: ✅ [IDBAdapter] Node created in IDB
- Node "Offline Test Node" visible: ✅/❌
- New node count: X+1
- Console errors: none/[list]
```

---

### 4. Simulate Network Failure

**IMPORTANT:** We cannot programmatically toggle DevTools offline mode. Instead, we kill the server to simulate network unavailability for the app's origin.

**Actions:**
1. Kill the preview server process
2. Verify with `curl http://localhost:4173` (should fail with connection error)

**Verification:**
- curl returns connection refused/timeout error
- Server process terminated

**Output to user:**
```
Network failure simulated:
- Server killed: ✅
- curl verification: connection failed ✅
```

---

### 5. Offline Load Test

**Actions:**
1. Refresh the browser page (F5 or navigate to http://localhost:4173)
2. Wait 3 seconds for service worker to serve cached assets
3. Take screenshot #3 (offline load)
4. Use `read_page` to count nodes in DOM
5. Read console messages (pattern: "SW.*Cache HIT|SW.*Network FAILED|Storage.*IDB|useRootViewData")

**Verification - Look for these EXACT logs:**
- `[SW] Network FAILED, trying cache: http://localhost:4173/` - Network unavailable
- `[SW] Cache HIT (fallback): http://localhost:4173/` - HTML served from cache
- `[SW] Cache HIT: /build/<chunk>.js` - Multiple JS chunks served from cache
- `[Storage] IDB has N+1 nodes, using existing data` - Confirms IDB count
- `[useRootViewData] Fetched N+1 root nodes` - Confirms data loaded
- DOM contains X+1 nodes via `read_page`
- "Offline Test Node" visible in DOM
- No unexpected errors (network failures are expected and OK)

**CRITICAL:** If nodes don't appear in DOM via `read_page`, test FAILS. Do NOT scroll around looking for them or check IDB directly - the UI must render them from IDB automatically.

**Output to user:**
```
Offline load verification:
- Page loaded from cache: ✅ [SW] Cache HIT (fallback)
- JS chunks from cache: ✅ [SW] Cache HIT × N times
- Service worker active: ✅
- IDB has N+1 nodes: ✅
- Fetched N+1 nodes: ✅
- Nodes in DOM: X+1 (expected X+1) ✅/❌
- "Offline Test Node" visible: ✅/❌
- Console errors: none/[list]

If any ❌ above, test FAILS - do not continue.
```

---

### 6. Create Node While Offline

**Actions:**
1. Click "Create New Asset" button
2. Wait 1 second
3. Enter "Created While Offline" in name field
4. Click "Create" button
5. Wait 2 seconds for node to appear
6. Take screenshot #4 (offline creation)
7. Use `read_page` to verify new node in DOM
8. Read console messages (pattern: "IDBAdapter.*Node created|useRootViewData")

**Verification - Look for these EXACT logs:**
- `[IDBAdapter] Node created in IDB: <id> Created While Offline` - Confirms persistence
- `[useRootViewData] Fetched N root nodes` - Should now be X+2
- Node "Created While Offline" appears in DOM
- Node count is now X+2
- No errors in console

**Output to user:**
```
Offline node creation:
- IDB write confirmed: ✅ [IDBAdapter] Node created in IDB
- Node "Created While Offline" visible: ✅/❌
- Node count: X+2 (expected X+2) ✅/❌
- Console errors: none/[list]
```

---

### 7. Phase 1 Summary

**Report to user:**
```
=== PHASE 1: OFFLINE FUNCTIONALITY TEST ===

Build:
- ✅/❌ Build succeeded
- Service worker precached N files

Online Baseline:
- ✅/❌ App loaded successfully
- ✅/❌ Baseline nodes: X
- ✅/❌ Service worker registered

Online Node Creation:
- ✅/❌ Created "Offline Test Node"
- ✅/❌ Node visible in UI
- ✅/❌ No console errors

Offline Simulation:
- ✅/❌ Server killed successfully
- ✅/❌ Network unavailable (verified)

Offline Load:
- ✅/❌ Page loaded from service worker cache
- ✅/❌ All X+1 nodes rendered
- ✅/❌ "Offline Test Node" visible
- ✅/❌ No errors

Offline Node Creation:
- ✅/❌ Created "Created While Offline"
- ✅/❌ Node visible in UI
- ✅/❌ IndexedDB operations working
- ✅/❌ No errors

RESULT: [PASS/FAIL]
```

---

## Phase 2 Decision Point

Use AskUserQuestion to ask:
- Question: "Phase 1 complete. Continue to Phase 2 (sync test)?"
- Options:
  - "Yes - Test sync to Firestore"
  - "No - End here"

If "No", END SKILL HERE.

---

## Phase 2: Sync Verification (Optional)

### 8. Restore Network

**Actions:**
1. Restart server: `npm run preview:pwa` in background
2. Wait 2 seconds
3. Verify with `curl http://localhost:4173`
4. Refresh browser page
5. Wait 5 seconds for sync to trigger

**Verification:**
- curl succeeds (server responds)
- Page reloads successfully

---

### 9. Verify Sync Activity

**Actions:**
1. Read console messages (pattern: "App.*Network.*ONLINE|SyncManager.*sync|SyncManager.*Push")
2. Look for sync queue processing
3. Take screenshot #5 (after reconnect)

**Verification - Look for these EXACT logs:**
- `[App] Network: ONLINE` - Network state change detected
- `[SyncManager] Network online - triggering sync` - Sync triggered by network change
- `[SyncManager] Starting sync cycle...` - Sync started
- `[SyncManager] Push: Processing N items` - Pending operations found
- `[SyncManager] Push: Synced createNode <id>` - Node creation synced (look for 2: online + offline nodes)
- `[SyncManager] Sync cycle complete` - Sync finished
- No sync errors

**Output to user:**
```
Sync activity:
- Network change detected: ✅ [App] Network: ONLINE
- SyncManager triggered: ✅ [SyncManager] Network online - triggering sync
- Pending operations: N items
- Operations synced: ✅ createNode × 2
- Sync completed: ✅ [SyncManager] Sync cycle complete
- Sync errors: none/[list]
```

---

### 10. Verify Cloud Persistence (if using emulator)

**Actions:**
1. Check Firestore emulator UI at http://localhost:4000/firestore
2. Look for `treeNodes` collection
3. Find node with nodeName "Created While Offline"

**Verification:**
- Node exists in Firestore
- updatedAt timestamp is recent

**Note:** If not using emulator, skip this step and note in results.

---

### 11. Cross-Device Test (Optional)

**Actions:**
1. Open new incognito window
2. Navigate to http://localhost:4173
3. Wait 3 seconds for load
4. Use `read_page` to count nodes
5. Verify "Created While Offline" appears

**Verification:**
- Both test nodes appear in fresh session
- Data fetched from Firestore, not local cache

---

### 12. Phase 2 Summary

**Report to user:**
```
=== PHASE 2: SYNC VERIFICATION ===

Network Restore:
- ✅/❌ Server restarted
- ✅/❌ Network available

Sync Activity:
- ✅/❌ SyncManager triggered
- ✅/❌ Firestore writes detected
- ✅/❌ No sync errors

Cloud Persistence:
- ✅/❌ "Created While Offline" in Firestore
- ⊘ Skipped (no emulator)

Cross-Device:
- ✅/❌ Fresh session loads both nodes
- ⊘ Skipped

RESULT: [PASS/FAIL]
```

---

## Cleanup

After both phases complete:
1. Kill the preview server
2. Note any issues or observations
3. Suggest next steps if failures occurred
