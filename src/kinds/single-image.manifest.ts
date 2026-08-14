/**
 * single-image — one image attached to a field.
 *
 * **No `ConfigForm`.** maxSizeMB / requireCaption / aspectHint are independent
 * knobs, so the generic `ConfigDraftForm` builds the rows from
 * `SINGLE_IMAGE_CONFIG_SCHEMA`. An override is earned only by a cross-field
 * invariant a row list cannot express, and this kind has none.
 */

import type { Component } from 'solid-js';
import { SingleImageField } from '../components/DataField/SingleImageField';
import type { DataFieldValue, DefinitionConfig, SingleImageValue } from '../data/models';
import { SINGLE_IMAGE_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { FieldRendererProps, KindManifest } from './types';

export const singleImageManifest: KindManifest = {
    kind: 'single-image',
    pickerLabel: 'Image',
    mintVia: 'add-surface',
    placement: 'inline',
    ...KIND_CAPABILITIES['single-image'], // capability subset — structural seam, not read yet
    Renderer: SingleImageField as unknown as Component<FieldRendererProps>,
    defaultConfig: (): DefinitionConfig => ({ maxSizeMB: 5 }),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : (v as SingleImageValue).caption ?? '[image]',
    configSchema: SINGLE_IMAGE_CONFIG_SCHEMA,
};
