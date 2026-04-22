# Specs: Coverage — branches below 80% threshold

**PRD:** [prd.md](prd.md)
**Issue:** #301

---

## 1. Arquitectura del cambio

No hay cambios arquitecturales. Solo se agregan archivos `*.test.ts` en los directorios ya establecidos:

- `src/services/{abuseLogs,achievements,businessData,trending,specials}.test.ts`
- `functions/src/__tests__/triggers/{authBlocking,customTags,priceLevels,recommendations,sharedLists,userTags,users}.test.ts`
- `functions/src/__tests__/admin/perfMetrics.test.ts`

### Patrones de mock a usar

**Frontend services** — patron consolidado en `ratings.test.ts`, `checkins.test.ts`, `feedback.test.ts`:

```ts
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { /* ... */ } }));
vi.mock('../config/converters', () => ({ /* converter keys */ }));
vi.mock('../config/adminConverters', () => ({ /* if needed */ }));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  getDoc: (...a) => mockGetDoc(...a),
  getDocs: (...a) => mockGetDocs(...a),
  setDoc: (...a) => mockSetDoc(...a),
  deleteDoc: (...a) => mockDeleteDoc(...a),
  onSnapshot: (...a) => mockOnSnapshot(...a),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  documentId: vi.fn().mockReturnValue('__name__'),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));
```

**Cloud Functions triggers** — patron consolidado en `comments.test.ts`:

```ts
const { handlers, mockIncrement, mockGetFirestore, mockCheckRateLimit, mockCheckModeration,
  mockIncrementCounter, mockTrackWrite, mockTrackDelete, mockLogAbuse, mockCreateNotification,
} = vi.hoisted(() => ({ /* ... */ }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { increment: (n) => mockIncrement(n), serverTimestamp: vi.fn() },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path, h) => { handlers[`created:${path}`] = h; return h; },
  onDocumentDeleted: (path, h) => { handlers[`deleted:${path}`] = h; return h; },
  onDocumentUpdated: (path, h) => { handlers[`updated:${path}`] = h; return h; },
}));
```

**Callable admin** — patron consolidado en `admin/moderationConfig.test.ts`:

```ts
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (opts, h) => h,
  HttpsError: class HttpsError extends Error { constructor(public code: string, msg: string) { super(msg); } },
}));
```

---

## 2. Tests a implementar

### 2.1 `src/services/abuseLogs.test.ts`

**Funcion:** `subscribeToAbuseLogs(maxDocs, onNext, onError)`

**Mocks especificos:**

- `mockOnSnapshot` captura el callback de next (arg 1) y de error (arg 2).

**Casos minimos:**

1. `onNext` recibe logs mapeados desde `snapshot.docs.map((d) => d.data())` con `docChanges` serializado a `{ type, id }`
2. `onError` se invoca cuando `onSnapshot` reporta error
3. Retorna la `Unsubscribe` devuelta por `onSnapshot`
4. `docChanges` vacios se reportan como array vacio

**Ramas cubiertas:** 3 (next callback, error callback, empty changes).

### 2.2 `src/services/achievements.test.ts`

**Funciones:** `fetchAchievements()`, `saveAllAchievements(list)`

**Casos minimos:**

1. `fetchAchievements` mapea `snap.docs` con `{ id: d.id, ...d.data() }` y usa `orderBy('order')`
2. `fetchAchievements` con coleccion vacia devuelve `[]`
3. `saveAllAchievements` elimina docs cuyo id no esta en el array nuevo (`currentIds.has(d.id) === false`)
4. `saveAllAchievements` upsertea cada item con `updatedAt` agregado y `id` removido del payload
5. `saveAllAchievements` sin cambios: no borra nada, upsertea todo

**Ramas cubiertas:** 3 (filter by currentIds, existing ids, no removed).

### 2.3 `src/services/businessData.test.ts`

**Funciones:** `fetchUserLikes`, `fetchSingleCollection`, `fetchBusinessData`

**Casos minimos:**

1. `fetchUserLikes` con array vacio devuelve `Set()` sin hacer queries (early return)
2. `fetchUserLikes` con 35 ids hace 2 batches (splits en 30) — verificar `Promise.all` con 2 elementos
3. `fetchUserLikes` parsea `d.id` dividido por `__` y extrae `[1]` como commentId
4. `fetchSingleCollection('favorites')` con `snap.exists` true/false devuelve `isFavorite`
5. `fetchSingleCollection('ratings')` devuelve `ratings: snap.docs.map(d.data())`
6. `fetchSingleCollection('comments')` filtra `flagged=true`, ordena por `createdAt desc`, y calcula `userCommentLikes`
7. `fetchSingleCollection('customTags')` ordena por `createdAt asc`
8. `fetchSingleCollection('priceLevels')` devuelve la lista directa
9. `fetchSingleCollection('menuPhotos')` devuelve null cuando `snap.empty`, primer elemento cuando no
10. `fetchSingleCollection('userTags')` devuelve la lista directa
11. `fetchBusinessData` happy path: ejecuta 7 queries en paralelo + fetchUserLikes, retorna shape completo
12. `fetchBusinessData` con `favSnap.exists() === false` devuelve `isFavorite: false`

