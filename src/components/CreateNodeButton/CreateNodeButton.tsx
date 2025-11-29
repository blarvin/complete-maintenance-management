import { component$, $, PropFunction } from '@builder.io/qwik';

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
            <div
                class="create-node"
                onClick$={handleClick$}
                title="Create New Asset"
                aria-label="Create New Asset"
            >
                Create New Asset
            </div>
        );
    }

    if (props.variant === 'child') {
        return (
            <div
                class="create-node create-node--child"
                onClick$={handleClick$}
                title="Create New Sub-Asset"
                aria-label="Create New Sub-Asset"
            >
                + Add Sub-Asset
            </div>
        );
    }

    return null;
});


