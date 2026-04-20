# Plan: Coverage — branches below 80% threshold

**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)
**Issue:** #301

---

## Orden de implementacion

Agrupado para **maximizar el delta de branch coverage** por paso. Los tests mas "grandes" (mas branches) van primero.

### Fase 1 — Alto impacto en branches (4 archivos)

1. **`src/services/businessData.test.ts`** — 8+ branches (switch de 7 tipos + filter + sort + empty)
2. **`functions/src/__tests__/triggers/recommendations.test.ts`** — 6 branches (self-rec + rate + moderation + empty + happy + undefined)
3. **`functions/src/__tests__/triggers/customTags.test.ts`** — 6 branches (2 rate limits + moderation + happy + delete + undefined)
4. **`functions/src/__tests__/admin/perfMetrics.test.ts`** — 8 branches (4 validaciones + 3 rate-limit tx paths + defaults)

**Check point:** correr `npm run test:coverage` y `cd functions && npm run test:coverage`. Si branches ya >= 80%, igual seguir Fase 2 para alcanzar margen de 85%.

### Fase 2 — Completar triggers (6 archivos)

5. **`functions/src/__tests__/triggers/authBlocking.test.ts`** — 5 branches
6. **`functions/src/__tests__/triggers/sharedLists.test.ts`** — 5 branches
7. **`functions/src/__tests__/triggers/priceLevels.test.ts`** — 5 branches
8. **`functions/src/__tests__/triggers/userTags.test.ts`** — 4 branches
9. **`functions/src/__tests__/triggers/users.test.ts`** — 3 branches

### Fase 3 — Servicios pequeños (4 archivos)

10. **`src/services/specials.test.ts`** — 3 branches
11. **`src/services/achievements.test.ts`** — 3 branches
12. **`src/services/abuseLogs.test.ts`** — 3 branches
13. **`src/services/trending.test.ts`** — 2 branches

### Fase 4 — Validacion + docs

14. Correr `npm run test:run` (sin coverage) para asegurar que todo pasa
15. Correr `npm run test:coverage` → verificar branches >= 80% (meta 85%)
16. Correr `cd functions && npm run test:coverage` → verificar branches >= 80%
17. Actualizar `docs/reference/tests.md`:
    - Marcar como ✓ los archivos nuevos en las tablas de inventario
    - Actualizar totales de test files (74 → 79 frontend; 34 → 42 functions)
    - Actualizar "Cobertura actual" si las metricas cambian significativamente
18. Actualizar `docs/_sidebar.md` con el PRD nuevo
19. Commit + push

---

## Detalles por archivo

### Paso 1 — `src/services/businessData.test.ts`

**Estructura:**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: {
  FAVORITES: 'favorites', RATINGS: 'ratings', COMMENTS: 'comments',
  USER_TAGS: 'userTags', CUSTOM_TAGS: 'customTags', PRICE_LEVELS: 'priceLevels',
  MENU_PHOTOS: 'menuPhotos', COMMENT_LIKES: 'commentLikes',
}}));
vi.mock('../config/converters', () => ({
  ratingConverter: {}, commentConverter: {}, userTagConverter: {},
  customTagConverter: {}, priceLevelConverter: {}, menuPhotoConverter: {},
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...a) => mockGetDoc(...a),
  getDocs: (...a) => mockGetDocs(...a),
  query: vi.fn(),
  where: vi.fn(),
  documentId: vi.fn().mockReturnValue('__name__'),
}));

import { fetchUserLikes, fetchSingleCollection, fetchBusinessData } from './businessData';

describe('fetchUserLikes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty Set for empty commentIds', async () => {
    const result = await fetchUserLikes('u1', []);
    expect(result.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('batches queries in groups of 30', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `c${i}`);
    mockGetDocs.mockResolvedValue({ docs: [] });
    await fetchUserLikes('u1', ids);
    expect(mockGetDocs).toHaveBeenCalledTimes(2); // 30 + 5
  });

  it('parses commentId from doc.id (uid__commentId)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'u1__comment123' }, { id: 'u1__comment456' }],
    });
    const result = await fetchUserLikes('u1', ['comment123', 'comment456']);
    expect(result.has('comment123')).toBe(true);
    expect(result.has('comment456')).toBe(true);
  });
});

describe('fetchSingleCollection', () => {
  // 7 switch cases...
});

