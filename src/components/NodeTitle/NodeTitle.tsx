import styles from '../TreeNode/TreeNode.module.css';

export type NodeTitleProps = {
    nodeName: string;
    id?: string;
};

export const NodeTitle = (props: NodeTitleProps) => {
    return (
        <h2 class={styles.nodeTitle} id={props.id}>{props.nodeName}</h2>
    );
};
