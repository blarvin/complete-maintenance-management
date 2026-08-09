/**
 * string-list.manifest.ts — list-of-strings config sub-field kind (config-only).
 *
 * Backs list-valued config (e.g. enum-kv `options`). Modeled as one
 * list-valued sub-field value rather than N repeatable child Elements (the
 * "repeatable data = many children" refinement is deferred — see LATER.md).
 * Registered + renderable but excluded from the composer picker; never mounted as
 * a standalone Data Card row in Phase 1.
 */

import type { DataFieldValue, DefinitionConfig, StringListValue } from '../data/models';
import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const stringListManifest: KindManifest = {
    kind: 'string-list',
    pickerLabel: 'List',
    mintVia: 'config-only',
    placement: 'inline',
    ...KIND_CAPABILITIES['string-list'], // capability subset — structural seam, not read yet
    Renderer: ConfigFieldStubRenderer,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : (v as StringListValue).join(', '),
};
