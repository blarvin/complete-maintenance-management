/**
 * part-supplier-link.manifest.ts — the `part-supplier-link` kind.
 *
 * `Edges(external)` / `inline`. The external twin of `asset-doc`: a stored URL to a
 * supplier page, datasheet or manufacturer's site, opened in a new tab. No
 * `reads.resolver` — nothing internal to resolve — and no config knobs, so it reuses
 * the inert config stub. Together with `asset-doc` it exercises both halves of
 * `TargetSpec.scope` (ELEMENT-MODEL §part-supplier-link).
 */

import { ConfigFieldStubConfigForm } from './configFieldStub';
import { PartSupplierLinkField } from '../components/DataField/PartSupplierLinkField';
import type { DataFieldValue, DefinitionConfig, PartSupplierLinkValue } from '../data/models';
import { displayUrl } from '../utils/url';
import { KIND_CAPABILITIES } from './capabilities';
import type { KindManifest } from './types';

export const partSupplierLinkManifest: KindManifest = {
    kind: 'part-supplier-link',
    pickerLabel: 'Supplier Link',
    mintVia: 'composer',
    placement: 'inline',
    ...KIND_CAPABILITIES['part-supplier-link'],
    Renderer: PartSupplierLinkField,
    ConfigForm: ConfigFieldStubConfigForm,
    defaultConfig: (): DefinitionConfig => ({}),
    displayPreview: (v: DataFieldValue | null) => {
        const url = v === null || v === undefined ? '' : (v as PartSupplierLinkValue).url;
        return url ? displayUrl(url) : null;
    },
};
