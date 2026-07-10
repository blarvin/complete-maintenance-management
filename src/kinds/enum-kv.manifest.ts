import type { Component } from 'solid-js';
import { ConfigFieldStubConfigForm } from './configFieldStub';
import { EnumKvField } from '../components/DataField/EnumKvField';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { ENUM_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const enumKvManifest: KindManifest = {
    kind: 'enum-kv',
    pickerLabel: 'Enum',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['enum-kv'], // capability subset — structural seam, not read yet
    Renderer: EnumKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm, // TODO(Phase IV): restore EnumKvConfigForm
    defaultConfig: (): DefinitionConfig => ({ options: [] }),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    configSchema: ENUM_KV_CONFIG_SCHEMA,
};
