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

import { Show, createResource, type Accessor } from 'solid-js';
import { useValueSlot } from '../../hooks/useValueSlot';
import { getDefinitionQueries } from '../../data/queries';
import type { TextKvConfig } from '../../data/models';
import type { PendingMode } from '../../kinds/types';
import styles from './DataField.module.css';

export type TextKvFieldProps = {
    id: string;
    definitionId: string;
    value: string | null;
    rootRef: Accessor<HTMLElement | undefined>;
    /** Draft config, for a row with no Definition to fetch from (the Add Surface). */
    config?: TextKvConfig;
    pendingMode?: PendingMode<string>;
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
    // Error-catching fetcher: never enters the throwing state (no ErrorBoundary);
    // missing/wrong-kind def degrades to an empty config. A null source skips the
    // fetch entirely — a draft row carries its config on the prop and has no
    // Definition to read.
    const [fetched] = createResource(
        () => (props.config ? null : props.definitionId),
        async (definitionId): Promise<TextKvConfig> => {
            try {
                const def = await getDefinitionQueries().getDefinitionById(definitionId);
                if (!def || def.kind !== 'text-kv') return {};
                return def.config as TextKvConfig;
            } catch {
                return {};
            }
        },
    );

    const config = () => props.config ?? fetched();

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
    // eslint-disable-next-line solid/reactivity -- mount-time constant; the Body remounts per config (<Show keyed>)
    const config = props.config;

    const {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        setEditInputRef,
        valuePointerDown,
        valueKeyDown,
        inputPointerDown,
        inputBlur,
        inputKeyDown,
        inputChange,
    } = useValueSlot<string>(props, {
        format: formatText,
        parse: parseText,
        validate: makeValidate(config),
    });

    const labelId = () => `field-label-${props.id}`;
    const isMultiline = () => !!config.multiline;

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
                        // The action key commits and dismisses — it does not
                        // advance to a next field. See useFieldEdit → inputBlur.
                        enterkeyhint="done"
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
                    // Truthful here too: this textarea's Enter saves rather than
                    // inserting a newline (deliberate — see the docblock above).
                    enterkeyhint="done"
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
