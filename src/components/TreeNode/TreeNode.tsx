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
    onNodeClick$?: PropFunction<() => void>;
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

    useVisibleTask$(async ({ track }) => {
        const nodeId = track(() => props.id);
        if (props.mode !== 'isUnderConstruction') {
            persistedFields.value = await listFieldsForNode(nodeId);
        }
    });

    const handleCreate$ = $(async () => {
        if (!props.onCreate$) return;
        await props.onCreate$({ nodeName: nameValue.value, nodeSubtitle: subtitleValue.value, fields: ucFields.value });
    });

    const toggleExpand$ = $((e?: Event) => {
        e?.stopPropagation();
        isExpanded.value = !isExpanded.value;
    });

    const handleBodyKeyDown$ = $((e: KeyboardEvent) => {
        if (props.onNodeClick$ && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            props.onNodeClick$();
        }
    });

    const handleExpandKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleExpand$();
        }
    });

    // Generate unique IDs for ARIA labeling
    const titleId = `node-title-${props.id}`;
    const isClickable = !!props.onNodeClick$;

    return (
        <>
            <article 
                class={{ node: true, 'node--expanded': isExpanded.value }}
                aria-labelledby={titleId}
            >
                <div 
                    class={{ 'node__body': true, 'node__body--clickable': isClickable }}
                    onClick$={props.onNodeClick$}
                    onKeyDown$={handleBodyKeyDown$}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Open ${props.nodeName || 'node'}` : undefined}
                >
                    <div>
                        {props.mode === 'isUnderConstruction' ? (
                            <>
                                <input
                                    class="node__title"
                                    ref={nameInputRef}
                                    placeholder="Name"
                                    value={nameValue.value}
                                    onInput$={(e) => (nameValue.value = (e.target as HTMLInputElement).value)}
                                    aria-label="Node name"
                                />
                                <input
                                    class="node__subtitle"
                                    placeholder="Subtitle / Location / Short description"
                                    value={subtitleValue.value}
                                    onInput$={(e) => (subtitleValue.value = (e.target as HTMLInputElement).value)}
                                    aria-label="Node subtitle"
                                />
                            </>
                        ) : (
                            <>
                                <NodeTitle nodeName={props.nodeName} id={titleId} />
                                <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        class="node__chevron"
                        onClick$={toggleExpand$}
                        onKeyDown$={handleExpandKeyDown$}
                        aria-expanded={isExpanded.value}
                        aria-label={isExpanded.value ? 'Collapse details' : 'Expand details'}
                    >
                        {isExpanded.value ? '▾' : '◂'}
                    </button>
                </div>
            </article>
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


