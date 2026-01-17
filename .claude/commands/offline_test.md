---
description: Test PWA offline functionality with browser automation
allowed-tools: Bash, mcp__claude-in-chrome__*, AskUserQuestion
---

# PWA Offline Test

Test that the app works offline after service worker caches all chunks, with optional sync verification.

## Phase 1: Offline Functionality

### 1. Build and Serve
- Run `npm run build` - must succeed
- Run `npm run preview:pwa` in background (serves on port 4173)

### 2. Online Smoke Test (Browser)
- Navigate to http://localhost:4173
- Screenshot the initial ROOT view
- Create a test node (tap "+", enter "Offline Test Node", save)
- Screenshot the result
- Check console for errors

### 3. Go Offline
- Use DevTools to set browser to offline (Network tab → Offline checkbox)
- Return to terminal and kill the preview server
- Verify server is dead: `curl http://localhost:4173` should fail

### 4. Offline Verification (Browser)
- Refresh the page (should load from service worker cache)
- Verify the test node still appears
- Create another node named "Created While Offline"
- Screenshot the result
- Check console - IndexedDB operations should work

### 5. Phase 1 Results
Summarize:
- ✅/❌ Build succeeded
- ✅/❌ Online functionality works
- ✅/❌ App loads offline (service worker cache)
- ✅/❌ Data persists offline (IndexedDB)
- ✅/❌ Can create new data offline

---

## User Decision Point

**Ask the user:** "Offline test complete. Would you like to continue with the **back online sync test**? This will verify that data created offline syncs to Firestore when connectivity is restored."

Options:
- **Yes, test sync** - Continue to Phase 2
- **No, done for now** - End the test

If user chooses "No", end here with the Phase 1 summary.

---

## Phase 2: Back Online Sync Test

### 6. Restore Connectivity
- Restart the preview server: `npm run preview:pwa` in background
- Verify server is up: `curl http://localhost:4173` should succeed
- In browser DevTools, uncheck "Offline" to restore network

### 7. Trigger Sync
- Refresh the page
- Wait a few seconds for SyncManager to push pending operations
- Check console for sync activity (look for Firestore writes)

### 8. Verify Cloud Persistence
- Check Firestore directly (use Firebase console or emulator UI)
- Verify "Created While Offline" node exists in `treeNodes` collection
- Verify `updatedAt` timestamps are reasonable

### 9. Cross-Device Simulation (Optional)
- Open a new incognito window (fresh IndexedDB)
- Navigate to http://localhost:4173
- Verify both test nodes appear (fetched from Firestore, not local cache)

### 10. Final Results
Summarize:
- ✅/❌ Server restart successful
- ✅/❌ Sync triggered on reconnection
- ✅/❌ Offline-created data now in Firestore
- ✅/❌ Data accessible from fresh browser session

Note any sync errors, conflicts, or unexpected behavior.
