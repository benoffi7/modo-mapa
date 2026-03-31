# PRD: Complete cron health monitoring for all scheduled functions

**Feature:** 257-admin-cron-health
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #257
**Prioridad:** Alta

---

## Contexto

El panel admin tiene un `CronHealthSection` que muestra indicadores de frescura para solo 2 de las 7 scheduled functions del proyecto (rankings y trending). Las 4 funciones de limpieza (`cleanupRejectedPhotos`, `cleanupExpiredNotifications`, `cleanupActivityFeed`) y la generacion semanal (`generateFeaturedLists`) no tienen ningun indicador de salud. Ademas, `dailyMetrics` tampoco esta representado. Esto crea un punto ciego operacional donde un cron puede fallar silenciosamente sin deteccion.

## Problema

- Las funciones de limpieza (`cleanupRejectedPhotos`, `cleanupExpiredNotifications`, `cleanupActivityFeed`) corren diariamente pero si fallan, datos basura se acumulan sin alerta
- `generateFeaturedLists` corre semanalmente (lunes 5AM) y su falla implica que las listas destacadas quedan desactualizadas indefinidamente
- `dailyMetrics` corre diariamente a las 3AM y es la fuente del dashboard de metricas, pero no tiene indicador de frescura
- El admin no tiene forma de saber si alguno de estos crons dejo de ejecutarse, salvo revisar logs de Cloud Functions manualmente

## Solucion

### S1. Registro de ejecucion en Cloud Functions (backend)

Cada scheduled function debe escribir un documento de heartbeat al finalizar exitosamente. Se usara una coleccion `_cronRuns` en Firestore con documentos por nombre de cron.

Estructura del documento:

```
_cronRuns/{cronName}
  lastRunAt: Timestamp (server)
  result: 'success' | 'error'
  detail?: string (ej: "Cleaned up 12 rejected photos")
  durationMs?: number
```

Los 7+2 crons que escribiran heartbeat (9 funciones exportadas, 7 scheduled functions):

| Cron | Schedule | Threshold OK | Threshold Warning |
|------|----------|-------------|-------------------|
| `computeWeeklyRanking` | Lunes 4AM | 7 dias | 14 dias |
| `computeMonthlyRanking` | 1ro del mes 4AM | 31 dias | 45 dias |
| `computeAlltimeRanking` | Lunes 5AM | 7 dias | 14 dias |
| `computeTrendingBusinesses` | Diario 3AM | 26h | 48h |
| `dailyMetrics` | Diario 3AM | 26h | 48h |
| `cleanupRejectedPhotos` | Diario 4AM | 26h | 48h |
| `cleanupExpiredNotifications` | Diario 5AM | 26h | 48h |
| `cleanupActivityFeed` | Diario 5AM | 26h | 48h |
| `generateFeaturedLists` | Lunes 5AM | 7 dias | 14 dias |

Cada cron wrappea su logica con un helper `withCronHeartbeat(cronName, fn)` que:

1. Registra el timestamp de inicio
2. Ejecuta la funcion
3. Escribe el heartbeat con `result: 'success'` y `durationMs`
4. Si falla, escribe `result: 'error'` con el mensaje de error en `detail`

### S2. Lectura de heartbeats en frontend (admin service)

Nuevo servicio `fetchCronHealthStatus()` en `src/services/admin/content.ts` que lee todos los documentos de `_cronRuns` y los retorna como array tipado.

### S3. Extender CronHealthSection con los 7 crons faltantes

Refactorizar `CronHealthSection` para:

1. Reemplazar la logica actual de freshness (que lee `userRankings` y `trendingBusinesses` indirectamente) por una lectura directa de `_cronRuns`
2. Mostrar una grilla de cards con todos los crons, cada uno con:
   - Nombre descriptivo del cron
   - `HealthIndicator` (OK/Atrasado/Sin datos)
   - Ultima ejecucion (fecha y hora relativa)
   - Resultado (success/error)
   - Duracion si disponible
3. Mantener las visualizaciones extra existentes (tier distribution, top ranking, trending list) como secciones colapsables debajo de la grilla de salud

### UX

