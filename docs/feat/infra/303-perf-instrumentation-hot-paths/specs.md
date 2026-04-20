# Specs: Perf instrumentation — hot paths

**Feature:** 303-perf-instrumentation-hot-paths
**PRD:** [prd.md](./prd.md)
**Plan:** [plan.md](./plan.md)

---

## Convencion de nombres

Los nombres pasados a `measureAsync('<name>', fn)` siguen el patron:

```text
<servicio>_<operacion>
```

Donde:

- `<servicio>` es el stem del archivo en `src/services/` sin `.ts` (ej: `businessData`, `userProfile`, `ratings`).
- `<operacion>` es un identificador corto de la operacion (ej: `ratings`, `comments`, `favorite`, `pendingCount`).

Excepcion: los 4 nombres ya en uso (`notifications`, `unreadCount`, `userSettings`, `paginatedQuery`) se mantienen tal cual por backward compat (ya hay datos agregados con esos nombres en Firestore).

---

## Archivos a modificar

### 1. `src/utils/perfMetrics.ts` — agregar helpers `measuredGetDocs` / `measuredGetDoc`

Agregar al final del archivo, debajo de `measureAsync`:

```ts
import type { Query, DocumentReference, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';
import { getDocs, getDoc } from 'firebase/firestore';

/**
 * Thin wrapper over `measureAsync(name, () => getDocs(q))`.
 * Use in service-layer modules for Firestore collection reads.
 */
export async function measuredGetDocs<T>(
  name: string,
  q: Query<T>,
): Promise<QuerySnapshot<T>> {
  return measureAsync(name, () => getDocs(q));
}

/**
 * Thin wrapper over `measureAsync(name, () => getDoc(ref))`.
 * Use in service-layer modules for Firestore document reads.
 */
export async function measuredGetDoc<T>(
  name: string,
  ref: DocumentReference<T>,
): Promise<DocumentSnapshot<T>> {
  return measureAsync(name, () => getDoc(ref));
}
```

Nota: los imports de `firebase/firestore` ya son usados en el archivo en ningun otro lugar — este archivo no usa Firebase SDK, solo el callable `httpsCallable`. Agregarlos solo para los tipos y funciones de wrapper.

Alternativa si el linter de separacion de capas se queja: declarar los tipos con `import type` y usar indirection; sin embargo `measureAsync` ya vive en `src/utils/` y se importa desde `src/services/`, por lo que el boundary es valido.

### 2. `src/services/businessData.ts`

#### `fetchUserLikes` — envolver el `Promise.all` de batches

Antes:

```ts
const snaps = await Promise.all(batches.map((batch) =>
  getDocs(query(collection(db, COLLECTIONS.COMMENT_LIKES), where(documentId(), 'in', batch))),
));
```

Despues (opcion A — batch paralelo con un solo nombre):

```ts
const snaps = await measureAsync('businessData_userLikes', () =>
  Promise.all(batches.map((batch) =>
    getDocs(query(collection(db, COLLECTIONS.COMMENT_LIKES), where(documentId(), 'in', batch))),
  )),
);
```

Esta forma mide la latencia total del `Promise.all` (incluido el mas lento de los batches). Es representativa del tiempo que el usuario percibe.

#### `fetchSingleCollection` — un nombre por caso

Envolver el `getDoc`/`getDocs` de cada case del switch:

```ts
case 'favorites': {
  const snap = await measuredGetDoc('businessData_favorite', doc(db, COLLECTIONS.FAVORITES, `${uid}__${bId}`));
  return { isFavorite: snap.exists() };
}
case 'ratings': {
  const snap = await measuredGetDocs('businessData_ratings', query(
    collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
    where('businessId', '==', bId),
  ));
  return { ratings: snap.docs.map((d) => d.data()) };
}
// ... similar para comments, userTags, customTags, priceLevels, menuPhotos
```

Nombres canonicos:

