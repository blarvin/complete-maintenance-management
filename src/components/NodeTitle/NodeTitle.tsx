import { component$ } from '@builder.io/qwik';

export type NodeTitleProps = {
    nodeName: string;
    id?: string;
};

export const NodeTitle = component$<NodeTitleProps>((props) => {
    return (
        <h2 class="node__title" id={props.id}>{props.nodeName}</h2>
    );
});


