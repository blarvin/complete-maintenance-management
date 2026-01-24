---
name: Defer Node Creation Until Save
overview: "Refactor node creation to use Option B: defer IDB writes until user clicks \"Create\", while keeping Save buttons that mark fields as \"saved\" in localStorage during construction. This eliminates orphan nodes and maintains the modeless UX."
todos:
  - id: "1"
    content: "Update usePendingForms: Add mode parameter, extend PendingForm with saved flag, modify save$() for construction mode"
    status: pending
  - id: "2"
    content: "Update useNodeCreation.start$(): Remove createEmptyNode() call, only generate ID"
    status: pending
  - id: "3"
    content: "Update useNodeCreation.complete$(): Create node + fields atomically using createWithFields"
    status: pending
  - id: "4"
    content: "Update useNodeCreation.cancel$(): Clear localStorage only (no IDB cleanup)"
    status: pending
  - id: "5"
    content: "Update FieldList: Add isConstruction prop, pass mode to usePendingForms"
    status: pending
  - id: "6"
    content: "Update TreeNodeConstruction: Pass isConstruction={true} to FieldList"
    status: pending
  - id: "7"
    content: "Update TreeNodeDisplay: Pass isConstruction={false} to FieldList"
    status: pending
  - id: "8"
    content: Add helper function to extract saved fields from localStorage for batch creation
    status: pending
isProject: false
---

# Defer Node Creation Until Save

## Problem

Currently, when UC starts, an empty node is immediately created in IDB. If user cancels, orphan nodes remain. Option B defers all IDB writes until "Create" is clicked, eliminating orphans by design.

## Architecture Changes

### Flow Comparison

**Current:**

```
UC starts → createEmptyNode() → Node in IDB + sync queue
User saves field → Field in IDB + sync queue
CANCEL → orphan node + fields to clean up
```

**New:**

```
UC starts → Generate ID only, nothing in IDB
User saves field → Mark as "saved" in localStorage (no IDB write)
CREATE → Atomic: Node + all saved fields created together
CANCEL → Clear localStorage, done
```

## Implementation Plan

### 1. Update `usePendingForms` Hook

**File**: `src/hooks/usePendingForms.ts`

**Changes**:

- Add `mode: 'construction' | 'display'` to `UsePendingFormsOptions`
- Extend `PendingForm` type with optional `saved: boolean` flag
- Modify `save$()` function:
  - **Construction mode**: Mark form as `saved: true` in localStorage, do NOT call `addField()`
  - **Display mode**: Keep current behavior (write to IDB immediately)
- Update `saveAllPending$()` to return saved forms for batch creation (not write to IDB in construction mode)

**Key Code Changes**:

```typescript
export type PendingForm = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
    cardOrder: number;
    saved?: boolean; // NEW: marks fields "locked in" during construction
};

export type UsePendingFormsOptions = {
    nodeId: string;
    mode: 'construction' | 'display'; // NEW
    // ... rest
};

// In save$():
if (options.mode === 'construction') {
    // Mark as saved in localStorage, don't write to IDB
    forms.value = forms.value.map(f => 
        f.id === formId 
            ? { ...f, fieldName: name, fieldValue, saved: true }
            : f
    );
    return; // Don't call addField()
}
// Display mode: existing behavior
```

### 2. Update `useNodeCreation` Hook

**File**: `src/hooks/useNodeCreation.ts`

**Changes**:

- **`start$()`**: Remove `createEmptyNode()` call, only generate ID and open UC UI
- **`complete$()`**: Create node + all saved fields atomically using existing `createWithFields` pattern
- **`cancel$()`**: Clear localStorage for pending forms (no IDB cleanup needed)

**Key Code Changes**:

