/**
 * Tests for storage error utilities.
 * Validates error creation, type guards, conversion, and user-facing messages.
 */

import { describe, it, expect } from 'vitest';
import {
    makeStorageError,
    isStorageError,
    toStorageError,
    describeForUser,
    type StorageError,
    type StorageErrorCode,
} from '../data/storage/storageErrors';

describe('Storage Error Utilities', () => {
    describe('makeStorageError', () => {
        it('creates error with required properties', () => {
            const err = makeStorageError('not-found', 'Item not found');

            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('Item not found');
            expect(err.code).toBe('not-found');
            expect(err.retryable).toBe(false);
        });

        it('sets retryable to true by default for unavailable code', () => {
            const err = makeStorageError('unavailable', 'Service down');
            expect(err.retryable).toBe(true);
        });

        it('sets retryable to false by default for other codes', () => {
            const codes: StorageErrorCode[] = ['not-found', 'validation', 'conflict', 'unauthorized', 'internal'];
            for (const code of codes) {
                const err = makeStorageError(code, 'Test');
                if (code !== 'unavailable') {
                    expect(err.retryable).toBe(false);
                }
            }
        });

        it('allows overriding retryable via options', () => {
            const err = makeStorageError('not-found', 'Item not found', { retryable: true });
            expect(err.retryable).toBe(true);
        });

        it('allows overriding retryable to false for unavailable', () => {
            const err = makeStorageError('unavailable', 'Service down', { retryable: false });
            expect(err.retryable).toBe(false);
        });

        it('attaches details when provided', () => {
            const details = { nodeId: '123', operation: 'delete' };
            const err = makeStorageError('conflict', 'Conflict detected', { details });

            expect(err.details).toEqual(details);
        });

        it('attaches cause when provided', () => {
            const cause = new Error('Original error');
            const err = makeStorageError('internal', 'Wrapped error', { cause });

            expect(err.cause).toBe(cause);
        });

        it('handles all options together', () => {
            const cause = new Error('Root cause');
            const details = { attemptNumber: 3 };
            const err = makeStorageError('unavailable', 'Retry failed', {
                retryable: false,
                details,
                cause,
            });

            expect(err.code).toBe('unavailable');
            expect(err.message).toBe('Retry failed');
            expect(err.retryable).toBe(false);
            expect(err.details).toEqual(details);
            expect(err.cause).toBe(cause);
        });

        it('leaves details undefined when not provided', () => {
            const err = makeStorageError('validation', 'Invalid input');
            expect(err.details).toBeUndefined();
        });

        it('leaves cause undefined when not provided', () => {
            const err = makeStorageError('validation', 'Invalid input');
            expect(err.cause).toBeUndefined();
        });
    });

    describe('isStorageError', () => {
        it('returns true for valid StorageError', () => {
            const err = makeStorageError('not-found', 'Test');
            expect(isStorageError(err)).toBe(true);
        });

        it('returns false for plain Error', () => {
            const err = new Error('Plain error');
            expect(isStorageError(err)).toBe(false);
        });

        it('returns false for null', () => {
            expect(isStorageError(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(isStorageError(undefined)).toBe(false);
        });

        it('returns false for string', () => {
            expect(isStorageError('error message')).toBe(false);
        });

        it('returns false for number', () => {
            expect(isStorageError(404)).toBe(false);
        });

        it('returns false for object without code', () => {
            const obj = { retryable: true, message: 'test' };
            expect(isStorageError(obj)).toBe(false);
        });

        it('returns false for object without retryable', () => {
            const obj = { code: 'not-found', message: 'test' };
            expect(isStorageError(obj)).toBe(false);
        });

        it('returns false for object with non-string code', () => {
            const obj = { code: 404, retryable: true };
            expect(isStorageError(obj)).toBe(false);
        });

        it('returns true for manually constructed StorageError-like object', () => {
            const obj = { code: 'internal', retryable: false, message: 'test' };
            expect(isStorageError(obj)).toBe(true);
        });
    });

    describe('toStorageError', () => {
        it('returns StorageError unchanged', () => {
            const original = makeStorageError('conflict', 'Already exists');
            const result = toStorageError(original);

            expect(result).toBe(original);
        });

        it('wraps plain Error with defaults', () => {
            const original = new Error('Something broke');
            const result = toStorageError(original);

            expect(isStorageError(result)).toBe(true);
            expect(result.code).toBe('internal');
            expect(result.message).toBe('Something broke');
            expect(result.retryable).toBe(true); // internal defaults to retryable
            expect(result.cause).toBe(original);
        });

        it('wraps plain Error with custom code', () => {
            const original = new Error('Not found');
            const result = toStorageError(original, { code: 'not-found' });

            expect(result.code).toBe('not-found');
            expect(result.retryable).toBe(false);
        });

        it('wraps plain Error with custom message', () => {
            const original = new Error('Internal details');
            const result = toStorageError(original, { message: 'User-friendly message' });

            expect(result.message).toBe('User-friendly message');
        });

        it('wraps plain Error with custom retryable', () => {
            const original = new Error('Failed');
            const result = toStorageError(original, { retryable: false });

            expect(result.retryable).toBe(false);
        });

        it('wraps non-Error values with fallback message', () => {
            const result = toStorageError('string error');

            expect(isStorageError(result)).toBe(true);
            expect(result.code).toBe('internal');
            expect(result.message).toBe('Unexpected storage error');
            expect(result.cause).toBe('string error');
        });

        it('wraps null with fallback message', () => {
            const result = toStorageError(null);

            expect(result.message).toBe('Unexpected storage error');
            expect(result.cause).toBeNull();
        });

        it('wraps undefined with fallback message', () => {
            const result = toStorageError(undefined);

            expect(result.message).toBe('Unexpected storage error');
            expect(result.cause).toBeUndefined();
        });

        it('wraps object with fallback message', () => {
            const obj = { status: 500, reason: 'Server error' };
            const result = toStorageError(obj);

            expect(result.message).toBe('Unexpected storage error');
            expect(result.cause).toBe(obj);
        });

        it('uses unavailable retryable default correctly', () => {
            const result = toStorageError(new Error('Network'), { code: 'unavailable' });
            expect(result.retryable).toBe(true);
        });

        it('uses internal retryable default correctly', () => {
            const result = toStorageError(new Error('Bug'));
            expect(result.code).toBe('internal');
            expect(result.retryable).toBe(true);
        });

        it('non-retryable codes default to false', () => {
            const codes: StorageErrorCode[] = ['not-found', 'validation', 'conflict', 'unauthorized'];
            for (const code of codes) {
                const result = toStorageError(new Error('Test'), { code });
                expect(result.retryable).toBe(false);
            }
        });
    });

    describe('describeForUser', () => {
        it('returns user message for not-found', () => {
            const err = makeStorageError('not-found', 'Technical details');
            expect(describeForUser(err)).toBe('That item was not found. It may have been removed.');
        });

        it('returns user message for validation', () => {
            const err = makeStorageError('validation', 'nodeName exceeds max length');
            expect(describeForUser(err)).toBe('Please check the inputs and try again.');
        });

        it('returns user message for conflict', () => {
            const err = makeStorageError('conflict', 'Version mismatch');
            expect(describeForUser(err)).toBe('This item was updated elsewhere. Please refresh.');
        });

        it('returns user message for unauthorized', () => {
            const err = makeStorageError('unauthorized', 'Missing auth token');
            expect(describeForUser(err)).toBe('You do not have permission to do that.');
        });

        it('returns user message for unavailable', () => {
            const err = makeStorageError('unavailable', 'Connection timeout');
            expect(describeForUser(err)).toBe('Service is temporarily unavailable. Please retry.');
        });

        it('returns generic message for internal', () => {
            const err = makeStorageError('internal', 'Null pointer');
            expect(describeForUser(err)).toBe('Something went wrong. Please try again.');
        });

        it('returns generic message for unknown code', () => {
            // Force an unknown code to test default case
            const err = makeStorageError('internal', 'Test');
            (err as any).code = 'unknown-code';
            expect(describeForUser(err)).toBe('Something went wrong. Please try again.');
        });

        it('does not expose technical details in user message', () => {
            const err = makeStorageError('not-found', 'SELECT * FROM nodes WHERE id = "abc123"');
            const userMsg = describeForUser(err);

            expect(userMsg).not.toContain('SELECT');
            expect(userMsg).not.toContain('abc123');
        });
    });

    describe('Error code coverage', () => {
        const allCodes: StorageErrorCode[] = [
            'not-found',
            'validation',
            'conflict',
            'unauthorized',
            'unavailable',
            'internal',
        ];

        it('all error codes can be created', () => {
            for (const code of allCodes) {
                const err = makeStorageError(code, `Test ${code}`);
                expect(err.code).toBe(code);
            }
        });

        it('all error codes have user descriptions', () => {
            for (const code of allCodes) {
                const err = makeStorageError(code, 'Test');
                const desc = describeForUser(err);
                expect(typeof desc).toBe('string');
                expect(desc.length).toBeGreaterThan(0);
            }
        });
    });
});
