/**
 * EllipsisButton - Vertical three-dot button for TreeNodeDetails toggle
 *
 * Uses double-tap interaction (same pattern as DataField editing).
 * Keyboard support: Enter/Space toggles with single press.
 */

import { useDoubleTap } from '../../hooks/useDoubleTap';
import styles from './EllipsisButton.module.css';

export type EllipsisButtonProps = {
    onDoubleTap?: () => void;
    isExpanded?: boolean;
};

export const EllipsisButton = (props: EllipsisButtonProps) => {
    const { checkDoubleTap } = useDoubleTap();

    const handlePointerDown = (e: PointerEvent) => {
        // Stop propagation to prevent parent click handlers (navigation)
        e.stopPropagation();
        if (!props.onDoubleTap) return;
        if (checkDoubleTap(e.clientX, e.clientY)) {
            props.onDoubleTap();
        }
    };

    const handleClick = (e: MouseEvent) => {
        // Stop click from bubbling to parent (which triggers navigation)
        e.stopPropagation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!props.onDoubleTap) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            props.onDoubleTap();
        }
    };

    return (
        <button
            type="button"
            class={styles.ellipsisButton}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            aria-expanded={props.isExpanded}
            aria-label={props.isExpanded ? 'Collapse node details' : 'Expand node details'}
        >
            ⋮
        </button>
    );
};
