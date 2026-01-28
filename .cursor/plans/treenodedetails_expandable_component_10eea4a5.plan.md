---
name: TreeNodeDetails Expandable Component
overview: Create TreeNodeDetails component with ellipsis button in NodeHeader and upward-sliding animation card, similar to DataCard but expanding upward and pushing NodeHeader down.
todos:
  - id: state-management
    content: Add expandedNodeDetails state to UIState, transitions, selectors, and uiPrefs
    status: pending
  - id: tree-node-details-component
    content: Create TreeNodeDetails component with upward slide animation (mirror of DataCard)
    status: pending
  - id: ellipsis-button
    content: Create EllipsisButton component with three dots
    status: pending
  - id: update-node-header
    content: Add ellipsis button to NodeHeader above chevron, update grid layout
    status: pending
  - id: integrate-display
    content: Integrate TreeNodeDetails into TreeNodeDisplay with state management
    status: pending
  - id: placeholder-content
    content: Add placeholder content sections for future features
    status: pending
isProject: false
---

# TreeNodeDetails Expandable Component

## Overview

Add an expandable TreeNodeDetails component that slides UP from behind NodeHeader (opposite direction of DataCard). The component will include:

- Three-dot ellipsis button in NodeHeader (positioned above the chevron)
- TreeNodeDetails card that expands upward
- State management for expansion state
- Placeholder content for future features

## Implementation Details

### 1. State Management

**File**: `src/state/appState.types.ts`

- Add `expandedNodeDetails: Set<string>` to `UIState` type (similar to `expandedCards`)
- This will track which nodes have their details panel expanded

**File**: `src/state/appState.transitions.ts`

- Add `toggleNodeDetailsExpanded` transition function (mirror of `toggleCardExpanded`)
- Persist state via `saveUIPrefs`

**File**: `src/state/appState.selectors.ts`

- Add `getNodeDetailsState` selector function (returns 'COLLAPSED' | 'EXPANDED')

**File**: `src/state/uiPrefs.ts`

- Update `UIPrefs` interface to include `expandedNodeDetails: string[]`
- Update `loadUIPrefs()` and `saveUIPrefs()` to handle the new field

### 2. TreeNodeDetails Component

**New File**: `src/components/TreeNodeDetails/TreeNodeDetails.tsx`

- Create component similar to DataCard structure
- Props: `nodeId: string`, `isOpen?: boolean`
- Use Slot for content (placeholder for now)
- Similar animation pattern to DataCard but inverted (slides UP)

**New File**: `src/components/TreeNodeDetails/TreeNodeDetails.module.css`

- Mirror DataCard animation but upward:
  - Wrapper: `grid-template-rows: 0fr` → `1fr` (same as DataCard)
  - Card: `transform: translateY(100%)` → `none` (starts BELOW, slides UP)
  - Full width (no margin-left indent)
  - Position above NodeHeader: `margin-bottom: -1.5px` (tuck under border)
  - z-index: `var(--z-base)` (behind NodeHeader which is `var(--z-node)`)

### 3. Ellipsis Button Component

**New File**: `src/components/EllipsisButton/EllipsisButton.tsx`

- Simple button component rendering three dots (⋯ or •••)
- Props: `onClick$`, `isExpanded`, `aria-label`
- Keyboard support (Enter/Space)

**New File**: `src/components/EllipsisButton/EllipsisButton.module.css`

- Style to match chevron button aesthetic
- Position: above chevron, same right alignment
- Font size: `var(--text-lg)` or similar
- Color: `var(--border-default)` (same as chevron)
- Padding: similar to chevron

### 4. Update NodeHeader

**File**: `src/components/NodeHeader/NodeHeader.tsx`

- Add `isDetailsExpanded?: boolean` prop
- Add `onDetailsToggle$?: PropFunction<(e?: Event) => void>` prop
- Add EllipsisButton above the chevron button in the grid
- Update grid layout to accommodate both buttons:
  - Current: `grid-template-columns: 1fr auto` (or `auto 1fr auto` for parent)
  - New: `grid-template-columns: 1fr auto auto` (or `auto 1fr auto auto` for parent)
  - Ellipsis button comes before chevron in DOM order

**File**: `src/components/TreeNode/TreeNode.module.css`

- Add `.nodeDetailsButton` style (similar to `.nodeChevron`)
- Position ellipsis button above chevron (vertical stacking or flex column)
- Adjust chevron positioning if needed

### 5. Update TreeNodeDisplay

**File**: `src/components/TreeNode/TreeNodeDisplay.tsx`

- Import TreeNodeDetails component
- Get details expansion state using selector
- Create toggle handler for details expansion
- Render TreeNodeDetails ABOVE NodeHeader in DOM (so it slides up from behind)
- Pass `isDetailsExpanded` and `onDetailsToggle$` to NodeHeader

**File**: `src/components/TreeNode/TreeNode.module.css`

- Update `.nodeWrapper` to handle TreeNodeDetails positioning
- Ensure proper stacking: TreeNodeDetails (z-base) → NodeHeader (z-node) → DataCard (z-base)

### 6. Placeholder Content

**File**: `src/components/TreeNodeDetails/TreeNodeDetails.tsx`

- Add placeholder content inside Slot:
  - Simple div with "Node Details" heading
  - Placeholder sections for:
    - Metadata (CreatedAt, UpdatedAt, UpdatedBy) - commented out
    - Breadcrumb hierarchy - commented out
    - Action buttons (DELETE, COPY) - commented out
  - Use CSS to style placeholder with appropriate spacing

## Animation Details

The upward slide animation works by:

1. **Wrapper**: Uses CSS Grid `grid-template-rows: 0fr → 1fr` for height animation
2. **Card**: Uses `transform: translateY(100%) → none` to slide from below to natural position
3. **Timing**: Same as DataCard (`var(--duration-fast)` = 100ms, `var(--ease-default)`)
4. **Positioning**: Card starts positioned below NodeHeader, slides up to sit above it

## Layout Structure

```
<div class="nodeWrapper">
  <TreeNodeDetails isOpen={isDetailsExpanded} />  <!-- Slides UP -->
  <NodeHeader ... />                              <!-- Gets pushed down -->
  <DataCard isOpen={isExpanded} />                <!-- Slides DOWN -->
</div>
```

## CSS Z-Index Layering

- TreeNodeDetails: `z-index: var(--z-base)` (1) - behind NodeHeader
- NodeHeader: `z-index: var(--z-node)` (2) - on top
- DataCard: `z-index: var(--z-base)` (1) - behind NodeHeader

## Testing Considerations

- Verify ellipsis button appears above chevron
- Verify TreeNodeDetails slides upward smoothly
- Verify NodeHeader is pushed down when details expand
- Verify state persists across page reloads
- Verify keyboard accessibility (Enter/Space on ellipsis)
- Verify animation timing matches DataCard

## Future Content Placeholders

The TreeNodeDetails component will eventually contain:

- Node metadata (CreatedAt, UpdatedAt, UpdatedBy)
- Breadcrumb hierarchy navigation
- DELETE button with confirmation
- COPY buttons (template and full node)
  These will be added in future iterations per ISSUES.md.
