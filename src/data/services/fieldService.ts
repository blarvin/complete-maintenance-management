/**
 * Field Service - High-level operations for DataFields.
 * Abstracts the repo layer so components don't depend on Firestore directly.
 */

import { listFieldsForNode, updateFieldValue as repoUpdateFieldValue } from '../repo/dataFields';
import type { DataField } from '../models';

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
};

