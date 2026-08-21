/**
 * definitions.manifest.ts — the `definitions` chrome kind, the Library's
 * Definitions index lens.
 *
 * `Reads.resolver` / `re-root` / `mintVia: 'provision'` — seeded as the Library
 * root's first child. Its listing is a pure gather over `listDefinitions()`
 * (BranchView routes on `libraryIndexView`); it stores nothing and owns nothing.
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const definitionsManifest: KindManifest = {
    kind: 'definitions',
    pickerLabel: 'Field Definitions',
    mintVia: 'provision',
    placement: 're-root',
    ...KIND_CAPABILITIES['definitions'],
};
