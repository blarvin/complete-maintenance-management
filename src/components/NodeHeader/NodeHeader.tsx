/**
 * NodeHeader - The visual card container for node header content.
 * 
 * Contains the clickable header area with title, subtitle, navigation buttons,
 * and expand/collapse chevron. Handles keyboard events for accessibility.
 */

import { component$, $, PropFunction } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
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
    nodeName: string;
    nodeSubtitle: string;
    parentId?: string | null;
    onNodeClick$?: PropFunction<() => void>;
    onNavigateUp$?: PropFunction<(parentId: string | null) => void>;
    onExpand$?: PropFunction<(e?: Event) => void>;
    onDetailsToggle$?: PropFunction<() => void>;
    /** When true, renders input fields instead of NodeTitle/NodeSubtitle (construction mode) */
    isConstruction?: boolean;
    /** For construction mode: name input ref */
    nameInputRef?: { value: HTMLInputElement | undefined };
    /** For construction mode: subtitle input ref */
    subtitleInputRef?: { value: HTMLInputElement | undefined };
    /** For construction mode: keydown handler */
    onKeyDown$?: PropFunction<(e: KeyboardEvent) => void>;
    /** For construction mode: disable chevron button */
    chevronDisabled?: boolean;
};

export const NodeHeader = component$((props: NodeHeaderProps) => {
    const handleBodyKeyDown$ = $((e: KeyboardEvent) => {
        if (props.onNodeClick$ && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            props.onNodeClick$();
        }
    });

    const handleExpandKeyDown$ = $((e: KeyboardEvent) => {
        if (props.onExpand$ && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            props.onExpand$();
        }
    });

    return (
        <article
            class={[
                styles.nodeHeader,
                props.isExpanded && styles.nodeHeaderExpanded,
                props.isParent && styles.nodeHeaderParent
            ]}
            aria-labelledby={props.titleId}
            data-node-id={props.id}
        >
            <div
                class={[
                    styles.nodeHeaderContent,
                    props.isClickable && styles.nodeHeaderContentClickable,
                    props.isClickable && 'no-caret'
                ]}
                onClick$={props.onNodeClick$}
                onKeyDown$={handleBodyKeyDown$}
                role={props.isClickable ? 'button' : undefined}
                tabIndex={props.isClickable ? 0 : undefined}
                aria-label={props.isClickable ? `Open ${props.nodeName || 'node'}` : undefined}
            >
                {props.isParent && props.onNavigateUp$ && (
                    <div class={styles.upButtonWrapper}>
                        <UpButton
                            parentId={props.parentId ?? null}
                            onNavigate$={props.onNavigateUp$}
                        />
                    </div>
                )}
                <div>
                    {props.isConstruction ? (
                        <>
                            <input
                                class={styles.nodeTitle}
                                ref={props.nameInputRef}
                                placeholder="Name"
                                onKeyDown$={props.onKeyDown$}
                                aria-label="Node name"
                                id={props.titleId}
                            />
                            <input
                                class={styles.nodeSubtitle}
                                ref={props.subtitleInputRef}
                                placeholder="Subtitle / Location / Short description"
                                onKeyDown$={props.onKeyDown$}
                                aria-label="Node subtitle"
                            />
                        </>
                    ) : (
                        <>
                            <NodeTitle nodeName={props.nodeName} id={props.titleId} />
                            <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                        </>
                    )}
                </div>
                <div class={styles.nodeButtons}>
                    <EllipsisButton
                        onDoubleTap$={props.onDetailsToggle$}
                        isExpanded={props.isDetailsExpanded}
                    />
                    <button
                        type="button"
                        class={styles.nodeChevron}
                        onClick$={props.onExpand$}
                        onKeyDown$={handleExpandKeyDown$}
                        aria-expanded={props.isExpanded}
                        aria-label={props.isExpanded ? 'Collapse details' : 'Expand details'}
                        disabled={props.chevronDisabled}
                    >
                        {props.isExpanded ? '▾' : '◂'}
                    </button>
                </div>
            </div>
        </article>
    );
});
