import type { Component } from '@builder.io/qwik';
import { EnumKvField } from '../components/DataField/EnumKvField';
import { EnumKvConfigForm } from '../components/FieldComposer/configForms/EnumKvConfigForm';
import type { DataFieldValue, FieldDefinitionConfig } from '../data/models';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const enumKvManifest: KindManifest = {
    kind: 'enum-kv',
    pickerLabel: 'Enum',
    Renderer: EnumKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: EnumKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({ options: [] }),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    hideLabel: false,
    blockValueLayout: false,
};