| Case | Nombre |
|------|--------|
| `favorites` | `businessData_favorite` |
| `ratings` | `businessData_ratings` |
| `comments` | `businessData_comments` |
| `userTags` | `businessData_userTags` |
| `customTags` | `businessData_customTags` |
| `priceLevels` | `businessData_priceLevels` |
| `menuPhotos` | `businessData_menuPhotos` |

#### `fetchBusinessData` — envolver cada item del `Promise.all`

Cada elemento del `Promise.all([...])` se convierte en una llamada envuelta:

```ts
const [favSnap, ratingsSnap, commentsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap] = await Promise.all([
  measuredGetDoc('businessData_favorite', doc(db, COLLECTIONS.FAVORITES, favDocId)),
  measuredGetDocs('businessData_ratings', query(
    collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
    where('businessId', '==', bId),
  )),
  measuredGetDocs('businessData_comments', query(
    collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
    where('businessId', '==', bId),
  )),
  measuredGetDocs('businessData_userTags', query(
    collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
    where('businessId', '==', bId),
  )),
  measuredGetDocs('businessData_customTags', query(
    collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
    where('userId', '==', uid),
    where('businessId', '==', bId),
  )),
  measuredGetDocs('businessData_priceLevels', query(
    collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
    where('businessId', '==', bId),
  )),
  measuredGetDocs('businessData_menuPhotos', query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('businessId', '==', bId),
    where('status', '==', 'approved'),
  )),
]);
```

El `fetchUserLikes` al final ya queda medido via el cambio de arriba.

### 3. `src/services/userProfile.ts`

Envolver cada uno de los 6 reads paralelos (en `fetchUserProfile`) y los 2 standalone (`fetchUserProfileDoc`, `updateUserDisplayName.getDoc`):

```ts
const userDocPromise = measuredGetDoc('userProfile_userDoc', userDocRef)
  .catch((err) => { logger.error('[userProfile] getDoc failed:', err); return null; });

// en el Promise.all:
await Promise.all([
  userDocPromise,
  measuredGetDocs('userProfile_comments', commentsQuery),
  measuredGetDocs('userProfile_ratings', ratingsQuery),
  measuredGetDocs('userProfile_favorites', favoritesQuery),
  measuredGetDocs('userProfile_customTags', customTagsQuery),
  measuredGetDocs('userProfile_photos', photosQuery),
  rankingPromise,
]);
```

Para `fetchUserProfileDoc`:

```ts
const snap = await measuredGetDoc('userProfile_doc', ref);
```

`updateUserDisplayName` hace un `getDoc` para chequear existencia — envolverlo como `userProfile_existsCheck`.

### 4. `src/services/ratings.ts`

| Funcion | Linea actual | Nombre |
|---------|--------------|--------|
| `upsertRating` | `getDoc(ratingRef)` | `ratings_upsertExists` |
| `upsertCriteriaRating` | `getDoc(ratingRef)` | `ratings_criteriaExists` |
| `fetchUserRatings` | `getDocs(query(...))` | `ratings_byUser` |
| `hasUserRatedBusiness` | `getDoc(...)` | `ratings_hasUser` |
| `fetchRatingsByBusinessIds` | `Promise.all(batches.map(getDocs))` | `ratings_byBusinessIds` (wrappeo el Promise.all) |

`fetchUserRatingsCount` ya usa `getCountOfflineSafe` que internamente no usa `measureAsync`, pero es un count call (no un getDocs). Envolverlo es opcional pero consistente: `measureAsync('ratings_countByUser', () => getCountOfflineSafe(...))`.

### 5. `src/services/checkins.ts`

| Funcion | Linea actual | Nombre |
|---------|--------------|--------|
| `fetchMyCheckIns` | `getDocs(q)` | `checkins_byUser` |
| `fetchCheckInsForBusiness` | `getDocs(...)` | `checkins_byUserBusiness` |
| `fetchUserCheckIns` | `getDocs(...)` | `checkins_byUserAll` |

