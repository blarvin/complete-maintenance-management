/**
 * kinds.manifest.ts — the `kinds` chrome kind, the Library's Kinds index lens.
 *
 * `Reads.resolver` / `re-root` / `mintVia: 'provision'` — seeded as the Library
 * root's second child. Its listing is a pure gather over the registry
 * (`FIELD_KINDS` + config schemas); it stores nothing and owns nothing.
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const kindsManifest: KindManifest = {
    kind: 'kinds',
    pickerLabel: 'Kinds',
    mintVia: 'provision',
    placement: 're-root',
    ...KIND_CAPABILITIES['kinds'],
};
