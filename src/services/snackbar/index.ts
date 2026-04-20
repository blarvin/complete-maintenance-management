import type { SnackbarService, SnackbarStore, ToastInput, ActiveToast } from './types';
import { DEFAULT_DURATIONS } from './types';

export type { SnackbarService, SnackbarStore, ToastInput, SnackbarVariant, ActiveToast, ToastAction } from './types';

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

function scheduleExpiry(durationMs: number): void {
    clearTimer();
    remainingMs = durationMs;
    timerId = setTimeout(() => {
        const toast = registeredStore?.current;
        if (!toast) return;
        registeredStore!.current = null;
        clearTimer();
        if (toast.onExpire) {
            void toast.onExpire();
        }
    }, durationMs);
}

export function registerSnackbarStore(store: SnackbarStore): void {
    registeredStore = store;
}

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
        // Replacement: prior toast's onExpire does NOT fire on replace (per spec — user didn't wait out the timer, and the new toast is a fresh interaction). We just drop it.
        clearTimer();
        const variant = toast.variant ?? 'success';
        const duration = toast.durationMs ?? DEFAULT_DURATIONS[variant];
        const active: ActiveToast = {
            id: ++sequence,
            message: toast.message,
            variant,
            durationMs: duration,
            action: toast.action,
            onExpire: toast.onExpire,
            createdAt: Date.now(),
        };
        registeredStore.current = active;
        scheduleExpiry(duration);
    },
    dismiss(): void {
        if (!registeredStore) return;
        clearTimer();
        registeredStore.current = null;
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
