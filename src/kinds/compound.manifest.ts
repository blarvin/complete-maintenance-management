/**
 * compound.manifest.ts — atomic co-varying object config sub-field (config-only).
 *
 * The one object-valued config residue (SPEC §596): values that must move
 * together under LWW, e.g. number-kv thresholds `{lowLow, low, high, highHigh}`.
 * Registered + renderable but excluded from the composer picker; never mounted as
 * a standalone Data Card row in Phase 1.
 */

import type { Component } from '@builder.io/qwik';
import type { CompoundValue, DataFieldValue, FieldDefinitionConfig } from '../data/models';
import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import { KIND_CAPABILITIES } from './capabilities';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const compoundManifest: KindManifest = {
    kind: 'compound',
    pickerLabel: 'Compound',
    mintVia: 'config-only',
    placement: 'inline',
    ...KIND_CAPABILITIES['compound'], // capability subset — structural seam, not read yet
    Renderer: ConfigFieldStubRenderer as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined
            ? null
            : Object.entries(v as CompoundValue).map(([k, val]) => `${k}=${val}`).join(', '),
    hideLabel: false,
    blockValueLayout: false,
};
