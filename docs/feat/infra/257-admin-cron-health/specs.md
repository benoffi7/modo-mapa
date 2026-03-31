# Specs: Complete cron health monitoring for all scheduled functions

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

### Coleccion `_cronRuns`

Documentos por nombre de cron. Solo escritura via admin SDK (Cloud Functions), lectura via admin panel.

```
_cronRuns/{cronName}
  lastRunAt: Timestamp (server)
  result: 'success' | 'error'
  detail?: string
  durationMs?: number
```

### TypeScript interfaces

**Frontend** (`src/types/admin.ts`):

```typescript
export interface CronRunStatus {
  cronName: string;
  lastRunAt: Date | null;
  result: 'success' | 'error' | null;
  detail?: string | undefined;
  durationMs?: number | undefined;
}
```

**Cloud Functions** (`functions/src/utils/cronHeartbeat.ts`):

No new types needed — the helper writes raw Firestore data using admin SDK.

### Constantes de crons

**Shared frontend** (`src/constants/admin.ts`):

```typescript
export interface CronConfig {
  name: string;
  label: string;
  schedule: string;
  thresholdOkHours: number;
  thresholdWarningHours: number;
}

export const CRON_CONFIGS: CronConfig[] = [
  { name: 'computeWeeklyRanking', label: 'Rankings (semanal)', schedule: 'Lunes 4AM', thresholdOkHours: 7 * 24, thresholdWarningHours: 14 * 24 },
  { name: 'computeMonthlyRanking', label: 'Rankings (mensual)', schedule: '1ro del mes 4AM', thresholdOkHours: 31 * 24, thresholdWarningHours: 45 * 24 },
  { name: 'computeAlltimeRanking', label: 'Rankings (all-time)', schedule: 'Lunes 5AM', thresholdOkHours: 7 * 24, thresholdWarningHours: 14 * 24 },
  { name: 'computeTrendingBusinesses', label: 'Trending', schedule: 'Diario 3AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'dailyMetrics', label: 'Metricas diarias', schedule: 'Diario 3AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'cleanupRejectedPhotos', label: 'Limpieza fotos rechazadas', schedule: 'Diario 4AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'cleanupExpiredNotifications', label: 'Limpieza notificaciones', schedule: 'Diario 5AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'cleanupActivityFeed', label: 'Limpieza activity feed', schedule: 'Diario 5AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'generateFeaturedLists', label: 'Listas destacadas', schedule: 'Lunes 5AM', thresholdOkHours: 7 * 24, thresholdWarningHours: 14 * 24 },
];
```

---

## Firestore Rules

Nueva regla para `_cronRuns` — admin read only, no client writes (Cloud Functions usa admin SDK):

