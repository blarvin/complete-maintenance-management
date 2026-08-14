/**
 * internal-link.manifest.ts — the `internal-link` kind (#6b minimal set).
 *
 * `Edges(internal, live) + Reads.resolver` / `inline`. A live-resolved link to
 * another Element: the value is the target's id, the Renderer resolves its name.
 * No config knobs in v1 (a target-kind filter / real picker is deferred), so it
 * reuses the inert config stub. `mintVia: 'composer'` — authored as a Definition
 * like the other field kinds.
 *
 * Named for its composition, not its use (renamed from `asset-doc`, 2026-08-12).
 * "Linked Doc" is the *Definition* label in the seeded library; O&M Manual,
 * Drawing, Parent Assembly are others of this one kind. The internal twin of
 * `external-link`: the two exercise both halves of `TargetSpec.scope`.
 */

import { ConfigFieldStubConfigForm } from './configFieldStub';
import { InternalLinkField } from '../components/DataField/InternalLinkField';
import type { DataFieldValue, DefinitionConfig, InternalLinkValue } from '../data/models';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const internalLinkManifest: KindManifest = {
    kind: 'internal-link',
    pickerLabel: 'Internal Link',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['internal-link'],
    Renderer: InternalLinkField,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) =>
        v === null || v === undefined ? null : `→ ${(v as InternalLinkValue).targetId}`,
};
