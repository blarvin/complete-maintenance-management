/**
 * MeasurementKvField - Renderer for measurement-kv DataFields.
 *
 * Numeric value with fixed units from the Template. Display appends units and
 * colors based on ok / warn / alarm ranges. Edit flow reuses useFieldEdit with
 * number parse/format. Validation rejects NaN and out-of-absolute-range values.
 */

import { component$, useResource$, Resource, type PropFunction, type Signal } from '@builder.io/qwik';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { getTemplateQueries } from '../../data/queries';
import type { MeasurementKvConfig } from '../../data/models';
import { computeMeasurementState, type MeasurementState } from './measurementState';
import styles from './DataField.module.css';
import measurementStyles from './MeasurementKvField.module.css';

export type MeasurementKvFieldProps = {
    id: string;
    fieldName: string;
    templateId: string;
    value: number | null;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
};

function makeFormat(decimals: number, units: string) {
    return (v: number | null): string => {
        if (v === null || v === undefined) return '';
        return `${v.toFixed(decimals)} ${units}`.trim();
    };
}

function makeFormatEdit(decimals: number) {
    // Edit buffer shows the raw number without units, rounded to display decimals.
    return (v: number | null): string => {
        if (v === null || v === undefined) return '';
        return v.toFixed(decimals);
    };
}

function parseMeasurement(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n)) {
        throw new Error(`"${raw}" is not a valid number`);
    }
    return n;
}

function makeValidate(config: MeasurementKvConfig) {
    return (value: number | null) => {
        if (value === null) return;
        if (config.absoluteMin !== undefined && value < config.absoluteMin) {
            throw new Error(`Value must be ≥ ${config.absoluteMin} ${config.units}`);
        }
        if (config.absoluteMax !== undefined && value > config.absoluteMax) {
            throw new Error(`Value must be ≤ ${config.absoluteMax} ${config.units}`);
        }
    };
}

export const MeasurementKvField = component$<MeasurementKvFieldProps>((props) => {
    // Fetch Template for units + ranges.
    const templateResource = useResource$(async ({ track }) => {
        track(() => props.templateId);
        const tpl = await getTemplateQueries().getTemplateById(props.templateId);
        if (!tpl || tpl.componentType !== 'measurement-kv') return null;
        return tpl.config as MeasurementKvConfig;
    });

    return (
        <Resource
            value={templateResource}
            onPending={() => <span class={styles.datafieldValue}>…</span>}
            onRejected={() => <span class={styles.datafieldValue}>—</span>}
            onResolved={(config) => {
                if (!config) return <span class={styles.datafieldValue}>—</span>;
                return <MeasurementKvBody {...props} config={config} />;
            }}
        />
    );
});

const MeasurementKvBody = component$<MeasurementKvFieldProps & { config: MeasurementKvConfig }>((props) => {
    const { config } = props;
    const decimals = config.decimals ?? 2;
    const formatDisplay = makeFormat(decimals, config.units);
    const formatEdit = makeFormatEdit(decimals);

    const {
        isEditing,
        displayValue,
        isPreviewActive,
        hasValue,
        editValue,
        editInputRef,
        currentValue,
        valuePointerDown$,
        valueKeyDown$,
        inputPointerDown$,
        inputBlur$,
        inputKeyDown$,
        inputChange$,
    } = useFieldEdit<number>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatEdit, // edit buffer uses bare number
        parse: parseMeasurement,
        validate: makeValidate(config),
        rootRef: props.rootRef,
        onUpdated$: props.onUpdated$,
    });

    const labelId = `field-label-${props.id}`;

    if (isEditing) {
        return (
            <span style="display: contents">
                <input
                    ref={editInputRef}
                    type="text"
                    inputMode="decimal"
                    class={[styles.datafieldValue, measurementStyles.input]}
                    value={editValue.value}
                    onInput$={(e) => inputChange$((e.target as HTMLInputElement).value)}
                    onPointerDown$={inputPointerDown$}
                    onBlur$={inputBlur$}
                    onKeyDown$={inputKeyDown$}
                    aria-labelledby={labelId}
                    autoFocus
                />
                <span class={measurementStyles.units}>{config.units}</span>
            </span>
        );
    }

    // Display: bare number + units + state coloring.
    const state: MeasurementState = computeMeasurementState(currentValue.value, config);
    const shown = formatDisplay(currentValue.value);
    return (
        <div
            class={[
                styles.datafieldValue,
                hasValue && styles.datafieldValueUnderlined,
                styles.datafieldValueEditable,
                isPreviewActive && styles.datafieldValuePreview,
                measurementStyles[`state_${state}`],
                'no-caret',
            ]}
            data-state={state}
            onPointerDown$={valuePointerDown$}
            onKeyDown$={valueKeyDown$}
            tabIndex={0}
            role="button"
            aria-labelledby={labelId}
            aria-description="Press Enter to edit"
        >
            {shown || <span class={styles.datafieldPlaceholder}>Empty</span>}
            {/* avoid unused-var warning when shown is falsy */}
            {displayValue ? null : null}
        </div>
    );
});
