/**
 * text-kv — free-form text, the Phase-1 default field kind.
 *
 * **No `ConfigForm`.** maxLength / multiline / placeholder / maxWords are
 * independent knobs, so the generic `ConfigDraftForm` builds the rows from
 * `TEXT_KV_CONFIG_SCHEMA`. An override is earned only by a cross-field
 * invariant a row list cannot express, and this kind has none.
 */

import type { Component } from 'solid-js';
import { TextKvField } from '../components/DataField/TextKvField';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { TEXT_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const textKvManifest: KindManifest = {
    kind: 'text-kv',
    pickerLabel: 'Text',
    mintVia: 'add-surface',
    placement: 'inline',
    ...KIND_CAPABILITIES['text-kv'], // capability subset — structural seam, not read yet
    Renderer: TextKvField as unknown as Component<FieldRendererProps>,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    configSchema: TEXT_KV_CONFIG_SCHEMA,
};
