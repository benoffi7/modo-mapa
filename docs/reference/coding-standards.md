# Coding Standards - Modo Mapa

This document defines the architecture, conventions, and patterns used in the Modo Mapa project. All contributors should follow these standards when adding or modifying code.

---

## Project Architecture

### Layer Overview

```text
src/
  services/    -> Firestore abstraction layer (reads/writes)
  hooks/       -> React hooks (state, side-effects, data fetching)
  components/  -> UI components (presentational + container)
  context/     -> React Context providers (global state)
  config/      -> Firebase config, converters, collection names
  types/       -> TypeScript interfaces and constants
  utils/       -> Pure utility functions (formatting, helpers)
  pages/       -> Route-level entry points
  theme/       -> MUI theme configuration
  data/        -> Static data (businesses.json)
```

### Data Flow

1. **Components** call **services** for Firestore CRUD operations.
2. **Services** use `firebase/firestore` SDK internally and export clean async functions.
3. **Hooks** orchestrate data fetching and state management.
4. **Components** never import `firebase/firestore` directly for writes; they call service functions.
5. **Converters** handle Firestore `DocumentSnapshot` to typed object conversion.

### Service Layer (`src/services/`)

Every Firestore collection has a corresponding service module:

| Module | Collection | Operations |
|--------|-----------|------------|
| `favorites.ts` | `favorites` | add, remove |
| `ratings.ts` | `ratings` | upsert, delete, upsertCriteriaRating |
| `comments.ts` | `comments` | add, edit, delete, like, unlike |
| `tags.ts` | `userTags`, `customTags` | add, remove, create, update, delete |
| `feedback.ts` | `feedback` | send |
| `priceLevels.ts` | `priceLevels` | upsert, delete |
| `menuPhotos.ts` | `menuPhotos` | upload, getForBusiness, report |
| `suggestions.ts` | — | fetchUserSuggestionData (aggregates favorites, ratings, userTags) |
| `admin.ts` | All collections | fetch (read-only, admin queries) |
| `userProfile.ts` | `users`, etc. | fetchUserProfile (read-only aggregate) |
| `rankings.ts` | `userRankings` | fetchLatestRanking |

**Rules:**