```typescript
const start$ = $(async () => {
    const id = generateId();
    // DON'T create node in DB - defer until CREATE
    await startConstruction$({
        id,
        parentId: options.parentId,
        nodeName: '',
        nodeSubtitle: '',
    });
});

const complete$ = $(async (payload: CreateNodePayload) => {
    const ucData = appState.underConstruction;
    if (!ucData) return;

    // Get all saved fields from localStorage
    const savedFields = getSavedFieldsFromLocalStorage(ucData.id);
    
    // Create node + all fields atomically
    await getNodeService().createWithFields({
        id: ucData.id,
        parentId: ucData.parentId,
        nodeName: payload.nodeName || 'Untitled',
        nodeSubtitle: payload.nodeSubtitle || '',
        defaults: savedFields.map(f => ({
            fieldName: f.fieldName,
            fieldValue: f.fieldValue,
        })),
    });

    // Clear localStorage
    localStorage.removeItem(`pendingFields:${ucData.id}`);
    
    triggerSync();
    await completeConstruction$();
    await options.onCreated$();
});

const cancel$ = $(async () => {
    const ucData = appState.underConstruction;
    if (ucData) {
        // Clear localStorage (no IDB cleanup needed)
        localStorage.removeItem(`pendingFields:${ucData.id}`);
    }
    await cancelConstruction$();
});
```

### 3. Update `FieldList` Component

**File**: `src/components/FieldList/FieldList.tsx`

**Changes**:

- Add `isConstruction?: boolean` prop
- Pass `mode` to `usePendingForms` based on construction state
- Update `saveAllPending$()` to return saved forms instead of writing to IDB in construction mode

**Key Code Changes**:

```typescript
export type FieldListProps = {
    nodeId: string;
    initialFieldNames?: readonly string[];
    handleRef?: Signal<FieldListHandle | null>;
    isConstruction?: boolean; // NEW
};

const { forms, ... } = usePendingForms({
    nodeId: props.nodeId,
    mode: props.isConstruction ? 'construction' : 'display', // NEW
    // ... rest
});
```

### 4. Update `TreeNodeConstruction` Component

**File**: `src/components/TreeNode/TreeNodeConstruction.tsx`

**Changes**:

- Pass `isConstruction={true}` to `FieldList`
- Update `handleCreate$()` to collect saved fields from `FieldListHandle` instead of calling `saveAllPending$()`

**Key Code Changes**:

```typescript
<FieldList 
    nodeId={props.id} 
    initialFieldNames={DEFAULT_DATAFIELD_NAMES}
    handleRef={fieldListHandle}
    isConstruction={true} // NEW
/>
```

### 5. Update `TreeNodeDisplay` Component

**File**: `src/components/TreeNode/TreeNodeDisplay.tsx`

**Changes**:

- Pass `isConstruction={false}` (or omit, default to display mode) to `FieldList`

### 6. Add Helper Function for LocalStorage

**File**: `src/hooks/usePendingForms.ts` or new utility file

**Function**: Extract saved fields from localStorage for batch creation

```typescript
export function getSavedFieldsFromLocalStorage(nodeId: string): PendingForm[] {
    const forms = loadPendingForms(nodeId);
    return forms.filter(f => f.saved === true && f.fieldName.trim());
}
```

### 7. Update `FieldListHandle` Type

**File**: `src/components/FieldList/FieldList.tsx`

**Changes**:

- Add method to get saved fields instead of (or in addition to) `saveAllPending$()`
```typescript
export type FieldListHandle = {
    saveAllPending$: QRL<() => Promise<number>>;
    getSavedFields$: QRL<() => PendingForm[]>; // NEW
};
```


## Testing Considerations

1. **UC Cancel**: Verify localStorage cleared, no IDB entries
2. **UC Create**: Verify node + all saved fields created atomically
3. **Display Mode Save**: Verify still writes to IDB immediately (unchanged behavior)
4. **Construction Mode Save**: Verify marks as saved in localStorage, no IDB write
5. **Refresh During UC**: Verify pending forms persist from localStorage

## Benefits

- **No orphans possible**: Nothing written to IDB until CREATE
- **Modeless UX**: Save buttons work the same visually, behavior differs by mode
- **Atomic creation**: Node + fields created together
- **Simpler cancel**: Just clear localStorage
- **No sync queue pollution**: Empty nodes never enqueued

## Migration Notes

- Existing UC nodes in IDB (if any) will need cleanup (one-time migration) - not for Agent, user will do this.
- localStorage structure changes (adds `saved` flag) but backward compatible
- Display mode behavior unchanged (no user-visible impact)