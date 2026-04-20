/**
 * SnackbarHost - renders the single global snackbar toast.
 *
 * Owns the reactive store (via useStore) and registers it with the module-level
 * snackbar service on mount. Service `show/dismiss` calls mutate the store,
 * which re-renders this host.
 */

import { component$, useStore, useVisibleTask$, $, useOnWindow } from '@builder.io/qwik';
import {
    registerSnackbarStore,
    getSnackbarService,
    invokeActionAndDismiss,
} from '../../services/snackbar';
import type { SnackbarStore } from '../../services/snackbar';
import styles from './SnackbarHost.module.css';

export const SnackbarHost = component$(() => {
    const store = useStore<SnackbarStore>({ current: null });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
        registerSnackbarStore(store);
    });

    useOnWindow(
        'keydown',
        $((ev) => {
            const e = ev as KeyboardEvent;
            if (e.key === 'Escape' && store.current) {
                getSnackbarService().dismiss();
            }
        }),
    );

    const onActionClick$ = $(async () => {
        await invokeActionAndDismiss();
    });

    const onPointerEnter$ = $(() => {
        getSnackbarService().pauseTimer();
    });

    const onPointerLeave$ = $(() => {
        getSnackbarService().resumeTimer();
    });

    const onFocusIn$ = $(() => {
        getSnackbarService().pauseTimer();
    });

    const onFocusOut$ = $(() => {
        getSnackbarService().resumeTimer();
    });

    const toast = store.current;
    if (!toast) return null;

    const isError = toast.variant === 'error';
    const hostClass = [styles.host, isError && styles.error].filter(Boolean).join(' ');

    return (
        <div
            key={toast.id}
            class={hostClass}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            aria-atomic="true"
            onPointerEnter$={onPointerEnter$}
            onPointerLeave$={onPointerLeave$}
            onFocusIn$={onFocusIn$}
            onFocusOut$={onFocusOut$}
        >
            <span class={styles.message}>{toast.message}</span>
            {toast.action && (
                <button
                    type="button"
                    class={styles.action}
                    onClick$={onActionClick$}
                >
                    {toast.action.label}
                </button>
            )}
        </div>
    );
});
