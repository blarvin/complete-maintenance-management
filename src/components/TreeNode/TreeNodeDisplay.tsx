/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 * Shows NodeTitle, NodeSubtitle, expandable DataCard with DataFields.
 */

import { component$, useSignal, $, PropFunction } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { DataCard } from '../DataCard/DataCard';
import { DataField } from '../DataField/DataField';
import { useTreeNodeFields } from './useTreeNodeFields';
import type { DataField as DataFieldRecord } from '../../data/models';
import styles from './TreeNode.module.css';

export type TreeNodeDisplayProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    initialExpanded?: boolean;
    onNodeClick$?: PropFunction<() => void>;
};

export const TreeNodeDisplay = component$((props: TreeNodeDisplayProps) => {
    const isExpanded = useSignal<boolean>(props.initialExpanded ?? false);
    const { fields } = useTreeNodeFields({ nodeId: props.id, enabled: true });

    const toggleExpand$ = $((e?: Event) => {
        e?.stopPropagation();
        isExpanded.value = !isExpanded.value;
    });

    const handleBodyKeyDown$ = $((e: KeyboardEvent) => {
        if (props.onNodeClick$ && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            props.onNodeClick$();
        }
    });

    const handleExpandKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleExpand$();
        }
    });

    const titleId = `node-title-${props.id}`;
    const isClickable = !!props.onNodeClick$;

    return (
        <>
            <article
                class={[styles.node, isExpanded.value && styles.nodeExpanded]}
                aria-labelledby={titleId}
            >
                <div
                    class={[styles.nodeBody, isClickable && styles.nodeBodyClickable]}
                    onClick$={props.onNodeClick$}
                    onKeyDown$={handleBodyKeyDown$}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Open ${props.nodeName || 'node'}` : undefined}
                >
                    <div>
                        <NodeTitle nodeName={props.nodeName} id={titleId} />
                        <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                    </div>
                    <button
                        type="button"
                        class={styles.nodeChevron}
                        onClick$={toggleExpand$}
                        onKeyDown$={handleExpandKeyDown$}
                        aria-expanded={isExpanded.value}
                        aria-label={isExpanded.value ? 'Collapse details' : 'Expand details'}
                    >
                        {isExpanded.value ? '▾' : '◂'}
                    </button>
                </div>
            </article>
            <div class={[styles.nodeExpand, isExpanded.value && styles.nodeExpandOpen]}>
                <div class={styles.nodeExpandClip}>
                    <div class={styles.nodeExpandSlide}>
                        <DataCard>
                            {fields.value?.map((f: DataFieldRecord) => (
                                <DataField
                                    key={f.id}
                                    id={f.id}
                                    fieldName={f.fieldName}
                                    fieldValue={f.fieldValue}
                                />
                            ))}
                        </DataCard>
                    </div>
                </div>
            </div>
        </>
    );
});
