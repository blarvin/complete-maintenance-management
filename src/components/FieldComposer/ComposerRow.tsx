/**
 * ComposerRow - One Template within the FieldComposer.
 *
 * Unchecked: checkbox + label, whole row toggles. Checked: checkbox + label +
 * the Component renderer in pendingMode so the user can fill in a value before
 * Save commits the batch. Locked rows render the same as checked but the
 * checkbox is disabled (construction-mode defaults).
 */

import { component$, useSignal, $, type QRL, type Signal } from '@builder.io/qwik';
import { TextKvField } from '../DataField/TextKvField';
import { EnumKvField } from '../DataField/EnumKvField';
import { MeasurementKvField } from '../DataField/MeasurementKvField';
import { SingleImageField } from '../DataField/SingleImageField';
import type { DataFieldTemplate, DataFieldValue, SingleImageValue } from '../../data/models';
import type { PendingForm } from '../../hooks/usePendingForms';
import styles from './ComposerRow.module.css';

export type ComposerRowProps = {
    template: DataFieldTemplate;
    checked: boolean;
    locked?: boolean;
    pendingForm?: PendingForm;
    onToggle$: QRL<(template: DataFieldTemplate) => void>;
    onValueChange$: QRL<(formId: string, value: DataFieldValue | null) => void>;
};

export const ComposerRow = component$<ComposerRowProps>((props) => {
    const rootRef = useSignal<HTMLElement>();

    const handleCheckboxChange$ = $(() => {
        if (props.locked) return;
        props.onToggle$(props.template);
    });

    const labelId = `composer-label-${props.template.id}`;

    return (
        <div class={styles.row} ref={rootRef}>
            <input
                type="checkbox"
                class={styles.checkbox}
                checked={props.checked}
                disabled={props.locked}
                onChange$={handleCheckboxChange$}
                aria-labelledby={labelId}
            />
            <label class={styles.label} id={labelId}>{props.template.label}:</label>
            {props.checked && props.pendingForm && (
                <RowBody
                    template={props.template}
                    pendingForm={props.pendingForm}
                    rootRef={rootRef}
                    onValueChange$={props.onValueChange$}
                />
            )}
        </div>
    );
});

type RowBodyProps = {
    template: DataFieldTemplate;
    pendingForm: PendingForm;
    rootRef: Signal<HTMLElement | undefined>;
    onValueChange$: QRL<(formId: string, value: DataFieldValue | null) => void>;
};

const RowBody = component$<RowBodyProps>((props) => {
    const formId = props.pendingForm.id;
    const onChange$ = $((value: DataFieldValue | null) => {
        return props.onValueChange$(formId, value);
    });

    switch (props.template.componentType) {
        case 'text-kv':
            return (
                <TextKvField
                    id={props.pendingForm.id}
                    fieldName={props.template.label}
                    value={(props.pendingForm.value as string | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: string | null) => void> }}
                />
            );
        case 'enum-kv':
            return (
                <EnumKvField
                    id={props.pendingForm.id}
                    fieldName={props.template.label}
                    templateId={props.template.id}
                    value={(props.pendingForm.value as string | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: string | null) => void> }}
                />
            );
        case 'measurement-kv':
            return (
                <MeasurementKvField
                    id={props.pendingForm.id}
                    fieldName={props.template.label}
                    templateId={props.template.id}
                    value={(props.pendingForm.value as number | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: number | null) => void> }}
                />
            );
        case 'single-image':
            return (
                <SingleImageField
                    id={props.pendingForm.id}
                    fieldName={props.template.label}
                    value={(props.pendingForm.value as SingleImageValue | null) ?? null}
                    rootRef={props.rootRef}
                    pendingMode={{ onChange$: onChange$ as QRL<(value: SingleImageValue | null) => void> }}
                />
            );
    }
});
