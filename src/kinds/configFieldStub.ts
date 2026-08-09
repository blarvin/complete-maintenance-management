/**
 * Shared placeholder for the config-only kinds (`flag` / `compound` /
 * `string-list`). These kinds back the `library`-tree config subtree and, in
 * Phase 1, only ever exist as config sub-fields — never mounted as standalone
 * Data Card rows. Full standalone-row rendering/editing/history for them is
 * deferred (see LATER.md). The renderer shows a read-only value (defensive only);
 * the config form is inert because a config-only kind is never authored as its
 * own Definition.
 *
 * Kept JSX-free (a `.ts` file — a Solid component may return a thunk, which is
 * a valid, reactive `JSX.Element`) so Vitest, which has no Solid transform, can
 * load the kinds graph.
 */

import type { Component, JSX } from 'solid-js';
import type { ConfigFormProps, FieldRendererProps } from './types';

export const ConfigFieldStubRenderer: Component<FieldRendererProps> = (props) => {
    const text = () => {
        const v = props.value;
        return v === null || v === undefined
            ? '—'
            : Array.isArray(v)
                ? v.join(', ')
                : typeof v === 'object'
                    ? JSON.stringify(v)
                    : String(v);
    };
    // A thunk is a valid, reactive JSX.Element at runtime; solid-js's published
    // JSX types omit FunctionElement from the Element union, so cast locally.
    return text as unknown as JSX.Element;
};

export const ConfigFieldStubConfigForm: Component<ConfigFormProps> = () => null;
