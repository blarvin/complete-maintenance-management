/**
 * TextKvField - Renderer for text-kv DataFields.
 *
 * Free-form text value. Multiline textarea variant deferred — Phase 1 ships
 * the single-line input regardless of config.multiline.
 */

import { component$, type PropFunction, type Signal, type QRL } from '@builder.io/qwik';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import styles from './DataField.module.css';

export type TextKvFieldProps = {
    id: string;
    fieldName: string;
    value: string | null;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange$. */
    pendingMode?: { onChange$: QRL<(value: string | null) => void> };
};

const formatText = (v: string | null): string => v ?? '';
const parseText = (raw: string): string | null => {
    return raw.trim() === '' ? null : raw;
};

export const TextKvField = component$<TextKvFieldProps>((props) => {
    const {
        isEditing,
        displayValue,
        isPreviewActive,
        hasValue,
        editValue,
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
        rootRef: props.rootRef,
        onUpdated$: props.onUpdated$,
        pendingMode: props.pendingMode,
    });

    const labelId = `field-label-${props.id}`;

    return isEditing ? (
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
    ) : (
        <div
            class={[
                styles.datafieldValue,
                hasValue && styles.datafieldValueUnderlined,
                styles.datafieldValueEditable,
                isPreviewActive && styles.datafieldValuePreview,
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
