# Specs: Admin panels — migrate to service layer

**PRD:** [1-admin-service-layer.md](1-admin-service-layer.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No schema changes. Both collections already exist with rules in place.

### New TypeScript interfaces

```typescript
// src/types/admin.ts — append

export interface Special {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: 'featured_list' | 'trending' | 'custom_link';
  referenceId: string;
  order: number;
  active: boolean;
}

export interface AchievementCondition {
  metric: string;
  threshold: number;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  order: number;
  active: boolean;
}
```

These interfaces are currently duplicated inline in `SpecialsPanel.tsx`, `AchievementsPanel.tsx`, and `SpecialsSection.tsx`. They will be centralized in `src/types/admin.ts` and re-exported from `src/types/index.ts`.

## Firestore Rules

No changes needed. Both collections already have the correct rules:

```
match /specials/{docId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}

match /achievements/{docId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}
```

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchSpecials()` in `services/specials.ts` | specials | Any authenticated | `allow read: if request.auth != null` | No |
| `fetchActiveSpecials()` in `services/specials.ts` | specials | Any authenticated | `allow read: if request.auth != null` | No |
| `saveSpecials(specials)` in `services/specials.ts` | specials | Admin (Google Sign-In) | `allow write: if isAdmin()` | No |
| `deleteSpecial(id)` in `services/specials.ts` | specials | Admin | `allow write: if isAdmin()` | No |
| `fetchAchievements()` in `services/achievements.ts` | achievements | Any authenticated | `allow read: if request.auth != null` | No |
| `saveAchievements(achievements)` in `services/achievements.ts` | achievements | Admin | `allow write: if isAdmin()` | No |
| `deleteAchievement(id)` in `services/achievements.ts` | achievements | Admin | `allow write: if isAdmin()` | No |

All queries work with existing rules. No changes needed.

## Cloud Functions

No changes. Existing Cloud Functions for these collections remain untouched.

## Componentes

### Modified: `SpecialsPanel` (`src/components/admin/SpecialsPanel.tsx`)

- **Remove:** All `firebase/firestore` imports (`collection`, `getDocs`, `doc`, `setDoc`, `deleteDoc`, `orderBy`, `query`)
- **Remove:** `db` import from `../../config/firebase`
- **Remove:** `COLLECTIONS` import from `../../config/collections`
- **Remove:** Inline `Special` interface definition
- **Add:** Import `Special` from `../../types`
- **Add:** Import `{ fetchSpecials, saveAllSpecials }` from `../../services/specials`
- **Replace:** `load()` body with call to `fetchSpecials()`
- **Replace:** `saveAll()` body with call to `saveAllSpecials(specials)`

### Modified: `AchievementsPanel` (`src/components/admin/AchievementsPanel.tsx`)

- **Remove:** All `firebase/firestore` imports
- **Remove:** `db` import, `COLLECTIONS` import
- **Remove:** Inline `Achievement` and `AchievementCondition` interface definitions
- **Add:** Import `Achievement` from `../../types`
- **Add:** Import `{ fetchAchievements, saveAllAchievements }` from `../../services/achievements`
- **Replace:** `load()` body with call to `fetchAchievements()`
- **Replace:** `saveAll()` body with call to `saveAllAchievements(achievements)`

### Modified: `SpecialsSection` (`src/components/home/SpecialsSection.tsx`)

- **Remove:** `firebase/firestore` imports (`collection`, `getDocs`, `query`, `where`, `orderBy`)
- **Remove:** `db` import from `../../config/firebase`
- **Remove:** `COLLECTIONS` import from `../../config/collections`
- **Remove:** Inline `Special` interface definition
- **Remove:** `console.warn` (replace with `logger.warn`)
- **Add:** Import `Special` from `../../types`
- **Add:** Import `{ fetchActiveSpecials }` from `../../services/specials`
- **Add:** Import `{ logger }` from `../../utils/logger`
- **Replace:** `useEffect` body with call to `fetchActiveSpecials()`

## Hooks

No new hooks. The admin panels use local state (`useState`) for CRUD form management, which is appropriate for admin-only screens. No custom hooks needed.

## Servicios

### New: `src/services/specials.ts`

```typescript
/**
 * Firestore service for the `specials` collection.
 */
import { collection, getDocs, doc, setDoc, deleteDoc, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import type { Special } from '../types';

/** Fetch all specials ordered by `order` field (admin use). */
export async function fetchSpecials(): Promise<Special[]>;

/** Fetch only active specials ordered by `order` field (user-facing use). */
export async function fetchActiveSpecials(): Promise<Special[]>;

/**
 * Save all specials — deletes removed ones, upserts current ones.
 * Each doc gets an `updatedAt` timestamp.
 */
export async function saveAllSpecials(specials: Special[]): Promise<void>;

/** Delete a single special by ID. */
export async function deleteSpecial(id: string): Promise<void>;
```

Implementation notes:

- `fetchSpecials`: `getDocs(query(collection(db, COLLECTIONS.SPECIALS), orderBy('order')))` then map to `Special[]`
- `fetchActiveSpecials`: `getDocs(query(collection(db, COLLECTIONS.SPECIALS), where('active', '==', true), orderBy('order')))` then map to `Special[]`
- `saveAllSpecials`: Reads existing docs, computes diff (deletes removed, upserts current via `setDoc`). Each upsert sets `updatedAt: new Date()`.
- `deleteSpecial`: `deleteDoc(doc(db, COLLECTIONS.SPECIALS, id))`
- No `withConverter` needed since these are admin-managed docs with simple structures and no `serverTimestamp()` complexity.
- No `invalidateQueryCache` needed since these are not paginated user queries.

### New: `src/services/achievements.ts`

```typescript
/**
 * Firestore service for the `achievements` collection.
 */
import { collection, getDocs, doc, setDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import type { Achievement } from '../types';

/** Fetch all achievements ordered by `order` field. */
export async function fetchAchievements(): Promise<Achievement[]>;

/**
 * Save all achievements — deletes removed ones, upserts current ones.
 * Each doc gets an `updatedAt` timestamp.
 */
export async function saveAllAchievements(achievements: Achievement[]): Promise<void>;

/** Delete a single achievement by ID. */
export async function deleteAchievement(id: string): Promise<void>;
```

Implementation follows the same pattern as `specials.ts`.

## Integracion

### Components to services wiring

| Component | Current Firestore call | New service call |
|-----------|----------------------|-----------------|
| `SpecialsPanel.load()` | `getDocs(query(collection(db, COLLECTIONS.SPECIALS), orderBy('order')))` | `fetchSpecials()` |
| `SpecialsPanel.saveAll()` | Inline loop with `getDocs`, `deleteDoc`, `setDoc` | `saveAllSpecials(specials)` |
| `AchievementsPanel.load()` | `getDocs(query(collection(db, COLLECTIONS.ACHIEVEMENTS), orderBy('order')))` | `fetchAchievements()` |
| `AchievementsPanel.saveAll()` | Inline loop with `getDocs`, `deleteDoc`, `setDoc` | `saveAllAchievements(achievements)` |
| `SpecialsSection` useEffect | `getDocs(query(collection(db, COLLECTIONS.SPECIALS), where(...), orderBy(...)))` | `fetchActiveSpecials()` |

### Existing code that stays untouched

- `src/config/collections.ts` already has `SPECIALS` and `ACHIEVEMENTS` keys
- Firestore rules already configured
- No hooks or contexts need modification

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/specials.test.ts` | `fetchSpecials`, `fetchActiveSpecials`, `saveAllSpecials`, `deleteSpecial` | Service unit |
| `src/services/achievements.test.ts` | `fetchAchievements`, `saveAllAchievements`, `deleteAchievement` | Service unit |

### `src/services/specials.test.ts`

Test cases:

- `fetchSpecials` returns mapped docs ordered by `order`
- `fetchSpecials` returns empty array when no docs
- `fetchActiveSpecials` queries with `where('active', '==', true)`
- `fetchActiveSpecials` returns empty array when no active specials
- `saveAllSpecials` deletes removed docs and upserts current ones
- `saveAllSpecials` handles empty array (deletes all existing)
- `saveAllSpecials` sets `updatedAt` on each doc
- `deleteSpecial` calls `deleteDoc` with correct ref

### `src/services/achievements.test.ts`

Test cases:

- `fetchAchievements` returns mapped docs ordered by `order`
- `fetchAchievements` returns empty array when no docs
- `saveAllAchievements` deletes removed docs and upserts current ones
- `saveAllAchievements` handles empty array
- `saveAllAchievements` sets `updatedAt` on each doc
- `deleteAchievement` calls `deleteDoc` with correct ref

### Mock strategy

```typescript
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { SPECIALS: 'specials', ACHIEVEMENTS: 'achievements' },
}));

const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
}));
```

### Criterio de aceptacion

- Coverage >= 80% on new service files
- All conditional paths covered (empty results, delete diff logic)

## Analytics

No new analytics events. `SpecialsSection` already calls `trackEvent('special_tapped', ...)` which remains unchanged.

---

## Offline

This feature is admin-only for writes (admin panel is online-only, no offline support needed). The read path in `SpecialsSection` already has a `FALLBACK_SPECIALS` constant for graceful degradation.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Specials (user-facing) | Firestore persistent cache (prod) + FALLBACK_SPECIALS constant | Firestore SDK managed | Firestore IndexedDB |
| Specials (admin) | No cache | N/A | N/A |
| Achievements (admin) | No cache | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| saveAllSpecials | Admin-only, no offline support | N/A |
| saveAllAchievements | Admin-only, no offline support | N/A |

### Fallback UI

`SpecialsSection` keeps its existing `FALLBACK_SPECIALS` array. If `fetchActiveSpecials()` fails, the catch block logs with `logger.warn` and the fallback data remains displayed.

---

## Decisiones tecnicas

1. **No `withConverter`**: Specials and Achievements are simple admin-managed documents without `serverTimestamp()` on reads. Using plain `d.data() as T` mapping (matching the current inline pattern) avoids creating unnecessary converters for two collections that are only read/written by admin.

2. **`saveAllSpecials` encapsulates the diff logic**: The current component does a read-delete-upsert loop inline. Moving this entire operation into the service keeps the component thin while preserving the same delete-then-upsert behavior. The alternative of separate `createSpecial`/`updateSpecial`/`deleteSpecial` granular functions was rejected because the admin UI always saves the entire list at once.

3. **`fetchActiveSpecials` as a separate function**: Rather than adding a `filter` parameter to `fetchSpecials`, a separate function keeps the API explicit and avoids confusion about which components should use which query. `fetchSpecials` (all) is for admin, `fetchActiveSpecials` (where active == true) is for user-facing `SpecialsSection`.

4. **`console.warn` replaced with `logger.warn`**: `SpecialsSection` currently uses `console.warn` directly, violating the centralized logger pattern. This is fixed as part of the migration.
