import type { Component } from '@builder.io/qwik';
import { TextKvField } from '../components/DataField/TextKvField';
import { TextKvConfigForm } from '../components/FieldComposer/configForms/TextKvConfigForm';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { TEXT_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const textKvManifest: KindManifest = {
    kind: 'text-kv',
    pickerLabel: 'Text',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['text-kv'], // capability subset — structural seam, not read yet
    Renderer: TextKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: TextKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    hideLabel: false,
    blockValueLayout: false,
    configSchema: TEXT_KV_CONFIG_SCHEMA,
};
