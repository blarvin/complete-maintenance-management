// Default thresholds
export const DOUBLE_TAP_THRESHOLD_MS = 280;
export const DOUBLE_TAP_SLOP_PX = 6;

export type UseDoubleTapOptions = {
    thresholdMs?: number;
    slopPx?: number;
};

/**
 * Tap state for detection algorithm
 */
export type TapState = {
    lastDownAt: number;
    lastDownX: number;
    lastDownY: number;
};

/**
 * Pure function for double-tap detection. Single source of truth —
 * `checkDoubleTap` delegates here. Returns [isDouble, newState].
 */
export function detectDoubleTap(
    state: TapState,
    x: number,
    y: number,
    now: number,
    thresholdMs = DOUBLE_TAP_THRESHOLD_MS,
    slopPx = DOUBLE_TAP_SLOP_PX
): [boolean, TapState] {
    const withinTime = now - state.lastDownAt <= thresholdMs;
    const dx = Math.abs(x - state.lastDownX);
    const dy = Math.abs(y - state.lastDownY);
    const withinSlop = dx <= slopPx && dy <= slopPx;
    const isDouble = withinTime && withinSlop;

    const newState: TapState = {
        lastDownAt: now,
        lastDownX: x,
        lastDownY: y,
    };

    return [isDouble, newState];
}

/**
 * Hook for detecting double-tap/double-click gestures.
 * Handles time-based detection (two taps within threshold)
 * and position-based detection (taps within slop distance).
 *
 * Returns a handler to call on pointerdown events that returns
 * whether the tap completed a double-tap gesture. Synchronous —
 * tap state is plain closure state, no reactivity needed.
 */
export function useDoubleTap(options: UseDoubleTapOptions = {}) {
    const thresholdMs = options.thresholdMs ?? DOUBLE_TAP_THRESHOLD_MS;
    const slopPx = options.slopPx ?? DOUBLE_TAP_SLOP_PX;

    let state: TapState = { lastDownAt: 0, lastDownX: 0, lastDownY: 0 };

    /**
     * Call this on pointerdown. Returns true if this tap completes a double-tap.
     * Also updates internal state for next detection.
     */
    const checkDoubleTap = (x: number, y: number): boolean => {
        const [isDouble, newState] = detectDoubleTap(state, x, y, Date.now(), thresholdMs, slopPx);
        state = newState;
        return isDouble;
    };

    return { checkDoubleTap };
}
