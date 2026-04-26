/**
 * SingleImageField - Phase 1 stub for single-image DataFields.
 *
 * Real blob storage, file picker, preview modal, and Firestore blob sync are
 * deferred (LATER.md §DataField Component Library → Real single-image).
 * This placeholder exists so the Template/Instance pair exists in the library
 * and users can see the shape; value is always null in Phase 1.
 */

import { component$, type QRL } from '@builder.io/qwik';
import styles from './DataField.module.css';
import imageStyles from './SingleImageField.module.css';

export type SingleImageFieldProps = {
    id: string;
    fieldName: string;
    /** Accepted for composer parity; the Phase 1 stub never produces a value. */
    pendingMode?: { onChange$: QRL<(value: null) => void> };
};

export const SingleImageField = component$<SingleImageFieldProps>((_props) => {
    return (
        <div class={[styles.datafieldValue, imageStyles.placeholder, 'no-caret']}>
            Image upload coming soon
        </div>
    );
});
