/**
 * asset-doc.manifest.ts — `asset-doc` kind (#6b minimal set).
 *
 * `Edges(internal, live) + Reads.resolver` / `inline`. A live-resolved link to
 * another Element: the value is the target's id, the Renderer resolves its name.
 * No config knobs in v1 (a target-kind filter / real picker is deferred), so it
 * reuses the inert config stub. `mintVia: 'composer'` — authored as a Definition
 * like the other field kinds.
 */

import { ConfigFieldStubRenderer, ConfigFieldStubConfigForm } from './configFieldStub';
import type { DataFieldValue, DefinitionConfig, AssetDocValue } from '../data/models';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const assetDocManifest: KindManifest = {
    kind: 'asset-doc',
    pickerLabel: 'Asset Doc',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['asset-doc'],
    Renderer: ConfigFieldStubRenderer, // TODO(Phase III): restore AssetDocField
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : `→ ${(v as AssetDocValue).targetId}`,
};
