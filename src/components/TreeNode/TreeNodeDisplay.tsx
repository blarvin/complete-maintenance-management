/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 * Shows NodeTitle, NodeSubtitle, expandable DataCard with DataFields.
 * Manages pending field forms with localStorage persistence.
 */

import { component$, $, PropFunction, useSignal, useVisibleTask$, useTask$ } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { DataCard } from '../DataCard/DataCard';
import { DataField } from '../DataField/DataField';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { UpButton } from '../UpButton/UpButton';
import { useTreeNodeFields } from './useTreeNodeFields';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { getFieldService } from '../../data/services';
import { generateId } from '../../utils/id';
import type { DataField as DataFieldRecord } from '../../data/models';
import type { DisplayNodeState } from './types';
import styles from './TreeNode.module.css';

/** Pending form state for localStorage */
type PendingForm = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
};

/** LS key for pending forms */
const getPendingFormsKey = (nodeId: string) => `pendingFields:${nodeId}`;

/** Load pending forms from localStorage */
const loadPendingForms = (nodeId: string): PendingForm[] => {
    try {
        const stored = localStorage.getItem(getPendingFormsKey(nodeId));
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

/** Save pending forms to localStorage */
const savePendingForms = (nodeId: string, forms: PendingForm[]) => {
    try {
        if (forms.length === 0) {
            localStorage.removeItem(getPendingFormsKey(nodeId));
        } else {
            localStorage.setItem(getPendingFormsKey(nodeId), JSON.stringify(forms));
        }
    } catch {
        // Ignore storage errors
    }
};

export type TreeNodeDisplayProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    nodeState: DisplayNodeState;
    parentId?: string | null;
    onNodeClick$?: PropFunction<() => void>;
    onNavigateUp$?: PropFunction<(parentId: string | null) => void>;
};

export const TreeNodeDisplay = component$((props: TreeNodeDisplayProps) => {
    const appState = useAppState();
    const { toggleCardExpanded$ } = useAppTransitions();
    
    // Get card state from FSM (persisted)
    const cardState = selectors.getDataCardState(appState, props.id);
    const isExpanded = cardState === 'EXPANDED';
    
    // Persisted fields from DB
    const { fields, reload$ } = useTreeNodeFields({ nodeId: props.id, enabled: true });

    // Pending forms (forms being added, not yet saved)
    const pendingForms = useSignal<PendingForm[]>([]);

    // Load pending forms from LS on mount
    useVisibleTask$(() => {
        pendingForms.value = loadPendingForms(props.id);
    });

    // Save pending forms to LS when they change
    useTask$(({ track }) => {
        const forms = track(() => pendingForms.value);
        // Only save to LS on client side
        if (typeof localStorage !== 'undefined') {
            savePendingForms(props.id, forms);
        }
    });

    const toggleExpand$ = $((e?: Event) => {
        e?.stopPropagation();
        toggleCardExpanded$(props.id);
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

    const handleFieldDeleted$ = $(() => {
        reload$();
    });

    // Add a new pending form
    const handleAddField$ = $(() => {
        const newForm: PendingForm = {
            id: generateId(),
            fieldName: '',
            fieldValue: null,
        };
        pendingForms.value = [...pendingForms.value, newForm];
    });

    // Save a pending form (persist to DB)
    const handleFormSave$ = $(async (formId: string, fieldName: string, fieldValue: string | null) => {
        const name = fieldName.trim();
        if (!name) {
            // Empty name - just cancel the form
            pendingForms.value = pendingForms.value.filter(f => f.id !== formId);
            return;
        }
        // Persist to DB
        await getFieldService().addField(props.id, name, fieldValue);
        // Remove from pending
        pendingForms.value = pendingForms.value.filter(f => f.id !== formId);
        // Refresh persisted fields
        reload$();
    });

    // Cancel a pending form
    const handleFormCancel$ = $((formId: string) => {
        pendingForms.value = pendingForms.value.filter(f => f.id !== formId);
    });

    // Update pending form values (for LS tracking)
    const handleFormChange$ = $((formId: string, fieldName: string, fieldValue: string | null) => {
        pendingForms.value = pendingForms.value.map(f =>
            f.id === formId ? { ...f, fieldName, fieldValue } : f
        );
    });

    const titleId = `node-title-${props.id}`;
    const isClickable = !!props.onNodeClick$;
    const isParent = props.nodeState === 'PARENT';
    const isChild = props.nodeState === 'CHILD';
    const indentVar = isChild ? '18px' : '50px';

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar }}>
            <article
                class={[styles.node, isExpanded && styles.nodeExpanded, isParent && styles.nodeParent]}
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
                    {isParent && props.onNavigateUp$ && (
                        <div class={styles.upButtonWrapper}>
                            <UpButton
                                parentId={props.parentId ?? null}
                                onNavigate$={props.onNavigateUp$}
                            />
                        </div>
                    )}
                    <div>
                        <NodeTitle nodeName={props.nodeName} id={titleId} />
                        <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                    </div>
                    <button
                        type="button"
                        class={styles.nodeChevron}
                        onClick$={toggleExpand$}
                        onKeyDown$={handleExpandKeyDown$}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                        {isExpanded ? '▾' : '◂'}
                    </button>
                </div>
            </article>
            <DataCard 
                isOpen={isExpanded} 
                nodeId={props.id} 
                pendingCount={pendingForms.value.length}
                onAddField$={handleAddField$}
            >
                {/* Persisted fields from DB */}
                {fields.value?.map((f: DataFieldRecord) => (
                    <DataField
                        key={f.id}
                        id={f.id}
                        fieldName={f.fieldName}
                        fieldValue={f.fieldValue}
                        onDeleted$={handleFieldDeleted$}
                    />
                ))}
                {/* Pending forms being added */}
                {pendingForms.value.map((form) => (
                    <CreateDataField
                        key={form.id}
                        id={form.id}
                        initialName={form.fieldName}
                        initialValue={form.fieldValue}
                        onSave$={handleFormSave$}
                        onCancel$={handleFormCancel$}
                        onChange$={handleFormChange$}
                    />
                ))}
            </DataCard>
        </div>
    );
});
