import { component$ } from '@builder.io/qwik';
import { RootView } from '../components/views/RootView';
import { BranchView } from '../components/views/BranchView';
import { useAppState, selectors } from '../state/appState';

export default component$(() => {
    const appState = useAppState();
    
    // Derive view from FSM state
    const isRootView = selectors.isRootView(appState);
    const currentNodeId = selectors.getCurrentNodeId(appState);

    return isRootView ? (
        <RootView />
    ) : (
        <BranchView parentId={currentNodeId!} />
    );
});
