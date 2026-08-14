/**
 * string-list.manifest.ts — list-of-strings config sub-field kind (config-only).
 *
 * Backs list-valued config (e.g. enum-kv `options`). Modeled as one
 * list-valued sub-field value rather than N repeatable child Elements (the
 * "repeatable data = many children" refinement is deferred — see LATER.md).
 * Registered + renderable but excluded from the authoring picker; never a
 * standalone Data Card row — it is drawn inside a Definition's config,
 * read-only. Editing an options list stays with `EnumKvConfigForm`, which owns
 * the `default ∈ options` invariant a flat row cannot express.
 */

import type { Component } from 'solid-js';
import type { DataFieldValue, DefinitionConfig, StringListValue } from '../data/models';
import { StringListField } from '../components/DataField/ConfigValueFields';
import { ConfigFieldStubConfigForm } from './configFieldStub';
import { formatStringList } from './configValueFormat';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const stringListManifest: KindManifest = {
    kind: 'string-list',
    pickerLabel: 'List',
    mintVia: 'config-only',
    placement: 'inline',
    ...KIND_CAPABILITIES['string-list'], // capability subset — structural seam, not read yet
    Renderer: StringListField as unknown as Component<FieldRendererProps>,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : formatStringList(v as StringListValue),
};
