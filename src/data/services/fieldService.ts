/**
 * Field Service - High-level operations for DataFields.
 * Abstracts the repo layer so components don't depend on Firestore directly.
 */

import { listFieldsForNode, updateFieldValue as repoUpdateFieldValue, deleteField as repoDeleteField, getFieldHistory as repoGetFieldHistory } from '../repo/dataFields';
import type { DataField, DataFieldHistory } from '../models';

export const fieldService = {
    /**
     * Get all fields for a node, sorted by updatedAt ascending.
     * Used by TreeNode to load DataCard fields.
     */
    getFieldsForNode: (nodeId: string): Promise<DataField[]> => listFieldsForNode(nodeId),

    /**
     * Update a field's value. Writes history entry automatically.
     * Used by DataField component for in-place editing.
     */
    updateFieldValue: (fieldId: string, newValue: string | null): Promise<void> => 
        repoUpdateFieldValue(fieldId, newValue),

    /**
     * Delete a field. Writes a "delete" history entry.
     * Per SPEC: manual DataField delete writes a history entry with action: "delete".
     */
    deleteField: (fieldId: string): Promise<void> =>
        repoDeleteField(fieldId),

    /**
     * Get history entries for a field, sorted by rev ascending.
     * Used to display Last Edit info (who, when, created).
     */
    getFieldHistory: (fieldId: string): Promise<DataFieldHistory[]> =>
        repoGetFieldHistory(fieldId),
};

