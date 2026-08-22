import { For, Show, createSignal } from 'solid-js';
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
    onClick?: (kind: Kind) => void;
    /**
     * Offered but not yet usable — storage is still initializing, so there is no
     * command bus for the Create this opens to reach. Shown disabled rather than
     * withheld: the affordance is where the reader expects it and arrives a beat
     * later, where a button that pops into existence reads as a glitch.
     */
    disabled?: boolean;
};

export const CreateNodeButton = (props: CreateNodeButtonProps) => {
    // eslint-disable-next-line solid/reactivity -- seeds once and never reseeds on prop change, matching the pre-migration useSignal(initial) semantics
    const [selectedKind, setSelectedKind] = createSignal<Kind>(props.availableKinds[0] ?? 'node');

    const handleClick = () => {
        if (props.disabled) return;
        props.onClick?.(selectedKind());
    };

    // Picker over the parent's admitted re-root kinds. Shown only when there's a
    // real choice; otherwise the lone kind is implied by the button.
    const picker = () => (
        <Show when={props.availableKinds.length > 1}>
            <select
                class={styles.kindPicker}
                value={selectedKind()}
                onChange={(e) => setSelectedKind(e.currentTarget.value as Kind)}
                aria-label="Kind of asset to create"
            >
                <For each={props.availableKinds}>
                    {(k) => <option value={k}>{getKindManifest(k).pickerLabel}</option>}
                </For>
            </select>
        </Show>
    );

    // A content-free lens admits nothing — offer no create surface at all.
    return (
        <Show when={props.availableKinds.length > 0}>
            <Show when={props.variant === 'root'}>
                <div class={styles.createRow}>
                    {picker()}
                    <button
                        type="button"
                        classList={{ [styles.createNode]: true, 'no-caret': true }}
                        onClick={handleClick}
                        disabled={props.disabled}
                        aria-label="Create New Asset"
                    >
                        Create New Asset
                    </button>
                </div>
            </Show>

            <Show when={props.variant === 'child'}>
                <div class={styles.createRow}>
                    {picker()}
                    <button
                        type="button"
                        classList={{
                            [styles.createNode]: true,
                            [styles.createNodeChild]: true,
                            'no-caret': true,
                        }}
                        onClick={handleClick}
                        disabled={props.disabled}
                        aria-label="Add Sub-Asset"
                    >
                        + Add Sub-Asset
                    </button>
                </div>
            </Show>
        </Show>
    );
};
