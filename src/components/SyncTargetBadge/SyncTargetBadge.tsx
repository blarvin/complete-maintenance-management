/**
 * SyncTargetBadge — floating marker shown only when this session syncs against
 * the Firestore emulator.
 *
 * Scoping the Dexie database by sync target (IMPLEMENTATION.md → *One database
 * per sync target*, 2026-08-11) stopped mode flips
 * from wiping data, but traded a loud symptom for a quiet one: each target now
 * has its own database, so the wrong target looks like a working app holding
 * unfamiliar data. This badge is what makes that state legible.
 *
 * Deliberately not DEV-gated: in an installed PWA the only way into emulator
 * mode is `localStorage.USE_FIRESTORE_EMULATOR`, set on a production build —
 * exactly the case where the marker is most needed. It renders nothing at all
 * when the target is production, which is every ordinary build.
 */

import { Show } from 'solid-js';
import { isEmulatorTarget } from '../../data/syncTarget';
import { DB_NAME } from '../../data/storage/db';
import styles from './SyncTargetBadge.module.css';

export const SyncTargetBadge = () => (
    // `<Show>` rather than an early return: `solid/components-return-once` runs
    // at error here. The condition is a module constant, so this collapses to
    // nothing on a production target.
    <Show when={isEmulatorTarget}>
        <div
            class={styles.badge}
            role="status"
            aria-label={`Syncing against the Firestore emulator, database ${DB_NAME}`}
            title={`Firestore emulator (localhost:8080) — IndexedDB: ${DB_NAME}`}
        >
            EMULATOR
        </div>
    </Show>
);
