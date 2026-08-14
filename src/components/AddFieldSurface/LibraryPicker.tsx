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

import { For, Show, createEffect, createResource, createSignal } from 'solid-js';
import { getDefinitionQueries } from '../../data/queries';
import { ConfigSummary } from '../ConfigSummary/ConfigSummary';
import { DefinitionAuthoring } from './DefinitionAuthoring';
import { isInline } from '../../kinds/placement';
import type { Definition, Kind } from '../../data/models';
import chevron from '../../styles/disclosure.module.css';
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
    onPick: (d: Definition) => void;
};

const DefinitionRow = (props: DefinitionRowProps) => {
    const [expanded, setExpanded] = createSignal(false);

    // Up/Down are deliberately not handled here — they bubble to the tree, which
    // moves focus by DOM order. A row only knows how to open and close itself.
    const onKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
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
                e.stopPropagation();
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
            // Static -1: the tree hands exactly one row a 0 imperatively, so Tab
            // enters and leaves once. Static because Solid then never rewrites
            // the attribute out from under that.
            tabIndex={-1}
            onKeyDown={onKeyDown}
        >
            <div class={styles.rowHead}>
                <button
                    type="button"
                    tabIndex={-1}
                    classList={{
                        [chevron.chevron]: true,
                        [chevron.chevronDown]: expanded(),
                        [chevron.chevronRight]: !expanded(),
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

    /**
     * Every visible row, in document order — which for a tree *is* visual order,
     * and collapsed subtrees aren't in the DOM at all, so this needs no notion
     * of depth. Read from the DOM rather than tracked: `<For>` recycles nodes,
     * and rows now arrive from three different components at arbitrary nesting.
     */
    const rowEls = (): HTMLElement[] =>
        containerEl ? Array.from(containerEl.querySelectorAll<HTMLElement>('[role="treeitem"]')) : [];

    /**
     * Roving tabindex, managed imperatively over the live DOM.
     *
     * The Phase I version compared a stored `activeIndex` against each row's
     * `<For>` index, which silently desynced the moment any row that wasn't a
     * Definition joined the tree. Deriving position from the node itself has no
     * such failure mode and survives arbitrary depth.
     */
    const focusRow = (els: HTMLElement[], i: number) => {
        els.forEach((el, n) => { el.tabIndex = n === i ? 0 : -1; });
        els[i]?.focus();
    };

    const onTreeKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const els = rowEls();
        const current = els.indexOf(document.activeElement as HTMLElement);
        if (current === -1) return; // focus is inside an open editor — leave it be
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        focusRow(els, Math.max(0, Math.min(els.length - 1, current + delta)));
    };

    // Move focus into the tree once the rows arrive. The user opened this
    // deliberately, and without it a keyboard user would have to Tab past the
    // trigger to reach what they just opened.
    let hasFocused = false;
    createEffect(() => {
        if (hasFocused || rows().length === 0) return;
        hasFocused = true;
        focusRow(rowEls(), 0);
    });

    return (
        <div
            ref={containerEl}
            class={styles.picker}
            role="tree"
            aria-label="Field definitions"
            onKeyDown={onTreeKeyDown}
        >
            {/* Authoring leads the list: it is what you reach for after failing
                to find what you wanted, and a fixed home beats a position that
                moves as the Library grows. */}
            <DefinitionAuthoring
                admittedKinds={props.admittedKinds}
                onCreated={props.onPick}
            />

            <Show when={!definitions.loading} fallback={<div class={styles.notice}>Loading…</div>}>
                <Show when={!failed()} fallback={<div class={styles.notice}>Could not load the Library</div>}>
                    <Show
                        when={rows().length > 0}
                        fallback={<div class={styles.notice}>Nothing in the Library yet — start one above</div>}
                    >
                        <For each={rows()}>
                            {(def) => <DefinitionRow definition={def} onPick={props.onPick} />}
                        </For>
                    </Show>
                </Show>
            </Show>
        </div>
    );
};
