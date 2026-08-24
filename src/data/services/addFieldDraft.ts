/**
 * addFieldDraft — the Add Surface's in-progress draft, in localStorage, keyed
 * by node.
 *
 * The tree-native Add Surface had no persistence of any kind, so a reload lost
 * a half-authored Definition outright — name, kind, and a `number-kv` config set
 * knob by knob. The whole draft is stored, not a subset: a half-persisted draft
 * raises a question a full one does not (what a stored config means once the
 * kind changed under it).
 *
 * Framework-free on purpose, the same shape as `pendingDraft.ts` — but a
 * **separate** store. `pendingFields:<nodeId>` belongs to the composer batch and
 * is still live for node construction; this is the tree-native surface's own
 * key and must not be conflated with it.
 *
 * Everything here is JSON-safe: `SingleImageValue` carries a `blobId`, not the
 * bytes, so no value shape can put an image in localStorage.
 */

import type { DataFieldValue, DefinitionConfig, Kind } from '../models';

export type StoredAddFieldDraft = {
    kind: Kind;
    label: string;
    config: DefinitionConfig;
    value: DataFieldValue | null;
    /**
     * Whether the user said anything about the value slot, *including* saying
     * empty. Stored because it is not derivable from `value`, and it decides
     * whether the Definition's `default` fills in at mint.
     */
    valueTouched: boolean;
    /** The Library Definition the draft was loaded from, by id. */
    pickedId: string | null;
};

export const getAddFieldDraftKey = (nodeId: string) => `addFieldDraft:${nodeId}`;

export const loadAddFieldDraft = (nodeId: string): StoredAddFieldDraft | null => {
    try {
        const stored = localStorage.getItem(getAddFieldDraftKey(nodeId));
        if (!stored) return null;
        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') return null;
        const d = parsed as Partial<StoredAddFieldDraft>;
        if (typeof d.kind !== 'string') return null;
        if (typeof d.label !== 'string') return null;
        if (!d.config || typeof d.config !== 'object') return null;
        return {
            kind: d.kind,
            label: d.label,
            config: d.config,
            value: d.value ?? null,
            valueTouched: d.valueTouched === true,
            pickedId: typeof d.pickedId === 'string' ? d.pickedId : null,
        };
    } catch {
        return null;
    }
};

export const saveAddFieldDraft = (nodeId: string, draft: StoredAddFieldDraft): void => {
    try {
        localStorage.setItem(getAddFieldDraftKey(nodeId), JSON.stringify(draft));
    } catch {
        // Ignore storage errors — a draft that cannot be stored is still usable
        // in the session that has it.
    }
};

export const clearAddFieldDraft = (nodeId: string): void => {
    try {
        localStorage.removeItem(getAddFieldDraftKey(nodeId));
    } catch {
        // Ignore storage errors
    }
};
