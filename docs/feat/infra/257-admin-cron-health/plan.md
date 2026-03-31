# Plan: Complete cron health monitoring for all scheduled functions

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Backend — Helper y heartbeat

**Branch:** `feat/257-admin-cron-health`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/cronHeartbeat.ts` | Crear helper `withCronHeartbeat(cronName, fn)` que escribe heartbeat a `_cronRuns/{cronName}` con `lastRunAt`, `result`, `detail`, `durationMs`. Try/catch: success path escribe 'success', error path escribe 'error' con `error.message` y re-throws. |
| 2 | `functions/src/utils/cronHeartbeat.test.ts` | Tests: success con detail string, success sin detail (void), error path escribe y re-throws, durationMs calculo correcto. Mock `getDb()`. |
| 3 | `functions/src/scheduled/cleanupPhotos.ts` | Extraer logica interna a funcion local `async function run(): Promise<string>`. Retornar detail string (ej: `Cleaned up ${n} rejected photos`). Wrappear con `await withCronHeartbeat('cleanupRejectedPhotos', run)`. Eliminar `console.log` final. |
| 4 | `functions/src/scheduled/cleanupNotifications.ts` | Mismo patron: extraer a `run()`, retornar detail, wrappear con `withCronHeartbeat('cleanupExpiredNotifications', run)`. |
| 5 | `functions/src/scheduled/cleanupActivityFeed.ts` | Mismo patron: wrappear con `withCronHeartbeat('cleanupActivityFeed', run)`. |
| 6 | `functions/src/scheduled/featuredLists.ts` | Wrappear con `withCronHeartbeat('generateFeaturedLists', run)`. |
| 7 | `functions/src/scheduled/dailyMetrics.ts` | Wrappear con `withCronHeartbeat('dailyMetrics', run)`. |
| 8 | `functions/src/scheduled/trending.ts` | Wrappear con `withCronHeartbeat('computeTrendingBusinesses', run)`. |
| 9 | `functions/src/scheduled/rankings.ts` | Wrappear cada uno de los 3 exports: `computeWeeklyRanking`, `computeMonthlyRanking`, `computeAlltimeRanking`. Cada uno extrae su logica interna a una funcion local y la wrappea con `withCronHeartbeat`. |

### Fase 2: Firestore rules

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar regla para `_cronRuns/{cronName}`: `allow read: if isAdmin(); allow write: if false;`. Ubicar junto a `_rateLimits` y `_ipRateLimits`. |

### Fase 3: Frontend — Types, constants, service

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar interface `CronRunStatus { cronName: string; lastRunAt: Date | null; result: 'success' | 'error' | null; detail?: string | undefined; durationMs?: number | undefined; }` |
| 2 | `src/config/collections.ts` | Agregar `CRON_RUNS: '_cronRuns'` al objeto `COLLECTIONS` |
| 3 | `src/constants/admin.ts` | Agregar interface `CronConfig` y array `CRON_CONFIGS` con los 9 crons (nombres, labels, schedules, thresholds). Importar con `import type` para `CronConfig`. |
| 4 | `src/services/admin/content.ts` | Agregar `fetchCronHealthStatus(): Promise<CronRunStatus[]>`. Lee `getDocs(collection(db, COLLECTIONS.CRON_RUNS))`, mapea cada doc a `CronRunStatus` con `{ cronName: doc.id, lastRunAt: doc.data().lastRunAt?.toDate() ?? null, result: doc.data().result ?? null, detail: doc.data().detail, durationMs: doc.data().durationMs }`. |
| 5 | `src/services/admin/index.ts` | Agregar `fetchCronHealthStatus` al re-export de content.ts |
| 6 | `src/services/admin/__tests__/content.test.ts` | Tests: `fetchCronHealthStatus` retorna datos mapeados correctamente, coleccion vacia retorna [], campos opcionales manejados. |

### Fase 4: Frontend — Componentes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/CronCard.tsx` | Crear componente. Props: `{ config: CronConfig; run: CronRunStatus | null }`. Importa `computeFreshness` (mover de CronHealthSection o copiar). Renderiza Card con: label, schedule, HealthIndicator, fecha relativa (`formatRelativeTime`), duracion, resultado. Si result='error': Chip "Error" rojo + Tooltip con detail. Si run es null: "Sin datos" con HealthIndicator error. |
| 2 | `src/components/admin/CronHealthSection.tsx` | Refactorizar: (a) importar `fetchCronHealthStatus` y `CRON_CONFIGS`, (b) cambiar fetcher para llamar a `fetchCronHealthStatus` + mantener `fetchLatestRanking`/`fetchTrendingCurrent` para las visualizaciones, (c) renderizar grilla de `CronCard` para los 9 crons (matching por `cronName`), (d) mantener seccion de visualizaciones existentes (tier, top ranking, trending) debajo con titulo "Datos adicionales". Eliminar `computeFreshness` local (movida a CronCard). |
| 3 | `src/components/admin/__tests__/CronCard.test.tsx` | Tests: renderiza label y schedule, freshness ok/warning/error segun thresholds, sin datos muestra error, result error muestra chip + tooltip. |

