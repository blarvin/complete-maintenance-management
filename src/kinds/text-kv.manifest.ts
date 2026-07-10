import type { Component } from 'solid-js';
import { ConfigFieldStubConfigForm } from './configFieldStub';
import { TextKvField } from '../components/DataField/TextKvField';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { TEXT_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const textKvManifest: KindManifest = {
    kind: 'text-kv',
    pickerLabel: 'Text',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['text-kv'], // capability subset — structural seam, not read yet
    Renderer: TextKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm, // TODO(Phase IV): restore TextKvConfigForm
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    configSchema: TEXT_KV_CONFIG_SCHEMA,
};
