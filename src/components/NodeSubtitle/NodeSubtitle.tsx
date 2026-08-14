import styles from '../TreeNode/TreeNode.module.css';

/** `subtitle` is `Element.subtitle`; the component name is a renderer identifier. */
export const NodeSubtitle = (props: { subtitle: string }) => {
    return (
        <div class={styles.nodeSubtitle}>{props.subtitle}</div>
    );
};
