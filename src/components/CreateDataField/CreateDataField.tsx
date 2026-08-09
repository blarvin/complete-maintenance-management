/**
 * CreateDataField — Legacy "+ Add Field" surface.
 *
 * Single-pick Definition dropdown: user clicks "+ Add Field", picks one
 * Definition, a DataField is created immediately via the command bus, the
 * dropdown closes. Click "+ Add Field" again to add another. Open state is
 * shared with FieldComposerSlot via the parent-owned `activeSurface`
 * accessor/setter pair so opening this dropdown automatically closes the
 * Composer (and vice versa).
 */

import { For, Show, createResource, type Accessor } from 'solid-js';
import { getDefinitionQueries } from '../../data/queries';
import { getCommandBus } from '../../data/commands';
import { isInline } from '../../kinds/placement';
import type { Definition } from '../../data/models';
import type { ActiveSurface } from '../FieldList/addFieldSurfaces';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    nodeId: string;
    /** Max cardOrder among already-persisted fields; new field is placed at +1. */
    currentMaxCardOrder: number;
    /** Shared mutex with the Composer surface. */
    activeSurface: Accessor<ActiveSurface>;
    setActiveSurface: (s: ActiveSurface) => void;
};

/** Sentinel for a failed fetch — createResource has no onRejected branch, so the
 *  fetcher catches and the render distinguishes failure from an empty list. */
const FAILED = Symbol('failed');

export const CreateDataField = (props: CreateDataFieldProps) => {
    const isOpen = () => props.activeSurface() === 'legacy';

    const [definitions] = createResource<Definition[] | typeof FAILED>(async () => {
        try {
            const list = await getDefinitionQueries().listDefinitions();
            // Field kinds only: re-root policy Definitions (logbook) live in the
            // same library tree but are not field-instantiable rows.
            return list.filter((d) => isInline(d.kind)).sort((a, b) => a.label.localeCompare(b.label));
        } catch {
            return FAILED;
        }
    });

    const toggle = () => {
        props.setActiveSurface(props.activeSurface() === 'legacy' ? 'none' : 'legacy');
    };

    const pick = async (def: Definition) => {
        props.setActiveSurface('none');
        await getCommandBus().execute({
            type: 'CREATE_ELEMENT_FROM_DEFINITION',
            payload: {
                parentId: props.nodeId,
                definitionId: def.id,
                siblingOrder: props.currentMaxCardOrder + 1,
            },
        });
    };

    return (
        <div class={styles.legacyWrapper}>
            <button
                type="button"
                class={styles.addButton}
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={isOpen()}
            >
                + Add Field
            </button>
            <Show when={isOpen()}>
                <div class={styles.dropdown} role="listbox" aria-label="Field definitions">
                    <Show
                        when={definitions()}
                        fallback={<div class={styles.dropdownItem}>Loading…</div>}
                    >
                        <Show
                            when={definitions() !== FAILED}
                            fallback={<div class={styles.dropdownItem}>Failed to load field definitions</div>}
                        >
                            <Show
                                when={(definitions() as Definition[]).length > 0}
                                fallback={<div class={styles.dropdownItem}>No field definitions available</div>}
                            >
                                <For each={definitions() as Definition[]}>
                                    {(def) => (
                                        <button
                                            type="button"
                                            class={styles.dropdownItem}
                                            onClick={() => pick(def)}
                                            role="option"
                                        >
                                            {def.label}
                                        </button>
                                    )}
                                </For>
                            </Show>
                        </Show>
                    </Show>
                </div>
            </Show>
        </div>
    );
};
