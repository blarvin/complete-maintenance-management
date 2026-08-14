import styles from '../TreeNode/TreeNode.module.css';

export type NodeTitleProps = {
    /** `Element.name` — the component name stays node-ish (a renderer identifier,
     *  SPEC §Data Model), but the prop speaks the element vocabulary it is given. */
    name: string;
    id?: string;
};

export const NodeTitle = (props: NodeTitleProps) => {
    return (
        <h2 class={styles.nodeTitle} id={props.id}>{props.name}</h2>
    );
};
