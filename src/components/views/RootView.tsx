// src/components/views/RootView.tsx
import { component$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';

export const RootView = component$(() => {
    const sampleNodes = [
        { id: '1', nodeName: 'Asset Name A', nodeSubtitle: 'Subtitle / Location / Short description' },
        { id: '2', nodeName: 'Asset Name B', nodeSubtitle: 'Subtitle / Location / Short description' },
        { id: '3', nodeName: 'Asset Name C', nodeSubtitle: 'Subtitle / Location / Short description' },
        { id: '4', nodeName: 'Asset Name D', nodeSubtitle: 'Subtitle / Location / Short description' },
        { id: '5', nodeName: 'Asset Name E', nodeSubtitle: 'Subtitle / Location / Short description' },
    ];

    return (
        <main class="view-root">
            {sampleNodes.map((n) => (
                <TreeNode key={n.id} id={n.id} nodeName={n.nodeName} nodeSubtitle={n.nodeSubtitle} mode="isRoot" />
            ))}
            <CreateNodeButton variant="root" />
        </main>
    );
});


