import { Slot, component$ } from '@builder.io/qwik';

export type DataCardProps = { children?: any };

export const DataCard = component$<DataCardProps>((props) => {
    return (
        <div class="datacard" role="region" aria-label="Node details">
            <Slot />
            <button type="button" class="datacard__add" aria-label="Add new field">
                + Add Field
            </button>
        </div>
    );
});