```javascript
// Cron heartbeats — admin read for dashboard, Cloud Functions write via admin SDK.
match /_cronRuns/{cronName} {
  allow read: if isAdmin();
  allow write: if false;
}
```

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchCronHealthStatus()` en `services/admin/content.ts` | `_cronRuns` | Admin (email check) | `allow read: if isAdmin()` | YES — nueva regla |
| Heartbeat write en `withCronHeartbeat` (Cloud Functions) | `_cronRuns` | Admin SDK (server) | Bypasses rules | No |

### Field whitelist check

No aplica — `_cronRuns` no tiene reglas de create/update para clientes. Todas las escrituras son via admin SDK que bypasea rules.

---

## Cloud Functions

### `withCronHeartbeat` helper (`functions/src/utils/cronHeartbeat.ts`)

Helper que wrappea la logica de cualquier scheduled function con heartbeat:

```typescript
export async function withCronHeartbeat(
  cronName: string,
  fn: () => Promise<string | void>,
): Promise<void>
```

Comportamiento:

1. Registra `startTime = Date.now()`
2. Ejecuta `fn()`
3. Si exito: escribe `{ lastRunAt: FieldValue.serverTimestamp(), result: 'success', detail: returnValue ?? '', durationMs }` a `_cronRuns/{cronName}`
4. Si error: escribe `{ lastRunAt: FieldValue.serverTimestamp(), result: 'error', detail: error.message, durationMs }` a `_cronRuns/{cronName}`, luego re-throws el error
5. El heartbeat write usa `set` con merge para crear o actualizar

La funcion wrapeada puede retornar un `string` como detail (ej: `"Cleaned up 12 rejected photos"`), o `void`.

### Integracion en scheduled functions

Las 7 scheduled functions (9 exports) wrappean su logica interna con `withCronHeartbeat`. El `onSchedule` wrapper se mantiene — solo la logica interna se extrae a una funcion que se pasa al helper.

---

## Componentes

### `CronHealthSection` (refactorizado)

**Archivo:** `src/components/admin/CronHealthSection.tsx`
**Cambios:**

- Reemplaza el fetcher actual (que lee `userRankings` + `trendingBusinesses`) por `fetchCronHealthStatus()`
- Renderiza una grilla de cards compactas con los 9 crons
- Cada card muestra: label, `HealthIndicator`, ultima ejecucion (relativa), resultado, duracion
- Si `result === 'error'`, muestra un Chip "Error" rojo adicional con `detail` en Tooltip
- Mantiene las visualizaciones existentes (tier distribution, top ranking, trending list) como seccion separada debajo, leyendo de las mismas fuentes (`fetchLatestRanking`, `fetchTrendingCurrent`)

**Props interface:** sin cambios (componente sin props)

### `CronCard` (nuevo subcomponente)

**Archivo:** `src/components/admin/CronCard.tsx`
**Props:**

```typescript
interface CronCardProps {
  config: CronConfig;
  run: CronRunStatus | null;
}
```

**Comportamiento:**

- Calcula freshness status usando `computeFreshness(lastRunAt, config.thresholdOkHours, config.thresholdWarningHours)`
- Muestra label del cron, schedule, HealthIndicator
- Si hay datos: fecha relativa (`formatRelativeTime`), duracion en ms/s, resultado
- Si `result === 'error'`: Chip "Error" rojo + Tooltip con detail
- Si no hay datos: HealthIndicator en 'error' + "Sin datos"

### Mutable prop audit

No aplica — `CronHealthSection` es read-only, no permite modificacion de datos.

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Estado de Crons" | Titulo en CronHealthSection | Ya existe |
| "Sin datos" | CronCard cuando no hay heartbeat | Chip en HealthIndicator |
| "Error" | CronCard cuando result es error | Chip rojo adicional |
| "Duracion" | CronCard label | |
| "Ultima ejecucion" | CronCard label | Tilde en Ultima |
| "Datos adicionales" | Titulo seccion de visualizaciones | |

---

## Hooks

No se crean hooks nuevos. `CronHealthSection` usa `useAsyncData` existente con el fetcher refactorizado.

---

## Servicios

### `fetchCronHealthStatus()` (nuevo)

**Archivo:** `src/services/admin/content.ts`
**Params:** ninguno
**Return:** `Promise<CronRunStatus[]>`
**Operaciones Firestore:** `getDocs(collection(db, COLLECTIONS.CRON_RUNS))` — lee todos los documentos de `_cronRuns`

Convierte cada documento a `CronRunStatus` usando un converter inline (o funcion helper) que mapea `lastRunAt` Timestamp a Date.

---

## Integracion

### Archivos existentes que necesitan modificacion

| Archivo | Cambio |
|---------|--------|
| `src/config/collections.ts` | Agregar `CRON_RUNS: '_cronRuns'` |
| `src/types/admin.ts` | Agregar `CronRunStatus` interface |
| `src/constants/admin.ts` | Agregar `CronConfig` interface y `CRON_CONFIGS` array |
| `src/services/admin/content.ts` | Agregar `fetchCronHealthStatus()` |
| `src/services/admin/index.ts` | Re-exportar `fetchCronHealthStatus` |
| `src/components/admin/CronHealthSection.tsx` | Refactorizar para usar heartbeats |
| `firestore.rules` | Agregar regla para `_cronRuns` |
| `functions/src/scheduled/rankings.ts` | Wrappear con `withCronHeartbeat` (3 exports) |
| `functions/src/scheduled/trending.ts` | Wrappear con `withCronHeartbeat` |
| `functions/src/scheduled/dailyMetrics.ts` | Wrappear con `withCronHeartbeat` |
| `functions/src/scheduled/cleanupPhotos.ts` | Wrappear con `withCronHeartbeat` |
| `functions/src/scheduled/cleanupNotifications.ts` | Wrappear con `withCronHeartbeat` |
| `functions/src/scheduled/cleanupActivityFeed.ts` | Wrappear con `withCronHeartbeat` |
| `functions/src/scheduled/featuredLists.ts` | Wrappear con `withCronHeartbeat` |

### Preventive checklist

- [x] **Service layer**: `fetchCronHealthStatus` esta en `src/services/admin/content.ts` — no hay imports directos de `firebase/firestore` en componentes
- [x] **Duplicated constants**: `CRON_CONFIGS` es nueva, no duplica nada existente. `computeFreshness` ya existe en CronHealthSection y se reutiliza
- [x] **Context-first data**: No hay context que tenga datos de `_cronRuns` — correcto usar service
- [x] **Silent .catch**: Los `.catch` existentes en CronHealthSection usan `logger.error` — se mantienen
- [x] **Stale props**: No aplica — componente read-only

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/utils/cronHeartbeat.test.ts` | Escritura success con detail, escritura error con mensaje, calculo de durationMs, re-throw de error | Unit |
| `src/services/admin/__tests__/content.test.ts` | `fetchCronHealthStatus` retorna array correcto, manejo de coleccion vacia, mapeo de campos | Unit |
| `src/components/admin/__tests__/CronCard.test.tsx` | Renderiza label/schedule, freshness colors correctos (ok/warning/error), muestra "Sin datos" cuando null, muestra chip error con tooltip | Component |

