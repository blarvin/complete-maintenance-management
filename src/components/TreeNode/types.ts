/**
 * TreeNode Type Definitions
 * 
 * Separated prop interfaces following Interface Segregation Principle (ISP).
 * Display mode and Construction mode have distinct requirements - components
 * only receive the props they actually need.
 * 
 * Uses discriminated union on `nodeState` for type safety.
 */

import type { PropFunction } from '@builder.io/qwik';

/**
 * Display states for TreeNode (read-only modes)
 */
export type DisplayNodeState = 'ROOT' | 'PARENT' | 'CHILD';

/**
 * All TreeNode states including construction
 */
export type TreeNodeState = DisplayNodeState | 'UNDER_CONSTRUCTION';

/**
 * Field data for construction mode
 */
export type ConstructionField = {
    fieldName: string;
    fieldValue: string | null;
};

/**
 * Payload emitted when node creation completes
 */
export type CreateNodePayload = {
    nodeName: string;
    nodeSubtitle: string;
    fields: ConstructionField[];
};

/**
 * Base props shared by all TreeNode modes
 */
type TreeNodeBaseProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
};

/**
 * Props for display modes (ROOT, PARENT, CHILD)
 * - Used for existing, persisted nodes
 * - Optional navigation callbacks depending on state
 */
export type TreeNodeDisplayProps = TreeNodeBaseProps & {
    nodeState: DisplayNodeState;
    parentId?: string | null;
    onNodeClick$?: PropFunction<() => void>;
    onNavigateUp$?: PropFunction<(parentId: string | null) => void>;
};

/**
 * Props for construction mode (UNDER_CONSTRUCTION)
 * - Used for new nodes being created
 * - Defaults are handled internally by TreeNodeConstruction
 */
export type TreeNodeConstructionProps = TreeNodeBaseProps & {
    nodeState: 'UNDER_CONSTRUCTION';
    /** When true, this is a child construction (inside branch-children) */
    isChildConstruction?: boolean;
    onCancel$: PropFunction<() => void>;
    onCreate$: PropFunction<(payload: CreateNodePayload) => void>;
};

/**
 * Discriminated union of TreeNode props
 * 
 * TypeScript will narrow the type based on `nodeState`:
 * - If nodeState is 'UNDER_CONSTRUCTION' → onCancel$, onCreate$ are available
 * - If nodeState is 'ROOT'|'PARENT'|'CHILD' → parentId, onNodeClick$, onNavigateUp$ are available
 */
export type TreeNodeProps = TreeNodeDisplayProps | TreeNodeConstructionProps;

/**
 * Type guard: Check if props are for construction mode
 */
export function isConstructionProps(props: TreeNodeProps): props is TreeNodeConstructionProps {
    return props.nodeState === 'UNDER_CONSTRUCTION';
}

/**
 * Type guard: Check if props are for display mode
 */
export function isDisplayProps(props: TreeNodeProps): props is TreeNodeDisplayProps {
    return props.nodeState !== 'UNDER_CONSTRUCTION';
}
