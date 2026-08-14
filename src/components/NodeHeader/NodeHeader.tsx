/**
 * NodeHeader - The visual card container for node header content.
 *
 * Contains the clickable header area with title, subtitle, navigation buttons,
 * and expand/collapse chevron. Handles keyboard events for accessibility.
 *
 */

import { Show } from 'solid-js';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { KindAdornment } from '../TreeNode/KindAdornment';
import { UpButton } from '../UpButton/UpButton';
import { EllipsisButton } from '../EllipsisButton/EllipsisButton';
import styles from '../TreeNode/TreeNode.module.css';

export type NodeHeaderProps = {
    id: string;
    titleId: string;
    isExpanded?: boolean;
    isDetailsExpanded?: boolean;
    isParent?: boolean;
    isClickable?: boolean;
    name: string;
    subtitle: string;
    parentId?: string | null;
    onNodeClick?: () => void;
    onNavigateUp?: (parentId: string | null) => void;
    onExpand?: (e?: Event) => void;
    onDetailsToggle?: () => void;
    /** When true, renders input fields instead of NodeTitle/NodeSubtitle (construction mode) */
    isConstruction?: boolean;
    /** For construction mode: name input ref callback */
    nameInputRef?: (el: HTMLInputElement) => void;
    /** For construction mode: subtitle input ref callback */
    subtitleInputRef?: (el: HTMLInputElement) => void;
    /** For construction mode: keydown handler */
    onKeyDown?: (e: KeyboardEvent) => void;
    /** For construction mode: name input handler (drives Create-button validity) */
    onNameInput?: (e: Event) => void;
    /** For construction mode: disable chevron button */
    chevronDisabled?: boolean;
    /** Whether to render the expand/collapse chevron. Default true; false for
     *  content-free kinds (no children/DataCard — e.g. the `jobs` lens, #5). */
    showChevron?: boolean;
};

export const NodeHeader = (props: NodeHeaderProps) => {
    const handleBodyKeyDown = (e: KeyboardEvent) => {
        if (props.onNodeClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            props.onNodeClick();
        }
    };

    const handleExpandKeyDown = (e: KeyboardEvent) => {
        if (props.onExpand && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            props.onExpand();
        }
    };

    return (
        <article
            classList={{
                [styles.nodeHeader]: true,
                [styles.nodeHeaderExpanded]: !!props.isExpanded,
                [styles.nodeHeaderParent]: !!props.isParent,
            }}
            aria-labelledby={props.titleId}
            data-node-id={props.id}
        >
            <div
                classList={{
                    [styles.nodeHeaderContent]: true,
                    [styles.nodeHeaderContentClickable]: !!props.isClickable,
                    'no-caret': !!props.isClickable,
                }}
                onClick={() => props.onNodeClick?.()}
                onKeyDown={handleBodyKeyDown}
                role={props.isClickable ? 'button' : undefined}
                tabIndex={props.isClickable ? 0 : undefined}
                aria-label={props.isClickable ? `Open ${props.name || 'node'}` : undefined}
            >
                <Show when={props.isParent && props.onNavigateUp}>
                    <div class={styles.upButtonWrapper}>
                        <UpButton
                            parentId={props.parentId ?? null}
                            onNavigate={props.onNavigateUp!}
                        />
                    </div>
                </Show>
                <div>
                    <Show
                        when={props.isConstruction}
                        fallback={
                            <>
                                <NodeTitle name={props.name} id={props.titleId} />
                                <NodeSubtitle subtitle={props.subtitle} />
                                {/* Manifest-driven meta in the subtitle slot: org count / jobs rollup (#6b). */}
                                <KindAdornment id={props.id} isParent={!!props.isParent} />
                            </>
                        }
                    >
                        <input
                            class={styles.nodeTitle}
                            ref={props.nameInputRef}
                            placeholder="Name"
                            onKeyDown={(e) => props.onKeyDown?.(e)}
                            onInput={(e) => props.onNameInput?.(e)}
                            aria-label="Node name"
                            id={props.titleId}
                        />
                        <input
                            class={styles.nodeSubtitle}
                            ref={props.subtitleInputRef}
                            placeholder="Subtitle / Location / Short description"
                            onKeyDown={(e) => props.onKeyDown?.(e)}
                            aria-label="Node subtitle"
                        />
                    </Show>
                </div>
                <div class={styles.nodeButtons}>
                    <EllipsisButton
                        onDoubleTap={props.onDetailsToggle}
                        isExpanded={props.isDetailsExpanded}
                    />
                    <Show when={props.showChevron !== false}>
                        <button
                            type="button"
                            class={styles.nodeChevron}
                            onClick={(e) => props.onExpand?.(e)}
                            onKeyDown={handleExpandKeyDown}
                            aria-expanded={props.isExpanded}
                            aria-label={props.isExpanded ? 'Collapse details' : 'Expand details'}
                            disabled={props.chevronDisabled}
                        >
                            {props.isExpanded ? '▾' : '◂'}
                        </button>
                    </Show>
                </div>
            </div>
        </article>
    );
};
