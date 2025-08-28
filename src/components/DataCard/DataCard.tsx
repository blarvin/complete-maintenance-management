import { Slot, component$ } from '@builder.io/qwik';

export type DataCardProps = { children?: any };

export const DataCard = component$<DataCardProps>((props) => {
    return (
        <div class="datacard">
            <Slot />
            <div class="datacard__add">+ Add Field</div>
        </div>
    );
});



