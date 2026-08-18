/**
 * useRevealOnArrival — the receiving half of the `revealElement` transition.
 *
 * `revealElement` only says *which* element and *where to stand*; the scroll and
 * the flash happen here, in the row itself. That split is not incidental:
 * navigation, card expansion and FieldList's async load mean the target row is
 * almost never mounted at the moment the state is set, so a scroll driven from
 * the transition would aim at nothing. A row that checks on mount fires whenever
 * it appears, however late that is.
 *
 * It is also why the hook takes an element accessor rather than the transition
 * taking a ref: DOM handles can't be serialised, and keeping them out of the
 * payload is what leaves `revealElement` drivable by a command layer later.
 *
 * The host wears the returned `flashing` accessor as its own class — the
 * animation is per-host chrome (a Field row and a node card don't flash alike),
 * so only the timing lives here.
 */

import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { useAppState, useAppTransitions, selectors } from '../state/appState';

/** Long enough to catch the eye after a smooth scroll, short enough not to nag.
 *  Kept in step with the animation durations in the two host stylesheets. */
const FLASH_MS = 1400;

export function useRevealOnArrival(
    elementId: Accessor<string>,
    hostEl: Accessor<HTMLElement | undefined>,
): Accessor<boolean> {
    const appState = useAppState();
    const { clearReveal } = useAppTransitions();
    const [flashing, setFlashing] = createSignal(false);

    createEffect(() => {
        if (!selectors.isRevealed(appState, elementId())) return;
        const el = hostEl();
        // Tracked: the ref lands after first run, and this re-runs when it does.
        if (!el) return;

        // `center` on something taller than the viewport aligns the *centres*,
        // pushing the top off-screen — for an expanded node card that hides the
        // header naming the thing you were sent to look at (observed at 1102px
        // against a 704px viewport). Align the top instead when it can't fit.
        const fits = el.getBoundingClientRect().height < window.innerHeight;
        el.scrollIntoView({ block: fits ? 'center' : 'start', behavior: 'smooth' });
        setFlashing(true);

        // Clearing the state as well as the local flag is what makes the reveal
        // one-shot: without it a later remount of this row would flash again.
        const timer = setTimeout(() => {
            setFlashing(false);
            clearReveal();
        }, FLASH_MS);
        onCleanup(() => clearTimeout(timer));
    });

    return flashing;
}
