import { Show } from 'solid-js';
import { useInlineRename } from '../../hooks/useInlineRename';
import styles from '../TreeNode/TreeNode.module.css';

/**
 * A rename binding. Given one, the title is double-tap editable in place; left
 * off, it is plain text — which is how every read-only surface (the Library
 * lenses) and every card whose tap already means *navigate* gets it. See
 * `NodeHeader` for where that line is drawn.
 */
export type InlineRenameBinding = {
    /** The FSM edit slot. `${elementId}::name` — a node has two editors. */
    editKey: string;
    commit: (next: string) => Promise<void>;
};

export type NodeTitleProps = {
    /** `Element.name` — the component name stays node-ish (a renderer identifier,
     *  SPEC §Data Model), but the prop speaks the element vocabulary it is given. */
    name: string;
    id?: string;
    rename?: InlineRenameBinding;
};

export const NodeTitle = (props: NodeTitleProps) => {
    const rename = useInlineRename({
        editKey: () => props.rename?.editKey ?? '',
        current: () => props.name,
        enabled: () => !!props.rename,
        commit: (next) => props.rename!.commit(next),
    });

    return (
        <Show
            when={rename.isEditing()}
            fallback={
                <h2
                    class={styles.nodeTitle}
                    id={props.id}
                    onPointerDown={rename.displayPointerDown}
                    title={props.rename ? 'Double-tap to rename' : undefined}
                >
                    {props.name}
                </h2>
            }
        >
            <input
                ref={rename.setInputRef}
                class={styles.nodeTitle}
                id={props.id}
                type="text"
                enterkeyhint="done"
                value={rename.draft()}
                aria-label="Rename node"
                onInput={(e) => rename.inputChange(e.currentTarget.value)}
                onBlur={rename.inputBlur}
                onKeyDown={rename.inputKeyDown}
            />
        </Show>
    );
};
