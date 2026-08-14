/**
 * LibraryPicker — the `library` tree rendered for picking (SPEC → The Add
 * Surface → The LibraryPicker).
 *
 * One row per active FieldDefinition, sorted by label. A row's chevron expands
 * it in place to peek at that Definition's config; a row's name picks it,
 * minting the field and leaving the picker open. The peek is the disambiguation
 * affordance — label uniqueness is not enforced, so config is what tells two
 * same-named Definitions apart.
 *
 * Tree ARIA rather than listbox, because the rows expand and `treeitem` is the
 * role that carries `aria-expanded` honestly. Focus roves: the *row* is the tab
 * stop and owns the keys, while the chevron and name stay clickable but out of
 * the tab order — so Tab doesn't walk two controls per Definition.
 */

import { For, Show, createEffect, createResource, createSignal, type Accessor } from 'solid-js';
import { getDefinitionQueries } from '../../data/queries';
import { ConfigSummary } from '../ConfigSummary/ConfigSummary';
import { isInline } from '../../kinds/placement';
import type { Definition, Kind } from '../../data/models';
import styles from './AddFieldSurface.module.css';

export type LibraryPickerProps = {
    /** Field kinds this node admits — `allowedChildKinds ∩ FIELD_KINDS`, from FieldList. */
    admittedKinds: Kind[];
    onPick: (definition: Definition) => void;
};

/** Sentinel for a failed fetch — `createResource` has no rejected branch, so the
 *  fetcher catches and the render distinguishes failure from an empty Library. */
const FAILED = Symbol('failed');

type DefinitionRowProps = {
    definition: Definition;
    index: Accessor<number>;
    activeIndex: Accessor<number>;
    onPick: (d: Definition) => void;
    onMove: (delta: number) => void;
    onActivate: (index: number) => void;
};

const DefinitionRow = (props: DefinitionRowProps) => {
    const [expanded, setExpanded] = createSignal(false);
    const isActive = () => props.activeIndex() === props.index();

    const onKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                props.onMove(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                props.onMove(-1);
                break;
            case 'ArrowRight':
                if (!expanded()) {
                    e.preventDefault();
                    setExpanded(true);
                }
                break;
            case 'ArrowLeft':
                if (expanded()) {
                    e.preventDefault();
                    setExpanded(false);
                }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                props.onPick(props.definition);
                break;
        }
    };

    return (
        <div
            class={styles.row}
            role="treeitem"
            aria-expanded={expanded()}
            aria-label={props.definition.label}
            // Roving tabindex: exactly one row is a tab stop, so Tab enters and
            // leaves the tree once rather than walking every Definition.
            tabIndex={isActive() ? 0 : -1}
            onKeyDown={onKeyDown}
            onFocus={() => props.onActivate(props.index())}
        >
            <div class={styles.rowHead}>
                <button
                    type="button"
                    tabIndex={-1}
                    classList={{
                        [styles.chevron]: true,
                        [styles.chevronDown]: expanded(),
                        [styles.chevronRight]: !expanded(),
                    }}
                    onClick={() => setExpanded(!expanded())}
                    aria-hidden="true"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    class={styles.rowName}
                    onClick={() => props.onPick(props.definition)}
                >
                    {props.definition.label}
                </button>
            </div>
            <Show when={expanded()}>
                <div class={styles.peek}>
                    <ConfigSummary definitionId={props.definition.id} />
                </div>
            </Show>
        </div>
    );
};

export const LibraryPicker = (props: LibraryPickerProps) => {
    const [definitions] = createResource<Definition[] | typeof FAILED>(async () => {
        try {
            return await getDefinitionQueries().listDefinitions();
        } catch {
            return FAILED;
        }
    });

    const [activeIndex, setActiveIndex] = createSignal(0);
    let containerEl: HTMLDivElement | undefined;

    const failed = () => definitions() === FAILED;

    /** Field-instantiable Definitions this node admits. `isInline` drops the
     *  re-root policy Definitions (logbook) that share the library tree; the
     *  admitted-kinds filter is the entailment (SPEC → The Add Surface). */
    const rows = (): Definition[] => {
        const list = definitions();
        if (!list || list === FAILED) return [];
        return list
            .filter((d) => isInline(d.kind) && props.admittedKinds.includes(d.kind))
            .sort((a, b) => a.label.localeCompare(b.label));
    };

    /** Read the rendered rows from the DOM rather than tracking an array of refs:
     *  `<For>` recycles nodes, so a ref array needs invalidation the query doesn't. */
    const rowEls = (): HTMLElement[] =>
        containerEl ? Array.from(containerEl.querySelectorAll<HTMLElement>('[role="treeitem"]')) : [];

    const move = (delta: number) => {
        const els = rowEls();
        if (els.length === 0) return;
        const next = Math.max(0, Math.min(els.length - 1, activeIndex() + delta));
        setActiveIndex(next);
        els[next]?.focus();
    };

    // Move focus into the tree once the rows arrive. The user opened this
    // deliberately, and without it a keyboard user would have to Tab past the
    // trigger to reach what they just opened.
    let hasFocused = false;
    createEffect(() => {
        if (hasFocused || rows().length === 0) return;
        hasFocused = true;
        rowEls()[0]?.focus();
    });

    return (
        <div ref={containerEl} class={styles.picker} role="tree" aria-label="Field definitions">
            <Show when={!definitions.loading} fallback={<div class={styles.notice}>Loading…</div>}>
                <Show when={!failed()} fallback={<div class={styles.notice}>Could not load the Library</div>}>
                    <Show
                        when={rows().length > 0}
                        fallback={<div class={styles.notice}>No field definitions available</div>}
                    >
                        <For each={rows()}>
                            {(def, i) => (
                                <DefinitionRow
                                    definition={def}
                                    index={i}
                                    activeIndex={activeIndex}
                                    onPick={props.onPick}
                                    onMove={move}
                                    onActivate={setActiveIndex}
                                />
                            )}
                        </For>
                    </Show>
                </Show>
            </Show>
        </div>
    );
};
