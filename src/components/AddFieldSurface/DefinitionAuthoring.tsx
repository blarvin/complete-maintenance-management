/**
 * DefinitionAuthoring — coining a FieldDefinition, as rows in the picker's tree.
 *
 * `+ New Field Definition` expands into one row per admitted kind; expanding a
 * kind row reveals its name, its config (`ConfigRows`), and a Create row. The
 * kind choice **is which row you expand** — there is no picker control, because
 * the tree already is one.
 *
 * **The app's one other exception to Minting Records Identity** (SPEC): unlike a
 * Node or a DataField, a Definition must be coherent at birth — a `number-kv`
 * with no units, an `enum-kv` with no options — so a kind row holds an ephemeral
 * draft until Create. Collapsing the row unmounts the draft and writes nothing.
 *
 * **One draft per kind row**, which is why `useDefinitionDraft` is called inside
 * `KindRow` rather than once above: expanding Number and then Text must not
 * carry units across, and unmount-on-collapse gives that for free.
 */

import { For, Show, createEffect, createSignal } from 'solid-js';
import { useDefinitionDraft } from '../../hooks/useDefinitionDraft';
import { getKindManifest, FIELD_KINDS } from '../../kinds/registry';
import { CONFIG_VALIDATORS } from '../../kinds/configSchema';
import { ConfigRows } from '../ConfigRows/ConfigRows';
import type { Definition, DefinitionConfig, Kind } from '../../data/models';
import chevron from '../../styles/disclosure.module.css';
import styles from './AddFieldSurface.module.css';

export type DefinitionAuthoringProps = {
    /** Field kinds this node admits — the same entailment that filters the picker. */
    admittedKinds: Kind[];
    /** Receives the committed Definition so the caller can mint an instance from it. */
    onCreated: (definition: Definition) => void;
};

const KindRow = (props: { kind: Kind; onCreated: (d: Definition) => void }) => {
    const [open, setOpen] = createSignal(false);
    const draft = useDefinitionDraft();
    let nameInputEl: HTMLInputElement | undefined;

    // A Definition cannot exist without a name, so expanding a kind puts the
    // cursor where the only required act is. Explicit rather than `autofocus`:
    // that attribute is processed per document and is unreliable for a node
    // inserted later. Same pattern as the lens create row.
    createEffect(() => {
        if (open()) nameInputEl?.focus();
    });

    // The hook starts on its own default kind; this row *is* a kind, so say so
    // once. `pickKind` batches kind+config, so the config below never sees the
    // previous kind's shape.
    // eslint-disable-next-line solid/reactivity -- mount-time constant: <For> keys each row *by* its kind, so a row's kind cannot change under it
    draft.pickKind(props.kind);

    const label = () => getKindManifest(props.kind).pickerLabel;

    /** Create is gated on the same rules the rows enforce while typing, so the
     *  button never promises a commit the validator would reject. */
    const blocker = (): string | null => {
        if (!draft.label().trim()) return 'Needs a name';
        return draft.configError() ?? CONFIG_VALIDATORS[props.kind]?.(draft.config()) ?? null;
    };

    const create = async () => {
        const def = await draft.save();
        if (def) {
            setOpen(false);
            props.onCreated(def);
        }
    };

    const toggle = () => setOpen(!open());

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        } else if (e.key === 'ArrowRight' && !open()) {
            e.preventDefault();
            setOpen(true);
        } else if (e.key === 'ArrowLeft' && open()) {
            e.preventDefault();
            setOpen(false);
        }
    };

    return (
        <div class={styles.row}>
            <div
                class={styles.rowHead}
                role="treeitem"
                aria-expanded={open()}
                aria-label={label()}
                tabIndex={-1}
                onKeyDown={onKeyDown}
            >
                <span
                    classList={{
                        [chevron.chevron]: true,
                        [chevron.chevronDown]: open(),
                        [chevron.chevronRight]: !open(),
                    }}
                    aria-hidden="true"
                    onClick={toggle}
                />
                <span class={styles.rowName} onClick={toggle}>{label()}</span>
            </div>

            <Show when={open()}>
                <div class={styles.authoringBody} role="group">
                    {/* Naming is the act, not a knob — so unlike a config row it
                        is an input at rest rather than something to activate.
                        Same reasoning as the lens create row. */}
                    <div class={styles.authoringNameRow}>
                        <span class={chevron.chevronSpacer} aria-hidden="true" />
                        <input
                            ref={(el) => (nameInputEl = el)}
                            class={styles.authoringNameInput}
                            type="text"
                            value={draft.label()}
                            maxLength={50}
                            placeholder={`${label()} field name`}
                            aria-label="Definition name"
                            onInput={(e) => draft.setLabel(e.currentTarget.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>

                    <ConfigRows
                        kind={props.kind}
                        config={draft.config()}
                        onChange={(cfg: DefinitionConfig, error?: string | null) => {
                            draft.setConfig(cfg);
                            draft.setConfigError(error ?? null);
                        }}
                    />

                    <Show when={blocker() && draft.label().trim()}>
                        <div class={styles.authoringError} role="alert">{blocker()}</div>
                    </Show>

                    <div class={styles.authoringNameRow}>
                        <span class={chevron.chevronSpacer} aria-hidden="true" />
                        <button
                            type="button"
                            class={styles.authoringCreate}
                            disabled={!!blocker()}
                            onClick={() => void create()}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            Create {label()} Definition
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export const DefinitionAuthoring = (props: DefinitionAuthoringProps) => {
    const [open, setOpen] = createSignal(false);

    /** A node cannot coin a Definition of a kind it would refuse as a child. */
    const kindChoices = () => FIELD_KINDS.filter((k) => props.admittedKinds.includes(k));

    const toggle = () => setOpen(!open());

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        } else if (e.key === 'ArrowRight' && !open()) {
            e.preventDefault();
            setOpen(true);
        } else if (e.key === 'ArrowLeft' && open()) {
            e.preventDefault();
            setOpen(false);
        }
    };

    return (
        <div class={styles.row}>
            <div
                class={styles.rowHead}
                role="treeitem"
                aria-expanded={open()}
                aria-label="New Field Definition"
                tabIndex={-1}
                onKeyDown={onKeyDown}
            >
                <span
                    classList={{
                        [chevron.chevron]: true,
                        [chevron.chevronDown]: open(),
                        [chevron.chevronRight]: !open(),
                    }}
                    aria-hidden="true"
                    onClick={toggle}
                />
                <span class={styles.rowName} onClick={toggle}>+ New Field Definition</span>
            </div>
            <Show when={open()}>
                <div class={styles.nested} role="group">
                    <For each={kindChoices()}>
                        {(k) => <KindRow kind={k} onCreated={props.onCreated} />}
                    </For>
                </div>
            </Show>
        </div>
    );
};
