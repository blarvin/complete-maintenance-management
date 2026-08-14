/**
 * ConfigRows — a kind's config, authored as tree rows.
 *
 * The generic authoring UI (SPEC → Authoring a Definition). Every knob is a row
 * at the same depth its schema puts it: top level, inside a collapsible group,
 * or one deeper inside a compound. Nesting comes from `group` / `members` on
 * `ConfigSubField`, so a kind never declares layout.
 *
 * **Rows behave like DataField value rows**, because that is the app's idiom for
 * editing in place: focus the row, Enter or Space opens the editor, Enter saves,
 * Escape cancels, focus returns to the row. A `flag` toggles outright — there is
 * nothing to type. Arrow keys are deliberately *not* handled here: they belong
 * to whichever tree hosts these rows, and bubble up to it.
 *
 * **Bound to the flat draft config, never to Elements.** Nothing exists to
 * parent a sub-field Element to until the Definition commits, and
 * `serializeConfig` builds the subtree then — including packing a compound's
 * flat member keys back into one object.
 */

import { For, Index, Show, createEffect, createSignal } from 'solid-js';
import { CONFIG_SCHEMAS, CONFIG_GROUPS, CONFIG_VALIDATORS } from '../../kinds/configSchema';
import { getInlineManifest } from '../../kinds/registry';
import type { ConfigSubField, ConfigSubFieldMember } from '../../kinds/types';
import type { DataFieldValue, DefinitionConfig, Kind, StringListValue } from '../../data/models';
import chevron from '../../styles/disclosure.module.css';
import styles from './ConfigRows.module.css';

export type ConfigRowsProps = {
    kind: Kind;
    config: DefinitionConfig;
    onChange: (cfg: DefinitionConfig, error?: string | null) => void;
};

type Flat = Record<string, unknown>;

/* ────────────────────────────────────────────────────────────────────────────
 * Leaf row — label + value, Enter to edit
 * ──────────────────────────────────────────────────────────────────────────── */

type LeafProps = {
    label: string;
    kind: Kind;
    value: unknown;
    options?: string[];
    onWrite: (value: unknown) => void;
};

const LeafRow = (props: LeafProps) => {
    const [editing, setEditing] = createSignal(false);
    let rowEl: HTMLDivElement | undefined;
    let editorEl: HTMLInputElement | HTMLSelectElement | undefined;

    // Focus the editor explicitly rather than trusting `autofocus`: the HTML
    // attribute is processed per *document*, so it is unreliable for a node
    // inserted later — and this surface can insert many. Same explicit pattern
    // as the lens create row.
    createEffect(() => {
        if (editing()) editorEl?.focus();
    });

    const isFlag = () => props.kind === 'flag';

    /** Read back through the kind's own preview so a config row and the
     *  read-only ConfigSummary of the same value always agree. */
    const display = () =>
        getInlineManifest(props.kind).displayPreview((props.value ?? null) as DataFieldValue | null)
        ?? '—';

    /** Leaving edit hands focus back to the row, so the tree keeps its place.
     *  useFieldEdit does this for DataFields; here the row owns it. */
    const leaveEdit = () => {
        setEditing(false);
        rowEl?.focus();
    };

    const activate = () => {
        if (isFlag()) props.onWrite(!props.value || undefined);
        else setEditing(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (editing()) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            activate();
        }
    };

    /**
     * One commit for both editors. Split in two, the kind test had to live
     * inside a callback handed to `editorKeyDown` — reactivity outside a tracked
     * scope, which `solid/reactivity` rightly rejects. Branching in here keeps
     * every `props` read on the event-handler path.
     */
    const commitValue = (raw: string) => {
        const trimmed = raw.trim();
        props.onWrite(
            trimmed === '' ? undefined : props.kind === 'number-kv' ? Number(raw) : raw,
        );
        leaveEdit();
    };

    /* Editor keys are handled inline rather than via a shared helper taking a
       commit callback: `solid/reactivity` traces the identifier, so *passing* a
       function that reads props counts as reactivity outside a tracked scope
       even when it is only ever invoked from an event handler. Calling directly
       keeps it honest, at the cost of four repeated lines. Both stop
       propagation so the hosting tree never sees Enter/Escape as navigation. */

    return (
        <div
            ref={rowEl}
            class={styles.row}
            role="treeitem"
            tabIndex={-1}
            aria-label={props.label}
            onKeyDown={onKeyDown}
            onDblClick={() => !editing() && activate()}
        >
            <span class={chevron.chevronSpacer} aria-hidden="true" />
            <span class={styles.label}>{props.label}</span>

            <Show
                when={editing()}
                fallback={
                    <span
                        classList={{ [styles.value]: true, [styles.valueEmpty]: props.value === undefined }}
                    >
                        {display()}
                    </span>
                }
            >
                <Show
                    when={props.kind === 'enum-kv'}
                    fallback={
                        <input
                            ref={(el) => (editorEl = el)}
                            class={styles.input}
                            type={props.kind === 'number-kv' ? 'number' : 'text'}
                            value={props.value === undefined ? '' : String(props.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitValue(e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    leaveEdit();
                                }
                            }}
                            onBlur={(e) => commitValue(e.currentTarget.value)}
                        />
                    }
                >
                    <select
                        ref={(el) => (editorEl = el)}
                        class={styles.input}
                        value={props.value === undefined ? '' : String(props.value)}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' || e.key === 'Escape') {
                                e.preventDefault();
                                leaveEdit();
                            }
                        }}
                        // Writes but does NOT close. A native select fires
                        // `change` on typeahead — every letter key you press to
                        // find an option — so closing here read as "letters move
                        // the focus". Enter, Escape or blur close it instead.
                        onChange={(e) => props.onWrite(e.currentTarget.value || undefined)}
                        onBlur={leaveEdit}
                    >
                        <option value="">— none —</option>
                        <For each={props.options ?? []}>{(o) => <option value={o}>{o}</option>}</For>
                    </select>
                </Show>
            </Show>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Parent row — a group, a compound, or a list
 * ──────────────────────────────────────────────────────────────────────────── */

