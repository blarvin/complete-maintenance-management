import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import type { DataFieldValue, DefinitionConfig, SingleImageValue } from '../data/models';
import { SINGLE_IMAGE_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const singleImageManifest: KindManifest = {
    kind: 'single-image',
    pickerLabel: 'Image',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['single-image'], // capability subset — structural seam, not read yet
    Renderer: ConfigFieldStubRenderer, // TODO(Phase III): restore SingleImageField
    ConfigForm: ConfigFieldStubConfigForm, // TODO(Phase IV): restore SingleImageConfigForm
    defaultConfig: (): DefinitionConfig => ({ maxSizeMB: 5 }),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : (v as SingleImageValue).caption ?? '[image]',
    configSchema: SINGLE_IMAGE_CONFIG_SCHEMA,
};
