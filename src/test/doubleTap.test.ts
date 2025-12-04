/**
 * Double-tap detection tests - validates the actual detection algorithm.
 * Tests the pure function exported from useDoubleTap.ts.
 */

import { describe, it, expect } from 'vitest';
import {
    detectDoubleTap,
    DOUBLE_TAP_THRESHOLD_MS,
    DOUBLE_TAP_SLOP_PX,
    type TapState,
} from '../hooks/useDoubleTap';

describe('Double-Tap Detection Algorithm', () => {
    const initialState: TapState = { lastDownAt: 0, lastDownX: 0, lastDownY: 0 };

    describe('exported constants', () => {
        it('has expected default threshold', () => {
            expect(DOUBLE_TAP_THRESHOLD_MS).toBe(280);
        });

        it('has expected default slop', () => {
            expect(DOUBLE_TAP_SLOP_PX).toBe(6);
        });
    });

    describe('time-based detection', () => {
        it('detects double-tap when second tap is within threshold', () => {
            const t1 = 1000;
            const t2 = t1 + 200; // 200ms later, within 280ms threshold

            // First tap
            const [isFirst, state1] = detectDoubleTap(initialState, 100, 100, t1);
            expect(isFirst).toBe(false); // First tap is never a double

            // Second tap at same position within threshold
            const [isSecond] = detectDoubleTap(state1, 100, 100, t2);
            expect(isSecond).toBe(true);
        });

        it('rejects double-tap when second tap is outside threshold', () => {
            const t1 = 1000;
            const t2 = t1 + 300; // 300ms later, outside 280ms threshold

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [isSecond] = detectDoubleTap(state1, 100, 100, t2);
            expect(isSecond).toBe(false);
        });

        it('accepts tap exactly at threshold boundary', () => {
            const t1 = 1000;
            const t2 = t1 + 280; // Exactly at threshold

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [isSecond] = detectDoubleTap(state1, 100, 100, t2);
            expect(isSecond).toBe(true);
        });
    });

    describe('position-based detection (slop)', () => {
        it('detects double-tap when taps are at exact same position', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [isSecond] = detectDoubleTap(state1, 100, 100, t2);
            expect(isSecond).toBe(true);
        });

        it('detects double-tap when second tap is within slop distance', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            // Move 5px in both directions (within 6px slop)
            const [isSecond] = detectDoubleTap(state1, 105, 105, t2);
            expect(isSecond).toBe(true);
        });

        it('accepts tap exactly at slop boundary', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            // Move exactly 6px (at boundary)
            const [isSecond] = detectDoubleTap(state1, 106, 100, t2);
            expect(isSecond).toBe(true);
        });

        it('rejects double-tap when second tap exceeds slop in X', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            // Move 7px in X (outside 6px slop)
            const [isSecond] = detectDoubleTap(state1, 107, 100, t2);
            expect(isSecond).toBe(false);
        });

        it('rejects double-tap when second tap exceeds slop in Y', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            // Move 7px in Y (outside 6px slop)
            const [isSecond] = detectDoubleTap(state1, 100, 107, t2);
            expect(isSecond).toBe(false);
        });

        it('handles negative position differences', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            // Move -5px (within slop)
            const [isSecond] = detectDoubleTap(state1, 95, 95, t2);
            expect(isSecond).toBe(true);
        });
    });

    describe('combined time + position', () => {
        it('rejects when time is ok but position exceeds slop', () => {
            const t1 = 1000;
            const t2 = t1 + 100; // Within time threshold

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [isSecond] = detectDoubleTap(state1, 120, 120, t2); // Outside slop
            expect(isSecond).toBe(false);
        });

        it('rejects when position is ok but time exceeds threshold', () => {
            const t1 = 1000;
            const t2 = t1 + 500; // Outside time threshold

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [isSecond] = detectDoubleTap(state1, 100, 100, t2); // Same position
            expect(isSecond).toBe(false);
        });
    });

    describe('state management', () => {
        it('first tap always returns false', () => {
            const [isDouble] = detectDoubleTap(initialState, 100, 100, 1000);
            expect(isDouble).toBe(false);
        });

        it('third tap can be double with second (not first)', () => {
            const t1 = 1000;
            const t2 = t1 + 500; // Too slow - not a double
            const t3 = t2 + 100; // Fast after t2 - is a double with t2

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [isSecond, state2] = detectDoubleTap(state1, 100, 100, t2);
            expect(isSecond).toBe(false);

            const [isThird] = detectDoubleTap(state2, 100, 100, t3);
            expect(isThird).toBe(true);
        });

        it('updates state even when detection fails', () => {
            const t1 = 1000;
            const t2 = t1 + 500; // Too slow

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1);
            const [, state2] = detectDoubleTap(state1, 200, 200, t2);

            // State should reflect the second tap
            expect(state2.lastDownAt).toBe(t2);
            expect(state2.lastDownX).toBe(200);
            expect(state2.lastDownY).toBe(200);
        });
    });

    describe('custom thresholds', () => {
        it('respects custom time threshold', () => {
            const t1 = 1000;
            const t2 = t1 + 400; // Would fail default 280ms, but within 500ms

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1, 500);
            const [isSecond] = detectDoubleTap(state1, 100, 100, t2, 500);
            expect(isSecond).toBe(true);
        });

        it('respects custom slop threshold', () => {
            const t1 = 1000;
            const t2 = t1 + 100;

            const [, state1] = detectDoubleTap(initialState, 100, 100, t1, 280, 20);
            // Move 15px (would fail default 6px, but within 20px)
            const [isSecond] = detectDoubleTap(state1, 115, 115, t2, 280, 20);
            expect(isSecond).toBe(true);
        });
    });
});
