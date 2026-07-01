import type { Component } from '@builder.io/qwik';
import { SingleImageField } from '../components/DataField/SingleImageField';
import { SingleImageConfigForm } from '../components/FieldComposer/configForms/SingleImageConfigForm';
import type { DataFieldValue, DefinitionConfig, SingleImageValue } from '../data/models';
import { SINGLE_IMAGE_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const singleImageManifest: KindManifest = {
    kind: 'single-image',
    pickerLabel: 'Image',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['single-image'], // capability subset — structural seam, not read yet
    Renderer: SingleImageField as unknown as Component<FieldRendererProps>,
    ConfigForm: SingleImageConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): DefinitionConfig => ({ maxSizeMB: 5 }),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : (v as SingleImageValue).caption ?? '[image]',
    hideLabel: true,
    blockValueLayout: true,
    configSchema: SINGLE_IMAGE_CONFIG_SCHEMA,
};
