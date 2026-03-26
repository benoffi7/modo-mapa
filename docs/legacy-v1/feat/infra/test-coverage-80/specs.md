# Specs — Subir cobertura de tests al 80%

**Fecha:** 2026-03-18

---

## Convenciones de testing del proyecto

| Aspecto | Frontend (src/) | Functions |
|---------|----------------|-----------|
| Framework | Vitest + jsdom | Vitest + node |
| Setup | `src/test/setup.ts` (@testing-library/jest-dom) | - |
| Mocking | `vi.mock()` top-level + `vi.fn()` | `vi.mock()` top-level + `vi.fn()` |
| Firebase mock | Mock manual de `firebase/firestore`, `firebase/auth` | Mock manual de `firebase-admin/firestore` |
| Hooks | `renderHook()` + `act()` + `waitFor()` | N/A |
| Naming | `describe('Module') > it('describes behavior')` | Igual |
| Reset | `beforeEach(() => vi.clearAllMocks())` | Igual |
| Ubicacion | `src/**/*.test.ts[x]` colocated | `functions/src/__tests__/**/*.test.ts` |

---

## Fase 1 — Frontend: archivos criticos (< 40% coverage)

### 1.1 `src/hooks/usePriceLevelFilter.test.ts`

**Archivo:** `src/hooks/usePriceLevelFilter.ts` (14.7% lines)

**Mocks necesarios:**
```typescript
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/converters', () => ({
  priceLevelConverter: { fromFirestore: vi.fn(), toFirestore: vi.fn() },
}));
```

**Tests a escribir:**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | Retorna mapa vacio cuando no hay datos en Firestore | Cache miss + getDocs vacio |
| 2 | Retorna mapa de precios agrupado por businessId | Happy path + data transformation |
| 3 | Usa cache si no expiro el TTL | Cache hit (no fetch) |
| 4 | Refetch si el TTL expiro | Cache TTL branch |
| 5 | Maneja error de getDocs sin crashear | Promise rejection (silent catch) |
| 6 | `invalidatePriceLevelCache()` limpia el cache y fuerza refetch | Cache invalidation |

**Tecnica:** Manipular `Date.now()` con `vi.spyOn(Date, 'now')` para simular TTL.

---

### 1.2 `src/utils/perfMetrics.test.ts`

**Archivo:** `src/utils/perfMetrics.ts` (14.6% lines)

**Mocks necesarios:**
```typescript
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({})),
}));
vi.mock('./analytics', () => ({ trackEvent: vi.fn() }));
// Mock global PerformanceObserver
vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
```

**Tests a escribir:**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `initPerfMetrics()` no hace nada si no es PROD | `!import.meta.env.PROD` |
| 2 | `initPerfMetrics()` no hace nada si analytics deshabilitado | `!analyticsEnabled` |
| 3 | `initPerfMetrics()` registra observers de LCP, INP, CLS, TTFB | Happy path init |
| 4 | Observer de LCP captura startTime correctamente | LCP entry handling |
| 5 | Observer de INP actualiza solo si duration > actual | INP comparison branch |
| 6 | Observer de CLS implementa sliding window de 5s | CLS window logic |
| 7 | `measureAsync()` mide tiempo y retorna resultado | Timing + return |
| 8 | `measureAsync()` propaga errores del callback | Error re-throw |
| 9 | `calculatePercentile()` con array vacio retorna 0 | Edge case |
| 10 | `calculatePercentile()` calcula p50 y p95 correctamente | Sorting + index |
| 11 | `getDeviceInfo()` detecta Android, iPhone, iPad, desktop | Regex branches |
| 12 | Flush envia metricas via httpsCallable | Network success |
| 13 | Flush no envia si ya se flusheo | `flushed` flag |
| 14 | Flush maneja error de red sin crashear | Silent catch |

**Tecnica:** Usar `vi.stubGlobal()` para PerformanceObserver. Crear clase mock que capture callbacks y permita simular entries.

---

### 1.3 `src/utils/analytics.test.ts`

**Archivo:** `src/utils/analytics.ts` (19.2% lines)

**Mocks necesarios:**
```typescript
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  setAnalyticsCollectionEnabled: vi.fn(),
  logEvent: vi.fn(),
  setUserProperties: vi.fn(),
}));
vi.mock('../config/firebase', () => ({ app: {} }));
const mockLocalStorage = { getItem: vi.fn(), setItem: vi.fn() };
vi.stubGlobal('localStorage', mockLocalStorage);
```

