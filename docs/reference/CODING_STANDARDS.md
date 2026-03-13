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
- Components import from `src/services/` (or `src/services/index.ts` barrel).

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
| Layout | `src/components/layout/` | App shell, side menu, error boundary |
| Business | `src/components/business/` | Business detail bottom sheet |
| Menu | `src/components/menu/` | Side menu sections (favorites, comments, etc.) |
| Admin | `src/components/admin/` | Admin dashboard panels |
| Map | `src/components/map/` | Google Maps integration |
| Search | `src/components/search/` | Search bar and filter chips |
| Stats | `src/components/stats/` | Shared chart/list components |
| Auth | `src/components/auth/` | Authentication dialogs |

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

- `src/services/index.ts` - public service functions
- `src/components/stats/index.ts` - shared chart components

Do NOT barrel-export everything; only use for frequently imported modules.

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
| `MapContext` | selectedBusiness, searchQuery, activeFilters, userLocation |

### Local State

Each component manages its own UI state (dialogs, form inputs, loading spinners).

### Caching

Two client-side cache layers reduce Firestore reads:

1. **Business view cache** (`useBusinessDataCache`): 5-min TTL for business detail queries.
2. **First-page query cache** (`usePaginatedQuery`): 2-min TTL for paginated list first pages.

Both caches are invalidated on write operations via `invalidateBusinessCache()` and `invalidateQueryCache()`.

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

---

## How to Add a New Feature

1. **Types**: Define interfaces in `src/types/`.
2. **Service**: Add CRUD functions in `src/services/` (new file or existing).
3. **Hook** (if needed): Create a custom hook in `src/hooks/`.
4. **Component**: Build the UI component.
5. **Integration**: Wire into existing layout (routes, menus, admin tabs).
6. **Update PROJECT_REFERENCE.md** with new files, types, and patterns.

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
- [ ] Firestore rules: `keys().hasOnly()` on create, ownership on update/delete, userId immutability
- [ ] Service queries use `limit()` (max 200)
- [ ] Cloud Function triggers: rate limit + moderation + counters
- [ ] Constants in `src/constants/` (no magic numbers)
- [ ] Privacy policy updated if new user data is collected
- [ ] Seed script updated for new collections (`scripts/seed-admin-data.mjs`)
