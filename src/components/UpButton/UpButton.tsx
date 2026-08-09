import styles from './UpButton.module.css';

export type UpButtonProps = {
    parentId: string | null;
    onNavigate: (parentId: string | null) => void;
};

export const UpButton = (props: UpButtonProps) => {
    return (
        <button
            class={styles.upButton}
            onClick={(e) => {
                e.stopPropagation(); // Prevent node click
                props.onNavigate(props.parentId);
            }}
            title={props.parentId ? 'Go to parent' : 'Go to root'}
            aria-label={props.parentId ? 'Go to parent' : 'Go to root'}
        >
            ↑
        </button>
    );
};
