# Performance Semaphores — Backlog Post-Merge

**Fecha:** 2026-03-15
**Version:** 2.9.0
**Origen:** Auditorias automatizadas del merge staging → main

## Contexto

Las 4 fases de Performance Semaphores estan implementadas y funcionando en produccion.
Durante el merge se corrieron 8 agentes auditores que detectaron mejoras pendientes.
Ninguna es bloqueante para produccion, pero se recomienda abordarlas en un sprint de polish.

## Items

### 1. Dark Mode — SEMAPHORE_COLORS hardcodeados

**Agente:** dark-mode-auditor
**Severidad:** Media
**Archivo:** `src/components/admin/PerformancePanel.tsx` lineas 55-59

El objeto `SEMAPHORE_COLORS` usa hex fijos (`#4caf50`, `#ff9800`, `#f44336`) en vez de
`theme.palette.success.main` / `warning.main` / `error.main`. En dark mode MUI ajusta
estos colores automaticamente para mejor contraste. Al hardcodearlos se pierde esa adaptacion.

**Fix:** Usar `useTheme()` y acceder a `theme.palette[status].main`. Eliminar `SEMAPHORE_COLORS`.

### 2. Security — storageStats N+1 queries

**Agente:** security + architecture
**Severidad:** Media
**Archivo:** `functions/src/admin/storageStats.ts` lineas 21-28

El loop `for (const file of files) { await file.getMetadata() }` es O(N) llamadas de red.
Con cientos de fotos sera lento y costoso. El listado de `getFiles()` ya incluye `metadata.size`
en cada objeto File, eliminando la necesidad de llamadas individuales a `getMetadata()`.

**Fix:** Reemplazar el loop por `files.reduce((sum, f) => sum + Number(f.metadata.size ?? 0), 0)`.
Alternativa: cachear resultado en Firestore y servir desde cache (actualizar en dailyMetrics).

### 3. Architecture — arrayUnion descarta duplicados

**Agente:** architecture + security
**Severidad:** Alta
**Archivo:** `functions/src/utils/perfTracker.ts` lineas 9-21

`FieldValue.arrayUnion(Math.round(elapsed))` no agrega valores duplicados. Si dos invocaciones
tardan exactamente lo mismo (redondeado a ms), solo se guarda una. Esto corrompe las metricas
de percentiles al perder muestras.

**Fix opciones:**

1. Usar `FieldValue.arrayUnion({ ms: elapsed, ts: Date.now() })` para hacer cada entrada unica
2. Cambiar a subcolleccion `config/perfCounters/{functionName}` con docs individuales
3. Pre-agregar en memoria y flushear con `set` periodico

**Recomendacion:** Opcion 1 es la mas simple y mantiene el approach actual.

### 4. Architecture — PerformancePanel decomposition

**Agente:** architecture
**Severidad:** Baja
**Archivo:** `src/components/admin/PerformancePanel.tsx` (514 lineas)

El componente es legible pero grande. La division natural seria:

- Extraer `SemaphoreCard`, `QueryLatencyTable`, `FunctionTimingTable`, `StorageCard` a
  `src/components/admin/perf/`
- Mover funciones de agregacion a `src/utils/perfAggregation.ts`
- El componente principal quedaria en ~150 lineas

### 5. Architecture — calculatePercentile duplicada

**Agente:** architecture
**Severidad:** Baja
**Archivo:** `src/components/admin/PerformancePanel.tsx` linea 66

La funcion `pctl` es una copia inline de `calculatePercentile` de `src/utils/perfMetrics.ts`.
Deberia importarla en vez de redefinirla.

**Fix:** `import { calculatePercentile } from '../../utils/perfMetrics'` y eliminar `pctl`.

### 6. Security — perfMetrics rate limiting

**Agente:** security
**Severidad:** Media

La coleccion `perfMetrics` permite creates sin rate limit. Un atacante puede crear cuentas
anonimas y floodear la coleccion. El client-side `flushed` flag es trivialmente bypasseable.

**Fix:** Agregar rate limiting server-side similar al patron `_rateLimits` usado en otros
lugares, o rutear writes por una callable Cloud Function con rate limiting.

### 7. Security — config/perfCounters array unbounded

**Agente:** security
**Severidad:** Media
**Archivo:** `functions/src/utils/perfTracker.ts`

Entre resets de dailyMetrics, los arrays en `config/perfCounters` pueden crecer sin limite
acercandose al 1 MiB max de Firestore. Si dailyMetrics falla, el doc queda bloqueado.

**Fix:** Agregar safety bound (max 5000 entries por funcion) o usar subcolleccion.

## Seccion de Help

No aplica — Performance panel es admin-only, no visible para usuarios.

## Privacy Policy

Ya actualizada en este merge (perfMetrics declarado en la politica).

## Seed Data

Ya actualizado en este merge (perfMetrics seeded, counters incluidos).

## Admin Panel

El propio PerformancePanel ES la feature admin. No requiere actualizacion adicional.

## Priorizacion sugerida

| # | Item | Esfuerzo | Impacto |
|---|------|----------|---------|
| 3 | arrayUnion duplicates | 30 min | Alto — datos corruptos |
| 2 | storageStats N+1 | 15 min | Medio — performance |
| 6 | perfMetrics rate limit | 1h | Medio — seguridad |
| 7 | perfCounters unbounded | 30 min | Medio — resiliencia |
| 1 | SEMAPHORE_COLORS | 15 min | Bajo — dark mode |
| 5 | calculatePercentile DRY | 5 min | Bajo — calidad |
| 4 | PerformancePanel split | 2h | Bajo — mantenibilidad |
