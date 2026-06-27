/**
 * flag.manifest.ts — boolean config sub-field kind (config-only).
 *
 * Backs boolean config knobs (e.g. text-kv `multiline`, single-image
 * `requireCaption`, enum-kv `allowOther`). Registered + renderable but excluded
 * from the composer picker (`mintVia: 'config-only'`); never mounted as a
 * standalone Data Card row in Phase 1.
 */

import type { Component } from '@builder.io/qwik';
import type { DataFieldValue, FieldDefinitionConfig } from '../data/models';
import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const flagManifest: KindManifest = {
    kind: 'flag',
    pickerLabel: 'Flag',
    mintVia: 'config-only',
    placement: 'inline',
    Renderer: ConfigFieldStubRenderer as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : v ? 'Yes' : 'No',
    hideLabel: false,
    blockValueLayout: false,
};