const ParentRow = (props: {
    label: string;
    defaultOpen?: boolean;
    children: unknown;
}) => {
    const [open, setOpen] = createSignal(!!props.defaultOpen);
    let rowEl: HTMLDivElement | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open());
        }
    };

    return (
        <div class={styles.group}>
            <div
                ref={rowEl}
                class={styles.row}
                role="treeitem"
                aria-expanded={open()}
                aria-label={props.label}
                tabIndex={-1}
                onKeyDown={onKeyDown}
            >
                <span
                    classList={{
                        [chevron.chevron]: true,
                        [chevron.chevronDown]: open(),
                        [chevron.chevronRight]: !open(),
                    }}
                    aria-hidden="true"
                    onClick={() => setOpen(!open())}
                />
                <span class={styles.groupLabel} onClick={() => setOpen(!open())}>
                    {props.label}
                </span>
            </div>
            <Show when={open()}>
                <div class={styles.nested} role="group">
                    {props.children as never}
                </div>
            </Show>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────────────────────
 * The list row — `string-list`, today only enum-kv's options
 * ──────────────────────────────────────────────────────────────────────────── */

const ListRow = (props: {
    sub: ConfigSubField;
    items: StringListValue;
    onWrite: (items: StringListValue | undefined) => void;
}) => {
    const setAt = (i: number, v: string) => {
        const next = [...props.items];
        next[i] = v;
        props.onWrite(next);
    };
    const removeAt = (i: number) => {
        const next = props.items.filter((_, n) => n !== i);
        props.onWrite(next.length ? next : undefined);
    };

    return (
        <ParentRow label={`${props.sub.label} (${props.items.length})`} defaultOpen>
            {/* <Index>, not <For>: For keys by value, so every keystroke made the
                edited string a "new" item and remounted its row — which blurred
                the input after one character. Index keys by position and patches
                the value in place. Same fix, same reason, as EnumKvConfigForm. */}
            <Index each={props.items}>
                {(item, i) => (
                    <div class={styles.row}>
                        <span class={chevron.chevronSpacer} aria-hidden="true" />
                        <input
                            class={styles.input}
                            type="text"
                            value={item()}
                            placeholder="Option label"
                            onInput={(e) => setAt(i, e.currentTarget.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                        <button
                            type="button"
                            class={styles.remove}
                            onClick={() => removeAt(i)}
                            aria-label={`Remove option ${i + 1}`}
                        >
                            ×
                        </button>
                    </div>
                )}
            </Index>
            <div class={styles.row}>
                <span class={chevron.chevronSpacer} aria-hidden="true" />
                <button
                    type="button"
                    class={styles.addItem}
                    onClick={() => props.onWrite([...props.items, ''])}
                >
                    + Add option
                </button>
            </div>
        </ParentRow>
    );
};

/* ──────────────────────────────────────────────────────────────────────────── */

export const ConfigRows = (props: ConfigRowsProps) => {
    const flat = () => props.config as Flat;

    /**
     * Write one knob and revalidate the whole config.
     *
     * Only the kind's cross-field validator runs: a sub-field's own `validate`
     * is subsumed by it today (`validateNumberKvConfig` already calls
     * `validateThresholds(packThresholds(config))`), and running both would
     * report the same violation twice.
     */
    const write = (key: string, value: unknown) => {
        const next = { ...flat() };
        if (value === undefined || value === '') delete next[key];
        else next[key] = value;
        const error = CONFIG_VALIDATORS[props.kind]?.(next as DefinitionConfig) ?? null;
        props.onChange(next as DefinitionConfig, error);
    };

    const schema = (): ConfigSubField[] => CONFIG_SCHEMAS[props.kind] ?? [];
    const visible = (s: ConfigSubField) => !s.visibleWhen || s.visibleWhen(flat());
    const inGroup = (label?: string) =>
        schema().filter((s) => s.group === label && visible(s));

    const renderSub = (sub: ConfigSubField) => {
        if (sub.members) {
            return (
                <ParentRow label={sub.label}>
                    <For each={sub.members}>
                        {(m: ConfigSubFieldMember) => (
                            <LeafRow
                                label={m.label}
                                kind={m.kind}
                                value={flat()[m.key]}
                                onWrite={(v) => write(m.key, v)}
                            />
                        )}
                    </For>
                </ParentRow>
            );
        }
        if (sub.kind === 'string-list') {
            return (
                <ListRow
                    sub={sub}
                    items={(flat()[sub.key] as StringListValue | undefined) ?? []}
                    onWrite={(items) => write(sub.key, items)}
                />
            );
        }
        return (
            <LeafRow
                label={sub.label}
                kind={sub.kind}
                value={flat()[sub.key]}
                options={sub.options}
                onWrite={(v) => write(sub.key, v)}
            />
        );
    };

    return (
        <div class={styles.rows}>
            {/* Ungrouped knobs first — the required ones live here by convention
                (number-kv's units symbol), so they are never behind a chevron. */}
            <For each={inGroup(undefined)}>{renderSub}</For>

            <For each={CONFIG_GROUPS[props.kind] ?? []}>
                {(group) => (
                    <Show when={inGroup(group.label).length > 0}>
                        <ParentRow label={group.label} defaultOpen={group.defaultOpen}>
                            <For each={inGroup(group.label)}>{renderSub}</For>
                        </ParentRow>
                    </Show>
                )}
            </For>
        </div>
    );
};