**Ramas cubiertas:** 8+ (empty input, batch threshold, 7 switch cases, flagged filter, empty menuPhoto).

### 2.4 `src/services/trending.test.ts`

**Funcion:** `fetchTrending()`

**Casos minimos:**

1. Retorna `snap.data()` cuando `snap.exists()` es true
2. Retorna `null` cuando `snap.exists()` es false

**Ramas cubiertas:** 2.

### 2.5 `src/services/specials.test.ts`

**Funciones:** `fetchSpecials`, `fetchActiveSpecials`, `saveAllSpecials`

**Casos minimos:**

1. `fetchSpecials` usa `orderBy('order')` y mapea `{ id, ...data }`
2. `fetchActiveSpecials` usa `where('active', '==', true)` + orderBy
3. `saveAllSpecials` elimina los no presentes en el array (branch delete)
4. `saveAllSpecials` upsertea cada item con `updatedAt`
5. `saveAllSpecials` con array vacio: borra todos

**Ramas cubiertas:** 3.

### 2.6 `functions/src/__tests__/triggers/authBlocking.test.ts`

**Funcion:** `onBeforeUserCreated`

**Mocks especificos:**

```ts
vi.mock('../../helpers/env', () => ({ getDb: () => mockDb }));
vi.mock('../../utils/ipRateLimiter', () => ({
  checkIpRateLimit: (...a) => mockCheckIpRateLimit(...a),
  getIpActionCount: (...a) => mockGetIpActionCount(...a),
  hashIp: (ip) => `hash(${ip})`,
}));
vi.mock('../../utils/abuseLogger', () => ({ logAbuse: (...a) => mockLogAbuse(...a) }));
vi.mock('firebase-functions/v2/identity', () => ({ beforeUserCreated: (h) => h }));
vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class extends Error { constructor(public code: string, msg: string) { super(msg); } },
}));
```

**Casos minimos:**

1. Skip si `providerId !== 'anonymous'` (no se llama a checkIpRateLimit)
2. Skip si `ipAddress` es undefined
3. Log-only cuando `count >= ANON_FLOOD_ALERT_THRESHOLD` y `< MAX_ANON_CREATES_PER_IP_PER_DAY` — llama a `logAbuse` con `severity: 'medium'`, no throws
4. Block: `checkIpRateLimit` devuelve true → `logAbuse` con `severity: 'high'` + throw `HttpsError('resource-exhausted')`
5. Happy path: count bajo, checkIpRateLimit false → no logAbuse, no throw

**Ramas cubiertas:** 5.

### 2.7 `functions/src/__tests__/triggers/customTags.test.ts`

**Funciones:** `onCustomTagCreated`, `onCustomTagDeleted`

**Casos minimos:**

1. `exceededPerEntity` (10 per business): `snap.ref.delete()` + `logAbuse('rate_limit', 'Exceeded 10 customTags for business ...')`, return
2. `exceededDaily` (50 per day): `snap.ref.delete()` + `logAbuse('rate_limit', 'Exceeded 50 customTags/day')`, return
3. Moderation flagged: `snap.ref.delete()` + `logAbuse('flagged', ...)`, return
4. Happy path: `incrementCounter('customTags', 1)` + `trackWrite` + `trackFunctionTiming`
5. `onCustomTagDeleted`: `incrementCounter('customTags', -1)` + `trackDelete` + `trackFunctionTiming`
6. `event.data` undefined: early return

**Ramas cubiertas:** 6.

### 2.8 `functions/src/__tests__/triggers/priceLevels.test.ts`

**Funciones:** `onPriceLevelCreated`, `onPriceLevelUpdated`

**Casos minimos:**

1. `userId` undefined: skip rate limit check, va directo a counters (branch)
2. `userId` defined, rate limit exceeded: `snap.ref.delete()` + `logAbuse`, return
3. `userId` defined, rate limit ok: `incrementCounter('priceLevels', 1)` + `trackWrite` + timing
4. `onPriceLevelUpdated`: `trackWrite('priceLevels')` + timing (no increment)
5. `event.data` undefined: early return

**Ramas cubiertas:** 5.

### 2.9 `functions/src/__tests__/triggers/recommendations.test.ts`

**Funcion:** `onRecommendationCreated`

**Casos minimos:**

1. Self-recommend (`senderId === recipientId`): `snap.ref.delete()`, return sin notification
2. Rate limit exceeded: `snap.ref.delete()` + `logAbuse('rate_limit', 'Exceeded 20 recommendations/day')`, return
3. Message flagged: `snap.ref.delete()` + `logAbuse('flagged', ...)`, return
4. Message vacio (`message === ''`): skip moderation, continuar a createNotification
5. Happy path con message: moderation OK → createNotification + counters + timing
6. `event.data` undefined: early return