**Tests a escribir:**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `initAnalytics()` no inicializa en DEV | `!import.meta.env.PROD` |
| 2 | `initAnalytics()` activa si consent es 'true' en localStorage | Consent + PROD |
| 3 | `initAnalytics()` no activa si consent no existe | Missing consent |
| 4 | `setAnalyticsEnabled(true)` activa analytics | `value && !analytics` |
| 5 | `setAnalyticsEnabled(false)` desactiva analytics existente | `!value && analytics` |
| 6 | `trackEvent()` no hace nada si disabled | `!enabled` guard |
| 7 | `trackEvent()` llama logEvent con nombre y params | Happy path |
| 8 | `setUserProperty()` no hace nada si disabled | `!enabled` guard |
| 9 | `setUserProperty()` llama setUserProperties | Happy path |

**Tecnica:** Usar `vi.stubEnv('PROD', true/false)` o mockear `import.meta.env` para alternar entornos.

---

### 1.4 `src/config/converters.test.ts`

**Archivo:** `src/config/converters.ts` (25% lines)

**Mocks necesarios:**
```typescript
vi.mock('../utils/formatDate', () => ({
  toDate: vi.fn((v) => v instanceof Date ? v : new Date(v)),
}));
```

**Tests a escribir (patron repetitivo por converter):**

Para cada converter (`ratingConverter`, `commentConverter`, `feedbackConverter`, `notificationConverter`, `menuPhotoConverter`, y los demas):

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `toFirestore()` serializa todos los campos requeridos | Serialization path |
| 2 | `toFirestore()` omite campos opcionales cuando son null/undefined | Conditional spreading |
| 3 | `fromFirestore()` deserializa documento completo | Deserialization path |
| 4 | `fromFirestore()` aplica defaults cuando faltan campos | `?? fallback` branches |
| 5 | `fromFirestore()` maneja timestamps de Firestore | `toDate()` calls |

**Total estimado:** ~45 tests (3-5 por cada uno de los ~15 converters). Agrupar en `describe` blocks por converter.

**Tecnica:** Crear helper `mockQueryDocumentSnapshot(data)` que retorne `{ data: () => data, id: 'test-id' }`.

---

### 1.5 `src/services/rankings.test.ts`

**Archivo:** `src/services/rankings.ts` (35.8% lines)

**Mocks necesarios:**
```typescript
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => mockDocRef),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  getCountFromServer: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/converters', () => ({
  userRankingConverter: { fromFirestore: vi.fn(), toFirestore: vi.fn() },
}));
```

**Tests a escribir:**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `getCurrentPeriodKey('alltime')` retorna 'alltime' | Alltime branch |
| 2 | `getCurrentPeriodKey('yearly')` retorna anio actual | Yearly branch |
| 3 | `getCurrentPeriodKey('monthly')` retorna YYYY-MM | Monthly branch |
| 4 | `getCurrentPeriodKey('weekly')` retorna YYYY-WNN | Weekly ISO branch |
| 5 | `getPreviousPeriodKey('alltime')` retorna null | Alltime null branch |
| 6 | `getPreviousPeriodKey('monthly')` en enero retorna dic del anio anterior | Year boundary |
| 7 | `getPreviousPeriodKey('weekly')` en semana 1 retorna semana 52/53 del anio anterior | Week boundary |
| 8 | `fetchRanking()` retorna ranking cuando existe | Happy path |
| 9 | `fetchRanking()` retorna null cuando no existe | Empty result |
| 10 | `fetchLatestRanking()` retorna el mas reciente | orderBy + limit |
| 11 | `fetchUserScoreHistory()` retorna array de scores | Loop + dedup |
| 12 | `fetchUserScoreHistory('alltime')` retorna array vacio | Early return |
| 13 | `fetchUserLiveScore()` calcula score sumando contribuciones | Scoring formula |

**Tecnica:** Mockear `Date` con fecha fija para tests de period keys. Usar `vi.setSystemTime()`.

---

## Fase 2 — Frontend: archivos medio-bajos (40-80% coverage)

### 2.1 `src/services/comments.test.ts` (complementar)

**Tests a agregar (actualmente 76.9%):**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `addComment()` con parentId agrega campo parentId al doc | Conditional parentId |
| 2 | `addComment()` rechaza texto vacio (solo espacios) | Trim + validation |
| 3 | `addComment()` rechaza texto que excede MAX_COMMENT_LENGTH | Length validation |
| 4 | `addComment()` rechaza nombre que excede MAX_DISPLAY_NAME_LENGTH | Name validation |
| 5 | `editComment()` rechaza texto vacio | Trim + validation |
| 6 | `editComment()` rechaza texto que excede limite | Length validation |

---

### 2.2 `src/context/AuthContext.test.tsx` (complementar)

