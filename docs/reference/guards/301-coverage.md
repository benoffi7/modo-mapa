# Guard: Coverage threshold (#301)

**Issue:** [#301](https://github.com/GonzaloBenoffi/modo-mapa/issues/301)
**PRD:** [feat/infra/301-coverage-branches-threshold/prd.md](../../feat/infra/301-coverage-branches-threshold/prd.md)
**Status:** Active — enforced by CI via `npm run test:coverage`
**Scope:** Evitar regresiones de cobertura de branches por debajo del 80% en frontend y Cloud Functions.

---

## Por que existe este guard

El 2026-04-18, el `health-check` sobre `new-home` detecto que el branch coverage del frontend cayo a **79.3%** (debajo del threshold de 80% configurado en `vitest.config.ts`), bloqueando el workflow de deploy. La causa raiz fue puntual: 5 servicios frontend y 8 Cloud Functions (7 triggers + 1 admin callable) acumularon logica condicional (rate limits, cascade deletes, moderation, IP blocking) sin tests.

Este guard formaliza las reglas que previenen que vuelva a pasar. Cada regla tiene un patron de deteccion (grep / ls) y un patron correcto de referencia.

---

## Reglas

### Regla 1 — Threshold no negociable

`vitest.config.ts` enforza `branches: 80` globalmente. **Nunca bajar este valor.**

Si un PR introduce codigo que baja el branch coverage, la solucion correcta es **agregar tests**, no relajar el threshold. La unica excepcion posible es subir el threshold (tightening).

```ts
// vitest.config.ts — valores obligatorios
coverage: {
  provider: 'v8',
  thresholds: {
    statements: 80,
    branches: 80,   // nunca bajar
    functions: 77,
    lines: 80,
  },
},
```

Lo mismo aplica a `functions/vitest.config.ts` (mismo threshold de 80 en branches).

### Regla 2 — Todo service nuevo lleva test co-located

Todo archivo nuevo en `src/services/` **debe** publicarse con un `.test.ts` hermano en el mismo directorio (convencion del proyecto — co-located tests).

```text
src/services/
  nuevoService.ts        -> requiere
  nuevoService.test.ts   <- este archivo
```

Cobertura minima por archivo de test: **1 happy path + 4 ramas condicionales** (>= 5 casos).

### Regla 3 — Todo Cloud Function trigger lleva test con handler-capture

Todo archivo nuevo en `functions/src/triggers/` debe shippar un test en `functions/src/__tests__/triggers/<nombre>.test.ts` siguiendo el patron `vi.hoisted` + captura de handlers via mock de `firebase-functions/v2/firestore`.

**Canonical reference:** `functions/src/__tests__/triggers/comments.test.ts`.

El patron captura los handlers al importarlos (side-effect) y luego los invoca directamente desde el test con eventos sinteticos. No se usa Firebase emulator.

### Regla 4 — Todo admin callable lleva test con callable-wrapping

Todo callable nuevo en `functions/src/admin/` debe shippar un test en `functions/src/admin/__tests__/<nombre>.test.ts` siguiendo el patron `handlerRef` capturado via mock de `firebase-functions/v2/https.onCall`.

**Canonical reference:** `functions/src/admin/__tests__/moderationConfig.test.ts`.

Casos minimos que cualquier test de callable debe cubrir:

- `request.auth` null → `HttpsError('unauthenticated')`
- Invalid inputs (tipos + longitudes + requeridos) → `HttpsError('invalid-argument', ...)`
- Rate limit exceeded (si aplica) → `HttpsError('resource-exhausted')`
- Happy path completo con side effects verificados

### Regla 5 — PR author corre coverage localmente

Antes de abrir el PR, el autor **debe** correr `npm run test:coverage` (frontend) y `cd functions && npm run test:coverage` (functions), y pegar el resumen en la descripcion del PR.

```bash
# Frontend
npm run test:coverage 2>&1 | tail -20

# Cloud Functions
cd functions && npm run test:coverage 2>&1 | tail -20
```

El resumen debe incluir la tabla con statements/branches/functions/lines por carpeta, no solo el total.

---

## Patrones de deteccion

Comandos para detectar violaciones de este guard antes de mergear un PR.

### D1 — Services sin test sibling

```bash
# Lista services sin test co-located
cd /home/walrus/proyectos/modo-mapa
for f in src/services/*.ts; do
  case "$f" in
    *.test.ts|*.d.ts) continue ;;
  esac
  test_file="${f%.ts}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "MISSING TEST: $f"
  fi
done
```

Esperado: output vacio. Si hay matches, crear el `.test.ts` antes de mergear.

### D2 — Triggers sin test entry en `__tests__/triggers/`

```bash
# Lista triggers sin test correspondiente
cd /home/walrus/proyectos/modo-mapa/functions
for f in src/triggers/*.ts; do
  name=$(basename "$f" .ts)
  test_file="src/__tests__/triggers/${name}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "MISSING TEST: $f -> $test_file"
  fi
done
```

Esperado: output vacio. Si hay matches, crear el test usando el patron de `comments.test.ts`.

### D3 — Admin callables sin test entry

```bash
# Lista admin callables sin test correspondiente
cd /home/walrus/proyectos/modo-mapa/functions
for f in src/admin/*.ts; do
  case "$f" in
    *.test.ts|*/index.ts) continue ;;
  esac
  name=$(basename "$f" .ts)
  test_file="src/admin/__tests__/${name}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "MISSING TEST: $f -> $test_file"
  fi
done
```

Esperado: output vacio. Si hay matches, crear el test usando el patron de `moderationConfig.test.ts`.

### D4 — Threshold accidentalmente reducido

```bash
# Detectar si alguien bajo el threshold en vitest configs
grep -rn "branches:" vitest.config.ts functions/vitest.config.ts
```

Ambas lineas deben mostrar `branches: 80` (o mayor). Cualquier numero menor requiere justificacion + aprobacion explicita y apertura de issue de seguimiento.

---

## Patrones correctos (excerpts)

### Frontend service — SDK mocking (ver `src/services/ratings.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest';

// Mock Firebase before importing the service
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { RATINGS: 'ratings' } }));
vi.mock('../config/converters', () => ({ ratingConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { upsertRating } from './ratings';

describe('upsertRating — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  it('throws on score 0', async () => {
    await expect(upsertRating('u1', 'b1', 0)).rejects.toThrow('Score must be an integer between 1 and 5');
  });

  it('creates new rating when none exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await upsertRating('u1', 'b1', 4);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', businessId: 'b1', score: 4 }),
    );
  });

  it('updates existing rating', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    await upsertRating('u1', 'b1', 3);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ score: 3 }),
    );
  });
});
```

Puntos clave:

- `vi.mock(...)` **antes** del `import` del archivo testeado (orden critico).
- Mocks como top-level `const mockX = vi.fn()` para poder configurarlos por test.
- Usar `expect.objectContaining` en vez de deep equality para evitar tests fragiles ante refactors.
- `beforeEach` con `vi.clearAllMocks()` + re-setear defaults cuando corresponda.

### Cloud Function trigger — handler capture (ver `functions/src/__tests__/triggers/comments.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks (accessible inside vi.mock factories) ---
const {
  handlers,
  mockIncrement,
  mockGetFirestore,
  mockCheckRateLimit,
  mockCheckModeration,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockLogAbuse,
  mockCreateNotification,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockIncrement: vi.fn().mockReturnValue({ __increment: true }),
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockCheckModeration: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackDelete: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
}));

