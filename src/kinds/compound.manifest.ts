/**
 * compound.manifest.ts — atomic co-varying object config sub-field (config-only).
 *
 * The one object-valued config residue (SPEC §596): values that must move
 * together under LWW, e.g. number-kv thresholds `{lowLow, low, high, highHigh}`.
 * Registered + renderable but excluded from the authoring picker; never a
 * standalone Data Card row — it is drawn inside a Definition's config,
 * read-only. Editing thresholds stays with `NumberKvConfigForm`, which owns the
 * ordering invariant the compound exists to keep atomic.
 */

import type { Component } from 'solid-js';
import type { CompoundValue, DataFieldValue, DefinitionConfig } from '../data/models';
import { CompoundField } from '../components/DataField/ConfigValueFields';
import { ConfigFieldStubConfigForm } from './configFieldStub';
import { formatCompound } from './configValueFormat';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const compoundManifest: KindManifest = {
    kind: 'compound',
    pickerLabel: 'Compound',
    mintVia: 'config-only',
    placement: 'inline',
    ...KIND_CAPABILITIES['compound'], // capability subset — structural seam, not read yet
    Renderer: CompoundField as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : formatCompound(v as CompoundValue),
};
