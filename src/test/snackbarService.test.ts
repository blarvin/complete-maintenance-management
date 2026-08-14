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
        getSnackbarService().show({ message: 'A', onExpire });
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
            action: { label: 'Undo', handler },
            onExpire,
        });
        await invokeActionAndDismiss();
        expect(store.current).toBeNull();
        expect(handler).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(10000);
        expect(onExpire).not.toHaveBeenCalled();
    });

    it('dismiss() clears toast and skips onExpire', async () => {
        const onExpire = vi.fn();
        getSnackbarService().show({ message: 'A', onExpire });
        getSnackbarService().dismiss();
        expect(store.current).toBeNull();
        await vi.advanceTimersByTimeAsync(10000);
        expect(onExpire).not.toHaveBeenCalled();
    });

    it('replacement drops prior toast without running its onExpire', async () => {
        const firstExpire = vi.fn();
        const secondExpire = vi.fn();
        getSnackbarService().show({ message: 'First', onExpire: firstExpire });
        const firstId = store.current!.id;
        getSnackbarService().show({ message: 'Second', onExpire: secondExpire });
        expect(store.current!.message).toBe('Second');
        expect(store.current!.id).not.toBe(firstId);
        expect(firstExpire).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(5000);
        expect(secondExpire).toHaveBeenCalledTimes(1);
    });

    it('same coalesceKey extends the toast in place, keeping its id', () => {
        getSnackbarService().show({ message: 'Field added', coalesceKey: 'field-added' });
        const firstId = store.current!.id;
        getSnackbarService().show({ message: '2 fields added', coalesceKey: 'field-added' });
        // Same toast saying something new — the id is what SnackbarHost keys on,
        // so holding it steady is what prevents a remount/re-animate per pick.
        expect(store.current!.id).toBe(firstId);
        expect(store.current!.message).toBe('2 fields added');
    });

    it('extension swaps the action, so Undo reverses the whole run', async () => {
        const undoOne = vi.fn();
        const undoBoth = vi.fn();
        getSnackbarService().show({
            message: 'Field added',
            coalesceKey: 'field-added',
            action: { label: 'Undo', handler: undoOne },
        });
        getSnackbarService().show({
            message: '2 fields added',
            coalesceKey: 'field-added',
            action: { label: 'Undo', handler: undoBoth },
        });
        await invokeActionAndDismiss();
        expect(undoBoth).toHaveBeenCalledTimes(1);
        expect(undoOne).not.toHaveBeenCalled();
    });

    it('extension restarts the timer', async () => {
        getSnackbarService().show({ message: 'A', coalesceKey: 'k' });
        await vi.advanceTimersByTimeAsync(4000);
        getSnackbarService().show({ message: 'B', coalesceKey: 'k' });
        await vi.advanceTimersByTimeAsync(4000); // 8s since the first, 4s since the second
        expect(store.current).not.toBeNull();
        await vi.advanceTimersByTimeAsync(1001);
        expect(store.current).toBeNull();
    });

    it('a different key, or no key, still replaces', () => {
        getSnackbarService().show({ message: 'A', coalesceKey: 'k' });
        const firstId = store.current!.id;
        getSnackbarService().show({ message: 'B', coalesceKey: 'other' });
        expect(store.current!.id).not.toBe(firstId);

        const secondId = store.current!.id;
        getSnackbarService().show({ message: 'C' });
        expect(store.current!.id).not.toBe(secondId);
    });

    it('two keyless toasts do not coalesce on undefined', () => {
        getSnackbarService().show({ message: 'A' });
        const firstId = store.current!.id;
        getSnackbarService().show({ message: 'B' });
        expect(store.current!.id).not.toBe(firstId);
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
