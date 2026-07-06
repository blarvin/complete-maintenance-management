/**
 * effectiveChildren — the single read-time chokepoint where a viewer's personal
 * `config` / `view-state` overlays (incl. personal `siblingOrder`) will layer
 * onto an element's canonical children (SPEC → Data Model → *Populations are typed
 * trees*).
 *
 * Phase 1 is a **pass-through**: it returns the canonical children unchanged
 * (the adapter already excludes soft-deleted rows and sorts by `siblingOrder`).
 * There is no `viewer` (auth) and no overlay data yet — view-state lives in
 * `uiPrefs` localStorage and the `config` tree needs the cascade arbiter. The
 * function exists so the later overlay merge lands here additively, with every
 * viewer-facing tree read already routed through it.
 *
 * Signature note: the work map writes this as `effectiveChildren(node, viewer)`;
 * we take the already-fetched canonical children instead of re-fetching by node.
 */

import type { Element, UserId } from './models';

export function effectiveChildren(canonical: Element[], _viewer: UserId): Element[] {
  // Pass-through until per-viewer overlays exist (see LATER.md). Overlay merge +
  // personal-siblingOrder re-sort will replace this body.
  return canonical;
}
