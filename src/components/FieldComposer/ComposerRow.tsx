/**
 * ComposerRow - One FieldDefinition within the FieldComposer.
 *
 * Unchecked: checkbox + label, whole row toggles. Checked: checkbox + label +
 * the Component renderer in pendingMode so the user can fill in a value before
 * Save commits the batch. Locked rows render the same as checked but the
 * checkbox is disabled (construction-mode defaults).
 *
 * After a check/uncheck transition resolves, the row's checkbox is anchored
 * in the viewport via scrollIntoView({ block: 'nearest' }) so a tall preview
 * (single-image especially) doesn't shove the user's place off-screen. A
 * smooth slide-in animation is tracked in LATER.md — the kvField renderers
 * use `display: contents` wrappers which can't be transitioned.
 */

import { component$, useSignal, useVisibleTask$, $, type QRL, type Signal } from '@builder.io/qwik';
import { TextKvField } from '../DataField/TextKvField';
import { EnumKvField } from '../DataField/EnumKvField';
import { MeasurementKvField } from '../DataField/MeasurementKvField';
import { SingleImageField } from '../DataField/SingleImageField';
import type { FieldDefinition, DataFieldValue, SingleImageValue } from '../../data/models';
import type { PendingForm } from '../../hooks/usePendingForms';
import styles from './ComposerRow.module.css';

export type ComposerRowProps = {
    definition: FieldDefinition;
    checked: boolean;
    locked?: boolean;
    pendingForm?: PendingForm;
    /** True only for the row the user JUST ticked — drives auto-focus / pick-list
     *  open. Seeded rows (construction defaults, restored Undo) are false so the
     *  composer opens with no field stealing focus. */
    autoFocus?: boolean;
    onToggle$: QRL<(definition: FieldDefinition) => void>;
    onValueChange$: QRL<(formId: string, value: DataFieldValue | null) => void>;
};

export const ComposerRow = component$<ComposerRowProps>((props) => {
    const rootRef = useSignal<HTMLElement>();
    const checkboxRef = useSignal<HTMLInputElement>();

    const handleCheckboxChange$ = $(() => {
        if (props.locked) return;
        props.onToggle$(props.definition);
    });

    // Anchor the checkbox after a toggle so a tall preview (e.g. single-image)
    // doesn't shove the user's place off-screen. Wait one frame past the
    // ~200ms animation budget so layout has settled before scrolling.
    useVisibleTask$(({ track, cleanup }) => {
        track(() => props.checked);
        const t = setTimeout(() => {
            checkboxRef.value?.scrollIntoView({ block: 'nearest' });
        }, 220);
        cleanup(() => clearTimeout(t));
    });

    const labelId = `composer-label-${props.definition.id}`;

    return (
        <div class={styles.row} ref={rootRef}>
            <input
                type="checkbox"
                class={styles.checkbox}
                checked={props.checked}
                disabled={props.locked}
                onChange$={handleCheckboxChange$}
                aria-labelledby={labelId}
                ref={checkboxRef}
            />
            <label class={styles.label} id={labelId}>{props.definition.label}:</label>
            {props.checked && props.pendingForm && (
                <RowBody
                    definition={props.definition}
                    pendingForm={props.pendingForm}
                    autoFocus={!!props.autoFocus}
                    rootRef={rootRef}
                    onValueChange$={props.onValueChange$}
                />
            )}
        </div>
    );
});

type RowBodyProps = {
    definition: FieldDefinition;
    pendingForm: PendingForm;
    autoFocus: boolean;
    rootRef: Signal<HTMLElement | undefined>;
    onValueChange$: QRL<(formId: string, value: DataFieldValue | null) => void>;
};

const RowBody = component$<RowBodyProps>((props) => {
    const formId = props.pendingForm.id;
    const onChange$ = $((value: DataFieldValue | null) => {
        return props.onValueChange$(formId, value);
    });
    const autoFocus = props.autoFocus;

    switch (props.definition.componentType) {
        case 'text-kv':
            return (
                <TextKvField
                    id={props.pendingForm.id}
                    fieldName={props.definition.label}
                    fieldDefinitionId={props.definition.id}
                    value={(props.pendingForm.value as string | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: string | null) => void>, autoFocus }}
                />
            );
        case 'enum-kv':
            return (
                <EnumKvField
                    id={props.pendingForm.id}
                    fieldName={props.definition.label}
                    fieldDefinitionId={props.definition.id}
                    value={(props.pendingForm.value as string | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: string | null) => void>, autoFocus }}
                />
            );
        case 'measurement-kv':
            return (
                <MeasurementKvField
                    id={props.pendingForm.id}
                    fieldName={props.definition.label}
                    fieldDefinitionId={props.definition.id}
                    value={(props.pendingForm.value as number | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: number | null) => void>, autoFocus }}
                />
            );
        case 'single-image':
            return (
                <SingleImageField
                    id={props.pendingForm.id}
                    fieldName={props.definition.label}
                    value={(props.pendingForm.value as SingleImageValue | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: SingleImageValue | null) => void>, autoFocus }}
                />
            );
    }
});
