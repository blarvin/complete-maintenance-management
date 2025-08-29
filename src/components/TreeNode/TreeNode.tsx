import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { DataCard } from '../DataCard/DataCard';
import { DataField } from '../DataField/DataField';
import { listFieldsForNode } from '../../data/repo/dataFields';
import type { DataField as DataFieldRecord } from '../../data/models';

export type TreeNodeMode = 'isRoot' | 'isParent' | 'isChild' | 'isUnderConstruction';

export type TreeNodeProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    mode: TreeNodeMode;
    ucDefaults?: { fieldName: string; fieldValue: string | null }[];
    onCancel$?: PropFunction<() => void>;
    onCreate$?: PropFunction<(payload: { nodeName: string; nodeSubtitle: string; fields: { fieldName: string; fieldValue: string | null }[] }) => void>;
};

export const TreeNode = component$((props: TreeNodeProps) => {
    const isExpanded = useSignal<boolean>(props.mode === 'isUnderConstruction');
    const ucFields = useSignal<{ fieldName: string; fieldValue: string | null }[]>(props.ucDefaults ?? []);
    const nameValue = useSignal<string>(props.nodeName || '');
    const subtitleValue = useSignal<string>(props.nodeSubtitle || '');
    const nameInputRef = useSignal<HTMLInputElement>();
    const persistedFields = useSignal<DataFieldRecord[] | null>(null);

    useVisibleTask$(() => {
        if (props.mode === 'isUnderConstruction') {
            nameInputRef.value?.focus();
        }
    });

    useVisibleTask$(async () => {
        if (props.mode !== 'isUnderConstruction') {
            persistedFields.value = await listFieldsForNode(props.id);
        }
    });

    const handleCreate$ = $(async () => {
        if (!props.onCreate$) return;
        await props.onCreate$({ nodeName: nameValue.value, nodeSubtitle: subtitleValue.value, fields: ucFields.value });
    });

    return (
        <>
            <section class={{ node: true, 'node--expanded': isExpanded.value }}>
                <div class="node__body">
                    <div>
                        {props.mode === 'isUnderConstruction' ? (
                            <>
                                <input
                                    class="node__title"
                                    ref={nameInputRef}
                                    placeholder="Name"
                                    value={nameValue.value}
                                    onInput$={(e) => (nameValue.value = (e.target as HTMLInputElement).value)}
                                />
                                <input
                                    class="node__subtitle"
                                    placeholder="Subtitle / Location / Short description"
                                    value={subtitleValue.value}
                                    onInput$={(e) => (subtitleValue.value = (e.target as HTMLInputElement).value)}
                                />
                            </>
                        ) : (
                            <>
                                <NodeTitle nodeName={props.nodeName} />
                                <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                            </>
                        )}
                    </div>
                    <div
                        class="node__chevron"
                        onClick$={(e) => {
                            e.stopPropagation();
                            isExpanded.value = !isExpanded.value;
                        }}
                        title={isExpanded.value ? 'Collapse' : 'Expand'}
                        aria-label={isExpanded.value ? 'Collapse' : 'Expand'}
                        role="button"
                    >
                        {isExpanded.value ? '▾' : '◂'}
                    </div>
                </div>
            </section>
            <div class={{ 'node__expand': true, 'node__expand--open': isExpanded.value }}>
                <div class="node__expand-clip">
                    <div class="node__expand-slide">
                        <DataCard>
                            {props.mode === 'isUnderConstruction' ? (
                                <>
                                    {ucFields.value.map((f, idx) => (
                                        <div class="datafield" key={`${f.fieldName}-${idx}`}>
                                            <div class="datafield__label">{f.fieldName}:</div>
                                            <input
                                                class={{ 'datafield__value': true, 'datafield__value--underlined': !!f.fieldValue }}
                                                value={f.fieldValue ?? ''}
                                                onInput$={(e, t) => {
                                                    const val = (e.target as HTMLInputElement).value;
                                                    ucFields.value = ucFields.value.map((row, i) => (i === idx ? { ...row, fieldValue: val || null } : row));
                                                }}
                                            />
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                        <button onClick$={props.onCancel$}>Cancel</button>
                                        <button onClick$={handleCreate$}>Create</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {persistedFields.value?.map((f) => (
                                        <DataField key={f.id} id={f.id} fieldName={f.fieldName} fieldValue={f.fieldValue} />
                                    ))}
                                </>
                            )}
                        </DataCard>
                    </div>
                </div>
            </div>
        </>
    );
});