### 6. `src/services/recommendations.ts`

| Funcion | Linea actual | Nombre |
|---------|--------------|--------|
| `markAllRecommendationsAsRead` | `getDocs(...)` (query unread) | `recommendations_unreadList` |
| `countUnreadRecommendations` | `getCountOfflineSafe(...)` | `recommendations_unreadCount` |
| `countRecommendationsSentToday` | `getCountOfflineSafe(...)` | `recommendations_sentTodayCount` |

### 7. `src/services/menuPhotos.ts`

| Funcion | Linea actual | Nombre |
|---------|--------------|--------|
| `uploadMenuPhoto` (pendingSnap check) | `getDocs(...)` | `menuPhotos_pendingCountCheck` |
| `getApprovedMenuPhoto` | `getDocs(...)` | `menuPhotos_approved` |
| `getUserPendingPhotos` | `getDocs(...)` | `menuPhotos_userPending` |

### 8. `src/services/follows.ts`

| Funcion | Linea actual | Nombre |
|---------|--------------|--------|
| `followUser` (count check) | `getCountOfflineSafe(...)` | `follows_followingCount` |
| `isFollowing` | `getDoc(...)` | `follows_isFollowing` |
| `fetchFollowing` | `getDocs(...)` | `follows_fetchFollowing` |
| `fetchFollowersCount` | `getCountOfflineSafe(...)` | `follows_followersCount` |

### 9. `src/services/sharedLists.ts`

| Funcion | Linea actual | Nombre |
|---------|--------------|--------|
| `deleteList` (items snap para batch) | `getDocs(...)` | `sharedLists_itemsForDelete` |
| `fetchListItems` | `getDocs(...)` | `sharedLists_items` |
| `fetchSharedList` | `getDoc(...)` | `sharedLists_listDoc` |
| `fetchUserLists` | `getDocs(...)` | `sharedLists_userLists` |
| `fetchEditorName` | `getDoc(...)` | `sharedLists_editorName` |
| `fetchSharedWithMe` | `getDocs(...)` | `sharedLists_sharedWithMe` |

### 10. `src/services/suggestions.ts`

Envolver el `Promise.all` de 3 reads con un solo nombre O un nombre por read. Preferimos un nombre por read para ver individualmente si alguno degrada:

```ts
const [favsSnap, ratingsSnap, tagsSnap] = await Promise.all([
  measuredGetDocs('suggestions_favorites', query(...)),
  measuredGetDocs('suggestions_ratings', query(...)),
  measuredGetDocs('suggestions_userTags', query(...)),
]);
```

### 11. `src/services/users.ts`

| Funcion | Nombre |
|---------|--------|
| `fetchProfileVisibility` (Promise.all de batches) | `users_profileVisibility` (wrappeo Promise.all) |
| `searchUsers` | `users_search` |
| `fetchUserDisplayNames` (loop de batches) | `users_displayNames` (wrappeo cada getDocs del loop, se suma a timings) |

Para `fetchUserDisplayNames` — como es un for loop secuencial (no Promise.all), cada iteracion acumula su timing bajo el mismo nombre. Eso es correcto: veremos el p95 del batch individual.

### 12. `src/services/rankings.ts`

| Funcion | Nombre |
|---------|--------|
| `fetchRanking` | `rankings_byPeriod` |
| `fetchLatestRanking` | `rankings_latest` |
| `countUserDocs` (usada por `fetchUserLiveScore`) | `rankings_userDocCount` |
| `fetchUserScoreHistory` (Promise.all de `fetchRanking`) | Se mide via `rankings_byPeriod` de cada llamada |
| `fetchUserLiveScore` Promise.all de 6 counts | Cada count es `countUserDocs` ya medido; el 6to (photos) envolver como `rankings_photosCount` |

### 13. `src/services/trending.ts`, `metrics.ts`, `config.ts`

Un `getDoc` por archivo:

