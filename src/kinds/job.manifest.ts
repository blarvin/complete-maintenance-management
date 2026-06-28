/**
 * job.manifest.ts — `job` kind (#6b minimal set).
 *
 * `Children(open)` / `re-root`. A layered task node: its status, priority, owner,
 * due-dates are ordinary Fields (scoped by the `children` allowlist), NOT an
 * OwnValue — so `Children + OwnValue` never arises. It composes the same
 * capability as `node`, and earns its kind as the **trigger** the `jobs` lens
 * provisions against: the framework reacts to a job's existence, which is
 * behaviour keyed on the kind, not a passive `typeOf` label (SPEC §584-585,
 * a deliberate boundary call — see ELEMENT-MODEL §job). First-class lifecycle
 * (validated transitions) waits on `Action` (built last).
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const jobManifest: KindManifest = {
    kind: 'job',
    pickerLabel: 'Job',
    mintVia: 'node-create',
    placement: 're-root',
    ...KIND_CAPABILITIES['job'],
};
