import { component$ } from '@builder.io/qwik';

export const NodeSubtitle = component$((props: { nodeSubtitle: string }) => {
    return (
        <div class="node__subtitle">{props.nodeSubtitle}</div>
    );
});


