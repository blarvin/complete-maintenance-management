/**
 * CreateDataField — Legacy "+ Add Field" surface.
 *
 * Single-pick Template dropdown: user clicks "+ Add Field", picks one Template,
 * a DataField is created immediately via the command bus, the dropdown closes.
 * Click "+ Add Field" again to add another. Nothing else is shared with the
 * FieldComposer — this component is self-contained so it can be turned on/off
 * via the LEGACY_ADD_FIELD_ENABLED flag without touching the composer code.
 */

import {
    component$,
    useSignal,
    useResource$,
    Resource,
    $,
    type PropFunction,
} from '@builder.io/qwik';
import { getTemplateQueries } from '../../data/queries';
import { getCommandBus } from '../../data/commands';
import type { DataFieldTemplate } from '../../data/models';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    nodeId: string;
    /** Max cardOrder among already-persisted fields; new field is placed at +1. */
    currentMaxCardOrder: number;
    /** Called after a field is successfully created so the parent can reload. */
    onCreated$: PropFunction<() => void>;
};

export const CreateDataField = component$<CreateDataFieldProps>((props) => {
    const isOpen = useSignal(false);

    const templatesResource = useResource$<DataFieldTemplate[]>(async () => {
        const list = await getTemplateQueries().listTemplates();
        return [...list].sort((a, b) => a.label.localeCompare(b.label));
    });

    const toggle$ = $(() => {
        isOpen.value = !isOpen.value;
    });

    const pick$ = $(async (tpl: DataFieldTemplate) => {
        isOpen.value = false;
        await getCommandBus().execute({
            type: 'ADD_FIELD_FROM_TEMPLATE',
            payload: {
                nodeId: props.nodeId,
                templateId: tpl.id,
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
                aria-expanded={isOpen.value}
            >
                + Add Field
            </button>
            {isOpen.value && (
                <div class={styles.dropdown} role="listbox" aria-label="Field templates">
                    <Resource
                        value={templatesResource}
                        onPending={() => <div class={styles.dropdownItem}>Loading…</div>}
                        onRejected={() => <div class={styles.dropdownItem}>Failed to load templates</div>}
                        onResolved={(templates) => {
                            if (templates.length === 0) {
                                return <div class={styles.dropdownItem}>No templates available</div>;
                            }
                            return (
                                <>
                                    {templates.map((tpl) => (
                                        <button
                                            key={tpl.id}
                                            type="button"
                                            class={styles.dropdownItem}
                                            onClick$={() => pick$(tpl)}
                                            role="option"
                                        >
                                            {tpl.label}
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
