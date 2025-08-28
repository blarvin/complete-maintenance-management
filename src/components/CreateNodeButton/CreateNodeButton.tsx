import { component$, $, PropFunction } from '@builder.io/qwik';

export type CreateNodeButtonProps = {
    variant: 'root';
    onClick$?: PropFunction<() => void>;
};

export const CreateNodeButton = component$((props: CreateNodeButtonProps) => {
    const handleClick$ = $(async () => {
        if (props.onClick$) await props.onClick$();
    });
    if (props.variant === 'root') {
        return (
            <div class="create-node" onClick$={handleClick$}>
                Create New Asset
            </div>
        );
    }
    return null;
});


