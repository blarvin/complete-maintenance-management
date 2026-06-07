import type { Component } from '@builder.io/qwik';
import { TextKvField } from '../components/DataField/TextKvField';
import { TextKvConfigForm } from '../components/FieldComposer/configForms/TextKvConfigForm';
import type { DataFieldValue, FieldDefinitionConfig } from '../data/models';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const textKvManifest: KindManifest = {
    componentType: 'text-kv',
    pickerLabel: 'Text',
    Renderer: TextKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: TextKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
};
