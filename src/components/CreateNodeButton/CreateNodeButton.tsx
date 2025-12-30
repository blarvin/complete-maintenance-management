import { component$, $, PropFunction } from '@builder.io/qwik';
import styles from './CreateNodeButton.module.css';

export type CreateNodeButtonProps = {
    variant: 'root' | 'child';
    onClick$?: PropFunction<() => void>;
};

export const CreateNodeButton = component$((props: CreateNodeButtonProps) => {
    const handleClick$ = $(async () => {
        if (props.onClick$) await props.onClick$();
    });

    if (props.variant === 'root') {
        return (
            <button
                type="button"
                class={[styles.createNode, 'no-caret']}
                onClick$={handleClick$}
                aria-label="Create New Asset"
            >
                Create New Asset
            </button>
        );
    }

    if (props.variant === 'child') {
        return (
            <button
                type="button"
                class={[styles.createNode, styles.createNodeChild, 'no-caret']}
                onClick$={handleClick$}
                aria-label="Add Sub-Asset"
            >
                + Add Sub-Asset
            </button>
        );
    }

    return null;
});


