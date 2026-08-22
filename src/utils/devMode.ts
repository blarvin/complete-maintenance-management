/**
 * The one gate for developer-facing surfaces: console tracing (`devLog`) and
 * the `window.__*` helpers in `data/sync/devTools.ts`.
 *
 * `import.meta.env.DEV` alone is the obvious gate and the wrong one. It is false
 * for anything `vite build` produces — and that single artifact is served three
 * ways: the Netlify deploy, `npm run preview:pwa` (the only way to exercise the
 * service worker), and any emulator-mode hand-test. A bare DEV gate would strip
 * the tools from the two local ones, which are exactly where they are used.
 *
 * So the gate is DEV *or* emulator target *or* an explicit request. That is true
 * for `npm run dev` and for Cypress (which drives the dev server on :5173), true
 * for a production build opened with `?emulator=true` or
 * `localStorage.USE_FIRESTORE_EMULATOR`, and false for an ordinary visit to the
 * deployed app. Same reasoning as `SyncTargetBadge`, which is deliberately not
 * DEV-gated for the same reason.
 *
 * **The third term exists because the second is not a hatch, it is a move.**
 * `?emulator=true` also renames the Dexie database and repoints sync at :8080,
 * so reaching for it on the deployed app opens the tools onto the wrong database
 * and a server that is not running — which left the deploy with no `window.__*`
 * helpers at all in practice. `?devtools=true` / `localStorage.DEV_TOOLS` opens
 * this gate and nothing else; `isEmulatorTarget` goes back to meaning only
 * *which remote*. The two hatches mirror the emulator flag's own pair for the
 * same reason it has both: an installed PWA's `start_url` carries no query
 * string, so localStorage is the only way in there.
 *
 * Resolved once at module load — every input is fixed for the session, and none
 * can change without a reload.
 */

import { isEmulatorTarget } from '../data/syncTarget';

const isBrowser = typeof window !== 'undefined';

/** The dev-tools-only hatch: opens the gate without touching the sync target. */
function devToolsRequested(): boolean {
    if (!isBrowser) return false;
    try {
        if (localStorage.getItem('DEV_TOOLS') === 'true') return true;
        return new URLSearchParams(window.location.search).get('devtools') === 'true';
    } catch {
        // SSR or blocked storage — treat as closed.
        return false;
    }
}

export const DEV_TOOLS_ENABLED =
    import.meta.env.DEV || isEmulatorTarget || devToolsRequested();

/**
 * Trace logging. No-ops unless the dev gate is open, so call sites need no
 * guard of their own.
 *
 * Deliberately only wraps `console.log`. `console.error` and `console.warn` stay
 * bare everywhere: a real failure must be visible in a production session too,
 * which is the whole point of the distinction.
 */
export function devLog(...args: unknown[]): void {
  if (DEV_TOOLS_ENABLED) console.log(...args);
}
