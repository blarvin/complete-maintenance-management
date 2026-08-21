/**
 * library.manifest.ts — the `library` chrome kind, the Library lens's root.
 *
 * `Children(template: definitions/kinds)` / `re-root` / `mintVia: 'provision'` —
 * never user-picked; written by the `library-chrome` bootstrap population
 * (`services/bootstrap.ts`) as a pinned ROOT row whose
 * two children are the index lenses. A lens, not a place: no Definition storage
 * changes hang off it (SPEC → The Library).
 */

import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const libraryManifest: KindManifest = {
    kind: 'library',
    pickerLabel: 'Field Library',
    mintVia: 'provision',
    placement: 're-root',
    ...KIND_CAPABILITIES['library'],
};
