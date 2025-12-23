import { Slot, component$, PropFunction } from '@builder.io/qwik';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import styles from './DataCard.module.css';

export type DataCardProps = {
    isOpen?: boolean;
    nodeId: string;
    onFieldCreated$?: PropFunction<() => void>;
    /** Hide the "+ Add Field" button (used in construction mode where it's shown inline) */
    hideAddField?: boolean;
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
                {!props.hideAddField && (
                    <CreateDataField nodeId={props.nodeId} onCreated$={props.onFieldCreated$} />
                )}
                <Slot name="actions" />
                </div>
            </div>
        </div>
    );
});



