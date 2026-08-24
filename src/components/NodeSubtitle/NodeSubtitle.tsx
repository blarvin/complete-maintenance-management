import { Show } from 'solid-js';
import { useInlineRename } from '../../hooks/useInlineRename';
import type { InlineRenameBinding } from '../NodeTitle/NodeTitle';
import styles from '../TreeNode/TreeNode.module.css';

/** `subtitle` is `Element.subtitle`; the component name is a renderer identifier. */
export type NodeSubtitleProps = {
    subtitle: string;
    /** Same binding the title takes — see `NodeTitle`. */
    rename?: InlineRenameBinding;
};

export const NodeSubtitle = (props: NodeSubtitleProps) => {
    const rename = useInlineRename({
        editKey: () => props.rename?.editKey ?? '',
        current: () => props.subtitle,
        enabled: () => !!props.rename,
        commit: (next) => props.rename!.commit(next),
        // Unlike a name, a subtitle is optional by definition, so clearing it is
        // a real edit rather than a slip to be ignored.
        allowEmpty: true,
    });

    return (
        <Show
            when={rename.isEditing()}
            fallback={
                <div
                    class={styles.nodeSubtitle}
                    onPointerDown={rename.displayPointerDown}
                    title={props.rename ? 'Double-tap to edit' : undefined}
                >
                    {props.subtitle}
                </div>
            }
        >
            <input
                ref={rename.setInputRef}
                class={styles.nodeSubtitle}
                type="text"
                enterkeyhint="done"
                value={rename.draft()}
                aria-label="Edit node subtitle"
                onInput={(e) => rename.inputChange(e.currentTarget.value)}
                onBlur={rename.inputBlur}
                onKeyDown={rename.inputKeyDown}
            />
        </Show>
    );
};
