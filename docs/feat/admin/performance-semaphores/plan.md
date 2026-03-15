# Plan: Performance Semaphores — Fase 1

**Branch:** `feat/performance-semaphores-phase1`
**Scope:** Instrumentacion client-side + coleccion perfMetrics

---

## Paso 1: Tipos y constantes

### 1.1 Crear `src/types/perfMetrics.ts`

- Interface `PerfVitals`: `{ lcp, inp, cls, ttfb }` (todos `number | null`)
- Interface `QueryTiming`: `{ p50, p95, count }`
- Interface `DeviceInfo`: `{ type: 'mobile' | 'desktop', connection: string }`
- Interface `PerfMetricsDoc`: documento completo para Firestore

### 1.2 Crear `src/constants/performance.ts`

- `PERF_THRESHOLDS`: umbrales verde/rojo para cada vital
- `PERF_FLUSH_DELAY_MS`: 30000 (timeout para flush)
- `PERF_COLLECTION`: reutilizar de COLLECTIONS

### 1.3 Agregar a `src/config/collections.ts`

- `PERF_METRICS: 'perfMetrics'`

**Commit:** `feat: add performance metrics types and constants`

---

## Paso 2: Modulo `perfMetrics.ts`

### 2.1 Crear `src/utils/perfMetrics.ts`

Funciones principales:

- `initPerfMetrics(userId, analyticsEnabled)`: punto de entrada, registra observers si esta en PROD y consent es true
- `observeLCP()`: PerformanceObserver para largest-contentful-paint
- `observeINP()`: PerformanceObserver para event (durationThreshold: 16)
- `observeCLS()`: PerformanceObserver para layout-shift (sliding window 5s)
- `observeTTFB()`: PerformanceObserver para navigation
- `measureAsync<T>(name, fn)`: wrapper de timing para queries
- `recordQueryTiming(name, elapsed)`: acumula en Map interno
- `flushPerfMetrics()`: calcula p50/p95, escribe doc en Firestore, envia analytics event
- `getDeviceInfo()`: detecta mobile/desktop y tipo de conexion
- `calculatePercentile(arr, p)`: helper para p50/p95

Estado interno (module-level):

- `vitals: PerfVitals` — acumula valores de cada vital
- `queryTimings: Map<string, number[]>` — tiempos por query
- `sessionId: string` — crypto.randomUUID()
- `flushed: boolean` — previene duplicados

**Commit:** `feat: add perfMetrics utility with Web Vitals capture and query timing`

---

## Paso 3: Instrumentar queries existentes

### 3.1 `src/services/notifications.ts`

- Importar `measureAsync` de `../utils/perfMetrics`
- Wrappear body de `fetchUserNotifications`:
  ```typescript
  const snap = await measureAsync('notifications', () => getDocs(q));
  ```
- Wrappear body de `getUnreadCount`:
  ```typescript
  const snap = await measureAsync('unreadCount', () => getCountFromServer(q));
  ```

### 3.2 `src/services/userSettings.ts`

- Wrappear body de `fetchUserSettings`:
  ```typescript
  const snap = await measureAsync('userSettings', () => getDoc(ref));
  ```

### 3.3 `src/hooks/usePaginatedQuery.ts`

- Wrappear `getDocs` en `loadPage`:
  ```typescript
  const snapshot = await measureAsync('paginatedQuery', () => getDocs(query(stableRef, ...queryConstraints)));
  ```

**Commit:** `feat: instrument Firestore queries with measureAsync timing`

---

## Paso 4: Inicializacion y flush

### 4.1 Integrar en el entry point

Buscar el lugar donde ya se inicializa analytics (probablemente `App.tsx` o un context).

- Llamar `initPerfMetrics(user.uid, settings.analyticsEnabled)` cuando el usuario este autenticado y sus settings esten cargados
- El init registra los observers y el listener de `visibilitychange`

### 4.2 Verificar que el flush se ejecuta

- En `visibilitychange` → `hidden`: flush
- Timeout de 30s post-ultima-vital: flush
- Flag `flushed` previene duplicados

**Commit:** `feat: initialize perf metrics on app load with consent check`

---

## Paso 5: Firestore Rules

### 5.1 Agregar regla para `perfMetrics`

En `firestore.rules`:

```javascript
match /perfMetrics/{docId} {
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly([
      'sessionId', 'userId', 'timestamp', 'vitals', 'queries', 'device', 'appVersion'
    ])
    && request.resource.data.sessionId is string
    && request.resource.data.timestamp == request.time;
  allow read: if isAdmin();
  allow update, delete: if false;
}
```

**Commit:** `feat: add Firestore security rules for perfMetrics collection`

---

## Paso 6: Tests

### 6.1 Crear `src/utils/__tests__/perfMetrics.test.ts`

- Test `measureAsync` retorna el resultado correctamente
- Test `measureAsync` registra timing
- Test `calculatePercentile` con arrays conocidos
- Test `getDeviceInfo` con mocks de userAgent y connection
- Test que `initPerfMetrics` no hace nada si no es PROD
- Test que `initPerfMetrics` no hace nada si analyticsEnabled es false

**Commit:** `test: add unit tests for perfMetrics utility`

---

## Paso 7: Seed data

### 7.1 Agregar perfMetrics al seed script

En `scripts/seed-admin-data.mjs`, agregar docs de ejemplo en `perfMetrics/` con datos realistas para que el admin panel (Fase 2) tenga data para mostrar.

- 7 docs (uno por dia de la ultima semana)
- Mezcla de device types y connection types
- Valores realistas de vitals (algunos green, algunos yellow)
- Query timings variados

**Commit:** `feat: add perfMetrics seed data for admin testing`

---

## Orden de merge

```text
Paso 1 → Paso 2 → Paso 3 → Paso 4 → Paso 5 → Paso 6 → Paso 7
```

Cada paso es un commit independiente. Se puede hacer squash al mergear si se prefiere.

---

## Verificacion pre-merge

- [ ] `npm run type-check` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run test:run` pasa
- [ ] `npm run build` pasa
- [ ] Firestore rules validas
- [ ] Seed data carga sin errores en emulador
- [ ] En el emulador, abrir la app y verificar que NO se capturan metricas (estamos en dev, no PROD)
- [ ] Verificar que `measureAsync` no afecta el comportamiento de los fetches existentes
