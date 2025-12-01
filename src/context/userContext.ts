/**
 * User Context Abstraction
 * 
 * Provides the current user identity for data operations.
 * Phase 1: Returns constant "localUser"
 * Future: Will pull from authentication state
 */

import { USER_ID } from '../constants';

/**
 * Get the current user's ID.
 * Used for updatedBy fields in data records.
 * 
 * @returns The current user's identifier
 */
export function getCurrentUserId(): typeof USER_ID {
    // Phase 1: constant user ID
    // Future: return from auth context, e.g., auth.currentUser?.uid
    return USER_ID;
}

