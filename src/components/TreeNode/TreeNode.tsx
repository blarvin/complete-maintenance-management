/**
 * TreeNode - Orchestrator component for tree nodes.
 * Delegates to TreeNodeDisplay (read mode) or TreeNodeConstruction (under-construction mode).
 * 
 * Uses FSM states instead of "modes":
 * - ROOT: Top-level node in ROOT view
 * - PARENT: Current node at top of BRANCH view
 * - CHILD: Child node in BRANCH view
 * - UNDER_CONSTRUCTION: New node being created
 */

import { component$, PropFunction } from '@builder.io/qwik';
import { TreeNodeDisplay } from './TreeNodeDisplay';
import { TreeNodeConstruction } from './TreeNodeConstruction';
import type { TreeNodeState } from '../../state/appState';

export type TreeNodeProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    nodeState: TreeNodeState;
    ucDefaults?: { fieldName: string; fieldValue: string | null }[];
    onCancel$?: PropFunction<() => void>;
    onCreate$?: PropFunction<(payload: {
        nodeName: string;
        nodeSubtitle: string;
        fields: { fieldName: string; fieldValue: string | null }[];
    }) => void>;
    onNodeClick$?: PropFunction<() => void>;
};

export const TreeNode = component$((props: TreeNodeProps) => {
    // Under-construction state: delegate to TreeNodeConstruction
    if (props.nodeState === 'UNDER_CONSTRUCTION') {
        return (
            <TreeNodeConstruction
                id={props.id}
                initialName={props.nodeName}
                initialSubtitle={props.nodeSubtitle}
                defaultFields={props.ucDefaults ?? []}
                onCancel$={props.onCancel$}
                onCreate$={props.onCreate$}
            />
        );
    }

    // Display states (ROOT, PARENT, CHILD): delegate to TreeNodeDisplay
    return (
        <TreeNodeDisplay
            id={props.id}
            nodeName={props.nodeName}
            nodeSubtitle={props.nodeSubtitle}
            nodeState={props.nodeState}
            onNodeClick$={props.onNodeClick$}
        />
    );
});
