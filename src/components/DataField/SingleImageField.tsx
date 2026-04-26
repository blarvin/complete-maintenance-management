/**
 * SingleImageField — Mocked single-image DataField with editable caption.
 *
 * Layout: a chunky placeholder box with a centered "Upload Image" mock link,
 * caption beneath. Single-tap the link flashes it bold (no real upload yet).
 * Double-tap the caption to edit (max 50 chars). The caption is stored in the
 * field's `value` string for prototyping; when real image upload lands, value
 * will become structured ({ imageUrl, caption }) and a small migration follows.
 *
 * Spans the value + metadata + spacer columns in the FieldList subgrid for
 * visual impact (`display: contents` + a wrapper with `grid-column: 3 / -2`).
 */

import { component$, useSignal, $, type PropFunction, type Signal, type QRL } from '@builder.io/qwik';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import type { SingleImageValue } from '../../data/models';
import styles from './DataField.module.css';
import imageStyles from './SingleImageField.module.css';

const CAPTION_MAX = 50;

/** Mocked image stub — real fields are populated when upload lands. */
const emptyImage = (caption: string): SingleImageValue => ({
    blobId: '',
    mimeType: '',
    width: 0,
    height: 0,
    byteSize: 0,
    caption,
});

export type SingleImageFieldProps = {
    id: string;
    fieldName: string;
    value: SingleImageValue | null;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
    pendingMode?: { onChange$: QRL<(value: SingleImageValue | null) => void> };
};

const formatCaption = (v: SingleImageValue | null): string => v?.caption ?? '';
const parseCaption = (raw: string): SingleImageValue | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    if (trimmed.length > CAPTION_MAX) {
        throw new Error(`Caption too long (max ${CAPTION_MAX} characters)`);
    }
    return emptyImage(trimmed);
};

export const SingleImageField = component$<SingleImageFieldProps>((props) => {
    const flashing = useSignal(false);

    const handleUploadTap$ = $(() => {
        flashing.value = true;
        setTimeout(() => { flashing.value = false; }, 180);
    });

    const {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        editInputRef,
        valuePointerDown$,
        valueKeyDown$,
        inputPointerDown$,
        inputBlur$,
        inputKeyDown$,
        inputChange$,
    } = useFieldEdit<SingleImageValue>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatCaption,
        parse: parseCaption,
        rootRef: props.rootRef,
        onUpdated$: props.onUpdated$,
        pendingMode: props.pendingMode,
    });

    const labelId = `field-label-${props.id}`;

    return (
        <div style="display: contents">
            <div class={imageStyles.imageBlock}>
                <div
                    class={imageStyles.imageBox}
                    onPointerDown$={handleUploadTap$}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload image (mock)"
                >
                    <span class={[imageStyles.uploadLink, flashing.value && imageStyles.uploadLinkFlash]}>
                        Upload Image
                    </span>
                </div>

                {isEditing ? (
                    <input
                        ref={editInputRef}
                        class={[styles.datafieldValue, imageStyles.captionInput]}
                        value={editValue.value}
                        maxLength={CAPTION_MAX}
                        placeholder="Add caption…"
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
                            imageStyles.caption,
                            hasValue && styles.datafieldValueUnderlined,
                            'no-caret',
                        ]}
                        onPointerDown$={valuePointerDown$}
                        onKeyDown$={valueKeyDown$}
                        tabIndex={0}
                        role="button"
                        aria-labelledby={labelId}
                        aria-description="Double-tap to edit caption"
                    >
                        {displayValue || <span class={imageStyles.captionPlaceholder}>Add caption…</span>}
                    </div>
                )}
            </div>
        </div>
    );
});
