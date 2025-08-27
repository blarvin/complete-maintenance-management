import { createContextId, useContext, useContextProvider, useStore } from '@builder.io/qwik';

export type AppStore = {
    currentParentNodeId: string | null;
};

export const AppStoreContext = createContextId<AppStore>('app.store');

export const useProvideAppStore = () => {
    const store = useStore<AppStore>({
        currentParentNodeId: null,
    });
    useContextProvider(AppStoreContext, store);
    return store;
};

export const useAppStore = () => {
    return useContext(AppStoreContext);
};


