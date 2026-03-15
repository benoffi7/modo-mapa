# PRD: Admin — Semaforos de Performance

**Feature:** performance-semaphores
**Categoria:** admin
**Fecha:** 2026-03-15
**Prioridad:** Media

---

## Contexto

El admin dashboard tiene 9 tabs cubriendo contenido, usuarios, tendencias, alertas y backups. Sin embargo, no hay visibilidad sobre la **salud del rendimiento** de la app. No se miden tiempos de carga, latencias de Firestore, ni Core Web Vitals. Sentry esta configurado solo para errores (`tracesSampleRate: 0`), y la daily metrics Cloud Function solo captura reads/writes/deletes, no tiempos.

Cuando un usuario reporta que "la app esta lenta", no hay datos para diagnosticar. El admin no puede distinguir si el problema es Firestore, el bundle, un componente lento, o el dispositivo del usuario.

---

## Problema

1. **Cero visibilidad de performance**: no se miden tiempos de carga, latencia de queries, ni Core Web Vitals.
2. **Diagnostico reactivo**: los problemas de performance solo se descubren por quejas de usuarios.
3. **Sin baseline**: no hay datos historicos para detectar regresiones tras deploys.
4. **Sentry infrautilizado**: la infraestructura de tracing existe pero esta desactivada.

---

## Solucion

### S1: Recoleccion de metricas (client-side)

Capturar metricas de performance en el navegador y enviarlas a Firestore para consumo en el admin.

#### S1.1: Web Vitals

Medir las 4 Core Web Vitals usando la API nativa `PerformanceObserver`:

| Metrica | Que mide | Semaforo verde | Semaforo amarillo | Semaforo rojo |
|---------|----------|---------------|-------------------|---------------|
| **LCP** (Largest Contentful Paint) | Tiempo hasta que el contenido principal es visible | < 2.5s | 2.5s - 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | Latencia de interaccion | < 200ms | 200ms - 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | Estabilidad visual | < 0.1 | 0.1 - 0.25 | > 0.25 |
| **TTFB** (Time to First Byte) | Respuesta del servidor/CDN | < 800ms | 800ms - 1800ms | > 1800ms |

**Implementacion**: usar `PerformanceObserver` directamente (sin dependencia `web-vitals`) para mantener bundle minimo. Capturar una vez por sesion, no en cada navegacion.

**Archivos:**

- `src/utils/perfMetrics.ts` (nuevo) — captura y envia metricas

#### S1.2: Tiempos de Firestore

Medir latencia de las queries mas criticas wrapeando los fetches existentes:

| Query | Donde se mide | Threshold verde | Threshold rojo |
|-------|---------------|----------------|---------------|
| businessDataCache fetch | `useBusinesses` | < 500ms | > 2000ms |
| Comments paginated | `usePaginatedQuery` | < 300ms | > 1000ms |
| Notifications fetch | `NotificationsContext` | < 200ms | > 800ms |
| User settings fetch | `useUserSettings` | < 150ms | > 500ms |

**Implementacion**: wrapper `measureAsync(name, fn)` que usa `performance.now()` antes/despues del await. No modifica la logica, solo mide.

**Archivos:**

- `src/utils/perfMetrics.ts` — agregar `measureAsync` helper
- Tocar los hooks existentes para wrappear los fetches (cambio minimo)

#### S1.3: Cloud Function execution time

Las Cloud Functions ya loguean duracion en el emulador. Para produccion, agregar un campo `executionMs` al doc de `dailyMetrics` con p50/p95 de las funciones mas criticas.

**Implementacion**: wrappear el body de `onCommentCreated` y `onRatingWritten` con `performance.now()`, acumular en un counter doc, y agregarlo en `dailyMetrics`.

**Archivos:**

- `functions/src/utils/perfTracker.ts` (nuevo)
- `functions/src/triggers/comments.ts` — wrappear
- `functions/src/scheduled/dailyMetrics.ts` — incluir metricas

---

### S2: Storage de metricas

#### S2.1: Coleccion `perfMetrics`

Un doc por sesion de usuario (no por page view) para mantener el volumen bajo.

```text
perfMetrics/{sessionId}
  userId: string
  timestamp: Timestamp
  vitals: { lcp: number, inp: number, cls: number, ttfb: number }
  queries: { [name: string]: { p50: number, p95: number, count: number } }
  device: { type: 'mobile' | 'desktop', connection: string }
  appVersion: string
```

**Volumen estimado**: ~50-200 docs/dia (1 por sesion activa). Costo Firestore despreciable.

**Retencion**: 30 dias. Una Cloud Function scheduled borra docs mas viejos.

#### S2.2: Agregacion diaria

Extender `dailyMetrics` con un campo `performance`:

```text
dailyMetrics/{date}
  ... campos existentes ...
  performance: {
    vitals: { lcp: { p50, p95, green%, yellow%, red% }, ... }
    queries: { businessFetch: { p50, p95 }, ... }
    functions: { onCommentCreated: { p50, p95 }, ... }
    sampleCount: number
  }
```

---

