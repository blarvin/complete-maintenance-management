import { component$ } from '@builder.io/qwik';

export const NodeTitle = component$((props: { nodeName: string }) => {
    return (
        <div class="node__title">{props.nodeName}</div>
    );
});


