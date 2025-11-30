/**
 * TreeNode - Orchestrator component for tree nodes.
 * Delegates to TreeNodeDisplay (read mode) or TreeNodeConstruction (under-construction mode).
 */

import { component$, PropFunction } from '@builder.io/qwik';
import { TreeNodeDisplay } from './TreeNodeDisplay';
import { TreeNodeConstruction } from './TreeNodeConstruction';

export type TreeNodeMode = 'isRoot' | 'isParent' | 'isChild' | 'isUnderConstruction';

export type TreeNodeProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    mode: TreeNodeMode;
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
    // Under-construction mode: delegate to TreeNodeConstruction
    if (props.mode === 'isUnderConstruction') {
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

    // Display mode: delegate to TreeNodeDisplay
    return (
        <TreeNodeDisplay
            id={props.id}
            nodeName={props.nodeName}
            nodeSubtitle={props.nodeSubtitle}
            onNodeClick$={props.onNodeClick$}
        />
    );
});