- `trending.fetchTrending` → `trending_current`
- `metrics.fetchDailyMetrics` → `metrics_byDate`
- `config.fetchAppVersionConfig` → `config_appVersion`

### 14. `src/services/priceLevels.ts`

- `fetchPriceLevelMap` → `priceLevels_allMap` (aunque tenga cache externa via `usePriceLevelFilter`, medir el costo de la llamada cuando llega a la red)
- `upsertPriceLevel` (getDoc check) → `priceLevels_upsertExists`

### 15. `scripts/seed-admin-data.mjs`

Agregar despues del bloque de perfMetrics (linea ~852, despues del loop de 7 dias de `perfMetrics`) un nuevo bloque:

```js
// ── config/perfCounters (Cloud Function timing samples) ─────────────────
console.log('Seeding perf counters for Cloud Functions...');
await setDoc(doc(db, 'config', 'perfCounters'), {
  onCommentCreated: [120, 145, 180, 210, 250, 300, 150, 175],
  onCommentLikeCreated: [80, 95, 110, 130, 160, 100, 120],
  onCommentDeleted: [95, 130, 145, 180, 110],
  onCommentUpdated: [70, 85, 100, 130, 90, 110],
  onCustomTagCreated: [100, 130, 160, 200, 140],
  onCustomTagDeleted: [60, 75, 90, 70],
  onFavoriteCreated: [50, 65, 80, 95, 70],
  onFavoriteDeleted: [45, 55, 70, 60],
  onFeedbackCreated: [180, 220, 280, 350, 250],
  onMenuPhotoCreated: [800, 950, 1200, 1500, 1000], // thumbnail generation
  onRatingWritten: [90, 110, 140, 170, 130, 100],
  onPriceLevelCreated: [60, 75, 90, 70],
  onPriceLevelUpdated: [55, 65, 80, 65],
  onFollowCreated: [120, 150, 180, 220, 160],
  onFollowDeleted: [80, 100, 130, 95],
  onRecommendationCreated: [140, 170, 220, 270, 190],
  onUserCreated: [45, 60, 80, 55],
});
```

No se siembran query timings porque esos se agregan automaticamente en `dailyMetrics/{YYYY-MM-DD}.performance.queries` — y el seed ya crea 15 dias de `dailyMetrics`. Podemos enriquecer un doc reciente de dailyMetrics con `performance.queries` para que el `QueryLatencyTable` se pinte tambien post-seed:

```js
// Enriquecer dailyMetrics del dia de hoy con performance.queries/vitals
const todayStr = new Date().toISOString().slice(0, 10);
await db.doc(`dailyMetrics/${todayStr}`).set({
  performance: {
    vitals: {
      lcp: { p50: 2100, p75: 2800, p95: 3400 },
      inp: { p50: 150, p75: 220, p95: 380 },
      cls: { p50: 0.05, p75: 0.08, p95: 0.15 },
      ttfb: { p50: 400, p75: 650, p95: 950 },
    },
    queries: {
      businessData_ratings: { p50: 180, p95: 420, count: 250 },
      businessData_comments: { p50: 240, p95: 560, count: 250 },
      businessData_userTags: { p50: 150, p95: 380, count: 250 },
      businessData_menuPhotos: { p50: 160, p95: 380, count: 250 },
      userProfile_comments: { p50: 220, p95: 520, count: 40 },
      userProfile_ratings: { p50: 180, p95: 400, count: 40 },
      ratings_byUser: { p50: 140, p95: 320, count: 80 },
      notifications: { p50: 120, p95: 280, count: 180 },
      unreadCount: { p50: 60, p95: 150, count: 240 },
      follows_followersCount: { p50: 60, p95: 150, count: 40 },
      userSettings: { p50: 80, p95: 180, count: 200 },
    },
    functions: {
      onCommentCreated: { p50: 175, p95: 280, count: 8 },
      onCommentLikeCreated: { p50: 110, p95: 160, count: 7 },
      onRatingWritten: { p50: 120, p95: 170, count: 6 },
      onMenuPhotoCreated: { p50: 1000, p95: 1500, count: 5 },
      onFollowCreated: { p50: 160, p95: 220, count: 5 },
      onRecommendationCreated: { p50: 190, p95: 270, count: 5 },
    },
  },
}, { merge: true });
```