- Service functions are plain `async` functions, not hooks.
- They accept primitive parameters (userId, businessId, etc.), not Firebase objects.
- They **validate input** as a first line of defense (defense in depth): text lengths, score ranges, enum whitelists.
- They use strict types (`FeedbackCategory`, `PredefinedTagId`) instead of plain `string`.
- They handle cache invalidation internally (e.g., `invalidateQueryCache`).
- Components import from `src/services/` (individual modules, barrel was removed in #232).

**Input validation examples:**

```typescript
// comments.ts - validate text length
if (!trimmedText || trimmedText.length > 500) throw new Error('Comment text must be 1-500 characters');

// tags.ts - validate against whitelist
if (!VALID_TAG_IDS.includes(tagId)) throw new Error(`Invalid tagId: ${tagId}`);

// ratings.ts - validate score range
if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error('Score must be 1-5');
```

---

## Component Patterns

### Component Categories

| Category | Location | Responsibility |
|----------|----------|---------------|
| Pages | `src/pages/` | Route-level entry points (lazy loaded) |
| Layout | `src/components/layout/` | App shell, tab bar, error boundary |
| Home | `src/components/home/` | Home screen (greeting, specials, trending, suggestions) |
| Search | `src/components/search/` | Search bar, filter chips, list view |
| Business | `src/components/business/` | Business detail bottom sheet and sub-components |
| Social | `src/components/social/` | Activity feed, rankings, followed list, recommendations |
| Lists | `src/components/lists/` | Favorites, shared lists, collaborative lists, recents |
| Profile | `src/components/profile/` | Profile screen, settings, stats, achievements, feedback |
| Map | `src/components/map/` | Google Maps integration, markers, FABs |
| Admin | `src/components/admin/` | Admin dashboard panels (15+ tabs) |
| Admin/Perf | `src/components/admin/perf/` | Performance monitoring sub-components |
| Admin/Alerts | `src/components/admin/alerts/` | Abuse alerts and reincidentes |
| Auth | `src/components/auth/` | Authentication dialogs (email/password, change password) |
| Common | `src/components/common/` | Shared UI (DiscardDialog, PaginatedListShell, PullToRefreshWrapper) |
| UI | `src/components/ui/` | Indicators and banners (offline, stale, rating prompt) |

### Admin Panel Pattern

All admin panels follow the same pattern using `useAsyncData` + `AdminPanelWrapper`:

```typescript
import { useCallback } from 'react';
import { fetchSomeData } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import AdminPanelWrapper from './AdminPanelWrapper';

export default function SomePanel() {
  const fetcher = useCallback(() => fetchSomeData(), []);
  const { data, loading, error } = useAsyncData(fetcher);

  return (
    <AdminPanelWrapper
      loading={loading}
      error={error}
      errorMessage="Error cargando datos."
    >
      {/* Panel content using data */}
    </AdminPanelWrapper>
  );
}
```

### Props-Driven Business Components

`BusinessRating`, `BusinessComments`, `BusinessTags`, and `FavoriteButton` receive data as props from `BusinessSheet`. They do not make their own Firestore queries. `BusinessSheet` orchestrates all data via `useBusinessData`.

### Component Decomposition

Keep components under 300 lines. When a component grows beyond this:

1. Extract sub-components to separate files with `React.memo`.
2. Extract types to a `*Types.ts` file.
3. Extract pure utility functions to a `*Utils.ts` file.
4. Extract hooks for complex state logic.
5. The main component becomes an orchestrator that delegates rendering.

**Examples in the codebase:**

- `BackupsPanel` -> `BackupTable`, `BackupConfirmDialog`, `backupTypes`, `backupUtils`
- `BusinessTags` -> `CustomTagDialog`, `DeleteTagDialog`

---

## TypeScript Conventions

### `verbatimModuleSyntax`

The project uses `verbatimModuleSyntax: true` in tsconfig. This means:

```typescript
// CORRECT: use `import type` for type-only imports
import type { Business, Comment } from '../types';
import type { FirestoreDataConverter } from 'firebase/firestore';

// INCORRECT: will cause build errors
import { Business, Comment } from '../types';  // if only used as types
```

### `exactOptionalPropertyTypes`

Enabled in tsconfig. Optional properties require explicit `| undefined`:

```typescript
interface Props {
  flagged?: boolean;  // can be true, false, or absent
}

// To assign undefined explicitly:
const obj: Props = { flagged: undefined };  // ERROR
const obj: Props = {};  // CORRECT
```

### Type Safety

- Avoid `as` type casts. Use type guards or helper functions instead:

  ```typescript
  // AVOID
  const val = d.field as number;

  // PREFER
  function asNumber(val: unknown, fallback = 0): number {
    return typeof val === 'number' ? val : fallback;
  }
  const val = asNumber(d.field);
  ```

- Use the shared `toDate()` from `src/utils/formatDate.ts` for Firestore timestamps.
- Define interfaces for all component props.
- Use `const` assertions for static arrays/objects (`as const`).

### Type Organization

| File | Content |
|------|---------|
| `types/index.ts` | Business, Rating, Comment, UserTag, CustomTag, Favorite, Feedback, PREDEFINED\_TAGS, CATEGORY\_LABELS |
| `types/admin.ts` | AdminCounters, DailyMetrics, AbuseLog |
| `types/metrics.ts` | PublicMetrics, TopTagEntry, TopBusinessEntry, TopRatedEntry |

---

## Naming Conventions

### Files

- Components: `PascalCase.tsx` (e.g., `BusinessSheet.tsx`)
- Hooks: `camelCase.ts` starting with `use` (e.g., `useBusinessData.ts`)
- Services: `camelCase.ts` matching the collection (e.g., `favorites.ts`)
- Utils: `camelCase.ts` describing the utility (e.g., `formatDate.ts`)
- Types: `camelCase.ts` (e.g., `admin.ts`, `metrics.ts`)
- Config: `camelCase.ts` (e.g., `firebase.ts`, `collections.ts`)

### Variables and Functions

- Components: `PascalCase` (e.g., `BusinessSheet`)
- Hooks: `camelCase` starting with `use` (e.g., `useBusinessData`)
- Service functions: `verbAction` (e.g., `addFavorite`, `fetchCounters`, `upsertRating`)
- Constants: `SCREAMING_SNAKE_CASE` for collections, tags, categories
- Interfaces/Types: `PascalCase` (e.g., `BusinessCategory`, `UseAsyncDataReturn`)

### Collections

All Firestore collection names are centralized in `src/config/collections.ts`. Never use string literals for collection names.

---

## File Organization

### Import Order

Organize imports in this order, with a blank line between groups:

1. React imports
2. Third-party libraries (MUI, Firebase, recharts, etc.)
3. Local config/context
4. Local hooks
5. Local services
6. Local utils
7. Local components
8. Type-only imports (with `import type`)

### Barrel Exports

Use barrel exports (`index.ts`) for:

- `src/components/stats/index.ts` - shared chart components

Do NOT barrel-export everything; only use for frequently imported modules. Note: `src/services/index.ts` barrel was removed in #232 — import individual service modules directly.

---

## Error Handling

### Service Layer

Service functions let errors propagate. The calling component catches them:

```typescript
try {
  await addComment(userId, userName, businessId, text);
} catch (error) {
  console.error('Error adding comment:', error);
}
```

### Hooks

`useAsyncData` catches errors and exposes an `error` boolean. `usePaginatedQuery` follows the same pattern.

### Components

- Use `AdminPanelWrapper` for admin panels (handles loading/error states).
- Use `ErrorBoundary` for top-level error catching.
- Show user-friendly error messages in Spanish (es-AR locale).

---

## State Management

### Global State (Context)

| Context | State |
|---------|-------|
| `AuthContext` | user, displayName, signInWithGoogle, signOut, setDisplayName |
| `SelectionContext` | Selected business ID |
| `FiltersContext` | Active search filters (split from MapContext) |
| `ConnectivityContext` | Online/offline status, consumed via `useConnectivity` |
| `OnboardingContext` | Onboarding flow state and checklist progress |
| `NotificationsContext` | Unread notification count and polling |

### Local State

Each component manages its own UI state (dialogs, form inputs, loading spinners).

### Caching (3 tiers)

Three client-side cache layers reduce Firestore reads:

1. **Business view cache** (`useBusinessDataCache`): In-memory `Map` with 5-min TTL for business detail queries.
2. **First-page query cache** (`queryCache.ts`): In-memory cache with 2-min TTL for paginated list first pages.
3. **Read cache** (`readCache.ts`): IndexedDB-backed LRU cache (20 entries) for offline reading of business data.

Data flow: `useBusinessData` checks memory cache → IndexedDB (`readCache`) → Firestore. When data comes from IndexedDB, it is marked `stale: true` and `StaleBanner` is shown.

All caches are invalidated on write operations via `invalidateBusinessCache()` and `invalidateQueryCache()`.

**Decision rule:** Use memory cache for re-render performance, IndexedDB for persistence between sessions, Firestore as source of truth.

### Offline Support

The project implements an offline-first pattern for write operations:

1. **Detection**: `ConnectivityContext` tracks online/offline via `navigator.onLine` + `online`/`offline` events.
2. **Interception**: `withOfflineSupport<T>(fn, offlineAction)` wraps service calls. If offline, enqueues the action instead of executing.
3. **Queue**: `offlineQueue.ts` uses IndexedDB to persist pending actions across sessions. Supports `enqueue`, `getPending`, `subscribe`.
4. **Sync**: `syncEngine.ts` processes the queue on reconnect. `executeAction` maps action types back to service functions. `processQueue` handles retries and error logging.
5. **UI**: `OfflineIndicator` shows a banner. `PendingActionsSection` in Profile shows queued actions count.

**Pattern for wrapping a service call:**

```typescript
await withOfflineSupport(
  () => addComment(userId, userName, businessId, text),
  { type: 'addComment', payload: { userId, userName, businessId, text } }
);
```

### Deep Linking

**Location:** `src/hooks/useDeepLinks.ts`, called from `TabShell.tsx`.

URL-based navigation via `useDeepLinks()` hook:

- `?business={id}` — opens BusinessSheet for the given business (validated with `BUSINESS_ID_RE = /^biz_\d{1,6}$/`)
- `?business={id}&sheetTab=opiniones` — opens specific tab in BusinessSheet
- `?list={id}` — navigates to Lists tab and opens the specified list

The hook reads `window.location.search` on mount, dispatches navigation actions via context, then removes consumed params from the URL (`replace: true`).

**Decision rule:** To add a new deep link, add a case in `useDeepLinks.ts`, validate input with regex, and clean the param after consuming it.

### Optimistic Updates

Six variants of optimistic UI, choose based on the interaction:

| Variant | Pattern | When to use | Example |
|---------|---------|-------------|---------|
| **Map-based toggle** | `useOptimisticLikes` — Map of toggled IDs + delta count | N items that can be independently toggled | Comment likes |
| **Pending state** | `pendingRating` / `pendingLevel` local state | Single value being updated | Rating, price level |
| **Derived state** | `prevIsFavorite` + `optimistic` flag | Parent re-renders could overwrite optimistic value | `FavoriteButton` |
| **Undo delete** | `useUndoDelete` — Map of pending deletes + timer + Snackbar | Destructive but reversible action | Delete comment |
| **Revert on error** | `useFollow` — toggle immediately, catch + revert | No undo UI, just silent rollback | Follow/unfollow |
| **Settings revert** | `useUserSettings` — update immediately, revert full object on error | Object with multiple fields | User settings |

**Rule:** Always use optimistic updates for user-facing actions. Choose variant from the table above.

### Cursor-Based Pagination

`usePaginatedQuery<T>` handles Firestore cursor pagination:

- **API**: `usePaginatedQuery<T>(collectionRef, constraints, orderByField, pageSize, cacheKey)`
- Stores `QueryDocumentSnapshot` as cursor for `startAfter()`
- `cacheKey` is mandatory for cache compatibility with `queryCache.ts`
- First page is cached (2-min TTL)
- `loadAll(maxItems)` fetches all pages async with `hasMoreRef` safety
- Backward compat: `constraints` accepts `string` (userId) or `QueryConstraint[]`
- Components should NOT import `QueryDocumentSnapshot` directly — keep cursor management inside hooks
- Used in: `FavoritesList`, `CommentsList`, `RatingsList`, `FollowedList`

**Rule:** Always provide a unique `cacheKey` per query. For user lists, use `userId` as key.

### Converter Layers

Three converter files handle Firestore ↔ TypeScript transformations:

| File | Purpose | Who reads |
|------|---------|-----------|
| `config/converters.ts` | Standard entity converters (Rating, Comment, Favorite, etc.) | User-facing reads |
| `config/adminConverters.ts` | Admin-specific converters (DailyMetrics, AbuseLog, PerfMetrics) | Admin panel reads |
| `config/metricsConverter.ts` | Public metrics transformation | Public metrics (no auth) |

**Rules:**
- Reads always use `withConverter<T>()`. Writes never use converters (because of `serverTimestamp()`).
- All converters use `toDate()` from `src/utils/formatDate.ts` for timestamps.
- Never duplicate conversion logic across converter files.

### Persistence Decision Guide

| Storage | When to use | Examples in codebase | Survives reload |
|---------|------------|---------------------|-----------------|
| React state | UI-only state (dialogs, form inputs) | Dialog open, loading spinners | No |
| Context | Shared app state across components | Auth user, selected business, active tab, connectivity | No (unless backed by localStorage) |
| In-memory cache | Query results, business data (2-5 min TTL) | `useBusinessDataCache` Map, `queryCache.ts` Map | No |
| `localStorage` | Preferences, flags, small data (<10KB) | Color mode, remembered email, onboarding flags, visit history, quick actions order | Yes |
| IndexedDB | Cache of large data, offline queue | `readCache.ts` (business data), `offlineQueue.ts` (pending writes) | Yes |
| Firestore | User data, content | Ratings, comments, settings, follows | Yes |

**Quick decision:**
1. UI preference or boolean flag? → `localStorage`
2. Shared across components in same session? → Context
3. Large data cache or offline write queue? → IndexedDB

### Screen Tracking

**Location:** `src/hooks/useScreenTracking.ts`

- Tracks `screen_view` event on every route change via `trackEvent('screen_view', { screen_name })`
- Naming: path `/` → `map`, `/admin/users` → `admin_users`
- Called once in `App.tsx` — no per-component integration needed
- **Rule:** Never add manual screen tracking; the hook handles all routes automatically

### Analytics Events

**Location:** `src/utils/analytics.ts` (wrapper), event constants in components/hooks.

Track user interactions via `trackEvent(name, params?)`:

- Only active in production when `analyticsEnabled` is true
- Events use `snake_case` naming: `{feature}_{action}` (e.g., `business_view`, `rating_submit`, `offline_action_queued`)
- Always include relevant IDs in params (e.g., `{ businessId }`)
- **Rule:** Never use string literals for event names in `trackEvent`. Define constants with `EVT_` prefix in `SCREAMING_SNAKE_CASE`

### Component Sub-folder Organization

**Decision rule:** Create a sub-folder when a component has 3+ related files (main component + subcomponents/types/utils).

Standard sub-folder structure:

```text
ComponentName/
  ComponentName.tsx      # Main orchestrator
  SubComponent.tsx       # Subcomponents with React.memo
  componentHelpers.ts    # Pure utility functions
  componentTypes.ts      # Types/interfaces (optional)
```

If a component has 1-2 files, keep it flat in the parent folder.

**Examples:**
- `admin/perf/` — 5 files (SemaphoreCard, QueryLatencyTable, FunctionTimingTable, StorageCard, perfHelpers) → sub-folder
- `admin/alerts/` — 3 files (KpiCard, alertsHelpers, ReincidentesView) → sub-folder
- `business/CustomTagDialog.tsx` — 1 file → flat

---

## SOLID Principles

### Single Responsibility

- **Services**: one module per Firestore collection, only CRUD operations.
- **Hooks**: one concern per hook (`useAsyncData` for loading, `useListFilters` for filtering).
- **Components**: one visual concern per component.

### Open/Closed

- `useAsyncData<T>` is generic and works with any fetcher function.
- `usePaginatedQuery<T>` is generic for any paginated Firestore collection.
- `AdminPanelWrapper` wraps any admin panel without modification.

### Liskov Substitution

- All Firestore converters implement `FirestoreDataConverter<T>`.
- Service functions follow consistent patterns (accept primitives, return `Promise<void>`).

### Interface Segregation

- Components receive only the props they need (e.g., `BusinessRating` receives `ratings[]`, not the full business data object).
- Hooks expose minimal return interfaces.

### Dependency Inversion

- Components depend on service abstractions, not on Firestore SDK directly.
- The service layer depends on config modules (`collections.ts`, `firebase.ts`).
- Converters handle the Firestore-specific data transformation.

---

## Integration Rules

### No placeholder props

When connecting a component to a parent (e.g., adding a section to SideMenu), every action prop (`onClick`, `onSelect`, `onNavigate`) **must** have a real, functional handler. Never commit noop callbacks like `() => {}`.

If the handler needs state or logic that doesn't exist yet, create it in the same step. If truly blocked, use `throw new Error('not implemented')` so it fails loudly instead of silently doing nothing.

---

## Security Coding Standards

### Firestore Rules — Mandatory Patterns

When adding a new Firestore collection, ALL of these patterns must be applied:

1. **`keys().hasOnly([...])`** on every `create` rule — prevents field injection.
2. **Ownership check on update/delete**: always use `resource.data.userId == request.auth.uid` (existing doc), never `request.resource.data.userId`.
3. **userId immutability on update**: add `request.resource.data.userId == resource.data.userId`.
4. **`affectedKeys().hasOnly([...])`** on update rules when the collection has server-managed fields (like `replyCount`, `likeCount`, `flagged`).
5. **Server timestamps**: `createdAt == request.time` on create, `updatedAt == request.time` on update.

### Server-Side Data Integrity

Fields managed by Cloud Functions (never writable by clients):

| Field | Collection | Managed by |
|-------|-----------|------------|
| `replyCount` | `comments` | `onCommentCreated` / `onCommentDeleted` |
| `likeCount` | `comments` | `onCommentLikeCreated` / `onCommentLikeDeleted` |
| `flagged` | `comments` | `onCommentCreated` / `onCommentUpdated` (moderation) |
| `reportCount` | `menuPhotos` | `reportMenuPhoto` callable |
| `thumbnailPath` | `menuPhotos` | `onMenuPhotoCreated` |

### Service Layer — Defense in Depth

Services validate input before sending to Firestore (even though rules also validate):

- Text lengths, score ranges, enum whitelists
- `limit()` on all queries that could return unbounded results (max 200)
- Trimming text input before write

### Cloud Functions — Checklist for New Triggers

- Add rate limiting via `checkRateLimit()` if user-facing
- Add content moderation via `checkModeration()` for text fields
- Update counters via `incrementCounter()` / `trackWrite()` / `trackDelete()`
- Use `FieldValue.increment()` for atomic counter updates
- Implement cascade deletes if the doc has child relationships

### Cloud Functions — Checklist for New Callable Functions

See full procedures in [docs/procedures/cloud-functions-staging.md](../procedures/cloud-functions-staging.md).

- Use `getDb(databaseId)` from `helpers/env.ts`, **never** `getFirestore()` directly
- Use `enforceAppCheck: ENFORCE_APP_CHECK` from `helpers/env.ts`, **never** `!IS_EMULATOR`
- Accept optional `databaseId` parameter from the client for staging DB support
- Admin-only functions: use `assertAdmin(request.auth)` for authentication
- Export the function in `functions/src/index.ts`
- Update test mocks to include `getDb` in the `helpers/env` mock
- **Never** use `as never` type casts — fix the types properly
- **Never** use `.catch(() => {})` — always log errors: `.catch((err) => console.error(...))`

### Cloud Functions — Admin Panel Queries

- **Collections with simple rules (1-2 conditions):** Direct Firestore queries from the frontend are OK.
- **Collections with complex rules (3+ OR conditions):** **Must** use a Cloud Function with Admin SDK.
  Complex OR rules (e.g., `isOwner || isEditor || isPublic || isFeatured`) block Firestore collection queries
  even when the filter matches a permitted condition. This is a Firestore security rules limitation.

### Staging Compatibility

The project uses a separate Firestore database (`staging`) for the staging environment.
Cloud Functions are shared between prod and staging (single Firebase project).

- **Triggers/scheduled functions:** Always operate on the default DB. Staging data in the `staging` DB
  will NOT trigger these functions.
- **Callable functions:** Must accept optional `databaseId` from the client. The staging frontend passes
  `VITE_FIRESTORE_DATABASE_ID` to callable functions so they query the correct database.
- **Deploy:** `deploy-staging.yml` auto-deploys functions when `functions/src/` changes.
- **Validation:** Run `scripts/pre-staging-check.sh` before pushing to staging.

---

## How to Add a New Feature

1. **Types**: Define interfaces in `src/types/`.
2. **Service**: Add CRUD functions in `src/services/` (new file or existing).
3. **Hook** (if needed): Create a custom hook in `src/hooks/`.
4. **Component**: Build the UI component.
5. **Tests**: Write tests (≥80% coverage). See [tests.md](tests.md) for patterns.
6. **Integration**: Wire into existing layout (routes, menus, admin tabs).
7. **Update project-reference.md** with new files, types, and patterns.

### Checklist

- [ ] Types use `import type` for type-only imports
- [ ] No direct Firestore imports in components (use services)
- [ ] Collection names from `COLLECTIONS` constant
- [ ] Converters use `toDate()` from shared utils
- [ ] Admin panels use `useAsyncData` + `AdminPanelWrapper`
- [ ] Component under 300 lines
- [ ] Imports ordered correctly
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` has no errors
- [ ] Tests pass (`npm run test:run`) with ≥80% coverage on new code
- [ ] Firestore rules: `keys().hasOnly()` on create, ownership on update/delete, userId immutability
- [ ] Service queries use `limit()` (max 200)
- [ ] Cloud Function triggers: rate limit + moderation + counters
- [ ] Cloud Function callables: `getDb(databaseId)` + `ENFORCE_APP_CHECK` + no `as never` casts
- [ ] No silent `.catch(() => {})` — always log errors
- [ ] Constants in `src/constants/` (no magic numbers)
- [ ] Privacy policy updated if new user data is collected
- [ ] Seed script updated for new collections (`scripts/seed-admin-data.mjs`)
- [ ] Run `scripts/pre-staging-check.sh` before pushing to staging
