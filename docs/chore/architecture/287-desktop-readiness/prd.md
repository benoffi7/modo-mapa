# PRD: Desktop Readiness — Decouple Mobile UI from Business Logic

**Issue:** #287
**Type:** chore/architecture
**Priority:** Medium
**Effort:** L (3 refactors, ~1,617 lines affected across 10 files)

## Problem

The app has 10 components/hooks tightly coupled to mobile-specific APIs (SwipeableDrawer, BottomNavigation, touch events, safe-area-inset). This prevents reusing business logic for a future desktop version without duplicating code.

Current coupling:
- 2 bottom sheets (BusinessSheet 355L, UserProfileSheet 191L) embed data logic inside SwipeableDrawer
- 1 nav bar (TabBar 102L) hardcodes BottomNavigation with no desktop variant
- 1 shell (TabShell 76L) uses fixed bottom layout with dvh units
- 2 hooks (useSwipeActions 152L, usePullToRefresh 75L) are exclusively touch-based
- 4 components consume touch hooks directly (CommentsList, CommentsListItem, PullToRefreshWrapper, SearchScreen)

## Goal

Extract platform-agnostic business logic from mobile-specific presentation so that:
1. A desktop layout can reuse 100% of business logic without forking
2. Mobile behavior is preserved exactly as-is (zero UX regression)
3. No new dependencies introduced

## Non-Goals

- Building the actual desktop UI (that's a separate feature)
- Adding responsive breakpoints or media queries
- Changing any user-facing behavior
- Touching MapView, TabContext, SelectionContext (already desktop-ready)

## Refactors

### R1: Extract BusinessSheetContent + UserProfileContent (L)

**Before:** BusinessSheet.tsx = SwipeableDrawer + tabs + data hooks + skeleton + error state all in one 355-line file.

**After:**
- `BusinessSheetContent.tsx` — tabs, data hooks, skeleton, error state (pure logic + generic MUI)
- `BusinessSheet.tsx` — thin wrapper: SwipeableDrawer + drag handle + safe-area padding, renders BusinessSheetContent
- Same pattern for UserProfileSheet → UserProfileContent + UserProfileSheet wrapper

**Success criteria:** BusinessSheetContent renders correctly inside a plain `<Box>` (testable without SwipeableDrawer).

### R2: Abstract Navigation Layout (M)

**Before:** TabBar.tsx hardcodes BottomNavigation. TabShell.tsx hardcodes bottom offset + dvh.

**After:**
- `TabBar.tsx` stays as-is (mobile bottom nav) — no changes needed
- `SideNav.tsx` — new desktop variant using MUI Drawer permanent + List (future, not in this PR)
- `TabShell.tsx` receives nav position as prop or derives from breakpoint
- `useNavLayout()` hook — returns `{ position: 'bottom' | 'left', height/width, NavComponent }` based on breakpoint

**Success criteria:** TabShell renders with `position='left'` without breaking layout math.

### R3: Decouple Swipe from Comments (M)

**Before:** CommentsList instantiates useSwipeActions, passes swipe state to CommentsListItem which spreads touch handlers.

**After:**
- CommentsListItem receives `actions: { onEdit, onDelete }` props (platform-agnostic)
- `CommentsListItemMobile` wraps CommentsListItem + useSwipeActions (touch reveal)
- Future: `CommentsListItemDesktop` wraps CommentsListItem + hover buttons
- CommentsList receives an `ItemComponent` prop (defaults to CommentsListItemMobile)

**Success criteria:** CommentsListItem renders edit/delete without touch handlers when given action callbacks.

## Risks

- **Prop drilling regression:** Extracting content from sheets may increase prop count. Mitigate with context where >3 props pass through.
- **Performance:** Extra component layers add React reconciliation work. Mitigate by using `memo` on content components.
- **Swipe UX regression:** Decoupling swipe must preserve the exact snap/settle thresholds and gesture-vs-scroll discrimination.

## Tests

- [ ] BusinessSheetContent renders tabs, switches between them, shows skeleton/error states — without SwipeableDrawer
- [ ] BusinessSheet (wrapper) opens/closes SwipeableDrawer, passes selection to content
- [ ] UserProfileContent renders profile data, medal chips, comments — without SwipeableDrawer
- [ ] TabShell renders with bottom nav (existing behavior preserved)
- [ ] CommentsListItem renders edit/delete buttons when `actions` prop provided (no swipe)
- [ ] CommentsListItemMobile renders swipe reveal (existing behavior)
- [ ] useNavLayout returns correct position based on breakpoint

## Security

No security implications — pure UI refactor, no new data flows or Firestore operations.

## Accessibility

- Extracted content components must preserve all existing aria-labels
- Desktop CommentsListItem actions must be keyboard-accessible (Tab + Enter)
- SideNav (future) must support arrow key navigation

## Copy

No user-facing text changes.