### 16. `docs/reference/patterns.md`

En el capitulo "Queries y cache" agregar una fila a la tabla despues de `Parallel query batching`:

```md
| **measureAsync en services** | Todo `getDocs` / `getDoc` en `src/services/` debe envolverse con `measureAsync(name, fn)` o el helper `measuredGetDocs(name, q)` / `measuredGetDoc(name, ref)` de `src/utils/perfMetrics.ts`. Nombres de query siguen la convencion `<servicio>_<operacion>` (ej: `businessData_ratings`, `userProfile_comments`). Las metricas se agregan en sesion client-side, se flushean via `writePerfMetrics` callable, y se consolidan diariamente en `dailyMetrics/{date}.performance.queries` (p50/p75/p95 + count). Permite visibilidad en el admin `QueryLatencyTable` de los hot paths. |
```

---

## Estrategia de tests

### Nuevo: `src/services/businessData.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMeasureAsync = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());

vi.mock('../utils/perfMetrics', () => ({
  measureAsync: (...args: unknown[]) => mockMeasureAsync(...args),
  measuredGetDocs: (name: string, q: unknown) => mockMeasureAsync(name, () => Promise.resolve({
    docs: [], empty: true, size: 0,
  })),
  measuredGetDoc: (name: string, ref: unknown) => mockMeasureAsync(name, () => Promise.resolve({
    exists: () => false, data: () => undefined, id: 'id',
  })),
}));

// ... mock firebase/firestore, db, COLLECTIONS, converters

describe('fetchBusinessData', () => {
  beforeEach(() => { mockMeasureAsync.mockClear(); });

  it('calls measureAsync for each of the 7 parallel reads', async () => {
    const { fetchBusinessData } = await import('./businessData');
    await fetchBusinessData('biz_001', 'user_001');
    const names = mockMeasureAsync.mock.calls.map((c) => c[0]);
    expect(names).toContain('businessData_favorite');
    expect(names).toContain('businessData_ratings');
    expect(names).toContain('businessData_comments');
    expect(names).toContain('businessData_userTags');
    expect(names).toContain('businessData_customTags');
    expect(names).toContain('businessData_priceLevels');
    expect(names).toContain('businessData_menuPhotos');
  });
});

describe('fetchSingleCollection', () => {
  it.each([
    ['favorites', 'businessData_favorite'],
    ['ratings', 'businessData_ratings'],
    ['comments', 'businessData_comments'],
    ['userTags', 'businessData_userTags'],
    ['customTags', 'businessData_customTags'],
    ['priceLevels', 'businessData_priceLevels'],
    ['menuPhotos', 'businessData_menuPhotos'],
  ])('wraps %s case with measureAsync name %s', async (col, expected) => {
    const { fetchSingleCollection } = await import('./businessData');
    await fetchSingleCollection('biz_001', 'user_001', col as any);
    expect(mockMeasureAsync.mock.calls.map((c) => c[0])).toContain(expected);
  });
});

