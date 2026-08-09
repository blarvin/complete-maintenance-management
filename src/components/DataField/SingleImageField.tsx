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

import { Show, createSignal, type Accessor } from 'solid-js';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
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
    value: SingleImageValue | null;
    rootRef: Accessor<HTMLElement | undefined>;
    /** `autoFocus` is set only for the row the user just ticked — focuses the
     *  caption input on mount; seeded rows leave it false. */
    pendingMode?: { onChange: (value: SingleImageValue | null) => void | Promise<void>; autoFocus?: boolean };
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

export const SingleImageField = (props: SingleImageFieldProps) => {
    const [flashing, setFlashing] = createSignal(false);

    const handleUploadTap = () => {
        setFlashing(true);
        setTimeout(() => setFlashing(false), 180);
    };

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
    } = useFieldEdit<SingleImageValue>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatCaption,
        parse: parseCaption,
        rootRef: props.rootRef,
        pendingMode: props.pendingMode,
    });

    useFieldValueSync<SingleImageValue>(props.id, setCurrentValue);
    /* eslint-enable solid/reactivity */

    const labelId = () => `field-label-${props.id}`;

    return (
        <div style={{ display: 'contents' }}>
            <div
                classList={{
                    [imageStyles.imageBlock]: true,
                    [imageStyles.imageBlockPending]: !!props.pendingMode,
                }}
            >
                <div
                    class={imageStyles.imageBox}
                    onPointerDown={handleUploadTap}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload image (mock)"
                >
                    <span
                        classList={{
                            [imageStyles.uploadLink]: true,
                            [imageStyles.uploadLinkFlash]: flashing(),
                        }}
                    >
                        Upload Image
                    </span>
                </div>

                <Show
                    when={isEditing()}
                    fallback={
                        <div
                            classList={{
                                [styles.datafieldValue]: true,
                                [imageStyles.caption]: true,
                                [styles.datafieldValueUnderlined]: hasValue(),
                                'no-caret': true,
                            }}
                            onPointerDown={valuePointerDown}
                            onKeyDown={valueKeyDown}
                            tabIndex={0}
                            role="button"
                            aria-labelledby={labelId()}
                            aria-description="Double-tap to edit caption"
                        >
                            {displayValue() || <span class={imageStyles.captionPlaceholder}>Add caption…</span>}
                        </div>
                    }
                >
                    <input
                        ref={setEditInputRef}
                        classList={{
                            [styles.datafieldValue]: true,
                            [imageStyles.captionInput]: true,
                        }}
                        value={editValue()}
                        maxLength={CAPTION_MAX}
                        placeholder="Add caption…"
                        onInput={(e) => inputChange(e.currentTarget.value)}
                        onPointerDown={inputPointerDown}
                        onBlur={inputBlur}
                        onKeyDown={inputKeyDown}
                        aria-labelledby={labelId()}
                        autofocus
                    />
                </Show>
            </div>
        </div>
    );
};
