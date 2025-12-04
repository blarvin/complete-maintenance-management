/**
 * TreeNode - Orchestrator component for tree nodes.
 * Delegates to TreeNodeDisplay (read mode) or TreeNodeConstruction (under-construction mode).
 * 
 * Uses FSM states instead of "modes":
 * - ROOT: Top-level node in ROOT view
 * - PARENT: Current node at top of BRANCH view
 * - CHILD: Child node in BRANCH view
 * - UNDER_CONSTRUCTION: New node being created
 * 
 * Props use a discriminated union based on nodeState (ISP compliance).
 */

import { component$ } from '@builder.io/qwik';
import { TreeNodeDisplay } from './TreeNodeDisplay';
import { TreeNodeConstruction } from './TreeNodeConstruction';
import { isConstructionProps, type TreeNodeProps } from './types';

// Re-export types for convenience
export type { TreeNodeProps, TreeNodeDisplayProps, TreeNodeConstructionProps } from './types';
export type { TreeNodeState, DisplayNodeState, ConstructionField, CreateNodePayload } from './types';

export const TreeNode = component$((props: TreeNodeProps) => {
    // Use type guard to narrow the discriminated union
    if (isConstructionProps(props)) {
        return (
            <TreeNodeConstruction
                id={props.id}
                initialName={props.nodeName}
                initialSubtitle={props.nodeSubtitle}
                defaultFields={props.ucDefaults}
                onCancel$={props.onCancel$}
                onCreate$={props.onCreate$}
            />
        );
    }

    // TypeScript now knows props is TreeNodeDisplayProps
    return (
        <TreeNodeDisplay
            id={props.id}
            nodeName={props.nodeName}
            nodeSubtitle={props.nodeSubtitle}
            nodeState={props.nodeState}
            parentId={props.parentId}
            onNodeClick$={props.onNodeClick$}
            onNavigateUp$={props.onNavigateUp$}
        />
    );
});
