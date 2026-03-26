# PRD: Comments Module -- Admin Dashboard Gaps

**Feature:** comments-admin-gaps
**Fecha:** 2026-03-14
**Prioridad:** Alta (moderation blindspot)
**Trigger:** Audit post feat/comments-improvements

---

## Problem

The comments module stores and tracks several data points that are invisible
to admins:

- **Edited comments** (`updatedAt`) -- admin cannot tell if a comment was
  modified after initial review or flagging.
- **Like counts** (`likeCount`) -- admin cannot identify high-engagement
  or controversial comments.
- **Reply structure** (`parentId`, `replyCount`) -- admin cannot see thread
  context, making moderation harder.
- **Total likes counter** -- DashboardOverview shows counters for comments,
  ratings, favorites, feedback, and users but NOT for commentLikes.
- **Likes trend** -- TrendsPanel charts comments, ratings, favorites, feedback,
  and tags over time but NOT commentLikes.
- **User-level like stats** -- UsersPanel ranks users by comments, ratings,
  favorites, tags, and feedback but NOT by likes given or received.

---

## Solution

Enhance existing admin panels (no new tabs required).

### S1: ActivityFeed Comments Table Enhancements

Add columns/indicators to the comments tab in ActivityFeed:

| Column/Indicator | Source | Display |
|------------------|--------|---------|
| "(editado)" | `comment.updatedAt` | Chip next to date if `updatedAt` exists |
| Likes | `comment.likeCount` | Number, 0 shown as dash |
| Replies | `comment.replyCount` | Number, 0 shown as dash |
| "Respuesta" | `comment.parentId` | Chip if `parentId` exists |

**File:** `src/components/admin/ActivityFeed.tsx`

### S2: DashboardOverview -- Total Likes Counter

- Add `commentLikes` field to `AdminCounters` type.
- Read the counter from `config/counters` doc (already incremented by
  Cloud Function `onCommentLikeCreated`/`onCommentLikeDeleted`).
- Display as StatCard alongside existing counters.

**Files:**

- `src/types/admin.ts` (add field)
- `src/config/adminConverters.ts` (read field)
- `src/components/admin/DashboardOverview.tsx` (add StatCard)

### S3: TrendsPanel -- Likes Line

- Extract `writesByCollection.commentLikes` in the `aggregate` function.
- Add a new line to the "Actividad por tipo" chart.

**File:** `src/components/admin/TrendsPanel.tsx`

### S4: UsersPanel -- Like Stats

- Include `commentLikes` collection in `fetchUsersPanelData`.
- Count likes given per user.
- Add "Mas likes dados" TopList.

**Files:**

- `src/services/admin.ts` (fetch commentLikes in `fetchUsersPanelData`)
- `src/components/admin/UsersPanel.tsx` (add stat + TopList)

### S5 (Medium): Edit and Reply Ratios

- In DashboardOverview or a new "Comments Health" section, show:
  - Edited comments count (query `comments` where `updatedAt != null`).
  - Reply count (query `comments` where `parentId != null`).
- Alternative: add these as counters maintained by Cloud Functions.

**Files:**

- `src/services/admin.ts` (new query functions)
- `src/components/admin/DashboardOverview.tsx` (new stats section)

---

## Scope

| Item | Priority | Effort |
|------|----------|--------|
| S1: ActivityFeed columns | Critical | S |
| S2: Total likes counter | Critical | S |
| S3: Likes trend line | Medium | S |
| S4: User like stats | Medium | M |
| S5: Edit/reply ratios | Low | M |

---

## Out of Scope

- New admin tab dedicated to comments (existing panels are sufficient).
- Moderation actions (approve/reject comments) -- separate feature.
- Firebase Analytics event surfacing in admin (these remain in Firebase
  console; only Firestore data is exposed in admin).

---

## Success Criteria

1. Admin can see at a glance which comments are edited, liked, and threaded
   in the ActivityFeed.
2. DashboardOverview shows total commentLikes alongside other counters.
3. TrendsPanel shows likes activity over time.
4. UsersPanel shows top likers.
5. All new columns/stats use existing Firestore data -- no new Cloud
   Functions required for S1-S4.

---

## Dependencies

- `feat/comments-improvements` must be merged first (introduces `updatedAt`,
  `replyCount`, `likeCount` in the Comment type and Cloud Functions).
- `AdminCounters` in the Cloud Function `incrementCounter` already tracks
  `commentLikes` -- the admin UI just needs to read it.
