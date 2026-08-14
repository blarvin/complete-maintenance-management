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

import { createSignal, Show } from 'solid-js';
import { useAppTransitions } from '../../state/appState.context';
import { FieldList } from '../FieldList/FieldList';
import styles from './NavigableRow.module.css';

export type NavigableRowProps = { id: string; name: string };

export const NavigableRow = (props: NavigableRowProps) => {
    const [expanded, setExpanded] = createSignal(false);
    const { navigateToNode } = useAppTransitions();

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigateToNode(props.id);
        }
    };

    return (
        <div class={styles.rowWrapper}>
            <div class={styles.row}>
                <button
                    type="button"
                    classList={{
                        [styles.chevron]: true,
                        [styles.chevronDown]: expanded(),
                        [styles.chevronRight]: !expanded(),
                    }}
                    onClick={() => setExpanded(!expanded())}
                    aria-expanded={expanded()}
                    aria-label={expanded() ? `Collapse ${props.name}` : `Expand ${props.name}`}
                />
                <span
                    class={styles.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToNode(props.id)}
                    onKeyDown={onKeyDown}
                >
                    {props.name}
                </span>
            </div>
            <Show when={expanded()}>
                <div class={styles.expanded}>
                    <FieldList nodeId={props.id} hideAddSurfaces />
                </div>
            </Show>
        </div>
    );
};
