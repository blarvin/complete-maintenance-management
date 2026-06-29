import { component$, $, useSignal, type PropFunction } from '@builder.io/qwik';
import { getKindManifest } from '../../kinds/registry';
import type { Kind } from '../../data/models';
import styles from './CreateNodeButton.module.css';

export type CreateNodeButtonProps = {
    variant: 'root' | 'child';
    /**
     * The re-root kinds this create surface may mint — the parent's admitted
     * kinds (`reRootCreateKindsFor`) at a branch, the full universe at root.
     * Empty → render nothing (a content-free lens offers no "Add").
     */
    availableKinds: Kind[];
    /** Receives the kind chosen in the picker (re-root kinds; defaults to the first available). */
    onClick$?: PropFunction<(kind: Kind) => void>;
};

export const CreateNodeButton = component$((props: CreateNodeButtonProps) => {
    // useSignal before any early return (Qwik hooks must run unconditionally).
    const selectedKind = useSignal<Kind>(props.availableKinds[0] ?? 'node');

    const handleClick$ = $(async () => {
        if (props.onClick$) await props.onClick$(selectedKind.value);
    });

    // A content-free lens admits nothing — offer no create surface at all.
    if (props.availableKinds.length === 0) return null;

    // Picker over the parent's admitted re-root kinds. Shown only when there's a
    // real choice; otherwise the lone kind is implied by the button.
    const picker =
        props.availableKinds.length > 1 ? (
            <select
                class={styles.kindPicker}
                value={selectedKind.value}
                onChange$={$((_, el) => {
                    selectedKind.value = el.value as Kind;
                })}
                aria-label="Kind of asset to create"
            >
                {props.availableKinds.map((k) => (
                    <option key={k} value={k}>
                        {getKindManifest(k).pickerLabel}
                    </option>
                ))}
            </select>
        ) : null;

    if (props.variant === 'root') {
        return (
            <div class={styles.createRow}>
                {picker}
                <button
                    type="button"
                    class={[styles.createNode, 'no-caret']}
                    onClick$={handleClick$}
                    aria-label="Create New Asset"
                >
                    Create New Asset
                </button>
            </div>
        );
    }

    if (props.variant === 'child') {
        return (
            <div class={styles.createRow}>
                {picker}
                <button
                    type="button"
                    class={[styles.createNode, styles.createNodeChild, 'no-caret']}
                    onClick$={handleClick$}
                    aria-label="Add Sub-Asset"
                >
                    + Add Sub-Asset
                </button>
            </div>
        );
    }

    return null;
});
