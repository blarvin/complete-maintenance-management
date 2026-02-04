import { getAncestorPath } from '../data/nodeIndex';

/**
 * Minimal helper that simply calls getAncestorPath.
 * Exists for parity with other hooks without introducing extra reactivity.
 */
export function useAncestorPath(nodeId: string) {
    return getAncestorPath(nodeId);
}
