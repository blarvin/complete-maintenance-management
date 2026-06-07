import type { Component } from '@builder.io/qwik';
import { NumberKvField } from '../components/DataField/NumberKvField';
import { NumberKvConfigForm } from '../components/FieldComposer/configForms/NumberKvConfigForm';
import type { DataFieldValue, FieldDefinitionConfig } from '../data/models';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const numberKvManifest: KindManifest = {
    componentType: 'number-kv',
    pickerLabel: 'Number',
    Renderer: NumberKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: NumberKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({ unitsSymbol: '' }),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
};
