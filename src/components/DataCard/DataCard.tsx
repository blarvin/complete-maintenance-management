import { Slot, component$ } from '@builder.io/qwik';
import styles from './DataCard.module.css';

export type DataCardProps = { children?: any };

export const DataCard = component$<DataCardProps>((props) => {
    return (
        <div class={styles.datacard} role="region" aria-label="Node details">
            <Slot />
            <button type="button" class={styles.datacardAdd} aria-label="Add new field">
                + Add Field
            </button>
        </div>
    );
});



