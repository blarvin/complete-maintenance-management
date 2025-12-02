import { Slot, component$ } from '@builder.io/qwik';
import styles from './DataCard.module.css';

export type DataCardProps = {
    isOpen?: boolean;
    children?: any;
};

export const DataCard = component$<DataCardProps>((props) => {
    return (
        <div class={[styles.wrapper, props.isOpen && styles.wrapperOpen]}>
            <div class={styles.inner}>
            <div
                class={[styles.datacard, props.isOpen && styles.datacardOpen]}
                role="region"
                aria-label="Node details"
            >
                <Slot />
                <button type="button" class={styles.datacardAdd} aria-label="Add new field">
                    + Add Field
                </button>
                </div>
            </div>
        </div>
    );
});



