---
description: Hand-test the service worker — that a built app still loads with its server dead. Use when changing the SW, the precache manifest, the build, or before shipping a PWA-affecting change.
allowed-tools: Bash, mcp__claude-in-chrome__*, AskUserQuestion, TaskCreate, TaskUpdate, TaskList
disable-model-invocation: true
argument-hint: "(no arguments)"
---

# PWA Offline Test

Prove the service worker serves the app shell from cache when the server is
gone. That is the whole subject: **server dead, app still loads.**

Everything else about offline behaviour is already covered hermetically by
Cypress — `offline-sync.cy.ts` (queue while offline, drain on reconnect) and
`retention.cy.ts` (a sync never drops local rows). Those run against the dev
server, which registers no service worker. This skill exists for the one thing
they structurally cannot reach: a real production build with a real SW.

**Kill the server for real.** Dispatching `window.dispatchEvent(new Event('offline'))`
tests the app's own network listeners and leaves the SW untested — the server is
still there, so a broken SW passes. Stopping the process is what makes the test
mean something.

## Setup

The SW is PROD-gated, so this needs a build. Free port 4173 first — a running
preview server locks `dist/service-worker.js` and the build fails.

```powershell
Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
npm run build
npm run preview:pwa   # background
npm run emulator      # background, separate shell
```

Navigate to **`http://localhost:4173/?emulator=true`**.

The query string does two jobs: it points sync at the local emulator so the test
never touches production Firestore, and it opens the `DEV_TOOLS_ENABLED` gate
(`src/utils/devMode.ts`), which a bare production URL leaves shut — no
`__syncStatus`, no `devLog` output. It does not change service-worker behaviour,
which is what is under test. Confirm the EMULATOR badge is visible.

## Steps

Read state with `javascript_tool` and `read_page`, not screenshots. Assert on
observable state — DOM contents, `caches.keys()`, `__syncStatus()` — rather than
on console strings, which drift silently as log lines get reworded.

### 1. Service worker is live

```js
navigator.serviceWorker.controller !== null
```

Then confirm the precache is populated: `(await caches.keys()).length > 0`, and
that at least one cache holds the app shell.

**Done when:** a controller exists and a cache contains `/index.html`. No
controller on the first load means the SW activated after the page — reload once
and re-check before treating it as a failure.

### 2. Baseline data

Create a node via the UI (`Create New Asset`). Record the visible root-node names
and count from `read_page` — that list is the comparison for every later step.

**Done when:** the new node is in the DOM and `__syncStatus()` reports
`queueLength: 0` (it reached the emulator).

### 3. Kill the server, reload

Stop the `preview:pwa` process. Confirm it is actually dead —
`curl http://localhost:4173` must fail — then reload the tab.

**Done when:** the app renders with every node from step 2 present. This is the
test. A blank page, a browser error page, or a shell with no data is a failure;
report which of the three, since they point at different halves (shell precache
vs IndexedDB).

### 4. Local-first with no server

Create a second node while the server is still down.

**Done when:** it appears in the DOM and `__syncStatus()` shows it queued
(`queueLength > 0`) rather than lost.

### 5. Restore

Restart `npm run preview:pwa`, reload, and let sync run (or call `__sync()`).

**Done when:** both nodes are present and `queueLength` returns to 0.

## Reporting

State the outcome of each numbered step and the node counts you actually
observed at each. Name the SW's cache keys — a changed `CACHE_VERSION` that did
not take is the usual cause of a stale shell.

If a step fails, stop and report rather than working around it: a failure here
means the deployed app would fail the same way, which is the finding.

## Cleanup

Stop the preview server and the emulator. Note that `dist/` is now a production
build — `npm run dev` is unaffected, but a later `npm run build` needs port 4173
free again.
