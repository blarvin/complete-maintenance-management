import type { Component } from 'solid-js';
import { NumberKvConfigForm } from '../components/FieldComposer/configForms/NumberKvConfigForm';
import { NumberKvField } from '../components/DataField/NumberKvField';
import { formatNumberKvDisplay } from '../components/DataField/numberKvState';
import type { DataFieldValue, DefinitionConfig, NumberKvConfig } from '../data/models';
import { NUMBER_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const numberKvManifest: KindManifest = {
    kind: 'number-kv',
    pickerLabel: 'Number',
    authoringMemo: 'Creating a Number field — pick a different Kind below to change that',
    mintVia: 'add-surface',
    placement: 'inline',
    ...KIND_CAPABILITIES['number-kv'], // capability subset — structural seam, not read yet
    Renderer: NumberKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: NumberKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): DefinitionConfig => ({ unitsSymbol: '' }),
    displayPreview: (v: DataFieldValue | null, config?: DefinitionConfig) =>
        v === null || v === undefined ? null
            : formatNumberKvDisplay(v as number, (config ?? {}) as NumberKvConfig),
    configSchema: NUMBER_KV_CONFIG_SCHEMA,
};
