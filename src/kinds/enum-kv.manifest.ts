import type { Component } from 'solid-js';
import { EnumKvConfigForm } from '../components/FieldComposer/configForms/EnumKvConfigForm';
import { EnumKvField } from '../components/DataField/EnumKvField';
import type { DataFieldValue, DefinitionConfig, EnumKvConfig } from '../data/models';
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
    // Two blank options, not none: an enum needs two to be a choice at all, so
    // the draft opens showing that shape rather than an empty list the user has
    // to discover the `+ Add option` button to populate. Blanks are stripped on
    // the way to storage (the `options` sub-field's `pack`), and the validator
    // holds Create until two are filled in.
    defaultConfig: (): DefinitionConfig => ({ options: ['', ''] }),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    // The Library preview seeds the first configured option, so the microcosm
    // opens showing a real choice the viewer can switch (locally, never synced).
    previewSeed: (config: DefinitionConfig) =>
        (config as EnumKvConfig).options?.find((o) => o.trim() !== '') ?? null,
    configSchema: ENUM_KV_CONFIG_SCHEMA,
};
