/**
 * ConfigValueFields — read-only renderers for the three config-only kinds
 * (`flag` / `compound` / `string-list`), replacing the shared stub.
 *
 * These kinds back a Definition's config subtree (config-as-Elements). They had
 * no real renderer because nothing ever mounted them: in Phase 1 they lived only
 * inside config, never as Data Card rows. Two surfaces now draw them — the
 * Library picker's config peek and a Field's Details → Config section — so the
 * stub's `JSON.stringify` fallback would have shown a user
 * `{"lowLow":0,"low":2}` where a threshold chain belongs.
 *
 * **Read-only is the spec, not a shortcut.** Every config sub-field is
 * `delegated` in Phase 1: it lives on the Definition and is read live, so an
 * instance shows what its Definition says and the override is the cascade
 * arbiter's job (SPEC → DataField Management → Field Details). None of these
 * therefore calls `useFieldEdit` or accepts `pendingMode`; they gain an edit
 * path when the arbiter gives them something to write to.
 *
 * Value → text lives in `kinds/configValueFormat`, shared with each kind's
 * manifest `displayPreview`, so the peek, the row and history cannot disagree.
 */

import { Show } from 'solid-js';
import { formatCompound, formatFlag, formatStringList } from '../../kinds/configValueFormat';
import type { CompoundValue, FlagValue, StringListValue } from '../../data/models';
import styles from './DataField.module.css';

/**
 * The shared row body. A config sub-field with no value is genuinely *unset* —
 * the kind's own default applies — which is a different statement from a value
 * field's "Empty" (a fact nobody has recorded yet), so it gets its own word.
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

export type FlagFieldProps = { value: FlagValue | null };

export const FlagField = (props: FlagFieldProps) => (
    <ConfigValue text={isAbsent(props.value) ? null : formatFlag(props.value as FlagValue)} />
);

export type StringListFieldProps = { value: StringListValue | null };

export const StringListField = (props: StringListFieldProps) => (
    <ConfigValue
        text={isAbsent(props.value) ? null : formatStringList(props.value as StringListValue)}
    />
);

export type CompoundFieldProps = { value: CompoundValue | null };

export const CompoundField = (props: CompoundFieldProps) => (
    <ConfigValue text={isAbsent(props.value) ? null : formatCompound(props.value as CompoundValue)} />
);