### Casos a cubrir

- `withCronHeartbeat`: success con detail string, success sin detail (void), error path, durationMs calculo correcto
- `fetchCronHealthStatus`: retorna datos mapeados, coleccion vacia retorna [], manejo de campos opcionales (detail, durationMs)
- `CronCard`: status ok (< threshold), status warning (entre thresholds), status error (> warning threshold), sin datos, result error con detail tooltip

### Mock strategy

- Cloud Functions: mock `getDb()` y `FieldValue.serverTimestamp()`
- Frontend service: mock `firebase/firestore` (getDocs, collection, etc.)
- Component: mock del servicio completo

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos
- Tests de freshness para cada tipo de schedule (diario, semanal, mensual)

---

## Analytics

No se agregan eventos de analytics nuevos — este es un feature admin-only que no afecta a usuarios.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `_cronRuns` docs | Firestore persistent cache (prod) | N/A (real-time) | IndexedDB (Firestore SDK) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Heartbeat write (server) | Cloud Functions — requiere conectividad | N/A |

### Fallback UI

`AdminPanelWrapper` ya maneja estados loading/error. Si no hay datos de heartbeat para un cron, `CronCard` muestra "Sin datos" con HealthIndicator en error.

---

## Decisiones tecnicas

1. **`_cronRuns` en vez de subcollection:** Coleccion top-level con 9 documentos es simple y eficiente. No justifica subcollections bajo config ya que necesita regla de read diferente (admin only, no config generico).

2. **Helper wrapper vs decorator:** `withCronHeartbeat` como funcion async que wrappea el callback. Es mas explicito que un decorator y compatible con el patron `onSchedule` de Firebase Functions v2.

3. **Mantener visualizaciones existentes:** Las visualizaciones de tier distribution, top ranking y trending list se mantienen como seccion separada leyendo de las mismas fuentes existentes. No se migran a `_cronRuns` porque proveen datos diferentes (contenido vs. estado de salud).

4. **`CronCard` como subcomponente separado:** Extraido a su propio archivo para mantener `CronHealthSection` como orquestador limpio y facilitar testing aislado del card.

5. **`computeFreshness` reutilizada:** La funcion ya existe en `CronHealthSection.tsx`. Se mueve a `CronCard.tsx` (unico consumidor tras refactor) o se extrae a un util si se necesita en tests.

---

## Hardening de seguridad

### Firestore rules requeridas

```javascript
match /_cronRuns/{cronName} {
  allow read: if isAdmin();
  allow write: if false;
}
```

### Rate limiting

No aplica — `_cronRuns` solo se escribe desde Cloud Functions scheduled (no desde clientes).

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Lectura no autorizada de estado interno | `isAdmin()` rule — solo admin puede leer | `firestore.rules` |
| Escritura maliciosa de heartbeats falsos | `allow write: if false` — escritura solo via admin SDK | `firestore.rules` |
| Scraping de datos de crons | Protegido por AdminGuard frontend + `isAdmin()` rules | `firestore.rules`, `AdminGuard.tsx` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security o tech debt que se resuelvan con este feature.

Los scheduled functions actualmente usan `console.log` para reportar resultados. El heartbeat reemplaza esta dependencia de Cloud Logging con un registro persistente en Firestore, mejorando la observabilidad.

---

## File size estimation

| Archivo | Lineas estimadas | Dentro del limite? |
|---------|-----------------|-------------------|
| `functions/src/utils/cronHeartbeat.ts` | ~30 | Si |
| `functions/src/utils/cronHeartbeat.test.ts` | ~80 | Si |
| `src/components/admin/CronCard.tsx` | ~80 | Si |
| `src/components/admin/CronHealthSection.tsx` (refactorizado) | ~120 | Si |
| `src/components/admin/__tests__/CronCard.test.tsx` | ~100 | Si |
| `src/services/admin/__tests__/content.test.ts` (nuevo) | ~60 | Si |
