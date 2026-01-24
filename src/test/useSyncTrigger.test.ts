/**
 * Tests for useSyncTrigger - debounced sync trigger helper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerSync, cancelPendingSync } from '../hooks/useSyncTrigger';
import * as syncManagerModule from '../data/sync/syncManager';

describe('useSyncTrigger', () => {
  const mockSyncDelta = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(syncManagerModule, 'getSyncManager').mockReturnValue({
      syncDelta: mockSyncDelta,
    } as any);
  });

  afterEach(() => {
    cancelPendingSync();
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockSyncDelta.mockClear();
  });

  it('triggers sync after 500ms debounce delay', async () => {
    triggerSync();
    
    // Should not sync immediately
    expect(mockSyncDelta).not.toHaveBeenCalled();
    
    // Should sync after debounce window
    vi.advanceTimersByTime(500);
    expect(mockSyncDelta).toHaveBeenCalledTimes(1);
  });

  it('debounces multiple rapid calls into one sync', () => {
    triggerSync();
    triggerSync();
    triggerSync();
    
    vi.advanceTimersByTime(500);
    expect(mockSyncDelta).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    triggerSync();
    vi.advanceTimersByTime(300); // 300ms elapsed
    
    triggerSync(); // Reset timer
    vi.advanceTimersByTime(300); // 600ms total, but only 300ms since reset
    
    // Should NOT have synced yet (only 300ms since last call)
    expect(mockSyncDelta).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(200); // 500ms since last call
    expect(mockSyncDelta).toHaveBeenCalledTimes(1);
  });

  it('cancelPendingSync prevents scheduled sync', () => {
    triggerSync();
    vi.advanceTimersByTime(200);
    
    cancelPendingSync();
    vi.advanceTimersByTime(500);
    
    expect(mockSyncDelta).not.toHaveBeenCalled();
  });

  it('logs errors but does not throw', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSyncDelta.mockRejectedValueOnce(new Error('Network error'));
    
    triggerSync();
    vi.advanceTimersByTime(500);
    
    // Wait for the promise rejection to be handled
    await vi.runAllTimersAsync();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[triggerSync] Sync failed:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