describe('fetchBusinessData', () => {
  // happy path + isFavorite false path
});
```

**Verificar tras agregar:** `cd /home/walrus/proyectos/modo-mapa && npm run test:run -- businessData`

### Paso 2 — `functions/src/__tests__/triggers/recommendations.test.ts`

**Estructura base** (copiar de `comments.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { handlers, mockGetFirestore, mockCheckRateLimit, mockCheckModeration,
  mockIncrementCounter, mockTrackWrite, mockLogAbuse, mockCreateNotification,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, any>,
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockCheckModeration: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({ getFirestore: mockGetFirestore }));
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path, h) => { handlers[`created:${path}`] = h; return h; },
}));
vi.mock('../../helpers/env', () => ({ getDb: () => ({}) }));
vi.mock('../../utils/rateLimiter', () => ({ checkRateLimit: (...a) => mockCheckRateLimit(...a) }));
vi.mock('../../utils/moderator', () => ({ checkModeration: (...a) => mockCheckModeration(...a) }));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...a) => mockIncrementCounter(...a),
  trackWrite: (...a) => mockTrackWrite(...a),
}));
vi.mock('../../utils/notifications', () => ({ createNotification: (...a) => mockCreateNotification(...a) }));
vi.mock('../../utils/abuseLogger', () => ({ logAbuse: (...a) => mockLogAbuse(...a) }));
vi.mock('../../utils/perfTracker', () => ({ trackFunctionTiming: (...a) => mockTrackFunctionTiming(...a) }));

import '../../triggers/recommendations';

function makeEvent(data: Record<string, any>) {
  return {
    data: { data: () => data, ref: { delete: vi.fn().mockResolvedValue(undefined) } },
    params: { docId: 'rec1' },
  };
}

describe('onRecommendationCreated', () => {
  const handler = handlers['created:recommendations/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
    mockCheckModeration.mockResolvedValue(false);
  });

  it('self-recommend deletes doc', async () => { /* senderId === recipientId */ });
  it('rate limit exceeded deletes + logs', async () => { /* mockCheckRateLimit → true */ });
  it('flagged message deletes + logs', async () => { /* mockCheckModeration → true */ });
  it('empty message skips moderation', async () => { /* message: '' */ });
  it('happy path creates notification + counters', async () => { /* todo ok */ });
});
```

**Verificar:** `cd /home/walrus/proyectos/modo-mapa/functions && npx vitest run recommendations`

### Paso 3 — `functions/src/__tests__/triggers/customTags.test.ts`

Reutilizar estructura base del paso 2. Handlers capturados:
- `handlers['created:customTags/{tagId}']`
- `handlers['deleted:customTags/{tagId}']`

Controlar `mockCheckRateLimit` con `.mockResolvedValueOnce(false).mockResolvedValueOnce(true)` para simular exceed en segundo check (daily) sin triggerear el primero (per_entity).

### Paso 4 — `functions/src/__tests__/admin/perfMetrics.test.ts`

**Estructura:**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockTx, mockDocSet } = vi.hoisted(() => {
  const tx = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
  const docSet = vi.fn().mockResolvedValue(undefined);
  return {
    mockGetDb: vi.fn(() => ({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ set: docSet }),
      }),
      runTransaction: vi.fn().mockImplementation(async (fn) => fn(tx)),
    })),
    mockTx: tx,
    mockDocSet: docSet,
  };
});

vi.mock('../../helpers/env', () => ({ ENFORCE_APP_CHECK: false, getDb: mockGetDb }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, h: any) => h,
  HttpsError: class extends Error {
    constructor(public code: string, msg: string) { super(msg); this.name = 'HttpsError'; }
  },
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('SERVER_TS') },
}));

import { writePerfMetrics } from '../../admin/perfMetrics';

function makeReq(overrides: Partial<any> = {}) {
  return {
    auth: { uid: 'user1' },
    data: {
      sessionId: 'session1',
      vitals: { LCP: 2000 },
      queries: {},
      device: { type: 'mobile', connection: '4g' },
      appVersion: '2.35.7',
    },
    ...overrides,
  };
}

describe('writePerfMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.get.mockResolvedValue({ data: () => undefined });
  });

  it('throws unauthenticated when no auth', async () => {
    await expect(writePerfMetrics.run(makeReq({ auth: null }))).rejects.toThrow(/authentication/i);
  });

  // ... more cases
});
```

