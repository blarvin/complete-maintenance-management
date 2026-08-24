/**
 * TreeNode Type Definitions
 *
 * Separated prop interfaces following Interface Segregation Principle (ISP).
 * Display mode and Construction mode have distinct requirements - components
 * only receive the props they actually need.
 *
 * Uses discriminated union on `nodeState` for type safety.
 */

import type { Kind } from '../../data/models';

/**
 * Display states for TreeNode (read-only modes)
 */
export type DisplayNodeState = 'ROOT' | 'PARENT' | 'CHILD';

/**
 * All TreeNode states including construction
 */
export type TreeNodeState = DisplayNodeState | 'UNDER_CONSTRUCTION';

/**
 * Field data for construction mode — references a Definition to instantiate.
 */
export type ConstructionField = {
    definitionId: string;
};

/**
 * Payload emitted when node creation completes.
 * The composer draft is committed separately (useNodeCreation reads localStorage
 * by nodeId after the node exists), so no field/callback data rides this payload.
 */
export type CreateNodePayload = {
    name: string;
    subtitle: string;
};

/**
 * Base props shared by all TreeNode modes
 */
type TreeNodeBaseProps = {
    id: string;
    name: string;
    subtitle: string;
};

/**
 * Props for display modes (ROOT, PARENT, CHILD)
 * - Used for existing, persisted nodes
 * - Optional navigation callbacks depending on state
 */
export type TreeNodeDisplayProps = TreeNodeBaseProps & {
    nodeState: DisplayNodeState;
    /** The element's kind — drives the manifest-aware shell (DataCard/chevron, #5). */
    kind: Kind;
    parentId?: string | null;
    onNodeClick?: () => void;
    onNavigateUp?: (parentId: string | null) => void;
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
    onCancel: () => void;
    onCreate: (payload: CreateNodePayload) => void | Promise<void>;
};

/**
 * Discriminated union of TreeNode props
 *
 * TypeScript will narrow the type based on `nodeState`:
 * - If nodeState is 'UNDER_CONSTRUCTION' → onCancel, onCreate are available
 * - If nodeState is 'ROOT'|'PARENT'|'CHILD' → parentId, onNodeClick, onNavigateUp are available
 */
export type TreeNodeProps = TreeNodeDisplayProps | TreeNodeConstructionProps;

/**
 * Type guard: Check if props are for construction mode
 */
export function isConstructionProps(p: TreeNodeProps): p is TreeNodeConstructionProps {
    return p.nodeState === 'UNDER_CONSTRUCTION';
}

/**
 * Type guard: Check if props are for display mode
 */
export function isDisplayProps(p: TreeNodeProps): p is TreeNodeDisplayProps {
    return p.nodeState !== 'UNDER_CONSTRUCTION';
}
