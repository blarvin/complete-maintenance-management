/**
 * LensCreate — the inline, name-only create affordance for a lens's target kind
 * (#5 container half). Collapsed it's a quiet `LensCreateButton` naming the owning
 * node; clicked it's a focused, field-skinned name input that mints the target
 * (e.g. a `job`) under the **owning node** on Enter — a job has only a name at
 * mint, so this is lighter than the global node-construction flow.
 *
 * The lens is a pure view over jobs it does NOT own, so the new job parents to the
 * owner, never to the lens, and re-appears via the gather. Shared by both lens
 * surfaces: the compact in-card rollup (`LensRollup`) and the re-rooted parent
 * view (`BranchView`).
 */

import { Show, createEffect, createSignal } from 'solid-js';
import { getKindManifest } from '../../kinds/registry';
import { getCommandBus } from '../../data/commands';
import { useElementById } from '../../hooks/useElementChildren';
import { LensCreateButton } from '../LensCreateButton/LensCreateButton';
import type { Kind } from '../../data/models';
import styles from './LensCreate.module.css';

export type LensCreateProps = {
    ownerId: string;
    targetKind: Kind;
    /** The bound policy Definition's entry word (e.g. "Entry"); falls back to
     *  the target kind's pickerLabel when the lens carries no policy. */
    entryLabel?: string;
};

export const LensCreate = (props: LensCreateProps) => {
    const { element: ownerEl } = useElementById(() => props.ownerId);

    const [creating, setCreating] = createSignal(false);
    let inputEl: HTMLInputElement | undefined;

    // The input mounts synchronously on the signal flip, so no delay is needed.
    createEffect(() => {
        if (creating()) inputEl?.focus();
    });

    const startCreate = () => setCreating(true);

    const commit = async () => {
        const name = inputEl?.value.trim() ?? '';
        if (inputEl) inputEl.value = '';
        setCreating(false);
        if (!name || !props.ownerId) return; // empty Enter/blur just closes
        await getCommandBus().execute({
            type: 'CREATE_ELEMENT',
            payload: { kind: props.targetKind, parentId: props.ownerId, name },
        });
    };

    const cancel = () => {
        if (inputEl) inputEl.value = '';
        setCreating(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    const entryLabel = () => props.entryLabel || getKindManifest(props.targetKind).pickerLabel;

    return (
        <Show
            when={creating()}
            fallback={
                <LensCreateButton
                    label={`Create New ${entryLabel()} on ${ownerEl()?.name ?? 'this asset'}`}
                    onClick={startCreate}
                />
            }
        >
            <div class={styles.createRow}>
                <span classList={{ [styles.chevron]: true, [styles.chevronRight]: true }} aria-hidden="true" />
                <input
                    ref={inputEl}
                    class={styles.nameInput}
                    type="text"
                    placeholder={`${entryLabel()} name`}
                    onKeyDown={onKeyDown}
                    onBlur={commit}
                    aria-label={`New ${entryLabel()} name`}
                />
            </div>
        </Show>
    );
};
