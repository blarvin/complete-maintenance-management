/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 *
 * Renders inputs for name/subtitle and uses FieldList (composer-mode) for the
 * field batch. On Save, props.onCreate creates the empty node; the in-flight
 * composer rows (persisted in localStorage by nodeId) are committed by
 * useNodeCreation right after the node exists — no handle into the composer.
 */

import { createSignal, onMount } from 'solid-js';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { FieldList } from '../FieldList/FieldList';
import type { CreateNodePayload } from './types';
import { DEFINITION_IDS } from '../../data/services/seedDefinitions';
import styles from './TreeNode.module.css';

const DEFAULT_DEFINITION_IDS = [
    DEFINITION_IDS.typeOf,
    DEFINITION_IDS.description,
    DEFINITION_IDS.tags,
] as const;

// Re-export for backwards compatibility
export type { ConstructionField } from './types';

export type TreeNodeConstructionProps = {
    id: string;
    initialName?: string;
    initialSubtitle?: string;
    /** When true, this is a child construction (inside branch-children, DataCard extends wider) */
    isChildConstruction?: boolean;
    onCancel: () => void;
    onCreate: (payload: CreateNodePayload) => void;
};

export const TreeNodeConstruction = (props: TreeNodeConstructionProps) => {
    let nameInputEl: HTMLInputElement | undefined;
    let subtitleInputEl: HTMLInputElement | undefined;
    // Reactive mirror of the Name input so the Create button can disable while empty.
    const [nameValue, setNameValue] = createSignal('');

    const handleNameInput = (e: Event) => {
        setNameValue((e.target as HTMLInputElement).value);
    };

    onMount(() => {
        nameInputEl?.focus();
    });

    const handleCreate = () => {
        const name = nameInputEl?.value || '';
        // Guard: Name is required. The button is also disabled, but Enter can reach here.
        if (name.trim() === '') return;
        const subtitle = subtitleInputEl?.value || '';

        props.onCreate({ name, subtitle });
    };

    const handleCancel = () => {
        // The composer draft is discarded by useNodeCreation.cancel (localStorage).
        props.onCancel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    const titleId = () => `node-title-${props.id}`;
    const indentVar = () => props.isChildConstruction ? '18px' : '50px';

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar() }}>
            <NodeHeader
                id={props.id}
                titleId={titleId()}
                isExpanded={true}
                isParent={false}
                isClickable={false}
                name={props.initialName || ''}
                subtitle={props.initialSubtitle || ''}
                isConstruction={true}
                nameInputRef={(el) => { nameInputEl = el; }}
                subtitleInputRef={(el) => { subtitleInputEl = el; }}
                onKeyDown={handleKeyDown}
                onNameInput={handleNameInput}
                chevronDisabled={true}
            />
            <DataCard
                isOpen={true}
                actions={
                    <div class={styles.constructionActions}>
                        <button type="button" onClick={handleCancel}>Cancel</button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={!nameValue().trim()}
                        >
                            Create
                        </button>
                    </div>
                }
            >
                <FieldList
                    nodeId={props.id}
                    isConstruction={true}
                    initialDefinitionIds={DEFAULT_DEFINITION_IDS}
                />
            </DataCard>
        </div>
    );
};
