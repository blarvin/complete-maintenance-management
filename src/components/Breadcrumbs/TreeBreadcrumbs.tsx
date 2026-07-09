import { createMemo, For, Show } from 'solid-js';
import { useAncestorPath } from '../../hooks/useAncestorPath';
import { useAppTransitions } from '../../state/appState';
import styles from './TreeBreadcrumbs.module.css';

type TreeBreadcrumbsProps = {
    nodeId: string;
};

export const TreeBreadcrumbs = (props: TreeBreadcrumbsProps) => {
    const { navigateToNode } = useAppTransitions();
    // Same staleness semantics as Qwik: nodeIndex mutations don't re-render —
    // only nodeId changes do.
    const path = createMemo(() => useAncestorPath(props.nodeId));

    return (
        <Show when={path().length > 0}>
            <nav class={styles.breadcrumbs} aria-label="Breadcrumb">
                <For each={path()}>
                    {(segment, index) => {
                        const isCurrent = () => index() === path().length - 1;
                        const label = () => segment.name || 'Untitled';
                        return (
                            <span class={styles.segment}>
                                <Show
                                    when={!isCurrent()}
                                    fallback={<span classList={{ [styles.label]: true, [styles.current]: true }}>{label()}</span>}
                                >
                                    <button
                                        type="button"
                                        classList={{ [styles.label]: true, [styles.ancestor]: true }}
                                        onClick={() => navigateToNode(segment.id)}
                                    >
                                        {label()}
                                    </button>
                                    <span class={styles.separator}>/</span>
                                </Show>
                            </span>
                        );
                    }}
                </For>
            </nav>
        </Show>
    );
};
