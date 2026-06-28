/**
 * jobs.manifest.ts — `jobs` kind, the lens (#6b minimal set).
 *
 * `Derivation(children/transitive → job) + Provision` / `re-root`. Holds no
 * content of its own: it gathers every `job` below its parent and lists them.
 * `mintVia: 'provision'` — never user-picked; the framework materializes a `jobs`
 * lens child on every node at create time (deterministic id `${parentId}::jobs`),
 * so each node carries its own subtree rollup. The gather/list is a manifest-driven
 * adornment (KindAdornment); the upward ancestor-walk + de-provision/GC are
 * deferred (LATER.md).
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const jobsManifest: KindManifest = {
    kind: 'jobs',
    pickerLabel: 'Jobs',
    mintVia: 'provision',
    placement: 're-root',
    ...KIND_CAPABILITIES['jobs'],
};
