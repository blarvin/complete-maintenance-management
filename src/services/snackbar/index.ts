import type { SnackbarService, SnackbarStore, ToastInput, ActiveToast } from './types';
import { DEFAULT_DURATIONS } from './types';

export type { SnackbarService, SnackbarStore, ToastInput, SnackbarVariant, ActiveToast, ToastAction } from './types';
export { PERSISTENT_DURATION } from './types';

let registeredStore: SnackbarStore | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
let pausedAt: number | null = null;
let remainingMs: number | null = null;
let sequence = 0;

function clearTimer(): void {
    if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
    }
    pausedAt = null;
    remainingMs = null;
}

/**
 * Run a toast's deferred tail. Called wherever the undo window **closes without
 * Undo having been pressed** — timeout, replacement, or dismissal — which is the
 * whole meaning of `onExpire` (SPEC → Snackbar & Undo). The one path that must
 * not call it is `invokeActionAndDismiss`: there the user *did* take the Undo,
 * so the tail is work that should never have happened.
 *
 * Fire-and-forget by design: the tail is an audit write, and a caller closing a
 * toast must not wait on storage.
 */
function releaseTail(toast: ActiveToast | null | undefined): void {
    if (toast?.onExpire) {
        void toast.onExpire();
    }
}

function scheduleExpiry(durationMs: number): void {
    clearTimer();
    remainingMs = durationMs;
    timerId = setTimeout(() => {
        const toast = registeredStore?.current;
        if (!toast) return;
        registeredStore!.current = null;
        clearTimer();
        releaseTail(toast);
    }, durationMs);
}

export function registerSnackbarStore(store: SnackbarStore): void {
    registeredStore = store;
}

/**
 * Teardown, not a dismissal: the tail is deliberately *not* released. This tears
 * the service down rather than closing a window the user was looking at, and its
 * callers are test `afterEach` hooks.
 */
export function resetSnackbarService(): void {
    clearTimer();
    if (registeredStore) registeredStore.current = null;
    registeredStore = null;
    sequence = 0;
    activeService = null;
}

const realService: SnackbarService = {
    show(toast: ToastInput): void {
        if (!registeredStore) {
            console.warn('[Snackbar] show() called before store registered; dropping toast:', toast.message);
            return;
        }
        const variant = toast.variant ?? 'success';
        const duration = toast.durationMs ?? DEFAULT_DURATIONS[variant];
        // Coalescing: a matching key means this is the *same* toast saying
        // something new (a third field added to the two it already reports), so
        // it keeps its id. SnackbarHost renders `<Show keyed>`, so reusing the id
        // is what stops the toast remounting and re-animating on every repeat.
        // A missing key never coalesces — two undefined keys are not a match.
        const prior = registeredStore.current;
        const extends_ =
            toast.coalesceKey !== undefined && prior?.coalesceKey === toast.coalesceKey;
        clearTimer();
        // Replacement ends the prior toast's undo window with the Undo untaken,
        // so its tail commits (SPEC → Snackbar & Undo → Replacement). Without
        // this a delete's audit row was lost outright the moment anything else
        // toasted, leaving a tombstone with no history behind it.
        //
        // An *extension* is exempt: it is the same toast saying something new, so
        // its tail is superseded by the incoming one exactly as its action is —
        // running the old tail here would double-write the run being coalesced.
        if (!extends_) releaseTail(prior);
        const active: ActiveToast = {
            id: extends_ ? prior!.id : ++sequence,
            message: toast.message,
            variant,
            durationMs: duration,
            action: toast.action,
            onExpire: toast.onExpire,
            createdAt: Date.now(),
            coalesceKey: toast.coalesceKey,
        };
        registeredStore.current = active;
        scheduleExpiry(duration);
    },
    dismiss(): void {
        if (!registeredStore) return;
        const toast = registeredStore.current;
        clearTimer();
        registeredStore.current = null;
        // Esc (SnackbarHost's only caller) closes the window without taking the
        // Undo — the same case as timing out, reached faster. Cleared before the
        // tail runs, matching the timeout path.
        releaseTail(toast);
    },
    pauseTimer(): void {
        if (timerId === null || remainingMs === null) return;
        clearTimeout(timerId);
        timerId = null;
        const elapsed = Date.now() - (registeredStore?.current?.createdAt ?? Date.now());
        remainingMs = Math.max(0, remainingMs - elapsed);
        pausedAt = Date.now();
    },
    resumeTimer(): void {
        if (timerId !== null || remainingMs === null || pausedAt === null) return;
        scheduleExpiry(remainingMs);
    },
};

let activeService: SnackbarService | null = null;

export function getSnackbarService(): SnackbarService {
    return activeService ?? realService;
}

export function setSnackbarService(mock: SnackbarService | null): void {
    activeService = mock;
}

/**
 * Run the current toast's action handler (if any) and dismiss the toast.
 * Used by SnackbarHost when the user clicks the action button.
 */
export async function invokeActionAndDismiss(): Promise<void> {
    const toast = registeredStore?.current;
    if (!toast) return;
    clearTimer();
    registeredStore!.current = null;
    if (toast.action) {
        await toast.action.handler();
    }
}
