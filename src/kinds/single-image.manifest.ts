import type { Component } from '@builder.io/qwik';
import { SingleImageField } from '../components/DataField/SingleImageField';
import { SingleImageConfigForm } from '../components/FieldComposer/configForms/SingleImageConfigForm';
import type { DataFieldValue, FieldDefinitionConfig, SingleImageValue } from '../data/models';
import type { ConfigFormProps, FieldRendererProps, KindManifest } from './types';

export const singleImageManifest: KindManifest = {
    kind: 'single-image',
    pickerLabel: 'Image',
    Renderer: SingleImageField as unknown as Component<FieldRendererProps>,
    ConfigForm: SingleImageConfigForm as unknown as Component<ConfigFormProps>,
    defaultConfig: (): FieldDefinitionConfig => ({ maxSizeMB: 5 }),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : (v as SingleImageValue).caption ?? '[image]',
    hideLabel: true,
    blockValueLayout: true,
};
