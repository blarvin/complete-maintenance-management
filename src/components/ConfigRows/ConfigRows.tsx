/**
 * ConfigRows — a kind's config, authored as tree rows.
 *
 * The generic authoring UI (SPEC → Authoring a Definition). **One flat list, one
 * row per knob** — including the four alarm thresholds, which were one `compound`
 * drawn as four sibling rows until the kind was retired 2026-08-17 and the schema
 * started saying what the band already showed. Collapsible category groups were
 * removed 2026-08-16 (see SUPERSEDED → *number-kv progressive disclosure*): every
 * label stands on its own, so the group chevrons were a level of structure that
 * hid knobs without telling the reader anything the labels didn't. Where a
 * category label *was* load-bearing it moved into the labels themselves
 * (`Low low` → `Threshold LL`).
 *
 * `visibleWhen` stays, and is a different thing: it hides a row that is
 * *irrelevant* to the current config rather than merely filing it under a
 * heading. **Nothing nests at all** as of 2026-08-16: a `string-list` used to
 * hang its items under an `Options (n)` parent row, which named a count, hid
 * nothing worth hiding, and wore a chevron promising a structure the band has
 * nowhere else. Its items are ordinary rows now.
 *
 * **Rows behave like DataField value rows**, because that is the app's idiom for
 * editing in place: focus the row, Enter or Space opens the editor, Enter saves,
 * Escape cancels, focus returns to the row. A `flag` toggles outright — there is
 * nothing to type. Arrow keys are deliberately *not* handled here: they belong
 * to whichever tree hosts these rows, and bubble up to it.
 *
 * **Bound to the flat draft config, never to Elements.** Nothing exists to
 * parent a sub-field Element to until the Definition commits, and
 * `serializeConfig` builds the subtree then.
 *
 * Not to be confused with a Definition's card **in the Library**, which draws the
 * same knobs as real `DataField` rows over the persisted sub-field Elements
 * (`FieldList`). This surface exists because at authoring time those Elements do
 * not exist yet.
 */

import { For, Index, Show, createUniqueId } from 'solid-js';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import type { ConfigSubField } from '../../kinds/types';
import type { DefinitionConfig, Kind, StringListValue } from '../../data/models';
import chevron from '../../styles/disclosure.module.css';
import styles from './ConfigRows.module.css';

export type ConfigRowsProps = {
    kind: Kind;
    config: DefinitionConfig;
    onChange: (cfg: DefinitionConfig) => void;
};

type Flat = Record<string, unknown>;

/* ────────────────────────────────────────────────────────────────────────────
 * Leaf row — label + a control that is always there
 *
 * **There is no edit mode.** The control for a knob is rendered at rest, so the
 * row says what it is before it is touched — which a `—` could not, and which
 * matters most on exactly the knobs that are still empty. Single-click entry is
 * not a feature added on top; it is what remains once there is no mode to enter.
 *
 * Each control is drawn as a **hole in the row's fill** rather than a bordered
 * widget: the surface behind it is already tinted (the Add Surface wears the
 * under-construction hue), so the page's own background showing through reads as
 * somewhere to put something. See `.entry` in the stylesheet.
 * ──────────────────────────────────────────────────────────────────────────── */

type LeafProps = {
    label: string;
    kind: Kind;
    value: unknown;
    options?: string[];
    onWrite: (value: unknown) => void;
};

