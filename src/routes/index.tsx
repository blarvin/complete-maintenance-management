import { component$, useSignal, $ } from '@builder.io/qwik';
import { RootView } from '../components/views/RootView';
import { BranchView } from '../components/views/BranchView';

export default component$(() => {
    // null means we're at ROOT view, a string means we're viewing that node's branch
    const currentNodeId = useSignal<string | null>(null);

    const handleNavigate$ = $((nodeId: string | null) => {
        console.log('[Navigate]', nodeId === null ? 'ROOT' : nodeId);
        currentNodeId.value = nodeId;
    });

    return currentNodeId.value === null ? (
        <RootView onNavigate$={handleNavigate$} />
    ) : (
        <BranchView
            parentId={currentNodeId.value}
            onNavigate$={handleNavigate$}
        />
    );
});