**Ramas cubiertas:** 6.

### 2.10 `functions/src/__tests__/triggers/sharedLists.test.ts`

**Funcion:** `onSharedListCreated`

**Mocks especificos:**

```ts
const mockDb = {
  collection: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  count: vi.fn().mockReturnThis(),
  get: vi.fn(),
};
```

**Casos minimos:**

1. `event.data` undefined: early return
2. Sin `ownerId`: ejecuta counters pero retorna antes del rate limit
3. Count <= 10: happy path (counters + timing, no delete)
4. Count > 10: `snap.ref.delete()` + `logAbuse('rate_limit', 'Exceeded 10 sharedLists/day — document deleted')`
5. Count exactamente 10: no delete (limite no exclusivo)

**Ramas cubiertas:** 5.

### 2.11 `functions/src/__tests__/triggers/userTags.test.ts`

**Funciones:** `onUserTagCreated`, `onUserTagDeleted`

**Casos minimos:**

1. `event.data` undefined: early return
2. Rate limit exceeded: delete + logAbuse, return
3. Happy path: counters + timing
4. `onUserTagDeleted`: `incrementCounter(-1)` + `trackDelete` + timing

**Ramas cubiertas:** 4.

### 2.12 `functions/src/__tests__/triggers/users.test.ts`

**Funcion:** `onUserCreated`

**Casos minimos:**

1. Sin `data?.displayName`: counters + timing, sin update del doc
2. Con `displayName`: update con `displayNameLower`, `followersCount: 0`, `followingCount: 0`
3. `event.data` undefined: counters solo (skip update del doc)

**Ramas cubiertas:** 3.

### 2.13 `functions/src/__tests__/admin/perfMetrics.test.ts`

**Funcion:** `writePerfMetrics` (callable)

**Mocks especificos:**

```ts
const mockTx = {
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
};
const mockDb = {
  collection: vi.fn().mockReturnThis(),
  doc: vi.fn().mockReturnThis(),
  set: vi.fn().mockResolvedValue(undefined),
  runTransaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
};
```

**Casos minimos:**

1. `request.auth` null: throw `HttpsError('unauthenticated')`
2. `sessionId` missing o no string: throw `HttpsError('invalid-argument', 'sessionId required')`
3. `vitals` missing: throw `HttpsError('invalid-argument', 'vitals required')`
4. `appVersion` no string o > 20 chars: throw `HttpsError('invalid-argument', 'invalid appVersion')`
5. Rate limit exceeded (snap existe, count >= MAX_WRITES_PER_DAY=5): throw `HttpsError('resource-exhausted')`
6. Rate limit ok con snap existente: `tx.update(count + 1)` y escribe el doc de `perfMetrics/{sessionId}`
7. Rate limit sin snap previo (primera vez): `tx.set({ count: 1, resetAt, userId })` y escribe doc
8. `queries` y `device` opcionales: defaults a `{}`

**Ramas cubiertas:** 8.

---

## 3. Coverage target

- **Frontend branches:** pasar de 79.3% a >= 82% (meta 85%)
- **Functions branches:** mantener >= 89% actual, idealmente subir a 92%
- Validar con `npm run test:coverage` post-implementacion

---

## 4. Riesgos y mitigaciones

| Riesgo | Mitigacion |
|--------|-----------|
| Tests frailes que rompen con refactors | Mockear contratos (no implementaciones). Usar `expect.objectContaining` en vez de deep equality estricta |
| Branch coverage sigue < 80% tras agregar tests | Implementar primero los 4 archivos con mas branches (businessData, customTags, recommendations, perfMetrics) y correr coverage para validar antes de seguir |
| Mock drift entre tests | Extraer helpers compartidos si aparecen duplicaciones (ej: `createMockSnap`) pero solo si se usan ≥ 3 veces — no overengineer |
| Tiempo de ejecucion de tests aumenta | Todos los tests son unitarios con mocks, no hay I/O real. Impacto esperado < 2s |

---

## 5. Dependencias

- Ninguna dependencia nueva.
- Ninguna modificacion a `package.json`, `vitest.config.ts`, ni `.github/workflows/*`.
- Puede mergear en paralelo a otros fixes no-test siempre que no toquen los archivos productivos de los que dependen los tests.

---

## 6. Puntos de integracion con otros issues

- **#300** (security enforcement): si agrega nuevos rate limits, sus tests deben seguir el mismo patron establecido aqui. Este PR debe mergearse primero para desbloquear CI.
- **#303** (perf instrumentation): si agrega `trackFunctionTiming` a mas triggers, los tests existentes deberan incluir verificacion de `trackFunctionTiming` en happy path.
