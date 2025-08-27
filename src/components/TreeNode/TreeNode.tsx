import { component$, useSignal } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { DataCard } from '../DataCard/DataCard';

export type TreeNodeMode = 'isRoot' | 'isParent' | 'isChild' | 'isUnderConstruction';

export type TreeNodeProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    mode: TreeNodeMode;
};

export const TreeNode = component$((props: TreeNodeProps) => {
    const isExpanded = useSignal<boolean>(false);

    const defaultRows = [
        { label: 'Type Of', value: 'Pump' },
        { label: 'Description', value: 'Primary cooling pump for HVAC' },
        { label: 'Tags', value: 'critical, hvac, maintenance' },
        { label: 'Status', value: 'In Service' },
        { label: 'Installed Date', value: '2025-01-01' },
    ];

    return (
        <>
            <section class={{ node: true, 'node--expanded': isExpanded.value }}>
                <div class="node__body" onClick$={() => (isExpanded.value = !isExpanded.value)}>
                    <div>
                        <NodeTitle nodeName={props.nodeName} />
                        <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                    </div>
                    <div class="node__chevron">{isExpanded.value ? '▾' : '◂'}</div>
                </div>
            </section>
            {isExpanded.value && <DataCard rows={defaultRows} />}
        </>
    );
});


