/**
 * Snackbar service tests - timer, replacement, dismiss, action/expire semantics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    registerSnackbarStore,
    getSnackbarService,
    invokeActionAndDismiss,
    resetSnackbarService,
    type SnackbarStore,
} from '../services/snackbar';

// QRL shim: in unit tests `$(fn)` isn't wrapping anything, so a plain function is
// a valid QRL at call time. We cast to any at the callsite.
const q = <T extends (...args: any[]) => any>(fn: T) => fn as any;

describe('SnackbarService', () => {
    let store: SnackbarStore;

    beforeEach(() => {
        vi.useFakeTimers();
        store = { current: null };
        registerSnackbarStore(store);
    });

    afterEach(() => {
        resetSnackbarService();
        vi.useRealTimers();
    });

    it('show() sets current toast with defaults', () => {
        getSnackbarService().show({ message: 'Hello' });
        expect(store.current).not.toBeNull();
        expect(store.current!.message).toBe('Hello');
        expect(store.current!.variant).toBe('success');
        expect(store.current!.durationMs).toBe(5000);
    });

    it('error variant defaults to 8000ms', () => {
        getSnackbarService().show({ variant: 'error', message: 'Oops' });
        expect(store.current!.durationMs).toBe(8000);
        expect(store.current!.variant).toBe('error');
    });

    it('auto-dismisses and runs onExpire after duration', async () => {
        const onExpire = vi.fn();
        getSnackbarService().show({ message: 'A', onExpire: q(onExpire) });
        expect(store.current).not.toBeNull();
        await vi.advanceTimersByTimeAsync(5000);
        expect(store.current).toBeNull();
        expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('invokeActionAndDismiss runs handler, clears toast, does NOT run onExpire', async () => {
        const handler = vi.fn();
        const onExpire = vi.fn();
        getSnackbarService().show({
            message: 'A',
            action: { label: 'Undo', handler: q(handler) },
            onExpire: q(onExpire),
        });
        await invokeActionAndDismiss();
        expect(store.current).toBeNull();
        expect(handler).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(10000);
        expect(onExpire).not.toHaveBeenCalled();
    });

    it('dismiss() clears toast and skips onExpire', async () => {
        const onExpire = vi.fn();
        getSnackbarService().show({ message: 'A', onExpire: q(onExpire) });
        getSnackbarService().dismiss();
        expect(store.current).toBeNull();
        await vi.advanceTimersByTimeAsync(10000);
        expect(onExpire).not.toHaveBeenCalled();
    });

    it('replacement drops prior toast without running its onExpire', async () => {
        const firstExpire = vi.fn();
        const secondExpire = vi.fn();
        getSnackbarService().show({ message: 'First', onExpire: q(firstExpire) });
        const firstId = store.current!.id;
        getSnackbarService().show({ message: 'Second', onExpire: q(secondExpire) });
        expect(store.current!.message).toBe('Second');
        expect(store.current!.id).not.toBe(firstId);
        expect(firstExpire).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(5000);
        expect(secondExpire).toHaveBeenCalledTimes(1);
    });

    it('sequence id increments', () => {
        getSnackbarService().show({ message: 'A' });
        const id1 = store.current!.id;
        getSnackbarService().show({ message: 'B' });
        expect(store.current!.id).toBeGreaterThan(id1);
    });

    it('custom durationMs overrides default', async () => {
        getSnackbarService().show({ message: 'A', durationMs: 1000 });
        await vi.advanceTimersByTimeAsync(999);
        expect(store.current).not.toBeNull();
        await vi.advanceTimersByTimeAsync(2);
        expect(store.current).toBeNull();
    });

    it('show() warns and no-ops when no store is registered', () => {
        resetSnackbarService();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getSnackbarService().show({ message: 'orphan' });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