describe('fetchUserLikes', () => {
  it('wraps the Promise.all of batches with measureAsync(businessData_userLikes)', async () => {
    const { fetchUserLikes } = await import('./businessData');
    await fetchUserLikes('user_001', ['c1', 'c2']);
    expect(mockMeasureAsync.mock.calls.map((c) => c[0])).toContain('businessData_userLikes');
  });
  it('returns empty set without calling measureAsync when commentIds is empty', async () => {
    const { fetchUserLikes } = await import('./businessData');
    const result = await fetchUserLikes('user_001', []);
    expect(result.size).toBe(0);
    expect(mockMeasureAsync).not.toHaveBeenCalled();
  });
});
```

### Ampliar tests existentes

Para cada `*.test.ts` modificado (ratings, checkins, notifications, menuPhotos, userProfile), agregar un suite adicional tipo:

```ts
describe('measureAsync instrumentation', () => {
  it.each([
    ['fetchUserRatings', 'ratings_byUser'],
    ['fetchUserRatingsCount', 'ratings_countByUser'],
    ['hasUserRatedBusiness', 'ratings_hasUser'],
    ['fetchRatingsByBusinessIds', 'ratings_byBusinessIds'],
  ])('%s instruments with name %s', async (fnName, expectedName) => {
    // ... invocar la funcion, verificar mock
  });
});
```

### Ampliar `src/utils/perfMetrics.test.ts`

```ts
describe('measuredGetDocs', () => {
  it('delegates to measureAsync with the provided name', async () => {
    // mock measureAsync, call measuredGetDocs('test_query', mockQuery), verify call
  });
  it('returns the underlying QuerySnapshot', async () => {
    // ...
  });
});

describe('measuredGetDoc', () => {
  it('delegates to measureAsync with the provided name', async () => {
    // ...
  });
});
```

### Mock strategy

- Mockear `measureAsync` para que pase-through (`(_name, fn) => fn()`) y registrar llamadas.
- Mockear `firebase/firestore` para que las funciones de query retornen snapshots vacios/fakes.
- Mockear `db` como objeto vacio.
- Verificar con `expect(mockMeasureAsync).toHaveBeenCalledWith(expectedName, expect.any(Function))`.

---

## Cambios en tipos

Ningun cambio en `src/types/`. No se agregan interfaces ni types publicos. Los tipos nuevos en `perfMetrics.ts` son los type imports de `firebase/firestore` (`Query`, `QuerySnapshot`, `DocumentReference`, `DocumentSnapshot`) — importados con `import type`.

## Cambios en Firestore rules

Ninguno. No se crean colecciones ni se agregan campos.

## Cambios en Cloud Functions

Ninguno. `trackFunctionTiming` ya esta instalado en los 17 triggers. `dailyMetrics` ya sabe leer y agregar `config/perfCounters`.

## Cambios en analytics

Ninguno. `trackEvent('perf_vitals_captured', ...)` ya existe en `perfMetrics.ts:184`.

---

## Orden de merge sugerido

1. Helpers (`measuredGetDocs` / `measuredGetDoc`) + tests.
2. Seed script (`config/perfCounters` + enriquecer `dailyMetrics` de hoy).
3. P0: `businessData.ts` + `userProfile.ts`.
4. P1: `ratings`, `checkins`, `recommendations`, `menuPhotos`, `follows`.
5. P2: `sharedLists`, `suggestions`, `users`, `rankings`.
6. P3: `trending`, `metrics`, `config`, `priceLevels`.
7. `patterns.md` + `_sidebar.md` updates.

Cada paso no rompe el anterior — `measureAsync` es opt-in pass-through.

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|--------------|------------|
| Nombre de query colisiona con uno existente en Firestore | Baja | Convencion `<servicio>_<operacion>` es especifica; los 4 nombres legacy (`notifications`, `unreadCount`, `userSettings`, `paginatedQuery`) se respetan |
| Wrappeo altera el tipo de retorno | Muy baja | `measureAsync<T>` es passthrough tipado; los tests de tipos en build catch |
| Volumen de timings infla `perfMetrics` doc | Baja | Ya hay limite "una sesion = un flush" en `flushPerfMetrics()`; por sesion se graban ~15-20 queries distintas, cada una con arrays cortos |
| Tests existentes fallan por nuevo mock de `measureAsync` | Media | El mock por default es pass-through; los tests existentes de `notifications.ts` ya mockean `measureAsync` (ver `notifications.test.ts:42`) y siguen funcionando |
| Seed con `config/perfCounters` colisiona con Firestore rules | Baja | `config/*` rules permiten writes solo desde Functions/admin. Seed usa admin SDK — bypass rules |
