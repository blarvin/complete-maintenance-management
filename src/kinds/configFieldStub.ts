/**
 * Inert authoring form for the config-only kinds (`flag` / `compound` /
 * `string-list`).
 *
 * A `ConfigForm` answers "how is a new Definition *of this kind* authored" —
 * and these three kinds are never authored as Definitions. They exist only as
 * sub-fields inside another kind's config subtree, so their config would
 * terminate the recursion anyway (a boolean has no config; SPEC §601). The
 * manifest type requires the field, so it gets a form that renders nothing.
 *
 * Their **renderers** are real — see `components/DataField/ConfigValueFields`.
 * The stub renderer that used to live here was replaced once the Library
 * picker's config peek and Field Details → Config began drawing config
 * sub-fields as rows; its `JSON.stringify` fallback would have shown a user
 * `{"lowLow":0,"low":2}` where a threshold chain belongs.
 *
 * Kept JSX-free (a `.ts` file) so it stays loadable from Node-only contexts.
 */

import type { Component } from 'solid-js';
import type { ConfigFormProps } from './types';

export const ConfigFieldStubConfigForm: Component<ConfigFormProps> = () => null;
