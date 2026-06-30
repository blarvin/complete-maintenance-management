/**
 * LensCreateButton — the quiet create affordance for a lens surface (#5 container
 * half). A `Jobs` lens is the place you create jobs, the same way the "+ Add Fields"
 * trigger is the place you add fields — so this borrows that trigger's skin
 * (`--text-sm`, weight 600, secondary, underline-on-hover) rather than the prominent
 * `CreateNodeButton`.
 *
 * It always **names its target** ("Create New Job on Compressor #3") so where the
 * new element lands is never ambiguous: a lens is a pure rollup/view, so the job is
 * parented to the lens's *owning* node, which the label spells out.
 *
 * Kind-agnostic: takes a pre-built label + handler, so it serves `jobs` today and
 * `logbook` (#6c) tomorrow with no change. The owning-node lookup + parent override
 * live in the view (BranchView).
 */

import { component$, type QRL } from '@builder.io/qwik';
import styles from './LensCreateButton.module.css';

export type LensCreateButtonProps = {
    /** Full, target-naming label, e.g. "Create New Job on Compressor #3". */
    label: string;
    onClick$: QRL<() => void>;
};

export const LensCreateButton = component$<LensCreateButtonProps>((props) => (
    <button type="button" class={styles.addButton} onClick$={props.onClick$}>
        {props.label}
    </button>
));