### S3: UI — Tab "Performance" en Admin

Nueva tab (la 10a) con vista de semaforos.

#### S3.1: Vista de semaforos (hero)

Grid de cards con indicador visual tipo semaforo:

```text
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  🟢 LCP          │ │  🟡 INP          │ │  🟢 CLS          │ │  🟢 TTFB         │
│  1.8s (p75)     │ │  280ms (p75)    │ │  0.04 (p75)     │ │  420ms (p75)    │
│  ▁▂▃▂▁▂▃▄▃▂    │ │  ▁▂▃▅▆▅▃▂▁▂    │ │  ▁▁▁▁▁▂▁▁▁▁    │ │  ▂▂▃▂▂▂▃▂▂▂    │
│  ultimos 7 dias │ │  ultimos 7 dias │ │  ultimos 7 dias │ │  ultimos 7 dias │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

Cada card tiene:

- Circulo de color (verde/amarillo/rojo) basado en el p75 del ultimo dia
- Valor numerico actual (p75)
- Sparkline de los ultimos 7 dias
- Tooltip con p50, p75, p95 y distribucion de semaforos

#### S3.2: Tabla de queries

Tabla con las latencias de Firestore queries:

| Query | p50 | p95 | Samples | Status |
|-------|-----|-----|---------|--------|
| Business fetch | 320ms | 890ms | 145 | 🟢 |
| Comments page | 180ms | 620ms | 89 | 🟢 |
| Notifications | 95ms | 340ms | 203 | 🟢 |
| User settings | 60ms | 180ms | 198 | 🟢 |

#### S3.3: Cloud Functions timing

Misma tabla para funciones server-side:

| Function | p50 | p95 | Invocations | Status |
|----------|-----|-----|-------------|--------|
| onCommentCreated | 45ms | 180ms | 23 | 🟢 |
| onRatingWritten | 32ms | 95ms | 15 | 🟢 |

#### S3.4: Tendencia historica

Grafico de lineas (reutilizar Recharts existente) mostrando la evolucion de los p75 de cada vital en los ultimos 30 dias. Overlay con deploy markers (tags de git via GitHub API o manual).

#### S3.5: Filtros

- **Periodo**: hoy / 7 dias / 30 dias
- **Dispositivo**: todos / mobile / desktop
- **Conexion**: todos / 4g / 3g / wifi

#### S3.6: Storage de fotos del menu

Card adicional en la seccion de semaforos mostrando el espacio usado por las fotos de menu en Firebase Storage:

```text
┌─────────────────────┐
│  📷 Fotos Menu       │
│  128 MB / 1 GB      │
│  ████████░░  (12.8%) │
│  347 archivos       │
│  ▁▂▃▃▄▄▅▅▆▆ +15%   │
└─────────────────────┘
```

La card muestra:

- Espacio total usado (MB/GB) y porcentaje del limite del free tier (1 GB storage / 5 GB en Blaze)
- Cantidad de archivos
- Barra de progreso con color: verde (< 50%), amarillo (50-80%), rojo (> 80%)
- Tendencia de crecimiento vs periodo anterior

**Implementacion**: Cloud Function callable `getStorageStats` que usa Admin SDK para listar archivos en el bucket `menuPhotos/` y sumar tamanios. Cachear resultado en `config/storageStats` (1 refresh por dia o manual desde admin).

**Archivos:**

- `functions/src/admin/storageStats.ts` (nuevo) — callable que calcula stats
- `src/services/admin.ts` — agregar `fetchStorageStats`
- `src/components/admin/PerformancePanel.tsx` — card de storage

---

### S4: Agente `perf-auditor`

Agente dedicado que corre automaticamente en cada `/merge` para mantener la tab de Performance actualizada y detectar regresiones de instrumentacion.

#### S4.1: Responsabilidades

1. **Verificar instrumentacion completa**: escanear hooks y services para confirmar que todos los fetches criticos estan wrapeados con `measureAsync`. Si se agrega un nuevo hook con Firestore fetch sin instrumentar, reportar como warning.
2. **Verificar thresholds**: leer la config de semaforos y validar que los thresholds siguen siendo razonables vs los p75 reales de los ultimos 7 dias.
3. **Detectar nuevas queries sin medir**: si se agrega un nuevo `getDocs`/`getDoc`/`onSnapshot` en hooks o services, y no esta wrapeado con `measureAsync`, alertar.
4. **Verificar seed data**: confirmar que `perfMetrics` y `dailyMetrics.performance` estan en el seed script.
5. **Verificar storage stats**: confirmar que la callable `getStorageStats` sigue funcionando si cambia el bucket path o la estructura de fotos.

#### S4.2: Trigger

- Se ejecuta como parte del checklist de `/merge` (despues de los audits existentes).
- Solo corre si hay cambios en `src/hooks/`, `src/services/`, `src/context/`, `functions/src/triggers/`, o `src/utils/perfMetrics.ts`.

#### S4.3: Output

Reporte con:

- Lista de fetches instrumentados vs no instrumentados
- Nuevos fetches detectados sin `measureAsync`
- Estado de thresholds vs datos reales (si hay datos en produccion)
- Recomendaciones

**Archivos:**

- `.claude/agents/perf-auditor.md` (nuevo) — definicion del agente

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1.1: Web Vitals capture | Alta | S |
| S1.2: Firestore query timing | Alta | S |
| S1.3: Cloud Function timing | Media | M |
| S2.1: perfMetrics collection | Alta | S |
| S2.2: dailyMetrics aggregation | Media | M |
| S3.1: Semaphore cards | Alta | M |
| S3.2: Query latency table | Media | S |
| S3.3: Function timing table | Media | S |
| S3.4: Historical trend chart | Baja | M |
| S3.5: Filters | Baja | S |
| S3.6: Storage fotos card | Media | M |
| S4: Agente perf-auditor | Media | S |

**Esfuerzo total estimado:** L

---

## Fases

### Fase 1: Instrumentacion + storage (S1.1, S1.2, S2.1)

Capturar Web Vitals y query times client-side, enviar a `perfMetrics` collection. Sin UI todavia — validar que los datos se recopilan correctamente en el emulador.

### Fase 2: Admin UI basica (S3.1, S3.2, S3.6)

Semaphore cards para vitals + tabla de query latencies + card de storage de fotos. Lectura directa de `perfMetrics` (sin agregacion aun).

### Fase 3: Server-side + agregacion (S1.3, S2.2, S3.3, S4)

Cloud Function timing + agregacion diaria en `dailyMetrics`. Tabla de functions en el admin. Crear agente `perf-auditor` y registrarlo en `/merge`.

### Fase 4: Polish (S3.4, S3.5)

Grafico historico con tendencias y filtros por dispositivo/conexion.

---

## Out of Scope

- **Real User Monitoring (RUM) externo**: no usar Datadog, New Relic, etc. Todo in-house via Firestore.
- **Alertas automaticas**: no enviar notificaciones cuando un semaforo cambia a rojo. Solo visual en admin (futuro issue).
- **Sentry performance tracing**: no habilitar `tracesSampleRate` — demasiado overhead y costo. Usamos nuestra propia instrumentacion ligera.
- **Metricas por ruta/pagina**: v1 mide a nivel de sesion global. Per-route breakdown es futuro.
- **Metricas de Cloud Functions no criticas**: solo instrumentar `onCommentCreated` y `onRatingWritten` inicialmente.
- **Limpieza automatica de storage**: el admin ve el espacio usado, pero no puede borrar fotos desde esta tab (ya existe en la tab Fotos).

---

## Dependencias

- `dailyMetrics` scheduled function (ya existe, se extiende).
- Recharts (ya instalado, para graficos historicos).
- Admin dashboard tabs system (ya existe, se agrega tab 10).
- `PerformanceObserver` API (nativa, soportada en todos los browsers modernos).
- Firebase Storage Admin SDK (para listar archivos y calcular tamanios en `getStorageStats`).
- `/merge` command (para integrar el agente `perf-auditor` en el checklist).

---

## Riesgos

| Riesgo | Mitigacion |
|--------|------------|
| Overhead de medicion afecta performance | Solo `PerformanceObserver` (passive) + `performance.now()` (< 0.01ms). No hay fetch adicional en hot path. |
| Volumen de perfMetrics crece | 1 doc/sesion + cleanup a 30 dias. Maximo ~6000 docs/mes. |
| Metricas sesgadas por emulador/dev | Filtrar por `appVersion` y `import.meta.env.PROD`. Solo recopilar en produccion. |
| Sparkline misleading con pocos datos | Mostrar "datos insuficientes" si < 10 samples en el periodo. |
| Privacy: timing side-channel | Las metricas son de performance general, no contienen datos de usuario. userId solo para dedup (no se muestra en admin). |

---

## Success Criteria

1. El admin puede ver de un vistazo si la app esta performando bien (semaforos verdes) o si hay degradacion (amarillo/rojo).
2. Despues de un deploy, el admin puede comparar metricas pre/post para detectar regresiones.
3. El overhead de instrumentacion es imperceptible (< 1ms por sesion).
4. Los datos se recopilan solo en produccion y se limpian automaticamente a los 30 dias.

---

## Impacto en otras areas

### Help Section

- Sin cambios. La tab de performance es admin-only.

### Privacy Policy

- Agregar mencion de "metricas anonimas de rendimiento" en la seccion de datos recopilados, condicionado al consent de analytics.

### Seed Data

- Agregar docs de ejemplo en `perfMetrics` con datos realistas para testing del admin.
- Agregar campo `performance` a `dailyMetrics` seeds existentes.

### Admin Panel

- Nueva tab "Performance" (la 10a) en `AdminLayout.tsx`.

---

## Analytics

| Evento | Cuando | Propiedades |
|--------|--------|-------------|
| `perf_vitals_captured` | Una vez por sesion, tras capturar vitals | `lcp, inp, cls, ttfb, device_type` |
| `admin_perf_view` | Admin abre la tab Performance | `period_filter` |
