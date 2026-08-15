import type { Component } from 'solid-js';
import { EnumKvConfigForm } from '../components/FieldComposer/configForms/EnumKvConfigForm';
import { EnumKvField } from '../components/DataField/EnumKvField';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { ENUM_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const enumKvManifest: KindManifest = {
    kind: 'enum-kv',
    pickerLabel: 'Enum',
    authoringMemo: 'Creating an Enum field — pick a different Kind below to change that',
    mintVia: 'add-surface',
    placement: 'inline',
    ...KIND_CAPABILITIES['enum-kv'], // capability subset — structural seam, not read yet
    Renderer: EnumKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: EnumKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): DefinitionConfig => ({ options: [] }),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    configSchema: ENUM_KV_CONFIG_SCHEMA,
};
