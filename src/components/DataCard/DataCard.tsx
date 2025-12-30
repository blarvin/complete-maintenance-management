/**
 * DataCard - Animation container for node details.
 * 
 * Pure presentation component that handles:
 * - Expand/collapse animation (grid-template-rows + transform)
 * - Visual container styling
 * 
 * All field logic is delegated to FieldList (or other children).
 * Uses Slot for content and optional "actions" slot for UC mode buttons.
 */

import { Slot, component$ } from '@builder.io/qwik';
import styles from './DataCard.module.css';

export type DataCardProps = {
    nodeId: string;
    isOpen?: boolean;
};

export const DataCard = component$<DataCardProps>((props) => {
    return (
        <div class={[styles.wrapper, props.isOpen && styles.wrapperOpen]}>
            <div class={styles.inner}>
                <div
                    class={[styles.datacard, props.isOpen && styles.datacardOpen, 'no-caret']}
                    role="region"
                    aria-label="Node details"
                >
                    <Slot />
                    <Slot name="actions" />
                </div>
            </div>
        </div>
    );
});
