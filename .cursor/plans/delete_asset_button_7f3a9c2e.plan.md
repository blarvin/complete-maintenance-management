---
name: ""
overview: ""
todos:
  - id: "1"
    content: Expose deleteNode in INodeService and nodeServiceFromAdapter (src/data/services/index.ts)
    status: pending
  - id: "2"
    content: Add .deleteButton and .actionsRow styles to TreeNodeDetails.module.css (copy from DataFieldDetails)
    status: pending
  - id: "3"
    content: Add Delete Asset button and handleDeleteNode$ in TreeNodeDisplay (use props.onNavigateUp$ for post-delete navigation)
    status: pending
isProject: false
---

# Plan: Add DELETE ASSET Button to TreeNodeDetails

## Overview

Add a "Delete Asset" button to the TreeNodeDetails panel, following the established pattern from DataFieldDetails. The button will soft-delete the node by setting `deletedAt` and trigger a re-render.

## Key Files to Modify

| File                                                        | Change                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/data/services/index.ts`                                | Add `deleteNode()` to INodeService interface and implementation           |
| `src/components/TreeNodeDetails/TreeNodeDetails.module.css` | Add `.deleteButton` and `.actionsRow` styles (copy from DataFieldDetails) |
| `src/components/TreeNode/TreeNodeDisplay.tsx`               | Add delete button UI and wire up handler                                  |

## Implementation Steps

### Step 1: Expose deleteNode in Service Layer

**File:** `src/data/services/index.ts`

Add to `INodeService` interface:

```typescript
deleteNode(id: string): Promise<void>;
```

Add implementation in `nodeServiceFromAdapter()`:

```typescript
async deleteNode(id: string): Promise<void> {
  console.log('[NodeService] Deleting node:', id);
  await adapter.deleteNode(id);
}
```

### Step 2: Add CSS Styles

**File:** `src/components/TreeNodeDetails/TreeNodeDetails.module.css`

Copy delete button styles from DataFieldDetails:

```css
.actionsRow {
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: var(--border-width-thin) solid var(--border-default);
}

.deleteButton {
  background: none;
  border: var(--border-width-thin) solid var(--destructive);
  color: var(--destructive);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-family: inherit;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition:
    background-color var(--duration-normal),
    color var(--duration-normal);
}

.deleteButton:hover {
  background: var(--destructive);
  color: var(--bg-surface);
}

.deleteButton:focus-visible {
  outline: 2px solid var(--destructive);
  outline-offset: var(--focus-offset);
}
```

### Step 3: Add Delete Button UI

**File:** `src/components/TreeNode/TreeNodeDisplay.tsx`

In the TreeNodeDetails slot content (around line 60-70), replace placeholder with:

```typescript
<div class={detailsStyles.actionsRow}>
  <button
    type="button"
    class={detailsStyles.deleteButton}
    onClick$={handleDeleteNode$}
    aria-label="Delete this asset"
  >
    Delete Asset
  </button>
</div>
```

Add handler near other handlers:

```typescript
const handleDeleteNode$ = $(async () => {
  console.log("[TreeNodeDisplay] Delete requested for node:", props.id);
  const parentId = props.parentId; // Capture before delete
  await getNodeService().deleteNode(props.id);
  console.log("[TreeNodeDisplay] Node deleted, triggering sync");
  triggerSync();
  // Reuse same "go up" as UpButton (parent branch or ROOT)
  props.onNavigateUp$?.(parentId);
});
```

Use the existing `props.onNavigateUp$` callback (same as UpButton); no new appState imports needed.

Import the details styles:

```typescript
import detailsStyles from "../TreeNodeDetails/TreeNodeDetails.module.css";
```

### Step 4: Handle Navigation After Delete

After deletion, navigate away by calling the same callback the Up button uses: `onNavigateUp$(parentId)` (with `parentId` captured before delete). This reuses the existing FSM transition (`transitions.navigateUp`) and avoids duplicating branch-vs-root logic. The user immediately sees valid content without any flash of deleted state.

## Logging Strategy

Add console logs at each step:

- `[NodeService] Deleting node: {id}`
- `[TreeNodeDisplay] Delete requested for node: {id}`
- `[TreeNodeDisplay] Node deleted, triggering sync`
- `[IDBAdapter] Node soft-deleted in IDB: {id}` (already exists)

## Verification

1. Run dev server: `npm run dev`
2. Create a test node
3. Double-tap the ellipsis (⋮) to open TreeNodeDetails
4. Click "Delete Asset" button
5. Verify:

- Node disappears from view
- Console shows logging chain
- IndexedDB still contains node with `deletedAt` set

1. Run tests: `npm run test` (ensure no regressions)

## Out of Scope (LATER.md)

- Confirmation dialog before delete
- Toast notification after delete
- Undo/restore functionality
- Cascading delete of children
- Orphan cleanup (children of deleted parents remain in IDB, implicitly hidden)

## Project Context Management

After developer verification is complete, update project documentation:

1. **ISSUES.md** - Mark off completed work items related to this feature
2. **IMPLEMENTATION.md** - Add notes if work involved architectural decisions or unusual patterns (not needed for this straightforward feature)
3. **LATER.md** - Add deferred work notes:

- Confirmation dialog before delete
- Toast notification after delete
- Undo/restore functionality
- Cascading soft-delete of children
- Orphan cleanup job
