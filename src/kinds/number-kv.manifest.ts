import type { Component } from 'solid-js';
import { ConfigFieldStubConfigForm } from './configFieldStub';
import { NumberKvField } from '../components/DataField/NumberKvField';
import { formatNumberKvDisplay } from '../components/DataField/numberKvState';
import type { DataFieldValue, DefinitionConfig, NumberKvConfig } from '../data/models';
import { NUMBER_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const numberKvManifest: KindManifest = {
    kind: 'number-kv',
    pickerLabel: 'Number',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['number-kv'], // capability subset — structural seam, not read yet
    Renderer: NumberKvField as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm, // TODO(Phase IV): restore NumberKvConfigForm
    defaultConfig: (): DefinitionConfig => ({ unitsSymbol: '' }),
    displayPreview: (v: DataFieldValue | null, config?: DefinitionConfig) =>
        v === null || v === undefined ? null
            : formatNumberKvDisplay(v as number, (config ?? {}) as NumberKvConfig),
    configSchema: NUMBER_KV_CONFIG_SCHEMA,
};