const LeafRow = (props: LeafProps) => {
    // Ties the visible label to its control without inventing a DOM id scheme —
    // several Add Surfaces can be mounted at once (one per card, plus each lens).
    const controlId = createUniqueId();

    /**
     * Text and number commit on `change` (blur or Enter), not on every
     * keystroke. Per-keystroke would fight the user on numbers: `Number('1.')`
     * is `1`, so typing a decimal point would erase itself as the value round-
     * tripped through the config.
     */
    const commitText = (raw: string) => {
        const trimmed = raw.trim();
        props.onWrite(
            trimmed === '' ? undefined : props.kind === 'number-kv' ? Number(raw) : raw,
        );
    };

    return (
        <div class={styles.row}>
            <span class={chevron.chevronSpacer} aria-hidden="true" />
            <label class={styles.label} for={controlId}>{props.label}</label>

            <Show
                when={props.kind === 'flag'}
                fallback={
                    <Show
                        when={props.kind === 'enum-kv'}
                        fallback={
                            <input
                                id={controlId}
                                class={styles.entry}
                                type={props.kind === 'number-kv' ? 'number' : 'text'}
                                value={props.value === undefined ? '' : String(props.value)}
                                // The hosting tree must never see these as navigation.
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => commitText(e.currentTarget.value)}
                            />
                        }
                    >
                        {/* The caret is ours, not the OS's: `appearance: none`
                            strips the native chrome that would otherwise sit
                            proud of a hole, and the glyph is the same disclosure
                            triangle the rest of the tree uses. */}
                        <span class={styles.selectWrap}>
                            <select
                                id={controlId}
                                classList={{ [styles.entry]: true, [styles.entrySelect]: true }}
                                value={props.value === undefined ? '' : String(props.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => props.onWrite(e.currentTarget.value || undefined)}
                            >
                                <option value="">—</option>
                                <For each={props.options ?? []}>{(o) => <option value={o}>{o}</option>}</For>
                            </select>
                            <span
                                classList={{
                                    [chevron.glyph]: true,
                                    [chevron.glyphDown]: true,
                                    [styles.selectCaret]: true,
                                }}
                                aria-hidden="true"
                            />
                        </span>
                    </Show>
                }
            >
                {/* Unchecked writes `undefined`, not `false` — an unset flag must
                    stay absent from the config so `serializeConfig` emits no
                    child for it. */}
                <input
                    id={controlId}
                    class={styles.entryCheck}
                    type="checkbox"
                    checked={props.value === true}
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => props.onWrite(e.currentTarget.checked || undefined)}
                />
            </Show>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────────────────────
 * The list rows — `string-list`, today only enum-kv's options
 *
 * A list contributes **one ordinary row per item**, at the same depth as every
 * other knob. There is no parent row: `Options (0)` was a heading that named a
 * count and hid nothing worth hiding, and the chevron beside it promised a
 * structure the config band no longer has anywhere else.
 *
 * The `+ Add` control does *not* live here — it sits at the very bottom of the
 * band, past the other knobs, because it is the one control that grows the list
 * rather than filling it in. See `ConfigRows`.
 * ──────────────────────────────────────────────────────────────────────────── */

const ListRows = (props: {
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
        /* <Index>, not <For>: For keys by value, so every keystroke made the
           edited string a "new" item and remounted its row — which blurred the
           input after one character. Index keys by position and patches the
           value in place. */
        <Index each={props.items}>
            {(item, i) => (
                <div class={styles.row}>
                    <span class={chevron.chevronSpacer} aria-hidden="true" />
                    <span class={styles.label}>{`${singular(props.sub.label)} ${i + 1}`}</span>
                    <input
                        class={styles.entry}
                        type="text"
                        value={item()}
                        // No placeholder: the row's own label already says
                        // `Option 1`, and every other text hole in the band is
                        // blank when empty.
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
    );
};

/** `Options` → `Option`. One list sub-field exists; this is the whole of the
 *  pluralisation this surface will ever need. */
const singular = (label: string) => label.replace(/s$/, '');

/* ──────────────────────────────────────────────────────────────────────────── */

export const ConfigRows = (props: ConfigRowsProps) => {
    const flat = () => props.config as Flat;

    /**
     * Write one knob. Validation is **not** run here and not handed back: the
     * kind's cross-field violation is a pure function of `(kind, config)`, so
     * the draft derives it (`useDefinitionDraft.configError`) rather than
     * caching what this component computed. Two copies of one fact is one too
     * many, and the cached one was always a write behind.
     */
    const write = (key: string, value: unknown) => {
        const next = { ...flat() };
        if (value === undefined || value === '') delete next[key];
        else next[key] = value;
        props.onChange(next as DefinitionConfig);
    };

    const schema = (): ConfigSubField[] =>
        (CONFIG_SCHEMAS[props.kind] ?? []).filter(
            (s) => !s.visibleWhen || s.visibleWhen(flat()),
        );

    const itemsOf = (sub: ConfigSubField): StringListValue =>
        (flat()[sub.key] as StringListValue | undefined) ?? [];

    /** The list sub-fields, whose `+ Add` controls trail the whole band. */
    const listSubs = () => schema().filter((s) => s.kind === 'string-list');

    const renderSub = (sub: ConfigSubField) => {
        if (sub.kind === 'string-list') {
            return (
                <ListRows
                    sub={sub}
                    items={itemsOf(sub)}
                    onWrite={(items) => write(sub.key, items)}
                />
            );
        }
        return (
            <LeafRow
                label={sub.label}
                kind={sub.kind}
                value={flat()[sub.key]}
                // `dynamicOptions` wins where a sub-field's vocabulary is
                // another knob's value (enum-kv's `default` over its `options`).
                options={sub.dynamicOptions ? sub.dynamicOptions(flat()) : sub.options}
                onWrite={(v) => write(sub.key, v)}
            />
        );
    };

    return (
        <div class={styles.rows}>
            {/* Schema order is render order — no partitioning, no chevrons. The
                required knobs lead by convention (number-kv's units symbol). */}
            <For each={schema()}>{renderSub}</For>

            {/* `+ Add` trails every knob rather than sitting with its own list:
                it is the one control that *grows* the config instead of filling
                a knob in, so it belongs at the end of the band where the reader
                has already seen what exists. */}
            <For each={listSubs()}>
                {(sub) => (
                    <div class={styles.row}>
                        <span class={chevron.chevronSpacer} aria-hidden="true" />
                        <button
                            type="button"
                            class={styles.addItem}
                            onClick={() => write(sub.key, [...itemsOf(sub), ''])}
                        >
                            {`+ Add ${singular(sub.label).toLowerCase()}`}
                        </button>
                    </div>
                )}
            </For>
        </div>
    );
};
