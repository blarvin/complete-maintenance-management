/**
 * storageEventRelevance - Pure predicates deciding whether a StorageEvent
 * is relevant to a given reader.
 *
 * Used by the data hooks (src/hooks/useElementChildren.ts) to skip reloads
 * for writes that cannot affect what they display. Pure, framework-free.
 */

import type { StorageEvent } from './storageEventBus';

/** Does this event possibly change the child list of `parentId`? (null = root) */
export function affectsChildrenOf(event: StorageEvent, parentId: string | null): boolean {
    switch (event.type) {
        case 'ELEMENT_WRITTEN':
            return event.element.parentId === parentId;
        case 'ELEMENT_HARD_DELETED':
            return true; // payload has no parentId — reload conservatively
        case 'DEFINITION_WRITTEN':
            return false;
    }
}

/** Does this event possibly change the element row `elementId`? */
export function affectsElement(event: StorageEvent, elementId: string): boolean {
    switch (event.type) {
        case 'ELEMENT_WRITTEN':
            return event.element.id === elementId;
        case 'ELEMENT_HARD_DELETED':
            return event.elementId === elementId;
        case 'DEFINITION_WRITTEN':
            return false;
    }
}