- La grilla de salud aparece primero, con una card compacta por cron
- Cards usan el `HealthIndicator` existente (Chip con colores success/warning/error)
- Crons diarios con freshness > 26h muestran warning, > 48h muestran error
- Crons semanales con freshness > 7d muestran warning, > 14d muestran error
- Crons mensuales con freshness > 31d muestran warning, > 45d muestran error
- Si `result === 'error'`, el card muestra un chip "Error" rojo adicional con el detalle en tooltip

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Helper `withCronHeartbeat` en Cloud Functions | Alta | S |
| Integrar heartbeat en los 9 crons existentes | Alta | M |
| Coleccion `_cronRuns` y Firestore rules (admin read only) | Alta | S |
| `fetchCronHealthStatus()` en admin service | Alta | S |
| Constantes de crons (nombres, schedules, thresholds) | Alta | S |
| Refactorizar `CronHealthSection` para usar heartbeats | Alta | M |
| Tests para `withCronHeartbeat` | Alta | S |
| Tests para `fetchCronHealthStatus` | Alta | S |
| Tests para `computeFreshness` con nuevos thresholds | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Alertas push/email cuando un cron falla (futuro: integracion con notificaciones admin)
- Dashboard de historico de ejecuciones (solo se guarda la ultima por cron)
- Retry automatico de crons fallidos
- Monitoreo de Cloud Functions no-scheduled (triggers, callables)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/cronHeartbeat.ts` | Util (Functions) | Escritura de heartbeat en success, escritura en error, calculo de durationMs, manejo de errores de Firestore |
| `functions/src/scheduled/cleanupPhotos.ts` | Scheduled (integration) | Verificar que heartbeat se escribe post-ejecucion |
| `functions/src/scheduled/cleanupNotifications.ts` | Scheduled (integration) | Verificar que heartbeat se escribe post-ejecucion |
| `functions/src/scheduled/cleanupActivityFeed.ts` | Scheduled (integration) | Verificar que heartbeat se escribe post-ejecucion |
| `functions/src/scheduled/featuredLists.ts` | Scheduled (integration) | Verificar que heartbeat se escribe post-ejecucion |
| `functions/src/scheduled/dailyMetrics.ts` | Scheduled (integration) | Verificar que heartbeat se escribe post-ejecucion |
| `src/services/admin/content.ts` | Service | fetchCronHealthStatus retorna datos correctos, manejo de coleccion vacia |
| `src/components/admin/CronHealthSection.tsx` | Component | Renderiza todos los crons, freshness colors correctos, manejo de datos faltantes |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (success/error/null por cada cron)
- Side effects verificados (escritura de heartbeat a Firestore)

---

## Seguridad

- [x] Feature admin-only: no expone datos a usuarios regulares
- [ ] `_cronRuns` Firestore rules: read admin only, write false (Functions only via admin SDK)
- [ ] No se expone informacion sensible en `detail` (solo conteos y mensajes genericos)
- [ ] Heartbeat writes usan admin SDK (no client writes)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Coleccion `_cronRuns` | Lectura no autorizada de estado interno | Rules: solo admin read, no client write |
| Admin panel endpoint | Scraping de estado de crons | Protegido por AdminGuard + isAdmin() |

Si el feature escribe a Firestore:

- [x] Escrituras a `_cronRuns` son exclusivamente via admin SDK desde Cloud Functions — no hay reglas de create/update para clientes
- [x] No hay inputs de usuario — los datos vienen del resultado de la ejecucion del cron
- [x] No se requiere rate limit (escritura solo desde scheduled functions)
- [x] No se requiere moderacion (sin texto libre de usuarios)

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| No hay issues de seguridad o tech debt abiertos | N/A | N/A |

### Mitigacion incorporada

- Los crons de cleanup (`cleanupPhotos`, `cleanupNotifications`, `cleanupActivityFeed`) actualmente solo hacen `console.log` al finalizar. El heartbeat reemplaza esos logs con un registro persistente y observable, mejorando la operabilidad sin dependencia de Cloud Logging.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `CronHealthSection` ya usa `useAsyncData` que maneja loading/error — el refactor mantiene este patron
- [ ] `withCronHeartbeat` en Cloud Functions tiene try/catch que escribe heartbeat de error si la funcion falla, y no silencia el error original (re-throw)
- [ ] Funciones exportadas que no se usan fuera del archivo y tests: marcar como internas o no exportar
- [ ] Archivos en `src/hooks/` DEBEN usar al menos un React hook — este feature no agrega hooks nuevos
- [ ] Constantes nuevas de localStorage: no aplica (datos de Firestore, no localStorage)
- [ ] Archivos nuevos no superan 300 lineas (warn) ni 400 lineas (blocker)

### Checklist de documentacion

- [ ] `docs/reference/features.md` actualizado con mencion de cron health monitoring completo
- [ ] `docs/reference/firestore.md` actualizado con coleccion `_cronRuns`
- [ ] `docs/reference/patterns.md` actualizado si `withCronHeartbeat` se considera un patron nuevo

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Leer `_cronRuns` | read | Firestore persistent cache cubre primera carga | AdminPanelWrapper muestra error |
| Escribir heartbeat (Functions) | write (server) | N/A — Cloud Functions requieren conectividad | N/A — server-side |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline de Firestore (prod)
- [x] Writes: server-side only via Cloud Functions (no aplica offline queue)
- [x] APIs externas: no hay
- [x] UI: AdminPanelWrapper ya maneja error state
- [x] Datos criticos: disponibles en cache de Firestore para primera carga

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en services (`fetchCronHealthStatus`) no inline en componente
- [x] `withCronHeartbeat` es un util reutilizable en `functions/src/utils/`
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Constantes de crons en archivo dedicado bajo `src/constants/admin.ts` o `functions/src/constants/`
- [x] Ningun componente nuevo importa directamente de `firebase/firestore` (usa service layer)
- [x] Archivos nuevos van en carpeta de dominio correcta (`admin/` y `functions/src/utils/`)
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Refactor de componente existente, no agrega imports cruzados |
| Estado global | = | Sin contextos nuevos, usa `useAsyncData` existente |
| Firebase coupling | = | Queries en service layer, no en componente |
| Organizacion por dominio | = | Archivos en carpetas correctas (admin/, functions/utils/) |

---

## Success Criteria

1. Los 9 cron exports (7 scheduled functions) escriben heartbeat a `_cronRuns` al completar exitosamente o con error
2. `CronHealthSection` muestra indicadores de salud para todos los crons con freshness apropiado por schedule
3. Un cron que no ejecuto en su ventana esperada muestra warning o error en el admin dashboard
4. Las visualizaciones existentes (tier distribution, top ranking, trending list) siguen funcionando sin regresion
5. Tests cubren >= 80% del codigo nuevo, incluyendo `withCronHeartbeat` y `fetchCronHealthStatus`
