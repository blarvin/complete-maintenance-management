/**
 * flag.manifest.ts — boolean config sub-field kind (config-only).
 *
 * Backs boolean config knobs (e.g. text-kv `multiline`, single-image
 * `requireCaption`, enum-kv `allowOther`). Registered + renderable but excluded
 * from the authoring picker (`mintVia: 'config-only'`); never a standalone Data
 * Card row — it is drawn inside a Definition's config, read-only.
 */

import type { Component } from 'solid-js';
import type { DataFieldValue, DefinitionConfig, FlagValue } from '../data/models';
import { FlagField } from '../components/DataField/ConfigValueFields';
import { ConfigFieldStubConfigForm } from './configFieldStub';
import { formatFlag } from './configValueFormat';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const flagManifest: KindManifest = {
    kind: 'flag',
    pickerLabel: 'Flag',
    mintVia: 'config-only',
    placement: 'inline',
    ...KIND_CAPABILITIES['flag'], // capability subset — structural seam, not read yet
    Renderer: FlagField as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : formatFlag(v as FlagValue),
};
