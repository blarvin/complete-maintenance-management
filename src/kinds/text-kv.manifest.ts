import type { Component } from '@builder.io/qwik';
import { TextKvField } from '../components/DataField/TextKvField';
import { TextKvConfigForm } from '../components/FieldComposer/configForms/TextKvConfigForm';
import type { DataFieldValue, FieldDefinitionConfig } from '../data/models';
import { TEXT_KV_CONFIG_SCHEMA } from './configSchema';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const textKvManifest: KindManifest = {
    kind: 'text-kv',
    pickerLabel: 'Text',
    mintVia: 'composer',
    placement: 'inline',
    Renderer: TextKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: TextKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    hideLabel: false,
    blockValueLayout: false,
    configSchema: TEXT_KV_CONFIG_SCHEMA,
};
