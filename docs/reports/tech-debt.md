# Deuda Técnica — Backlog

**Última actualización:** 2026-03-16
**Consolidado de:** audit-phase4-v1, pre-launch-audit, security-audit-v1.4 (todos resueltos, archivados)

---

## Resueltos

| ID | Descripción | Resolución |
|----|-------------|------------|
| P1.4 | Sin manual chunk splitting (firebase, MUI en un solo chunk) | ✅ Ya configurado en vite.config.ts — firebase, mui, recharts en chunks separados |
| DT-1 | Dependencia bidireccional services ↔ hooks (invalidateQueryCache) | ✅ v2.15.0 — sharedLists.ts importa de services/queryCache en vez de hooks/usePaginatedQuery |
| P3.1 | MapContext value change re-renders 40+ markers en cada selección | ✅ v2.15.0 — Optimizado: selectedId como string comparison + markers memoizados. Impacto real bajo (solo 2 markers re-renderizan) |
| DT-4 | `dailyMetrics` Cloud Function hace full collection scans | ✅ v2.15.0 — Agregado limit(10000) a scan de userTags. Resto de queries filtradas por fecha (aceptable) |

---

## Pendientes

### Arquitectura

| ID | Descripción | Impacto | Esfuerzo |
|----|-------------|---------|----------|
| DT-6 | `BusinessComments` ~527 líneas, 13 state vars, 26 hooks | Mantenibilidad | Medio — extraer CommentForm, ReplyThread, custom hooks |

### Performance

| ID | Descripción | Impacto | Esfuerzo |
|----|-------------|---------|----------|
| DT-7 | `writesByCollection` en dailyMetrics nunca se computa | Gráficos de Features panel vacíos | Bajo — actualizar Cloud Function. Tracked en [#161](https://github.com/benoffi7/modo-mapa/issues/161) |
| DT-8 | `AbuseAlerts.tsx` 643 líneas — podría descomponerse como PerformancePanel | Mantenibilidad | Bajo |

---

## Seguridad (informativo, riesgo aceptado)

| ID | Descripción | Decisión |
|----|-------------|----------|
| I-01 | Cloud Functions triggers sin App Check | Comportamiento de Firebase por diseño |
| I-03 | Datos de negocio estáticos en JSON local | Datos públicos, riesgo aceptado |
