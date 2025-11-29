import { component$, PropFunction } from '@builder.io/qwik';

export type UpButtonProps = {
    parentId: string | null;
    onNavigate$: PropFunction<(parentId: string | null) => void>;
};

export const UpButton = component$((props: UpButtonProps) => {
    return (
        <button
            class="up-button"
            onClick$={() => props.onNavigate$(props.parentId)}
            title={props.parentId ? 'Go to parent' : 'Go to root'}
            aria-label={props.parentId ? 'Go to parent' : 'Go to root'}
        >
            ↑
        </button>
    );
});

