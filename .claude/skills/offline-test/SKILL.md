---
description: Test PWA offline functionality with browser automation
allowed-tools: Bash, mcp__claude-in-chrome__*, AskUserQuestion, TaskCreate, TaskUpdate, TaskList
disable-model-invocation: true
argument-hint: "[phase1|phase2|all] - optional, defaults to phase1 only"
---

# PWA Offline Test

Test that the app works offline using browser offline/online events and sync behavior.

**IMPORTANT NOTES:**
- This test uses **JavaScript event dispatch** to simulate browser offline/online state changes
- This properly triggers the app's network detection and sync behavior (same as DevTools toggle)
- All verifications use DOM inspection (`read_page`) + console logs, not just screenshots
- **Screenshots:** When you see "Take screenshot #N", the image will appear in the conversation output immediately after the tool call. Always caption it clearly (e.g., "Screenshot #1 - Baseline state showing 5 root nodes")
- **Console logs are critical:** This test relies heavily on structured console output for verification. Look for EXACT log messages as specified in each step:
  - `[App]` prefix - Application-level events (network, service worker)
  - `[IDBAdapter]` prefix - IndexedDB write confirmations
  - `[SyncManager]` prefix - Sync operations
  - `[Storage]` prefix - Storage initialization
  - `[useRootViewData]` prefix - Data loading operations

---

## Phase 1: Offline Functionality

### 1. Pre-Build Cleanup

**Actions:**
```bash
# Kill any existing preview server on port 4173
netstat -ano | grep ':4173'  # Find PID if running
taskkill //F //PID <pid>     # Kill it (Windows)
sleep 2                      # Wait for cleanup
```

**Why:** Running preview servers can lock dist/service-worker.js and cause build failures.

**Verification:**
- Port 4173 is free (netstat shows no listener)
- Continue to build step

---

### 2. Build and Serve

```bash
npm run build
npm run preview:pwa  # background task on port 4173
```

**Verification:**
- Build must complete without errors
- Server responds to `curl http://localhost:4173`

---

### 3. Baseline State (Online)

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
- IndexedDB: N nodes total
- Fetched: N root nodes
- Visible in DOM: X nodes
- Node names: [list from DOM]
```

---

### 4. Create Test Node (Online)

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

### 5. Simulate Going Offline

**Actions:**
1. Use JavaScript to dispatch offline event: `window.dispatchEvent(new Event('offline'))`
2. Wait 1 second for app to react
3. Read console messages (pattern: "App.*Network.*OFFLINE")

**Verification - Look for this EXACT log:**
- `[App] Network: OFFLINE` - App detected offline state

**Output to user:**
```
Offline simulation:
- Offline event dispatched: ✅
- App detected offline: ✅ [App] Network: OFFLINE
```

---

### 6. Create Node While Offline

**Actions:**
1. Click "Create New Asset" button
2. Wait 1 second
3. Enter "Created While Offline" in name field
4. Click "Create" button
5. Wait 2 seconds for node to appear
6. Take screenshot #3 (offline creation)
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
- ✅/❌ Browser offline event dispatched
- ✅/❌ App detected offline state

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

### 8. Simulate Going Back Online

**Actions:**
1. Use JavaScript to dispatch online event: `window.dispatchEvent(new Event('online'))`
2. Wait 2 seconds for sync to trigger
3. Take screenshot #4 (after reconnect)
4. Read console messages (pattern: "App.*Network.*ONLINE|SyncManager.*sync|SyncManager.*Push|SyncManager.*Pull")

**Verification - Look for these EXACT logs:**
- `[App] Network: ONLINE` - Network state change detected
- `[SyncManager] Network online - triggering sync` - Sync triggered by network change
- `[SyncManager] Starting sync cycle...` - Sync started
- `[SyncManager] Push: Processing N items` OR `[SyncManager] Push: No pending items`
- `[SyncManager] Pull: Fetching changes since <timestamp>`
- `[SyncManager] Sync cycle complete` - Sync finished
- No sync errors

**Output to user:**
```
Sync activity:
- Network change detected: ✅ [App] Network: ONLINE
- SyncManager triggered: ✅ [SyncManager] Network online - triggering sync
- Sync started: ✅ [SyncManager] Starting sync cycle...
- Push phase: ✅ [SyncManager] Push: <result>
- Pull phase: ✅ [SyncManager] Pull: Fetching changes
- Sync completed: ✅ [SyncManager] Sync cycle complete
- Sync errors: none/[list]
```

---

### 9. Verify Sync Behavior

**Actions:**
1. Check if sync queue was processed (look for "Push: Processing N items" or "Push: No pending items")
2. Note the behavior

**Analysis for user:**
```
Sync Queue Analysis:
- If "Push: No pending items" → Nodes were created with server available, already synced
- If "Push: Processing N items" → Offline-created nodes are now being synced
- Pull phase shows server data fetch

Note: In this test, nodes may already be synced because:
- The server was never actually down (we only simulated browser offline state)
- IDBAdapter may have synced immediately on creation
- This is correct behavior - testing browser offline detection, not server availability
```

---

### 10. Phase 2 Summary

**Report to user:**
```
=== PHASE 2: SYNC VERIFICATION ===

Network Reconnection:
- ✅/❌ Online event dispatched
- ✅/❌ App detected online state

Sync Activity:
- ✅/❌ Network change triggered sync
- ✅/❌ SyncManager started cycle
- ✅/❌ Push phase completed
- ✅/❌ Pull phase completed
- ✅/❌ Sync cycle finished
- ✅/❌ No sync errors

Key Findings:
- Network detection: ✅/❌ Working correctly
- Event-driven sync: ✅/❌ Triggered on online event
- Sync infrastructure: ✅/❌ Operational

RESULT: [PASS/FAIL]
```

---

## Cleanup

After both phases complete:
1. Kill the preview server
2. Note any issues or observations
3. Provide summary:

```
TEST COMPLETE

Phase 1 - Offline Functionality: [PASS/FAIL]
- Service worker caching works
- IndexedDB persistence works
- Offline operations functional

Phase 2 - Sync Verification: [PASS/FAIL]
- Network change detection works
- Sync triggers on online event
- Sync cycle completes successfully

Architectural Notes:
- Browser offline/online events properly detected
- Event-driven sync working as designed
- Offline-first architecture validated
```
