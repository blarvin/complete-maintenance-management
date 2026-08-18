/**
 * TextKvField - Renderer for text-kv DataFields.
 *
 * Free-form text. Reads the Definition config to decide single-line
 * `<input>` vs multi-line `<textarea>` (`config.multiline`) and to apply
 * per-definition save validation (`config.maxWords`). The textarea variant
 * matters on mobile: a
 * wrapped, multi-line value collapsing to a 1-line input on edit shifts the row
 * height, which Android dismisses the keyboard for; a textarea preserves the
 * height and keeps the keyboard up.
 *
 * Wrapper/Body split: the Body owns the `useFieldEdit` call so config is a
 * mount-time constant it may capture (`makeValidate(config)`).
 */

import { Show, type Accessor } from 'solid-js';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import { useDefinitionConfig } from '../../hooks/useDefinitionConfig';
import type { TextKvConfig } from '../../data/models';
import styles from './DataField.module.css';

export type TextKvFieldProps = {
    id: string;
    definitionId: string;
    value: string | null;
    rootRef: Accessor<HTMLElement | undefined>;
    /** Draft config, for a row with no Definition to fetch from (the Add Surface,
     *  and a config Field on a Definition's card in the Library). */
    config?: TextKvConfig;
    /** Write-once: the row displays but never opens an editor. */
    readOnly?: boolean;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange.
     *  `autoFocus` is set only for the row the user just ticked. */
    pendingMode?: { onChange: (value: string | null) => void | Promise<void>; autoFocus?: boolean };
};

const formatText = (v: string | null): string => v ?? '';
const parseText = (raw: string): string | null => {
    return raw.trim() === '' ? null : raw;
};

const countWords = (s: string): number => {
    const trimmed = s.trim();
    if (trimmed === '') return 0;
    return trimmed.split(/\s+/).length;
};

const makeValidate = (config: TextKvConfig) => {
    return (value: string | null) => {
        if (value === null) return;
        if (config.maxWords !== undefined) {
            const n = countWords(value);
            if (n > config.maxWords) {
                throw new Error(`Must be at most ${config.maxWords} word${config.maxWords === 1 ? '' : 's'}`);
            }
        }
    };
};

export const TextKvField = (props: TextKvFieldProps) => {
    // Live, not merely fetched: an edit to this Definition in the Library has to
    // reach this row (SPEC → *Downstream only*). A null id skips the fetch — a
    // draft row carries its config on the prop and has no Definition to read.
    const { definition, loading } = useDefinitionConfig(() =>
        props.config ? null : props.definitionId,
    );

    // Missing / wrong-kind / failed degrades to an empty config, exactly as the
    // error-catching fetcher this replaced did — `undefined` only ever means "the
    // fetch is still in flight", which is what the `<Show>` fallback below draws.
    const config = (): TextKvConfig | undefined => {
        if (props.config) return props.config;
        if (loading()) return undefined;
        const def = definition();
        return def?.kind === 'text-kv' ? (def.config as TextKvConfig) : {};
    };

    return (
        // `keyed` remounts the body when the config object's identity changes,
        // which for a draft is every edit in the Config band. Intended: the body
        // captures config as a mount-time constant, and an enum's options must
        // reach the value slot.
        <Show when={config()} keyed fallback={<span class={styles.datafieldValue}>…</span>}>
            {(cfg) => <TextKvBody {...props} config={cfg} />}
        </Show>
    );
};

const TextKvBody = (props: TextKvFieldProps & { config: TextKvConfig }) => {
    /* eslint-disable solid/reactivity -- mount-time constants; rows remount per field (<For> reference-keyed) */
    const {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        setCurrentValue,
        setEditInputRef,
        valuePointerDown,
        valueKeyDown,
        inputPointerDown,
        inputBlur,
        inputKeyDown,
        inputChange,
    } = useFieldEdit<string>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatText,
        parse: parseText,
        validate: makeValidate(props.config),
        rootRef: props.rootRef,
        readOnly: props.readOnly,
        pendingMode: props.pendingMode,
    });
    /* eslint-enable solid/reactivity */

    // eslint-disable-next-line solid/reactivity -- mount-time constant; rows remount per field
    useFieldValueSync<string>(props.id, setCurrentValue);

    const labelId = () => `field-label-${props.id}`;
    const isMultiline = () => !!props.config.multiline;

    return (
        <Show
            when={isEditing()}
            fallback={
                <div
                    classList={{
                        [styles.datafieldValue]: true,
                        [styles.datafieldValueUnderlined]: hasValue(),
                        [styles.datafieldValueEditable]: true,
                        'no-caret': true,
                    }}
                    onPointerDown={valuePointerDown}
                    onKeyDown={valueKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-labelledby={labelId()}
                    aria-description="Press Enter to edit"
                >
                    {displayValue() || <span class={styles.datafieldPlaceholder}>Empty</span>}
                </div>
            }
        >
            <Show
                when={isMultiline()}
                fallback={
                    <input
                        ref={setEditInputRef}
                        classList={{
                            [styles.datafieldValue]: true,
                            [styles.datafieldValueUnderlined]: !!editValue(),
                        }}
                        value={editValue()}
                        onInput={(e) => inputChange(e.currentTarget.value)}
                        onPointerDown={inputPointerDown}
                        onBlur={inputBlur}
                        onKeyDown={inputKeyDown}
                        aria-labelledby={labelId()}
                        autofocus
                    />
                }
            >
                <textarea
                    ref={setEditInputRef}
                    classList={{
                        [styles.datafieldValue]: true,
                        [styles.datafieldTextarea]: true,
                        [styles.datafieldValueUnderlined]: !!editValue(),
                    }}
                    value={editValue()}
                    rows={4}
                    onInput={(e) => inputChange(e.currentTarget.value)}
                    onPointerDown={inputPointerDown}
                    onBlur={inputBlur}
                    onKeyDown={inputKeyDown}
                    aria-labelledby={labelId()}
                    autofocus
                />
            </Show>
        </Show>
    );
};
