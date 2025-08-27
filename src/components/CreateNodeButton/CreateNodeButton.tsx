import { component$ } from '@builder.io/qwik';

export type CreateNodeButtonProps = {
    variant: 'root';
};

export const CreateNodeButton = component$((props: CreateNodeButtonProps) => {
    if (props.variant === 'root') {
        return <div class="create-node">Create New Asset</div>;
    }
    return null;
});


