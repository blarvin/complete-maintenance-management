import type { Component } from '@builder.io/qwik';
import { NumberKvField } from '../components/DataField/NumberKvField';
import { formatNumberKvDisplay } from '../components/DataField/numberKvState';
import { NumberKvConfigForm } from '../components/FieldComposer/configForms/NumberKvConfigForm';
import type { DataFieldValue, DefinitionConfig, NumberKvConfig } from '../data/models';
import { NUMBER_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const numberKvManifest: KindManifest = {
    kind: 'number-kv',
    pickerLabel: 'Number',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['number-kv'], // capability subset — structural seam, not read yet
    Renderer: NumberKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: NumberKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): DefinitionConfig => ({ unitsSymbol: '' }),
    displayPreview: (v: DataFieldValue | null, config?: DefinitionConfig) =>
        v === null || v === undefined ? null
            : formatNumberKvDisplay(v as number, (config ?? {}) as NumberKvConfig),
    hideLabel: false,
    blockValueLayout: false,
    configSchema: NUMBER_KV_CONFIG_SCHEMA,
};
