/**
 * TreeNode - Orchestrator component for tree nodes.
 * Delegates to TreeNodeDisplay (read mode); construction mode returns null
 * until Phase IV re-mounts TreeNodeConstruction.
 *
 * Uses FSM states instead of "modes":
 * - ROOT: Top-level node in ROOT view
 * - PARENT: Current node at top of BRANCH view
 * - CHILD: Child node in BRANCH view
 * - UNDER_CONSTRUCTION: New node being created
 *
 * Props use a discriminated union based on nodeState (ISP compliance).
 */

import { isConstructionProps, type TreeNodeProps } from './types';
import { TreeNodeDisplay } from './TreeNodeDisplay';

// Re-export types for convenience
export type { TreeNodeProps, TreeNodeDisplayProps, TreeNodeConstructionProps } from './types';
export type { TreeNodeState, DisplayNodeState, ConstructionField, CreateNodePayload } from './types';

export const TreeNode = (props: TreeNodeProps) => {
    // Branch tested inside the JSX expression so the props.nodeState read stays tracked.
    return (
        <>
            {isConstructionProps(props) ? (
                null /* TODO(Phase IV): <TreeNodeConstruction> — must not be imported before then */
            ) : (
                <TreeNodeDisplay
                    id={props.id}
                    name={props.name}
                    subtitle={props.subtitle}
                    nodeState={props.nodeState}
                    kind={props.kind}
                    parentId={props.parentId}
                    onNodeClick={props.onNodeClick}
                    onNavigateUp={props.onNavigateUp}
                />
            )}
        </>
    );
};
