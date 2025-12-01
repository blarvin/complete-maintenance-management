import { component$ } from '@builder.io/qwik';
import styles from '../TreeNode/TreeNode.module.css';

export const NodeSubtitle = component$((props: { nodeSubtitle: string }) => {
    return (
        <div class={styles.nodeSubtitle}>{props.nodeSubtitle}</div>
    );
});


