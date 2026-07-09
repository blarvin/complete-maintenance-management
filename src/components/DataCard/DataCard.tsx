/**
 * DataCard - Animation container for node details.
 *
 * Pure presentation component that handles:
 * - Expand/collapse animation (grid-template-rows + transform)
 * - Visual container styling
 *
 * All field logic is delegated to FieldList (or other children).
 */

import type { JSX } from 'solid-js';
import styles from './DataCard.module.css';

export type DataCardProps = {
    isOpen?: boolean;
    children: JSX.Element;
};

export const DataCard = (props: DataCardProps) => {
    return (
        <div classList={{ [styles.wrapper]: true, [styles.wrapperOpen]: !!props.isOpen }}>
            <div class={styles.inner}>
                <div
                    classList={{ [styles.datacard]: true, [styles.datacardOpen]: !!props.isOpen, 'no-caret': true }}
                    role="region"
                    aria-label="Node details"
                >
                    {props.children}
                    {/* TODO(Phase IV): actions prop for UC-mode buttons (was <Slot name="actions"/>) */}
                </div>
            </div>
        </div>
    );
};
