/**
 * SnackbarHost - renders the single global snackbar toast.
 *
 * Owns the reactive state (a signal) and registers a signal-backed accessor
 * object with the module-level snackbar service on mount — the service's plain
 * `registeredStore.current = active` assignments stay reactive with zero
 * service changes. `<Show keyed>` remounts the toast element per fresh toast
 * object (the service builds a new one per `show()`), reproducing the old
 * `key={toast.id}` semantics.
 */

import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import {
    registerSnackbarStore,
    getSnackbarService,
    invokeActionAndDismiss,
} from '../../services/snackbar';
import type { ActiveToast } from '../../services/snackbar';
import styles from './SnackbarHost.module.css';

export const SnackbarHost = () => {
    const [current, setCurrent] = createSignal<ActiveToast | null>(null);

    onMount(() => {
        registerSnackbarStore({
            get current() {
                return current();
            },
            set current(v: ActiveToast | null) {
                setCurrent(v);
            },
        });

        const onKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && current()) {
                getSnackbarService().dismiss();
            }
        };
        window.addEventListener('keydown', onKeydown);
        onCleanup(() => window.removeEventListener('keydown', onKeydown));
    });

    return (
        <Show when={current()} keyed>
            {(toast) => {
                const isError = toast.variant === 'error';
                const hostClass = [styles.host, isError && styles.error].filter(Boolean).join(' ');
                return (
                    <div
                        class={hostClass}
                        role={isError ? 'alert' : 'status'}
                        aria-live={isError ? 'assertive' : 'polite'}
                        aria-atomic="true"
                        onPointerEnter={() => getSnackbarService().pauseTimer()}
                        onPointerLeave={() => getSnackbarService().resumeTimer()}
                        onFocusIn={() => getSnackbarService().pauseTimer()}
                        onFocusOut={() => getSnackbarService().resumeTimer()}
                    >
                        <span class={styles.message}>{toast.message}</span>
                        {toast.action && (
                            <button
                                type="button"
                                class={styles.action}
                                onClick={() => void invokeActionAndDismiss()}
                            >
                                {toast.action.label}
                            </button>
                        )}
                    </div>
                );
            }}
        </Show>
    );
};
