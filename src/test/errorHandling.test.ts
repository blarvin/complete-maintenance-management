/**
 * Tests for error handling utilities.
 * Validates that safeAsync and related functions properly catch errors,
 * return fallbacks, and log with context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeAsync, safeAsyncVoid, withSafeAsync } from '../data/services/withErrorHandling';

describe('Error Handling Utilities', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('safeAsync', () => {
        it('returns operation result on success', async () => {
            const operation = async () => 'success';
            const result = await safeAsync(operation, 'fallback');
            expect(result).toBe('success');
        });

        it('returns fallback on error', async () => {
            const operation = async () => {
                throw new Error('Test error');
            };
            const result = await safeAsync(operation, 'fallback');
            expect(result).toBe('fallback');
        });

        it('returns complex fallback types', async () => {
            const operation = async (): Promise<{ items: string[] }> => {
                throw new Error('Test error');
            };
            const result = await safeAsync(operation, { items: [] });
            expect(result).toEqual({ items: [] });
        });

        it('returns null as fallback when appropriate', async () => {
            const operation = async (): Promise<string | null> => {
                throw new Error('Test error');
            };
            const result = await safeAsync(operation, null);
            expect(result).toBeNull();
        });

        it('logs error with default context', async () => {
            const error = new Error('Test error');
            const operation = async () => {
                throw error;
            };
            await safeAsync(operation, 'fallback');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[Error]', error);
        });

        it('logs error with custom context', async () => {
            const error = new Error('Test error');
            const operation = async () => {
                throw error;
            };
            await safeAsync(operation, 'fallback', 'MyComponent.loadData');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[MyComponent.loadData]', error);
        });

        it('does not log on success', async () => {
            const operation = async () => 'success';
            await safeAsync(operation, 'fallback');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('handles async operations that take time', async () => {
            const operation = async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'delayed result';
            };
            const result = await safeAsync(operation, 'fallback');
            expect(result).toBe('delayed result');
        });

        it('handles async operations that throw after delay', async () => {
            const operation = async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                throw new Error('Delayed error');
            };
            const result = await safeAsync(operation, 'fallback');
            expect(result).toBe('fallback');
        });
    });

    describe('safeAsyncVoid', () => {
        it('completes without error on success', async () => {
            let executed = false;
            const operation = async () => {
                executed = true;
            };
            await safeAsyncVoid(operation);
            expect(executed).toBe(true);
        });

        it('does not throw on error', async () => {
            const operation = async () => {
                throw new Error('Test error');
            };
            // Should not throw
            await expect(safeAsyncVoid(operation)).resolves.toBeUndefined();
        });

        it('logs error with context', async () => {
            const error = new Error('Test error');
            const operation = async () => {
                throw error;
            };
            await safeAsyncVoid(operation, 'Analytics.track');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[Analytics.track]', error);
        });

        it('logs error with default context when not provided', async () => {
            const error = new Error('Test error');
            const operation = async () => {
                throw error;
            };
            await safeAsyncVoid(operation);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[Error]', error);
        });
    });

    describe('withSafeAsync', () => {
        it('creates a wrapped function that returns result on success', async () => {
            const originalFn = async (x: number) => x * 2;
            const safeFn = withSafeAsync(originalFn, -1);
            const result = await safeFn(5);
            expect(result).toBe(10);
        });

        it('creates a wrapped function that returns fallback on error', async () => {
            const originalFn = async (x: number): Promise<number> => {
                throw new Error('Test error');
            };
            const safeFn = withSafeAsync(originalFn, -1);
            const result = await safeFn(5);
            expect(result).toBe(-1);
        });

        it('preserves function arguments', async () => {
            const originalFn = async (a: string, b: number) => `${a}-${b}`;
            const safeFn = withSafeAsync(originalFn, 'error');
            const result = await safeFn('test', 42);
            expect(result).toBe('test-42');
        });

        it('logs error with context', async () => {
            const error = new Error('Test error');
            const originalFn = async (): Promise<string> => {
                throw error;
            };
            const safeFn = withSafeAsync(originalFn, 'fallback', 'service.method');
            await safeFn();
            expect(consoleErrorSpy).toHaveBeenCalledWith('[service.method]', error);
        });

        it('wrapped function can be called multiple times', async () => {
            let callCount = 0;
            const originalFn = async () => {
                callCount++;
                return callCount;
            };
            const safeFn = withSafeAsync(originalFn, 0);
            
            expect(await safeFn()).toBe(1);
            expect(await safeFn()).toBe(2);
            expect(await safeFn()).toBe(3);
        });

        it('each call handles errors independently', async () => {
            let shouldFail = false;
            const originalFn = async (): Promise<string> => {
                if (shouldFail) throw new Error('Test error');
                return 'success';
            };
            const safeFn = withSafeAsync(originalFn, 'fallback');
            
            expect(await safeFn()).toBe('success');
            shouldFail = true;
            expect(await safeFn()).toBe('fallback');
            shouldFail = false;
            expect(await safeFn()).toBe('success');
        });
    });
});

