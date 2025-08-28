import { component$ } from '@builder.io/qwik';

export type DataFieldProps = {
    fieldName: string;
    fieldValue: string | null;
};

export const DataField = component$<DataFieldProps>((props) => {
    const hasValue = !!props.fieldValue;
    return (
        <div class="datafield">
            <div class="datafield__label">{props.fieldName}:</div>
            <div class={{ 'datafield__value': true, 'datafield__value--underlined': hasValue }}>
                {props.fieldValue ?? ''}
            </div>
        </div>
    );
});


