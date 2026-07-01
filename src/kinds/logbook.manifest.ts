/**
 * logbook.manifest.ts — `logbook` kind, the lens's second instance (#6c).
 *
 * The `jobs` twin, proving the lens generalizes by target kind: a hybrid
 * container that owns its own DataFields *and* rolls up every `log-entry` below
 * its owning node (`Derivation(children/transitive → log-entry) + Provision`).
 * `mintVia: 'provision'` — never user-picked; the framework materializes a
 * `logbook` lens child on every node at create time (deterministic id
 * `${parentId}::logbook`) via the spec-driven provisioner (`provisionPolicy.ts`
 * + `ensureProvisionedLenses`), which reads this manifest's ProvisionSpec rather
 * than hardcoding the kind. The upward ancestor-walk + de-provision/GC are
 * deferred (LATER.md), inherited from `jobs`.
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const logbookManifest: KindManifest = {
    kind: 'logbook',
    pickerLabel: 'Logbook',
    mintVia: 'provision',
    placement: 're-root',
    ...KIND_CAPABILITIES['logbook'],
};
