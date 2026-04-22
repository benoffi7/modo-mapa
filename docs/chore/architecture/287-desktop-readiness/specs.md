# Specs: Desktop Readiness — Decouple Mobile UI from Business Logic

**Issue:** #287
**PRD:** [prd.md](prd.md)

## R1: Extract Sheet Content Components

### BusinessSheetContent.tsx (NEW)

**Location:** `src/components/business/BusinessSheetContent.tsx`

**Props:**
```ts
interface BusinessSheetContentProps {
  businessId: string;
  onClose: () => void;
  onNavigateToProfile: (userId: string) => void;
}
```

**Internals moved from BusinessSheet:**
- `useBusinessData(businessId)` — fetches business, stays, ratings
- `useBusinessRating(businessId)` — user's rating
- `useVisitHistory(businessId)` — visit tracking
- `useTrending(businessId)` — trending badge
- `useUnsavedChanges()` — discard dialog
- Tab state (`useState<number>(0)`)
- Error state (`BusinessSheetError` component)
- Skeleton state (`BusinessSheetSkeleton`)
- `ResizeObserver` for sticky tabs
- All tab content: `InfoTab`, `OpinionesTab`, lazy `RecommendDialog`
- Header: `BusinessSheetHeader`
- Action bar: `FavoriteButton`, `ShareButton`, `CheckInButton`, `AddToListDialog`, `StaleBanner`

**Does NOT include:**
- `SwipeableDrawer` wrapper
- Drag handle (pill + arrow animation)
- `safe-area-inset-bottom` padding
- `maxHeight: '85dvh'`
- `STORAGE_KEY_DRAG_HANDLE_SEEN` localStorage hint

### BusinessSheet.tsx (SIMPLIFIED)

**After refactor — ~50 lines:**
```tsx
export default function BusinessSheet() {
  const { selectedBusiness, clearSelection } = useSelection();
  const open = !!selectedBusiness;

  return (
    <SwipeableDrawer anchor="bottom" open={open} onClose={clearSelection} ...>
      <DragHandle />
      <Box sx={{ maxHeight: '85dvh', pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
        {selectedBusiness && (
          <BusinessSheetContent
            businessId={selectedBusiness}
            onClose={clearSelection}
            onNavigateToProfile={handleProfileNav}
          />
        )}
      </Box>
    </SwipeableDrawer>
  );
}
```

### UserProfileContent.tsx (NEW)

**Location:** `src/components/user/UserProfileContent.tsx`

**Props:**
```ts
interface UserProfileContentProps {
  userId: string;
  onClose: () => void;
  onCommentClick: (businessId: string) => void;
}
```

**Same extraction pattern:** Move `useUserProfile`, medal rendering, stats row, comment list into content component. Shell keeps SwipeableDrawer + drag handle + safe-area.

### UserProfileSheet.tsx (SIMPLIFIED)

~30 lines. SwipeableDrawer + UserProfileContent.

---

## R2: Navigation Layout Abstraction

### useNavLayout.ts (NEW)

**Location:** `src/hooks/useNavLayout.ts`

```ts
interface NavLayout {
  position: 'bottom' | 'left';
  offset: number; // px — height for bottom, width for left
}

export function useNavLayout(): NavLayout {
  // Phase 1: always returns bottom (current behavior)
  return { position: 'bottom', offset: TAB_BAR_HEIGHT };
  // Phase 2 (future): useMediaQuery('(min-width:1024px)') → left
}
```

### TabShell.tsx changes

**Current:** Hardcoded `bottom: ${TAB_BAR_HEIGHT}px` and `height: 100dvh`.

**After:**
```tsx
const { position, offset } = useNavLayout();

// Content area
<Box sx={{
  height: '100dvh',
  pb: position === 'bottom' ? `${offset}px` : 0,
  pl: position === 'left' ? `${offset}px` : 0,
}}>
```

**TabBar stays unchanged** — it's already a clean single-responsibility component. A future `SideNav` would be a separate component, selected by `useNavLayout`.

---

## R3: Comments Action Decoupling

### CommentsListItem.tsx changes

**Current props that change:**
```ts
// REMOVE from props:
swipe: ReturnType<typeof useSwipeActions>;

// ADD to props:
actions?: {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};
```

**Rendering changes:**
- Remove `{...handlers}` spread from root Box
- Remove `style={style}` transform
- Remove swipe reveal overlay (lines 57–90)
- Add optional action buttons (visible when `actions` provided):
  ```tsx
  {actions && (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <IconButton aria-label="editar" onClick={() => actions.onEdit(id)}>
        <EditOutlined />
      </IconButton>
      <IconButton aria-label="eliminar" onClick={() => actions.onDelete(id)}>
        <DeleteOutline />
      </IconButton>
    </Box>
  )}
  ```

### CommentsListItemSwipeable.tsx (NEW)

**Location:** `src/components/profile/CommentsListItemSwipeable.tsx`
**~40 lines**

Wraps CommentsListItem with useSwipeActions touch behavior:
```tsx
function CommentsListItemSwipeable(props: CommentsListItemProps & { swipe: SwipeState }) {
  const { swipe, ...itemProps } = props;
  const handlers = swipe.getHandlers(props.comment.id);
  const style = swipe.getStyle(props.comment.id);

  return (
    <Box {...handlers} style={style} sx={{ position: 'relative' }}>
      <SwipeRevealOverlay swipe={swipe} id={props.comment.id} />
      <CommentsListItem {...itemProps} />
    </Box>
  );
}
```

### CommentsList.tsx changes

**Replace:**
```tsx
// Before
<CommentsListItem swipe={swipe} ... />

// After
<CommentsListItemSwipeable swipe={swipe} ... />
```

The `useSwipeActions()` instantiation stays in CommentsList (it manages the single-open-at-a-time state for the whole list).

---

## File inventory

| Action | File | Lines (est.) |
|--------|------|-------------|
| NEW | `src/components/business/BusinessSheetContent.tsx` | ~280 |
| EDIT | `src/components/business/BusinessSheet.tsx` | 355→~50 |
| NEW | `src/components/user/UserProfileContent.tsx` | ~150 |
| EDIT | `src/components/user/UserProfileSheet.tsx` | 191→~30 |
| NEW | `src/hooks/useNavLayout.ts` | ~15 |
| EDIT | `src/components/layout/TabShell.tsx` | 76→~85 |
| EDIT | `src/components/profile/CommentsListItem.tsx` | 226→~190 |
| NEW | `src/components/profile/CommentsListItemSwipeable.tsx` | ~40 |
| EDIT | `src/components/profile/CommentsList.tsx` | ~10 lines changed |
| NEW | Tests for new components | ~200 |

**Total:** 4 new files, 5 edited files, ~200 lines of tests.
