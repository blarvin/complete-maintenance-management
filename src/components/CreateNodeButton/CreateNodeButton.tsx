import { component$, $, useSignal, type PropFunction } from '@builder.io/qwik';
import { RE_ROOT_CREATE_KINDS, getKindManifest } from '../../kinds/registry';
import type { Kind } from '../../data/models';
import styles from './CreateNodeButton.module.css';

export type CreateNodeButtonProps = {
    variant: 'root' | 'child';
    /** Receives the kind chosen in the picker (re-root kinds; defaults to `node`). */
    onClick$?: PropFunction<(kind: Kind) => void>;
};

export const CreateNodeButton = component$((props: CreateNodeButtonProps) => {
    const selectedKind = useSignal<Kind>('node');

    const handleClick$ = $(async () => {
        if (props.onClick$) await props.onClick$(selectedKind.value);
    });

    // Picker over the re-root, node-create kinds (reads the registry — itself a
    // consumer of the manifest seam). Shown only when there's a real choice.
    const picker =
        RE_ROOT_CREATE_KINDS.length > 1 ? (
            <select
                class={styles.kindPicker}
                value={selectedKind.value}
                onChange$={$((_, el) => {
                    selectedKind.value = el.value as Kind;
                })}
                aria-label="Kind of asset to create"
            >
                {RE_ROOT_CREATE_KINDS.map((k) => (
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
