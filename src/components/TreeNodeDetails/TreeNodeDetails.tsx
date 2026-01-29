/**
 * TreeNodeDetails - Expandable details panel for a TreeNode
 *
 * Slides UP from behind NodeHeader (opposite direction of DataCard).
 * Contains placeholder content for future features like metadata, breadcrumbs, and actions.
 */

import { component$, Slot } from '@builder.io/qwik';
import styles from './TreeNodeDetails.module.css';

export type TreeNodeDetailsProps = {
    nodeId: string;
    isOpen?: boolean;
};

export const TreeNodeDetails = component$((props: TreeNodeDetailsProps) => {
    return (
        <div class={[styles.wrapper, props.isOpen && styles.wrapperOpen]}>
            <div class={styles.inner}>
                <div class={[styles.details, props.isOpen && styles.detailsOpen]}>
                    <Slot />
                </div>
            </div>
        </div>
    );
});
