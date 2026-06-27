/**
 * node.manifest.ts — the `node` kind's manifest entry.
 *
 * `node` is `Children(open)` / `re-root` (see ELEMENT-MODEL.md §node). It carries
 * identity only: its recursion and navigation are drawn framework-side by the
 * shell (TreeNode), not via a manifest Renderer — routing that through the
 * manifest is the chrome-entailment cluster. Registering it here removes `node`'s
 * privileged status so `Kind` derives cleanly from KIND_REGISTRY's keys.
 */

import type { KindManifest } from './types';

export const nodeManifest: KindManifest = {
    kind: 'node',
    pickerLabel: 'Node',
    mintVia: 'node-create',
    placement: 're-root',
};
