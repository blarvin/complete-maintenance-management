import { component$ } from '@builder.io/qwik';

export type DataCardProps = {
    rows?: Array<{ label: string; value: string | null }>;
    trows?: Array<{ label: string; value: string | null }>;
};

export const DataCard = component$<DataCardProps>((props) => {
    const rows = props.rows ?? props.trows ?? [];
    return (
        <div class="datacard">
            <div class="datacard__rows">
                {rows.map((row) => (
                    <div class="datacard__row">
                        <div class="datacard__label">{row.label}:</div>
                        <div class={{ 'datacard__value': true, 'datacard__value--underlined': !!row.value }}>
                            {row.value ?? ''}
                        </div>
                    </div>
                ))}
            </div>
            <div class="datacard__add">+ Add Field</div>
        </div>
    );
});



