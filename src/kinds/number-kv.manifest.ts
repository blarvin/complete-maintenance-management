import type { Component } from '@builder.io/qwik';
import { NumberKvField } from '../components/DataField/NumberKvField';
import { formatNumberKvDisplay } from '../components/DataField/numberKvState';
import { NumberKvConfigForm } from '../components/FieldComposer/configForms/NumberKvConfigForm';
import type { DataFieldValue, FieldDefinitionConfig, NumberKvConfig } from '../data/models';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const numberKvManifest: KindManifest = {
    kind: 'number-kv',
    pickerLabel: 'Number',
    mintVia: 'composer',
    placement: 'inline',
    Renderer: NumberKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: NumberKvConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({ unitsSymbol: '' }),
    displayPreview: (v: DataFieldValue | null, config?: FieldDefinitionConfig) =>
        v === null || v === undefined ? null
            : formatNumberKvDisplay(v as number, (config ?? {}) as NumberKvConfig),
    hideLabel: false,
    blockValueLayout: false,
};
