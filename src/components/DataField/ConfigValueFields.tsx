/**
 * ConfigValueFields — renderers for the two config-only kinds (`flag` /
 * `string-list`).
 *
 * These kinds back a Definition's config subtree (config-as-Elements). They were
 * one-line read-only formatters until 2026-08-17, which was right while nothing
 * mounted them as an *editable* surface: config appeared only as a peek (the Add
 * Surface's Config band, a Field's Details → Config), and every config sub-field
 * is `delegated`, so an instance may show what its Definition says but must not
 * rewrite it.
 *
 * **The Library changes that, and only for the Library.** A Definition's config is
 * ordinary Fields on its Data Card, editable in place and history-tracked (SPEC →
 * *Everything in the Library is a Node with Fields*), so these need real editors:
 * a toggle and a chips list. The read-only peek surfaces are untouched — they go
 * through each kind's `displayPreview` via `ConfigSummary`, never through a
 * Renderer, precisely so that mounting an editable renderer here cannot make a
 * picker row editable.
 *
 * Both commit on the standard path (`commitWithUndo` + `UPDATE_ELEMENT_VALUE`), so
 * the adapter's required-config check and the `DEFINITION_WRITTEN` propagation
 * apply to them exactly as to a `number-kv` knob. Neither has an edit *mode*: a
 * toggle has nothing to type, and a chips list is a set of always-live inputs —
 * the same reasoning as the Add Surface's config rows.
 *
 * Value → text for the read-only surfaces still lives in `kinds/configValueFormat`,
 * shared with each kind's manifest `displayPreview`.
 */

import { Index, Show, type Accessor } from 'solid-js';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import { useEditableValue } from '../../hooks/useEditableValue';
import { formatFlag, formatStringList } from '../../kinds/configValueFormat';
import type { DataFieldValue, FlagValue, StringListValue } from '../../data/models';
import styles from './DataField.module.css';
import configStyles from './ConfigValueFields.module.css';

/**
 * Shared write path. `pendingMode` buffers instead (the Add Surface's value slot);
 * otherwise the value goes through `commitWithUndo` like every other Field edit,
 * which is what gives a config change its Undo toast and its history row.
 */
type ConfigWriteProps<T extends DataFieldValue> = {
    id: string;
    readOnly?: boolean;
    pendingMode?: { onChange: (value: T | null) => void | Promise<void>; autoFocus?: boolean };
};

async function commitConfigValue<T extends DataFieldValue>(
    props: ConfigWriteProps<T>,
    prev: T | null,
    next: T | null,
): Promise<boolean> {
    if (props.readOnly) return false;
    if (props.pendingMode) {
        await props.pendingMode.onChange(next);
        return true;
    }
    const fieldId = props.id;
    return commitWithUndo({
        message: 'Field updated',
        execute: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: next } }),
        undo: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: prev } }),
    });
}

/**
 * The read-only row body, still used by both kinds when `readOnly` is set. A
 * config sub-field with no value is genuinely *unset* — the kind's own default
 * applies — which is a different statement from a value field's "Empty" (a fact
 * nobody has recorded yet), so it keeps its own word.
 */
const ConfigValue = (props: { text: string | null }) => (
    <div class={styles.datafieldValue}>
        <Show
            when={props.text !== null}
            fallback={<span class={styles.datafieldPlaceholder}>Unset</span>}
        >
            {props.text}
        </Show>
    </div>
);

const isAbsent = (v: unknown): boolean => v === null || v === undefined;

/** `useEditableValue` formats `T | null`; the shared formatters take a present
 *  value only, because the read-only body draws its own "Unset" placeholder. */
const flagText = (v: FlagValue | null): string => (isAbsent(v) ? '' : formatFlag(v as FlagValue));
const listText = (v: StringListValue | null): string =>
    isAbsent(v) ? '' : formatStringList(v as StringListValue);

/* ────────────────────────────────────────────────────────────────────────────
 * flag — a toggle
 *
 * No edit mode to enter and nothing to save: the checkbox *is* the control, and
 * flipping it commits. Double-tap-to-edit exists to protect a value that is there
 * to be read from an accidental brush; a checkbox has no such reading state, and
 * gating it behind a mode would mean two taps to express one bit.
 * ──────────────────────────────────────────────────────────────────────────── */

export type FlagFieldProps = ConfigWriteProps<FlagValue> & {
    value: FlagValue | null;
    rootRef?: Accessor<HTMLElement | undefined>;
};

