/**
 * log-entry.manifest.ts — `log-entry` kind (#6c, the lens's second target).
 *
 * `Children(open)` / `re-root`. The `job` twin: a layered record node whose
 * details (timestamp, author, category, notes) are ordinary Fields, NOT an
 * OwnValue — so `Children + OwnValue` never arises. It earns its kind as the
 * **trigger** the `logbook` lens provisions against, exactly as `job` does for
 * `jobs` (ELEMENT-MODEL §job boundary call). Being a `derivation.targetKind`, it
 * auto-joins `isLensSurfaced` — created inside a Logbook, hidden from the tree,
 * never a loose sibling. First-class lifecycle waits on `Action` (built last).
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const logEntryManifest: KindManifest = {
    kind: 'log-entry',
    pickerLabel: 'Log Entry',
    mintVia: 'node-create',
    placement: 're-root',
    ...KIND_CAPABILITIES['log-entry'],
};