// Mock firebase-admin/firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { increment: (n: number) => mockIncrement(n), serverTimestamp: vi.fn() },
}));

// Mock firebase-functions/v2/firestore — capture handlers
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
  onDocumentDeleted: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`deleted:${path}`] = handler;
    return handler;
  },
  onDocumentUpdated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`updated:${path}`] = handler;
    return handler;
  },
}));

// --- Import triggers (registers handlers via mock side-effects) ---
import '../../triggers/comments';

describe('onCommentCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
    mockCheckModeration.mockResolvedValue(false);
  });

  it('skips if no snapshot data', async () => {
    await handlers['created:comments/{commentId}']({ data: null, params: { commentId: 'c1' } });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});
```

Puntos clave:

- `vi.hoisted(...)` garantiza que los mocks existan antes de las `vi.mock(...)` factories (que tambien se hoistean).
- El mock de `firebase-functions/v2/firestore` **captura** cada handler por path usando un diccionario `handlers`.
- El import side-effect `import '../../triggers/comments'` ejecuta los `onDocumentCreated(...)` que llenan el diccionario.
- El test invoca el handler directamente con un evento sintetico (`{ data, params }`), sin Firebase emulator.
- Casos minimos que cualquier trigger test debe cubrir: `event.data` undefined (early return), rate limit exceeded, moderation flagged (si aplica), happy path.

---

## Related

- **PRD:** [feat/infra/301-coverage-branches-threshold/prd.md](../../feat/infra/301-coverage-branches-threshold/prd.md)
- **Specs:** [feat/infra/301-coverage-branches-threshold/specs.md](../../feat/infra/301-coverage-branches-threshold/specs.md)
- **Plan:** [feat/infra/301-coverage-branches-threshold/plan.md](../../feat/infra/301-coverage-branches-threshold/plan.md)
- **Tests reference:** [tests.md](../tests.md)
- **Patterns:** [patterns.md](../patterns.md) seccion Testing
- **Testing agent:** [../../.claude/agents/testing.md](../../../.claude/agents/testing.md)

### Paths cubiertos por el fix de #301

Services frontend:

- `src/services/abuseLogs.ts`
- `src/services/achievements.ts`
- `src/services/businessData.ts`
- `src/services/trending.ts`
- `src/services/specials.ts`

Cloud Functions triggers:

- `functions/src/triggers/authBlocking.ts`
- `functions/src/triggers/customTags.ts`
- `functions/src/triggers/priceLevels.ts`
- `functions/src/triggers/recommendations.ts`
- `functions/src/triggers/sharedLists.ts`
- `functions/src/triggers/userTags.ts`
- `functions/src/triggers/users.ts`

Admin callables:

- `functions/src/admin/perfMetrics.ts`

Canonical test references:

- `src/services/ratings.test.ts` — SDK mocking pattern
- `functions/src/__tests__/triggers/comments.test.ts` — trigger handler-capture pattern
- `functions/src/admin/__tests__/moderationConfig.test.ts` — callable-wrapping pattern
