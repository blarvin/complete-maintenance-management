import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { TEXT_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const textKvManifest: KindManifest = {
    kind: 'text-kv',
    pickerLabel: 'Text',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['text-kv'], // capability subset — structural seam, not read yet
    Renderer: ConfigFieldStubRenderer, // TODO(Phase III): restore TextKvField
    ConfigForm: ConfigFieldStubConfigForm, // TODO(Phase IV): restore TextKvConfigForm
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    configSchema: TEXT_KV_CONFIG_SCHEMA,
};