**Tests a agregar (branches al 61.9%):**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `getAuthMethod()` retorna 'email' para provider password | Provider check |
| 2 | `getAuthMethod()` retorna 'google' para provider google | Provider check |
| 3 | `getAuthMethod()` retorna 'anonymous' para user null | Null check |
| 4 | Auth en ruta admin no hace signInAnonymously | `isAdminRoute` branch |
| 5 | `setDisplayName()` hace updateDoc si user doc existe | Existence true |
| 6 | `setDisplayName()` hace setDoc si user doc no existe | Existence false |
| 7 | `signInWithGoogle()` maneja error con mensaje | Try/catch |
| 8 | `refreshEmailVerified()` retorna false si no hay user | Null guard |

---

### 2.3 `src/context/MapContext.test.tsx` (complementar)

**Tests a agregar (branches al 50%):**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `toggleFilter()` agrega tag si no esta en activos | Add branch |
| 2 | `toggleFilter()` remueve tag si ya esta en activos | Remove branch |
| 3 | `setPriceFilter()` setea nivel cuando es diferente | Set branch |
| 4 | `setPriceFilter()` togglea a null cuando es el mismo nivel | Toggle null branch |
| 5 | `useMapContext()` retorna merge de ambos contextos | Deprecated hook |

---

### 2.4 `src/hooks/useBusinessDataCache.test.ts` (complementar)

**Tests a agregar (75% lines):**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `getBusinessCache()` retorna null si entry expiro por TTL | TTL expiry |
| 2 | `getBusinessCache()` borra entry expirada del cache | Delete on expiry |
| 3 | `patchBusinessCache()` no hace nada si entry no existe | Null guard |

---

### 2.5 `src/utils/formatDate.test.ts` (complementar)

**Tests a agregar (functions al 60%):**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `formatRelativeTime()` retorna "hace un momento" para < 1 min | diffMin < 1 |
| 2 | `formatRelativeTime()` retorna "hace Xh" para 1-24 horas | diffHours branch |
| 3 | `formatRelativeTime()` retorna "ayer" para 1 dia | diffDays === 1 |
| 4 | `formatRelativeTime()` retorna "hace X dias" para 2-6 dias | diffDays < 7 |
| 5 | `formatRelativeTime()` retorna fecha para >= 7 dias | Default branch |
| 6 | `formatDateFull()` retorna string formateado | Happy path |
| 7 | `formatDateFull()` maneja fecha invalida | isNaN branch |
| 8 | `toDate()` convierte Firestore Timestamp | `toDate in field` |
| 9 | `toDate()` retorna new Date() para campo invalido | Default branch |

---

## Fase 3 — Functions: perfTracker

### 3.1 `functions/src/__tests__/utils/perfTracker.test.ts` (complementar)

**Archivo:** `functions/src/utils/perfTracker.ts` (66.6% lines, 25% branches)

**Tests a agregar:**

| # | Test | Branch que cubre |
|---|------|-----------------|
| 1 | `trackFunctionTiming()` crea array si no existe | `!Array.isArray` branch |
| 2 | `trackFunctionTiming()` appenda a array existente | Array exists branch |
| 3 | `trackFunctionTiming()` trunca array si excede MAX_SAMPLES | Safety bound |
| 4 | `trackFunctionTiming()` no crashea si transaction falla | Try/catch (silent) |

---

## Fase 4 — CI enforcement

### 4.1 Script `test:coverage` en `package.json` (root)

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage --coverage.thresholds.statements=80 --coverage.thresholds.branches=80 --coverage.thresholds.functions=80 --coverage.thresholds.lines=80"
  }
}
```

### 4.2 Script `test:coverage` en `functions/package.json`

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage --coverage.thresholds.statements=80 --coverage.thresholds.branches=80 --coverage.thresholds.functions=80 --coverage.thresholds.lines=80"
  }
}
```

### 4.3 Vitest config thresholds (alternativa preferida)

Agregar en `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### 4.4 GitHub Action step

Agregar step en el workflow de CI existente (o crear `.github/workflows/test.yml`):

```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Run functions tests with coverage
  run: cd functions && npm run test:coverage
```

El step falla automaticamente si alguna metrica baja del 80%, bloqueando el merge.

---

## Resumen de esfuerzo

| Fase | Tests nuevos | Archivos afectados |
|------|-------------|-------------------|
| Fase 1 | ~85 tests | 5 test files nuevos |
| Fase 2 | ~26 tests | 5 test files existentes |
| Fase 3 | ~4 tests | 1 test file existente |
| Fase 4 | 0 tests | 3 config files |
| **Total** | **~115 tests** | **14 archivos** |
