export type SnackbarVariant = 'success' | 'error' | 'info';

export type ToastAction = {
    label: string;
    handler: () => void | Promise<void>;
};

export type ToastInput = {
    message: string;
    variant?: SnackbarVariant;
    durationMs?: number;
    action?: ToastAction;
    onExpire?: () => void | Promise<void>;
    /**
     * Marks this toast as one of a repeatable series. A `show()` whose key
     * matches the visible toast **extends** it — same toast, new message and
     * action, timer restarted — instead of replacing it.
     *
     * Exists because the Snackbar is single-slot: without it, adding three
     * fields in a row would leave only the third undoable, and the toast would
     * remount and re-animate on each one (`SnackbarHost` renders `<Show keyed>`).
     * The caller accumulates whatever its Undo has to reverse; the service only
     * has to not throw the toast away.
     */
    coalesceKey?: string;
};

export type ActiveToast = {
    id: number;
    message: string;
    variant: SnackbarVariant;
    durationMs: number;
    action?: ToastAction;
    onExpire?: () => void | Promise<void>;
    createdAt: number;
    coalesceKey?: string;
};

export type SnackbarStore = {
    current: ActiveToast | null;
};

export type SnackbarService = {
    show(toast: ToastInput): void;
    dismiss(): void;
    pauseTimer(): void;
    resumeTimer(): void;
};

export const DEFAULT_DURATIONS: Record<SnackbarVariant, number> = {
    success: 5000,
    info: 5000,
    error: 8000,
};

/**
 * `durationMs` for a toast that must not time out — a condition the user has to
 * act on, not an event that has passed (today: a degraded boot).
 *
 * The largest delay `setTimeout` accepts rather than `Infinity`: a 32-bit
 * overflow fires the timer *immediately*, which would make "persistent" the one
 * value that dismisses fastest. ~24 days outlives any session.
 */
export const PERSISTENT_DURATION = 2_147_483_647;
