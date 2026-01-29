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
    content: Create EllipsisButton component with vertical three dots and double-tap
    status: pending
  - id: update-node-header
    content: Add button container with ellipsis + chevron to NodeHeader
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

- Vertical three-dot ellipsis button (⋮) in NodeHeader, positioned above the chevron
- Double-tap interaction pattern (same as DataField editing)
- TreeNodeDetails card that expands upward, pushing NodeHeader down
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
  - Full width (no margin-left indent like DataCard has)
  - Position above NodeHeader: `margin-bottom: -1.5px` (tuck under border)
  - z-index: `var(--z-base)` (behind NodeHeader which is `var(--z-node)`)

**Animation comparison table:**


| Aspect       | DataCard                              | TreeNodeDetails           |
| ------------ | ------------------------------------- | ------------------------- |
| Transform    | `translateY(-100%) → none`            | `translateY(100%) → none` |
| Margin       | `margin-top: -1.5px`                  | `margin-bottom: -1.5px`   |
| DOM position | After NodeHeader                      | Before NodeHeader         |
| Slides       | DOWN from above                       | UP from below             |
| Indent       | `margin-left: var(--datacard-indent)` | None (full width)         |


### 3. Ellipsis Button Component

**New File**: `src/components/EllipsisButton/EllipsisButton.tsx`

- Renders vertical three dots: `⋮`
- **Double-tap interaction** using `useDoubleTap` hook (same pattern as DataField)
- Props:
  - `onDoubleTap$: PropFunction<() => void>` - called on double-tap
  - `isExpanded?: boolean` - for aria-expanded state
- Keyboard support: Enter/Space toggles (single press, not double)
- Call `checkDoubleTap$(x, y)` on `onPointerDown$`, toggle only if returns true

**New File**: `src/components/EllipsisButton/EllipsisButton.module.css`

- Style to match chevron button aesthetic
- **Compact padding** to avoid inflating header height:
  - Use `padding: var(--space-2) var(--space-3)` (smaller than chevron's `var(--space-4)`)
- Font size: `var(--text-2xl)` (same as chevron for easy tap target)
- Color: `var(--border-default)` (same as chevron)
- No `transform: translateY()` needed (unlike chevron)

### 4. Update NodeHeader - Button Container Approach

**Key insight**: Don't add more grid columns. Instead, wrap ellipsis + chevron in a single container that stacks them vertically.

**File**: `src/components/NodeHeader/NodeHeader.tsx`

- Add `isDetailsExpanded?: boolean` prop
- Add `onDetailsToggle$?: PropFunction<() => void>` prop
- Create a **button container div** that wraps both EllipsisButton and chevron button
- The container replaces the standalone chevron as the rightmost grid cell
- Grid template **stays the same**: `1fr auto` (or `auto 1fr auto` for parent)

```jsx
<div class={styles.nodeButtons}>
    <EllipsisButton
        onDoubleTap$={props.onDetailsToggle$}
        isExpanded={props.isDetailsExpanded}
    />
    <button class={styles.nodeChevron} ...>
        {props.isExpanded ? '▾' : '◂'}
    </button>
</div>
```

**File**: `src/components/TreeNode/TreeNode.module.css`

Add new styles:

```css
.nodeButtons {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Buttons stack vertically: ellipsis on top, chevron below */
}
```

- **Adjust chevron**: Remove or reduce `transform: translateY(10px)` since buttons are now stacked
- Ensure hitboxes don't overlap (compact padding on ellipsis helps)

### 5. Update TreeNodeDisplay

**File**: `src/components/TreeNode/TreeNodeDisplay.tsx`

- Import TreeNodeDetails component
- Import `useDoubleTap` hook (for ellipsis button state, if needed at this level)
- Get details expansion state using `getNodeDetailsState` selector
- Create toggle handler: call `toggleNodeDetailsExpanded(nodeId)`
- Render TreeNodeDetails **BEFORE** NodeHeader in DOM (so it's naturally positioned above)
- Pass `isDetailsExpanded` and `onDetailsToggle$` to NodeHeader

**File**: `src/components/TreeNode/TreeNode.module.css`

- Update `.nodeWrapper` if needed to handle the new layout
- Ensure proper stacking order in the DOM:
  1. TreeNodeDetails (z-base, slides up from behind)
  2. NodeHeader (z-node, on top)
  3. DataCard (z-base, slides down from behind)

### 6. Placeholder Content

**File**: `src/components/TreeNodeDetails/TreeNodeDetails.tsx`

- Add placeholder content inside the card:
  - Simple div with "Node Details" heading
  - Placeholder text for future sections:
    - Metadata (CreatedAt, UpdatedAt, UpdatedBy)
    - Breadcrumb hierarchy
    - Action buttons (DELETE, COPY)
  - Use CSS to style placeholder with appropriate spacing

## Animation Details

The upward slide animation works by:

1. **Wrapper**: Uses CSS Grid `grid-template-rows: 0fr → 1fr` for height animation
2. **Card**: Uses `transform: translateY(100%) → none` to slide from below to natural position
3. **Timing**: Same as DataCard (`var(--duration-fast)` = 100ms, `var(--ease-default)`)
4. **Visual effect**: Card starts shifted down (overlapping NodeHeader but behind it due to z-index), then slides up into view above NodeHeader, pushing everything below it down

## Layout Structure

```
<div class="nodeWrapper">
  <TreeNodeDetails isOpen={isDetailsExpanded} />  <!-- Slides UP, pushes content down -->
  <NodeHeader>
    <div class="nodeHeaderContent">
      [UpButton if parent]
      <div>Title + Subtitle</div>
      <div class="nodeButtons">           <!-- NEW: vertical flex container -->
        <EllipsisButton />                <!-- Top: double-tap to toggle details -->
        <button class="nodeChevron" />    <!-- Bottom: single-tap to toggle DataCard -->
      </div>
    </div>
  </NodeHeader>
  <DataCard isOpen={isExpanded} />                <!-- Slides DOWN -->
</div>
```

## CSS Z-Index Layering

- TreeNodeDetails: `z-index: var(--z-base)` (1) - behind NodeHeader
- NodeHeader: `z-index: var(--z-node)` (2) - on top
- DataCard: `z-index: var(--z-base)` (1) - behind NodeHeader

## Testing Considerations

- Verify ellipsis button (⋮) appears above chevron, vertically stacked
- Verify double-tap on ellipsis toggles TreeNodeDetails
- Verify single-tap on ellipsis does NOT toggle (only double-tap)
- Verify keyboard Enter/Space on ellipsis toggles (single press)
- Verify TreeNodeDetails slides upward smoothly
- Verify NodeHeader is pushed down when details expand
- Verify header height is not inflated by the button container
- Verify state persists across page reloads
- Verify animation timing matches DataCard

## Future Content Placeholders

The TreeNodeDetails component will eventually contain:

- Node metadata (CreatedAt, UpdatedAt, UpdatedBy)
- Breadcrumb hierarchy navigation
- DELETE button with confirmation
- COPY buttons (template and full node)

These will be added in future iterations per ISSUES.md.