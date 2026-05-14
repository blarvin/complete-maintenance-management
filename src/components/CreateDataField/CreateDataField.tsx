/**
 * CreateDataField — Legacy "+ Add Field" surface.
 *
 * Single-pick FieldDefinition dropdown: user clicks "+ Add Field", picks one
 * FieldDefinition, a DataField is created immediately via the command bus, the
 * dropdown closes. Click "+ Add Field" again to add another. Open state is
 * shared with FieldComposerSlot via the parent-owned `activeSurface` signal so
 * opening this dropdown automatically closes the Composer (and vice versa).
 */

import {
    component$,
    useResource$,
    Resource,
    $,
    type PropFunction,
    type Signal,
} from '@builder.io/qwik';
import { getFieldDefinitionQueries } from '../../data/queries';
import { getCommandBus } from '../../data/commands';
import type { FieldDefinition } from '../../data/models';
import type { ActiveSurface } from '../FieldComposer/FieldComposerSlot';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    nodeId: string;
    /** Max cardOrder among already-persisted fields; new field is placed at +1. */
    currentMaxCardOrder: number;
    /** Shared mutex with the Composer surface. */
    activeSurface: Signal<ActiveSurface>;
    /** Called after a field is successfully created so the parent can reload. */
    onCreated$: PropFunction<() => void>;
};

export const CreateDataField = component$<CreateDataFieldProps>((props) => {
    const isOpen = props.activeSurface.value === 'legacy';

    const definitionsResource = useResource$<FieldDefinition[]>(async () => {
        const list = await getFieldDefinitionQueries().listFieldDefinitions();
        return [...list].sort((a, b) => a.label.localeCompare(b.label));
    });

    const toggle$ = $(() => {
        props.activeSurface.value = props.activeSurface.value === 'legacy' ? 'none' : 'legacy';
    });

    const pick$ = $(async (def: FieldDefinition) => {
        props.activeSurface.value = 'none';
        await getCommandBus().execute({
            type: 'ADD_FIELD_FROM_DEFINITION',
            payload: {
                nodeId: props.nodeId,
                fieldDefinitionId: def.id,
                cardOrder: props.currentMaxCardOrder + 1,
            },
        });
        await props.onCreated$();
    });

    return (
        <div class={styles.legacyWrapper}>
            <button
                type="button"
                class={styles.addButton}
                onClick$={toggle$}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                + Add Field
            </button>
            {isOpen && (
                <div class={styles.dropdown} role="listbox" aria-label="Field definitions">
                    <Resource
                        value={definitionsResource}
                        onPending={() => <div class={styles.dropdownItem}>Loading…</div>}
                        onRejected={() => <div class={styles.dropdownItem}>Failed to load field definitions</div>}
                        onResolved={(definitions) => {
                            if (definitions.length === 0) {
                                return <div class={styles.dropdownItem}>No field definitions available</div>;
                            }
                            return (
                                <>
                                    {definitions.map((def) => (
                                        <button
                                            key={def.id}
                                            type="button"
                                            class={styles.dropdownItem}
                                            onClick$={() => pick$(def)}
                                            role="option"
                                        >
                                            {def.label}
                                        </button>
                                    ))}
                                </>
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
});
