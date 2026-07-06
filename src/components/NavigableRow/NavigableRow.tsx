/**
 * NavigableRow — a generic navigable inline row a container/lens hands its
 * children (#5 slice 2). The name re-roots into the child (identical to
 * clicking its CHILD card); a disclosure chevron expands the child's own
 * fields inline as a read-only peek (FieldList with the add-field surfaces
 * suppressed).
 *
 * Deliberately kind-agnostic: takes only id + name, so the same row serves the
 * `jobs` lens today and `logbook` (#6c) tomorrow — no `kind === '…'` checks.
 * Borrows the field-row skin (the triangle chevron, NavigableRow.module.css),
 * NOT the DataField component, which is welded to value-editing.
 */

import { component$, useSignal, $ } from '@builder.io/qwik';
import { useAppTransitions } from '../../state/appState.context';
import { FieldList } from '../FieldList/FieldList';
import styles from './NavigableRow.module.css';

export type NavigableRowProps = { id: string; name: string };

export const NavigableRow = component$<NavigableRowProps>((props) => {
    const expanded = useSignal(false);
    const { navigateToNode$ } = useAppTransitions();

    const toggle$ = $(() => {
        expanded.value = !expanded.value;
    });

    const navigate$ = $(() => navigateToNode$(props.id));

    const onKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigateToNode$(props.id);
        }
    });

    return (
        <div class={styles.rowWrapper}>
            <div class={styles.row}>
                <button
                    type="button"
                    class={[
                        styles.chevron,
                        expanded.value ? styles.chevronDown : styles.chevronRight,
                    ]}
                    onClick$={toggle$}
                    aria-expanded={expanded.value}
                    aria-label={expanded.value ? 'Collapse' : 'Expand'}
                />
                <span
                    class={styles.name}
                    role="button"
                    tabIndex={0}
                    onClick$={navigate$}
                    onKeyDown$={onKeyDown$}
                >
                    {props.name}
                </span>
            </div>
            {expanded.value && (
                <div class={styles.expanded}>
                    <FieldList nodeId={props.id} hideAddSurfaces />
                </div>
            )}
        </div>
    );
});
