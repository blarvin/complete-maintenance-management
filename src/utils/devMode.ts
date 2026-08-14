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
 * So the gate is DEV *or* emulator target. That is true for `npm run dev` and
 * for Cypress (which drives the dev server on :5173), true for a production
 * build opened with `?emulator=true` or `localStorage.USE_FIRESTORE_EMULATOR`,
 * and false for an ordinary visit to the deployed app. Same reasoning as
 * `SyncTargetBadge`, which is deliberately not DEV-gated for the same reason.
 *
 * Resolved once at module load: `isEmulatorTarget` is itself a module constant
 * (the target cannot change without a reload), so this collapses to a constant
 * and the bundler can drop guarded blocks from a production build.
 */

import { isEmulatorTarget } from '../data/syncTarget';

export const DEV_TOOLS_ENABLED = import.meta.env.DEV || isEmulatorTarget;

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
