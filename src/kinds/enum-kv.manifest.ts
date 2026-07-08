import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import type { DataFieldValue, DefinitionConfig } from '../data/models';
import { ENUM_KV_CONFIG_SCHEMA } from './configSchema';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const enumKvManifest: KindManifest = {
    kind: 'enum-kv',
    pickerLabel: 'Enum',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['enum-kv'], // capability subset — structural seam, not read yet
    Renderer: ConfigFieldStubRenderer, // TODO(Phase III): restore EnumKvField
    ConfigForm: ConfigFieldStubConfigForm, // TODO(Phase IV): restore EnumKvConfigForm
    defaultConfig: (): DefinitionConfig => ({ options: [] }),
    displayPreview: (v: DataFieldValue | null) => (v === null || v === undefined ? null : String(v)),
    configSchema: ENUM_KV_CONFIG_SCHEMA,
};
