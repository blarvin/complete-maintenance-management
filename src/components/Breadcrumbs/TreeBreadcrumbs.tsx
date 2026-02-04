import { component$, $ } from '@builder.io/qwik';
import { useAncestorPath } from '../../hooks/useAncestorPath';
import { useAppTransitions } from '../../state/appState';
import styles from './TreeBreadcrumbs.module.css';

type TreeBreadcrumbsProps = {
    nodeId: string;
};

export const TreeBreadcrumbs = component$((props: TreeBreadcrumbsProps) => {
    const { navigateToNode$ } = useAppTransitions();
    const path = useAncestorPath(props.nodeId);

    if (!path.length) {
        return null;
    }

    return (
        <nav class={styles.breadcrumbs} aria-label="Breadcrumb">
            {path.map((segment, index) => {
                const isCurrent = index === path.length - 1;
                const label = segment.name || 'Untitled';

                return (
                    <span key={segment.id} class={styles.segment}>
                        {isCurrent ? (
                            <span class={[styles.label, styles.current]}>{label}</span>
                        ) : (
                            <button
                                type="button"
                                class={[styles.label, styles.ancestor]}
                                onClick$={$(() => navigateToNode$(segment.id))}
                            >
                                {label}
                            </button>
                        )}
                        {!isCurrent && <span class={styles.separator}>/</span>}
                    </span>
                );
            })}
        </nav>
    );
});
