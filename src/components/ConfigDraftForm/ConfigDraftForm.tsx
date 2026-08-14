/**
 * ConfigDraftForm — the generic authoring UI for a kind's config.
 *
 * SPEC → The Add Surface → Authoring a Definition: "the generic tree view is the
 * default authoring UI; a per-kind `ConfigForm` is an override, and it earns
 * that override only by carrying cross-field invariants a row list cannot
 * express." This is that default. A kind whose config is a set of independent
 * knobs needs no form at all — it gets rows, driven by its `configSchema`.
 *
 * **Bound to the draft config object, not to Elements.** Config *is* Elements
 * once a Definition exists, but nothing exists to parent a sub-field Element to
 * until the Definition commits — so authoring edits the flat draft, and
 * `serializeConfig` builds the subtree at commit time as it already does. That
 * asymmetry (draft object in, Elements out) is the whole reason this is a
 * different component from `ConfigSummary`, which reads Elements back.
 */

import { For, Match, Show, Switch } from 'solid-js';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import type { ConfigSubField } from '../../kinds/types';
import type { DefinitionConfig, Kind } from '../../data/models';
import styles from './ConfigDraftForm.module.css';

export type ConfigDraftFormProps = {
    kind: Kind;
    config: DefinitionConfig;
    onChange: (cfg: DefinitionConfig, error?: string | null) => void;
};

/** Kinds a generic row cannot author — they only appear in schemas whose kind
 *  keeps a `ConfigForm` (thresholds on `number-kv`, options on `enum-kv`), so
 *  reaching this is a wiring mistake rather than a user-facing state. Guarded
 *  loudly instead of falling through to a control that would silently mangle
 *  the value. */
const NEEDS_A_FORM: ReadonlySet<Kind> = new Set<Kind>(['compound', 'string-list']);

export const ConfigDraftForm = (props: ConfigDraftFormProps) => {
    const schema = (): ConfigSubField[] => CONFIG_SCHEMAS[props.kind] ?? [];

    const flat = () => props.config as Record<string, unknown>;

    /** Write one knob and re-run that sub-field's own guard, if it declares one. */
    const update = (sub: ConfigSubField, value: unknown) => {
        const next = { ...flat() };
        // `undefined` omits the key, matching the sparse config `serializeConfig`
        // expects — an absent knob and an empty one are the same thing here.
        if (value === undefined || value === '') delete next[sub.key];
        else next[sub.key] = value;
        const error = sub.validate ? sub.validate(next[sub.key] as never) : null;
        props.onChange(next as DefinitionConfig, error);
    };

    return (
        <div class={styles.form}>
            <Show
                when={schema().length > 0}
                fallback={<span class={styles.none}>This field kind has no configuration.</span>}
            >
                <For each={schema()}>
                    {(sub) => (
                        <label class={styles.row}>
                            <span class={styles.label}>{sub.label}</span>
                            <Switch
                                fallback={
                                    <span class={styles.unsupported}>
                                        needs a per-kind form
                                    </span>
                                }
                            >
                                <Match when={NEEDS_A_FORM.has(sub.kind)}>
                                    <span class={styles.unsupported}>needs a per-kind form</span>
                                </Match>

                                <Match when={sub.kind === 'flag'}>
                                    <input
                                        type="checkbox"
                                        class={styles.checkbox}
                                        checked={!!flat()[sub.key]}
                                        onChange={(e) =>
                                            update(sub, e.currentTarget.checked || undefined)
                                        }
                                    />
                                </Match>

                                <Match when={sub.kind === 'number-kv'}>
                                    <input
                                        type="number"
                                        class={styles.input}
                                        value={(flat()[sub.key] as number | undefined) ?? ''}
                                        onInput={(e) => {
                                            const raw = e.currentTarget.value;
                                            update(sub, raw === '' ? undefined : Number(raw));
                                        }}
                                    />
                                </Match>

                                <Match when={sub.kind === 'enum-kv'}>
                                    <select
                                        class={styles.input}
                                        value={(flat()[sub.key] as string | undefined) ?? ''}
                                        onChange={(e) =>
                                            update(sub, e.currentTarget.value || undefined)
                                        }
                                    >
                                        <option value="">— none —</option>
                                        <For each={sub.options ?? []}>
                                            {(opt) => <option value={opt}>{opt}</option>}
                                        </For>
                                    </select>
                                </Match>

                                <Match when={sub.kind === 'text-kv'}>
                                    <input
                                        type="text"
                                        class={styles.input}
                                        value={(flat()[sub.key] as string | undefined) ?? ''}
                                        onInput={(e) => update(sub, e.currentTarget.value)}
                                    />
                                </Match>
                            </Switch>
                        </label>
                    )}
                </For>
            </Show>
        </div>
    );
};