**Nota:** El callable export puede necesitar wrap (`writePerfMetrics.run(...)` o llamar al handler interno via import del archivo). Verificar en ejecucion.

### Paso 5 — `functions/src/__tests__/triggers/authBlocking.test.ts`

Mocks adicionales: `ipRateLimiter`, `firebase-functions/v2/identity`, `firebase-functions/v2/https`.

```ts
vi.mock('firebase-functions/v2/identity', () => ({ beforeUserCreated: (h) => h }));

vi.mock('../../utils/ipRateLimiter', () => ({
  checkIpRateLimit: (...a) => mockCheckIpRateLimit(...a),
  getIpActionCount: (...a) => mockGetIpActionCount(...a),
  hashIp: (ip: string) => `hash_${ip}`,
}));

import { onBeforeUserCreated } from '../../triggers/authBlocking';

function makeEvent(overrides: any = {}) {
  return {
    ipAddress: '1.2.3.4',
    additionalUserInfo: { providerId: 'anonymous' },
    ...overrides,
  };
}
```

### Pasos 6-9 — triggers pequeños

Seguir el mismo patron estructural. Cada archivo <= 150 lineas.

### Pasos 10-13 — servicios pequeños

Seguir el patron de `ratings.test.ts` / `checkins.test.ts`.

### Paso 14-15 — Correr coverage

```bash
cd /home/walrus/proyectos/modo-mapa
npm run test:coverage 2>&1 | tail -30
cd functions
npx vitest run --coverage 2>&1 | tail -30
```

Si branch coverage frontend < 80%:
- Revisar el reporte HTML en `coverage/index.html` para identificar branches no cubiertas
- Agregar casos adicionales a los archivos de test con mayor cantidad de branches no cubiertas

### Paso 17 — Actualizar `docs/reference/tests.md`

Cambios:

1. Actualizar metricas de cobertura (2026-04-18 → fecha del merge)
2. En seccion "React App — Servicios": agregar `abuseLogs`, `achievements`, `businessData`, `trending`, `specials` con estado `100%`
3. En seccion "Cloud Functions — Triggers": agregar `authBlocking`, `customTags`, `priceLevels`, `recommendations`, `sharedLists`, `userTags`, `users` con estado `100%`
4. En seccion "Cloud Functions — Admin": agregar `perfMetrics` con estado `100%`
5. Actualizar totales en tabla de resumen (Total test files, Total test cases)

### Paso 18 — Actualizar `docs/_sidebar.md`

Agregar bajo seccion **Infra** (antes de `#259`):

```markdown
  - [#301 Coverage Branches Threshold](/feat/infra/301-coverage-branches-threshold/prd.md)
    - [Specs](/feat/infra/301-coverage-branches-threshold/specs.md)
    - [Plan](/feat/infra/301-coverage-branches-threshold/plan.md)
```

### Paso 19 — Commit

Mensaje sugerido:

```text
test(#301): restore branch coverage above 80% threshold

Add test files for 5 frontend services and 8 Cloud Functions
(7 triggers + 1 admin callable) that were accumulating conditional
branches without coverage. Branch coverage: 79.3% → >=82%.

No production code changes. CI deploy unblocked.

Files added:
- src/services/{abuseLogs,achievements,businessData,trending,specials}.test.ts
- functions/src/__tests__/triggers/{authBlocking,customTags,priceLevels,
  recommendations,sharedLists,userTags,users}.test.ts
- functions/src/__tests__/admin/perfMetrics.test.ts
```

---

## Validacion final

- [ ] `npm run test:run` pasa verde (sin coverage)
- [ ] `npm run test:coverage` reporta branches >= 80% (meta 85%)
- [ ] `cd functions && npm run test:coverage` reporta branches >= 80%
- [ ] `docs/reference/tests.md` actualizado
- [ ] `docs/_sidebar.md` incluye PRD/specs/plan
- [ ] Commit creado con mensaje descriptivo
- [ ] No se modificaron archivos productivos

---

## Rollback plan

Este PR solo agrega archivos `*.test.ts`. Un rollback es seguro: borrar los archivos nuevos. No hay migraciones, ni cambios de schema, ni features deployados que dependan de estos tests.

Si algun test es flaky y no se puede estabilizar rapido: moverlo a `describe.skip(...)` con comentario `// TODO #301: estabilizar` y abrir issue de seguimiento. No bajar el threshold.
