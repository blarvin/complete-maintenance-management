/**
 * external-link.manifest.ts — the `external-link` kind.
 *
 * `Edges(external)` / `inline`. The external twin of `internal-link`: a stored URL
 * opened in a new tab. No `reads.resolver` — nothing internal to resolve — and no
 * config knobs, so it reuses the inert config stub. Together with `internal-link` it
 * exercises both halves of `TargetSpec.scope` (ELEMENT-MODEL §external-link).
 *
 * Named for its composition, not its use. "Supplier Link", "Datasheet" and
 * "Manufacturer Page" are *Definitions* of this one kind, authored in the library —
 * the domain word stays soft (ELEMENT-MODEL → What is *not* a kind).
 */

import { ConfigFieldStubConfigForm } from './configFieldStub';
import { ExternalLinkField } from '../components/DataField/ExternalLinkField';
import type { DataFieldValue, DefinitionConfig, ExternalLinkValue } from '../data/models';
import { displayUrl } from '../utils/url';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const externalLinkManifest: KindManifest = {
    kind: 'external-link',
    pickerLabel: 'External Link',
    authoringMemo: 'Creating an External Link field — pick a different Kind below to change that',
    mintVia: 'add-surface',
    placement: 'inline',
    ...KIND_CAPABILITIES['external-link'],
    Renderer: ExternalLinkField,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => {
        const url = v === null || v === undefined ? '' : (v as ExternalLinkValue).url;
        return url ? displayUrl(url) : null;
    },
};
