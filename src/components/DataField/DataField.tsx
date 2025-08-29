import { component$, useSignal, $, useVisibleTask$, useOnDocument } from '@builder.io/qwik';
import { updateFieldValue } from '../../data/repo/dataFields';

export type DataFieldProps = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
};

export const DataField = component$<DataFieldProps>((props) => {
    const isEditing = useSignal<boolean>(false);
    const rootEl = useSignal<HTMLElement>();
    const currentValue = useSignal<string>(props.fieldValue ?? '');
    const editValue = useSignal<string>('');
    const lastDownAt = useSignal<number>(0);
    const lastDownX = useSignal<number>(0);
    const lastDownY = useSignal<number>(0);
    const suppressCancelUntil = useSignal<number>(0);
    const DOUBLE_CLICK_MS = 280;
    const DOUBLE_CLICK_SLOP = 6; // px

    useVisibleTask$(() => {
        currentValue.value = props.fieldValue ?? '';
    });

    const beginEdit$ = $(() => {
        if (isEditing.value) return;
        isEditing.value = true;
        editValue.value = currentValue.value;
    });

    const save$ = $(async () => {
        if (!isEditing.value) return;
        const newVal = editValue.value.trim() === '' ? null : editValue.value;
        await updateFieldValue(props.id, newVal);
        currentValue.value = newVal ?? '';
        isEditing.value = false;
    });

    const cancel$ = $(() => {
        isEditing.value = false;
        editValue.value = currentValue.value;
    });

    const hasValue = !!currentValue.value;

    const registerDownAndIsDouble$ = $((x: number, y: number) => {
        const now = Date.now();
        const withinTime = now - lastDownAt.value <= DOUBLE_CLICK_MS;
        const dx = Math.abs(x - lastDownX.value);
        const dy = Math.abs(y - lastDownY.value);
        const withinSlop = dx <= DOUBLE_CLICK_SLOP && dy <= DOUBLE_CLICK_SLOP;
        const isDouble = withinTime && withinSlop;
        lastDownAt.value = now;
        lastDownX.value = x;
        lastDownY.value = y;
        return isDouble;
    });

    const valuePointerDown$ = $(async (ev: any) => {
        if (isEditing.value) return;
        const e = ev as PointerEvent | MouseEvent;
        const x = (e as any).clientX ?? 0;
        const y = (e as any).clientY ?? 0;
        const isDouble = await registerDownAndIsDouble$(x, y);
        if (isDouble) {
            await beginEdit$();
        }
    });

    const inputPointerDown$ = $(async (ev: any) => {
        if (!isEditing.value) return;
        const e = ev as PointerEvent | MouseEvent;
        const x = (e as any).clientX ?? 0;
        const y = (e as any).clientY ?? 0;
        suppressCancelUntil.value = Date.now() + 220;
        const isDouble = await registerDownAndIsDouble$(x, y);
        if (isDouble) {
            // Save on custom double-click
            await save$();
        }
    });

    // Cancel edit on any outside click
    useOnDocument('pointerdown', $((ev: Event) => {
        if (!isEditing.value) return;
        const container = rootEl.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            cancel$();
        }
    }));

    return (
        <div class="datafield" ref={rootEl}>
            <div class="datafield__label">{props.fieldName}:</div>
            {isEditing.value ? (
                <input
                    class={{ 'datafield__value': true, 'datafield__value--underlined': !!editValue.value }}
                    value={editValue.value}
                    onInput$={(e) => (editValue.value = (e.target as HTMLInputElement).value)}
                    onPointerDown$={inputPointerDown$}
                    onBlur$={$(() => {
                        if (Date.now() < suppressCancelUntil.value) return;
                        if (isEditing.value) cancel$();
                    })}
                    onKeyDown$={$((e) => {
                        const key = (e as KeyboardEvent).key;
                        if (key === 'Enter') {
                            // prevent form submits if any
                            e.preventDefault();
                            save$();
                        } else if (key === 'Escape') {
                            e.preventDefault();
                            cancel$();
                        }
                    })}
                    autoFocus
                />
            ) : (
                <div class={{ 'datafield__value': true, 'datafield__value--underlined': hasValue }} onPointerDown$={valuePointerDown$}>
                    {currentValue.value}
                </div>
            )}
        </div>
    );
});