### Fase 5: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Agregar coleccion `_cronRuns` a la tabla de colecciones con campos, reglas y proposito |
| 2 | `docs/reference/features.md` | Actualizar mencion de admin panel: "cron health monitoring para las 9 scheduled functions" |
| 3 | `docs/reference/patterns.md` | Agregar `withCronHeartbeat` como patron server-side en seccion Server-side |

---

## Orden de implementacion

1. `functions/src/utils/cronHeartbeat.ts` + tests (sin dependencias)
2. 7 archivos de scheduled functions (dependen de cronHeartbeat)
3. `firestore.rules` (independiente del frontend)
4. `src/types/admin.ts` (sin dependencias)
5. `src/config/collections.ts` (sin dependencias)
6. `src/constants/admin.ts` (depende de types)
7. `src/services/admin/content.ts` + barrel + tests (depende de collections, types)
8. `src/components/admin/CronCard.tsx` + tests (depende de constants, types)
9. `src/components/admin/CronHealthSection.tsx` refactor (depende de service, CronCard, constants)
10. Documentacion (ultimo)

---

## Riesgos

1. **Heartbeat write falla silenciosamente:** Si la escritura del heartbeat a `_cronRuns` falla (ej: Firestore timeout), la funcion principal ya completo pero el dashboard no se actualiza. Mitigacion: el heartbeat write esta en un try/catch separado que loggea el error pero no afecta la funcion principal. El dashboard mostrara "warning" o "error" por falta de actualizacion, lo cual es el comportamiento deseado.

2. **Cambio en 7 archivos de scheduled functions:** Riesgo de regresion si la extraccion de logica a funcion local introduce bugs. Mitigacion: el patron es mecanico (extraer body de callback a funcion, wrappear), y los tests existentes de las funciones scheduled (si los hay) cubren la logica.

3. **Firestore rules desplegadas antes que Cloud Functions:** Si las rules se deployean antes que las funciones con heartbeat, la coleccion existira en rules pero estara vacia. El frontend ya maneja el caso "sin datos". No hay riesgo operacional.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — `fetchCronHealthStatus` esta en service layer
- [x] Archivos nuevos en carpeta de dominio correcta: `CronCard` en `components/admin/`, `cronHeartbeat` en `functions/src/utils/`
- [x] Logica de negocio en hooks/services, no en componentes — freshness calc en CronCard es logica de presentacion, datos via service
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — los `console.log` de las scheduled functions se reemplazan por heartbeat
- [x] Ningun archivo resultante supera 400 lineas — estimaciones en specs confirman

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Agregar coleccion `_cronRuns` con campos y reglas |
| 2 | `docs/reference/features.md` | Actualizar admin panel: cron health monitoring completo |
| 3 | `docs/reference/patterns.md` | Agregar `withCronHeartbeat` como patron server-side |

---

## Criterios de done

- [ ] `withCronHeartbeat` helper creado con tests
- [ ] Los 9 cron exports (7 scheduled functions) integran heartbeat
- [ ] Regla de Firestore para `_cronRuns` deployeada
- [ ] `fetchCronHealthStatus` en service layer con tests
- [ ] `CronCard` componente con tests
- [ ] `CronHealthSection` refactorizado mostrando los 9 crons
- [ ] Visualizaciones existentes (tier, top ranking, trending) sin regresion
- [ ] Tests pass con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (frontend + functions)
- [ ] Reference docs actualizados (firestore.md, features.md, patterns.md)
