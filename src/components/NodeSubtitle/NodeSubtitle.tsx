import styles from '../TreeNode/TreeNode.module.css';

export const NodeSubtitle = (props: { nodeSubtitle: string }) => {
    return (
        <div class={styles.nodeSubtitle}>{props.nodeSubtitle}</div>
    );
};
