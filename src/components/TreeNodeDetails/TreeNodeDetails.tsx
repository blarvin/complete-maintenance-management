/**
 * TreeNodeDetails - Expandable details panel for a TreeNode
 *
 * Slides UP from behind NodeHeader (opposite direction of DataCard).
 * Contains placeholder content for future features like metadata, breadcrumbs, and actions.
 */

import type { JSX } from 'solid-js';
import styles from './TreeNodeDetails.module.css';

export type TreeNodeDetailsProps = {
    nodeId: string;
    isOpen?: boolean;
    children: JSX.Element;
};

export const TreeNodeDetails = (props: TreeNodeDetailsProps) => {
    return (
        <div classList={{ [styles.wrapper]: true, [styles.wrapperOpen]: !!props.isOpen }}>
            <div class={styles.inner}>
                <div classList={{ [styles.details]: true, [styles.detailsOpen]: !!props.isOpen }}>
                    {props.children}
                </div>
            </div>
        </div>
    );
};
