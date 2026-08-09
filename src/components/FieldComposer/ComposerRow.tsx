/**
 * ComposerRow - One Definition within the FieldComposer.
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

import { Show, createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { getInlineManifest } from '../../kinds/registry';
import type { Definition, DataFieldValue } from '../../data/models';
import type { PendingForm } from '../../hooks/usePendingForms';
import styles from './ComposerRow.module.css';

export type ComposerRowProps = {
    definition: Definition;
    checked: boolean;
    locked?: boolean;
    pendingForm?: PendingForm;
    /** True only for the row the user JUST ticked — drives auto-focus / pick-list
     *  open. Seeded rows (construction defaults, restored Undo) are false so the
     *  composer opens with no field stealing focus. */
    autoFocus?: boolean;
    onToggle: (definition: Definition) => void;
    onValueChange: (formId: string, value: DataFieldValue | null) => void;
};

export const ComposerRow = (props: ComposerRowProps) => {
    // The row element is a signal (not a plain ref) — renderers read it for
    // outside-click containment covering the whole row.
    const [rootEl, setRootEl] = createSignal<HTMLElement>();
    let checkboxEl: HTMLInputElement | undefined;

    const handleCheckboxChange = () => {
        if (props.locked) return;
        props.onToggle(props.definition);
    };

    // Anchor the checkbox after a toggle so a tall preview (e.g. single-image)
    // doesn't shove the user's place off-screen. Wait one frame past the
    // ~200ms animation budget so layout has settled before scrolling.
    createEffect(() => {
        void props.checked;
        const t = setTimeout(() => {
            checkboxEl?.scrollIntoView({ block: 'nearest' });
        }, 220);
        onCleanup(() => clearTimeout(t));
    });

    const labelId = () => `composer-label-${props.definition.id}`;

    return (
        <div class={styles.row} ref={setRootEl}>
            <input
                type="checkbox"
                classList={{ [styles.checkbox]: true, [styles.checkboxLocked]: !!props.locked }}
                checked={props.checked}
                title={props.locked ? 'Required' : undefined}
                aria-disabled={props.locked ? 'true' : undefined}
                tabIndex={props.locked ? -1 : undefined}
                onChange={handleCheckboxChange}
                aria-labelledby={labelId()}
                ref={checkboxEl}
            />
            <label class={styles.label} id={labelId()}>{props.definition.label}:</label>
            <Show when={props.checked && props.pendingForm}>
                <RowBody
                    definition={props.definition}
                    pendingForm={props.pendingForm!}
                    autoFocus={!!props.autoFocus}
                    rootRef={rootEl}
                    onValueChange={props.onValueChange}
                />
            </Show>
            {/* Auto-flows into the column after the value (the spacer column). */}
            <Show when={props.locked}>
                <span class={styles.requiredTag}>(required)</span>
            </Show>
        </div>
    );
};

type RowBodyProps = {
    definition: Definition;
    pendingForm: PendingForm;
    autoFocus: boolean;
    rootRef: Accessor<HTMLElement | undefined>;
    onValueChange: (formId: string, value: DataFieldValue | null) => void;
};

const RowBody = (props: RowBodyProps) => {
    /* eslint-disable-next-line solid/reactivity -- mount-time captures; rows remount per definitions refetch */
    const formId = props.pendingForm.id;
    const onChange = (value: DataFieldValue | null) => props.onValueChange(formId, value);

    return (
        <Dynamic
            component={getInlineManifest(props.definition.kind).Renderer}
            id={props.pendingForm.id}
            definitionId={props.definition.id}
            value={props.pendingForm.value ?? null}
            rootRef={props.rootRef}
            pendingMode={{ onChange, autoFocus: props.autoFocus }}
        />
    );
};
