/**
 * Shared placeholder for the config-only kinds (`flag` / `compound` /
 * `string-list`). These kinds back the `library`-tree config subtree and, in
 * Phase 1, only ever exist as config sub-fields — never mounted as standalone
 * Data Card rows. Full standalone-row rendering/editing/history for them is
 * deferred (see LATER.md). The renderer shows a read-only value (defensive only);
 * the config form is inert because a config-only kind is never authored as its
 * own Definition.
 */

import { component$ } from '@builder.io/qwik';
import type { ConfigFormProps, FieldRendererProps } from './types';

export const ConfigFieldStubRenderer = component$<FieldRendererProps>((props) => {
    const v = props.value;
    const text =
        v === null || v === undefined
            ? '—'
            : Array.isArray(v)
                ? v.join(', ')
                : typeof v === 'object'
                    ? JSON.stringify(v)
                    : String(v);
    return <span class="config-field-stub">{text}</span>;
});

export const ConfigFieldStubConfigForm = component$<ConfigFormProps>(() => {
    return <></>;
});
