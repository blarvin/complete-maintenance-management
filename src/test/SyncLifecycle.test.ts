/**
 * Unit tests for SyncLifecycle - Timer and event management.
 *
 * Tests lifecycle behavior with fake timers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncLifecycle } from '../data/sync/SyncLifecycle';

// Mock window for browser-only features
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

// Store original window reference
const originalWindow = typeof window !== 'undefined' ? window : undefined;

describe('SyncLifecycle', () => {
  let onTickMock: ReturnType<typeof vi.fn>;
  let lifecycle: SyncLifecycle;

  beforeEach(() => {
    vi.useFakeTimers();
    onTickMock = vi.fn().mockResolvedValue(undefined);
    lifecycle = new SyncLifecycle(onTickMock as () => Promise<void>, 1000); // 1 second interval
    
    // Setup window mock
    vi.stubGlobal('window', mockWindow);
    mockWindow.addEventListener.mockClear();
    mockWindow.removeEventListener.mockClear();
    mockWindow.dispatchEvent.mockClear();
  });

  afterEach(() => {
    lifecycle.stop();
    vi.useRealTimers();
    // Restore window
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow);
    } else {
      vi.unstubAllGlobals();
    }
  });

  describe('start/stop', () => {
    it('starts and sets isRunning to true', () => {
      expect(lifecycle.isRunning).toBe(false);
      lifecycle.start();
      expect(lifecycle.isRunning).toBe(true);
    });

    it('stops and sets isRunning to false', () => {
      lifecycle.start();
      lifecycle.stop();
      expect(lifecycle.isRunning).toBe(false);
    });

    it('does not start twice', () => {
      lifecycle.start();
      lifecycle.start(); // Should be no-op
      expect(lifecycle.isRunning).toBe(true);
    });

    it('can be stopped without starting', () => {
      expect(() => lifecycle.stop()).not.toThrow();
      expect(lifecycle.isRunning).toBe(false);
    });
  });

  describe('periodic timer', () => {
    it('calls onTick after poll interval', async () => {
      lifecycle.start();

      expect(onTickMock).not.toHaveBeenCalled();

      // Advance time by poll interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(onTickMock).toHaveBeenCalledTimes(1);
    });

    it('calls onTick repeatedly at poll interval', async () => {
      lifecycle.start();

      await vi.advanceTimersByTimeAsync(3000);

      expect(onTickMock).toHaveBeenCalledTimes(3);
    });

    it('stops calling onTick after stop', async () => {
      lifecycle.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(onTickMock).toHaveBeenCalledTimes(1);

      lifecycle.stop();

      await vi.advanceTimersByTimeAsync(2000);
      expect(onTickMock).toHaveBeenCalledTimes(1); // No additional calls
    });

    it('does not throw when onTick rejects', async () => {
      onTickMock.mockRejectedValue(new Error('Tick failed'));

      lifecycle.start();

      // Should not throw
      await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow();
    });
  });

  describe('online event', () => {
    it('registers online listener on start', () => {
      lifecycle.start();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    });

    it('calls onTick when online event fires', async () => {
      lifecycle.start();

      expect(onTickMock).not.toHaveBeenCalled();

      // Get the registered handler and call it
      const onlineHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];
      expect(onlineHandler).toBeDefined();
      
      // Simulate online event by calling the handler
      onlineHandler();

      // Allow the promise microtask to resolve (not the timer)
      await Promise.resolve();

      expect(onTickMock).toHaveBeenCalledTimes(1);
    });

    it('removes online listener on stop', () => {
      lifecycle.start();
      
      const onlineHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];
      
      lifecycle.stop();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('online', onlineHandler);
    });

    it('does not throw when onTick rejects on online event', async () => {
      onTickMock.mockRejectedValue(new Error('Tick failed'));

      lifecycle.start();

      // Get the registered handler
      const onlineHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];
      
      // Should not throw
      expect(() => onlineHandler()).not.toThrow();
    });
  });

  describe('configurable poll interval', () => {
    it('uses custom poll interval', async () => {
      const customLifecycle = new SyncLifecycle(onTickMock as () => Promise<void>, 5000);
      customLifecycle.start();

      await vi.advanceTimersByTimeAsync(4999);
      expect(onTickMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(onTickMock).toHaveBeenCalledTimes(1);

      customLifecycle.stop();
    });

    it('uses default poll interval when not specified', async () => {
      const defaultLifecycle = new SyncLifecycle(onTickMock as () => Promise<void>);
      defaultLifecycle.start();

      // Default is 600000ms (10 minutes)
      await vi.advanceTimersByTimeAsync(599999);
      expect(onTickMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(onTickMock).toHaveBeenCalledTimes(1);

      defaultLifecycle.stop();
    });
  });
});
