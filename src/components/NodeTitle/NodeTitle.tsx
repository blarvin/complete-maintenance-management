import { component$ } from '@builder.io/qwik';
import styles from '../TreeNode/TreeNode.module.css';

export type NodeTitleProps = {
    nodeName: string;
    id?: string;
};

export const NodeTitle = component$<NodeTitleProps>((props) => {
    return (
        <h2 class={styles.nodeTitle} id={props.id}>{props.nodeName}</h2>
    );
});


