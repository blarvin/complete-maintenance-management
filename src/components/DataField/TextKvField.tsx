/**
 * TextKvField - Renderer for text-kv DataFields.
 *
 * Free-form text. Reads the Template config to decide single-line `<input>` vs
 * multi-line `<textarea>` (`config.multiline`) and to apply per-template save
 * validation (`config.maxWords`). The textarea variant matters on mobile: a
 * wrapped, multi-line value collapsing to a 1-line input on edit shifts the row
 * height, which Android dismisses the keyboard for; a textarea preserves the
 * height and keeps the keyboard up.
 */

import { component$, useResource$, Resource, type PropFunction, type Signal, type QRL } from '@builder.io/qwik';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import { getTemplateQueries } from '../../data/queries';
import type { TextKvConfig } from '../../data/models';
import styles from './DataField.module.css';

export type TextKvFieldProps = {
    id: string;
    fieldName: string;
    templateId: string;
    value: string | null;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange$.
     *  `autoFocus` is set only for the row the user just ticked. */
    pendingMode?: { onChange$: QRL<(value: string | null) => void>; autoFocus?: boolean };
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

export const TextKvField = component$<TextKvFieldProps>((props) => {
    const templateResource = useResource$(async ({ track }) => {
        track(() => props.templateId);
        const tpl = await getTemplateQueries().getTemplateById(props.templateId);
        if (!tpl || tpl.componentType !== 'text-kv') return {} as TextKvConfig;
        return tpl.config as TextKvConfig;
    });

    return (
        <Resource
            value={templateResource}
            onPending={() => <span class={styles.datafieldValue}>…</span>}
            onResolved={(config) => <TextKvBody {...props} config={config} />}
        />
    );
});

const TextKvBody = component$<TextKvFieldProps & { config: TextKvConfig }>((props) => {
    const { config } = props;
    const isMultiline = !!config.multiline;

    const {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        currentValue,
        editInputRef,
        valuePointerDown$,
        valueKeyDown$,
        inputPointerDown$,
        inputBlur$,
        inputKeyDown$,
        inputChange$,
    } = useFieldEdit<string>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatText,
        parse: parseText,
        validate: makeValidate(config),
        rootRef: props.rootRef,
        onUpdated$: props.onUpdated$,
        pendingMode: props.pendingMode,
    });

    useFieldValueSync<string>(props.id, currentValue);

    const labelId = `field-label-${props.id}`;

    if (isEditing) {
        if (isMultiline) {
            return (
                <textarea
                    ref={editInputRef as Signal<HTMLTextAreaElement | undefined>}
                    class={[styles.datafieldValue, styles.datafieldTextarea, editValue.value && styles.datafieldValueUnderlined]}
                    value={editValue.value}
                    rows={4}
                    onInput$={(e) => inputChange$((e.target as HTMLTextAreaElement).value)}
                    onPointerDown$={inputPointerDown$}
                    onBlur$={inputBlur$}
                    onKeyDown$={inputKeyDown$}
                    aria-labelledby={labelId}
                    autoFocus
                />
            );
        }
        return (
            <input
                ref={editInputRef}
                class={[styles.datafieldValue, editValue.value && styles.datafieldValueUnderlined]}
                value={editValue.value}
                onInput$={(e) => inputChange$((e.target as HTMLInputElement).value)}
                onPointerDown$={inputPointerDown$}
                onBlur$={inputBlur$}
                onKeyDown$={inputKeyDown$}
                aria-labelledby={labelId}
                autoFocus
            />
        );
    }

    return (
        <div
            class={[
                styles.datafieldValue,
                hasValue && styles.datafieldValueUnderlined,
                styles.datafieldValueEditable,
                'no-caret',
            ]}
            onPointerDown$={valuePointerDown$}
            onKeyDown$={valueKeyDown$}
            tabIndex={0}
            role="button"
            aria-labelledby={labelId}
            aria-description="Press Enter to edit"
        >
            {displayValue || <span class={styles.datafieldPlaceholder}>Empty</span>}
        </div>
    );
});
