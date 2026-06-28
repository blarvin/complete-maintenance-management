/**
 * org.manifest.ts — `org` kind (#6b minimal set).
 *
 * `Children(open) + Derivation(children/transitive)` / `re-root`. The simplest
 * aggregation: a node that also rolls up a descendant count (no Provision). First
 * consumer of the `gatherDescendants` traversal. Identity-only like `node` — its
 * re-root view is the framework shell; the count is a manifest-driven adornment
 * (KindAdornment), not a per-kind Renderer (that is #5).
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const orgManifest: KindManifest = {
    kind: 'org',
    pickerLabel: 'Organization',
    mintVia: 'node-create',
    placement: 're-root',
    ...KIND_CAPABILITIES['org'],
};
