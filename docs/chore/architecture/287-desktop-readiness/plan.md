# Plan: Desktop Readiness — Decouple Mobile UI from Business Logic

**Issue:** #287
**Specs:** [specs.md](specs.md)
**Branch:** `chore/287-desktop-readiness`
**Base:** `new-home`

## Implementation Order

R1 → R3 → R2 (dependency order: R3 is independent, R2 is lowest risk, R1 is largest)

## Step 1: R1a — Extract BusinessSheetContent (Luna)

**Files:**
- NEW: `src/components/business/BusinessSheetContent.tsx`
- EDIT: `src/components/business/BusinessSheet.tsx`

**Actions:**
1. Read BusinessSheet.tsx fully
2. Create BusinessSheetContent.tsx — move all logic, hooks, and tab rendering
3. Simplify BusinessSheet.tsx to SwipeableDrawer wrapper + DragHandle + BusinessSheetContent
4. Ensure BusinessSheetContent accepts `businessId`, `onClose`, `onNavigateToProfile` as props
5. Move the `DragHandle` inline JSX into a small local component within BusinessSheet
6. Verify existing tests pass (`npx vitest run --dir src/components/business`)
7. Write test: BusinessSheetContent renders in isolation (inside plain Box, no SwipeableDrawer)

**Risk:** BusinessSheet has a ResizeObserver on header — make sure the ref stays in BusinessSheetContent since it's the component that renders the header.

## Step 2: R1b — Extract UserProfileContent (Luna)

**Files:**
- NEW: `src/components/user/UserProfileContent.tsx`
- EDIT: `src/components/user/UserProfileSheet.tsx`

**Actions:**
1. Read UserProfileSheet.tsx fully
2. Create UserProfileContent.tsx — move useUserProfile, medals, stats, comment list
3. Simplify UserProfileSheet.tsx to SwipeableDrawer wrapper
4. Verify existing tests pass
5. Write test: UserProfileContent renders with mock user data

## Step 3: R3 — Decouple Swipe from Comments (Luna)

**Files:**
- EDIT: `src/components/profile/CommentsListItem.tsx` — remove swipe props, add `actions?` prop
- NEW: `src/components/profile/CommentsListItemSwipeable.tsx` — swipe wrapper
- EDIT: `src/components/profile/CommentsList.tsx` — use CommentsListItemSwipeable

**Actions:**
1. Read CommentsListItem.tsx, CommentsList.tsx, useSwipeActions.ts
2. In CommentsListItem.tsx:
   - Remove `swipe` prop and all touch handler spreading
   - Remove swipe reveal overlay JSX (lines 57-90)
   - Add optional `actions?: { onEdit, onDelete }` prop
   - When `actions` provided, render IconButtons inline (with aria-labels)
3. Create CommentsListItemSwipeable.tsx:
   - Accept same props as CommentsListItem + `swipe` from useSwipeActions
   - Wrap CommentsListItem with touch handlers and reveal overlay
4. In CommentsList.tsx:
   - Change import from CommentsListItem to CommentsListItemSwipeable
   - Pass swipe prop to CommentsListItemSwipeable (no other changes)
5. Run full test suite: `npx vitest run --dir src/components/profile`
6. Write test: CommentsListItem renders edit/delete buttons with `actions` prop

**Risk:** The swipe overlay has delete-left (red) and edit-right (primary) color coding. Extract the overlay JSX cleanly into CommentsListItemSwipeable.

## Step 4: R2 — Navigation Layout Abstraction (Luna)

**Files:**
- NEW: `src/hooks/useNavLayout.ts`
- EDIT: `src/components/layout/TabShell.tsx`

**Actions:**
1. Create useNavLayout.ts — returns `{ position: 'bottom', offset: TAB_BAR_HEIGHT }` (hardcoded for now)
2. In TabShell.tsx:
   - Import useNavLayout
   - Replace hardcoded `bottom: ${TAB_BAR_HEIGHT}px` with dynamic offset based on position
3. Run tests: `npx vitest run --dir src/components/layout`
4. Write test: useNavLayout returns bottom/64 by default

**Risk:** Minimal — this step is a thin abstraction with zero behavioral change.

## Step 5: Verify + Lint + Commit

1. `npm run lint` — fix any issues
2. `npx vitest run` — full suite
3. `npx vite build` — build check
4. Commit with descriptive message

## Token Budget Estimate

| Step | Complexity | Est. tokens |
|------|-----------|-------------|
| R1a (BusinessSheetContent) | High — largest file, many hooks | 15k |
| R1b (UserProfileContent) | Medium — smaller, same pattern | 8k |
| R3 (Comments swipe) | Medium — surgical extraction | 10k |
| R2 (Nav layout) | Low — thin hook + small edit | 5k |
| Tests | Medium — 4 test files | 10k |
| **Total** | | **~48k** |

## Parallelization

Steps 1-2 (R1a + R1b) can run in parallel if using worktrees. Steps 3-4 are independent of each other but both depend on Steps 1-2 being done (for integration testing). Recommended: sequential execution to minimize merge conflicts since files are in different directories and won't conflict.

## Rollback

Each refactor is independently revertable via `git revert` since they touch different file sets. No database migrations or config changes.