export const FlagField = (props: FlagFieldProps) => {
    /* eslint-disable-next-line solid/reactivity -- mount-time seed; rows remount per field (<For> reference-keyed) */
    const { current, setCurrent } = useEditableValue<FlagValue>(props.value, flagText);
    /* eslint-disable-next-line solid/reactivity -- mount-time constant; rows remount per field */
    useFieldValueSync<FlagValue>(props.id, setCurrent);

    const labelId = () => `field-label-${props.id}`;

    const toggle = async (next: boolean) => {
        const prev = current();
        const ok = await commitConfigValue<FlagValue>(props, prev, next);
        if (ok) setCurrent(next);
        // A rejected write must not leave the box showing the value it failed to
        // save, and the DOM checkbox has already flipped itself.
        else setCurrent(prev);
    };

    return (
        <Show
            when={!props.readOnly}
            fallback={<ConfigValue text={isAbsent(current()) ? null : formatFlag(current() as FlagValue)} />}
        >
            <div classList={{ [styles.datafieldValue]: true, [configStyles.flagRow]: true }}>
                <input
                    type="checkbox"
                    class={configStyles.checkbox}
                    checked={current() === true}
                    aria-labelledby={labelId()}
                    onChange={(e) => void toggle(e.currentTarget.checked)}
                />
                <span class={configStyles.flagWord}>{formatFlag(current() === true)}</span>
            </div>
        </Show>
    );
};

/* ────────────────────────────────────────────────────────────────────────────
 * string-list — a chips list
 *
 * One always-live input per entry plus a `+ Add`, mirroring the Add Surface's
 * `ListRows`: the two surfaces edit the same knob and there is no reason for them
 * to feel different. Commits on `change` (blur or Enter) rather than per keystroke
 * — a per-keystroke write would put one history row per character into the
 * Definition's audit log.
 *
 * An empty entry is dropped on commit rather than stored, matching
 * `enum-kv.options`' `pack`; a list that empties out entirely writes `null`
 * (unset), which is what an absent knob has always meant.
 * ──────────────────────────────────────────────────────────────────────────── */

export type StringListFieldProps = ConfigWriteProps<StringListValue> & {
    value: StringListValue | null;
    rootRef?: Accessor<HTMLElement | undefined>;
};

/** Blank entries never reach storage; an all-blank list is `null`, not `[]`. */
const cleaned = (items: StringListValue): StringListValue | null => {
    const filled = items.map((i) => i.trim()).filter((i) => i !== '');
    return filled.length ? filled : null;
};

export const StringListField = (props: StringListFieldProps) => {
    /* eslint-disable-next-line solid/reactivity -- mount-time seed; rows remount per field */
    const { current, setCurrent } = useEditableValue<StringListValue>(props.value, listText);
    /* eslint-disable-next-line solid/reactivity -- mount-time constant; rows remount per field */
    useFieldValueSync<StringListValue>(props.id, setCurrent);

    const items = (): StringListValue => current() ?? [];

    const write = async (next: StringListValue) => {
        const prev = current();
        const value = cleaned(next);
        const ok = await commitConfigValue<StringListValue>(props, prev, value);
        setCurrent(ok ? value : prev);
    };

    return (
        <Show
            when={!props.readOnly}
            fallback={<ConfigValue text={isAbsent(current()) ? null : formatStringList(items())} />}
        >
            <div classList={{ [styles.datafieldValue]: true, [configStyles.chips]: true }}>
                {/* <Index>, not <For>: For keys by value, so every keystroke would
                    make the edited string a "new" item and remount its row, which
                    blurs the input after one character. */}
                <Index each={items()}>
                    {(item, i) => (
                        <span class={configStyles.chip}>
                            <input
                                class={configStyles.chipInput}
                                type="text"
                                value={item()}
                                aria-label={`Entry ${i + 1}`}
                                // The hosting tree must never read these as navigation.
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    const next = [...items()];
                                    next[i] = e.currentTarget.value;
                                    void write(next);
                                }}
                            />
                            <button
                                type="button"
                                class={configStyles.chipRemove}
                                aria-label={`Remove entry ${i + 1}`}
                                onClick={() => void write(items().filter((_, n) => n !== i))}
                            >
                                ×
                            </button>
                        </span>
                    )}
                </Index>
                <button
                    type="button"
                    class={configStyles.addItem}
                    // Appends locally without committing: an empty entry is not a
                    // value, and writing one would be a history row saying nothing.
                    // It reaches storage when the user types into it.
                    onClick={() => setCurrent([...items(), ''])}
                >
                    + Add
                </button>
            </div>
        </Show>
    );
};

/* `CompoundField` lived here until 2026-08-17. `compound` is retired — number-kv's
   thresholds are four ordinary `number-kv` sub-fields now, each with its own row,
   its own history and its own editor. See ELEMENT-MODEL → number-kv. */
