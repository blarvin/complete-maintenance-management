import type { QRL } from '@builder.io/qwik';

export type SnackbarVariant = 'success' | 'error' | 'info';

export type ToastAction = {
    label: string;
    handler: QRL<() => void | Promise<void>>;
};

export type ToastInput = {
    message: string;
    variant?: SnackbarVariant;
    durationMs?: number;
    action?: ToastAction;
    onExpire?: QRL<() => void | Promise<void>>;
};

export type ActiveToast = {
    id: number;
    message: string;
    variant: SnackbarVariant;
    durationMs: number;
    action?: ToastAction;
    onExpire?: QRL<() => void | Promise<void>>;
    createdAt: number;
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
