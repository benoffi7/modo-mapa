# Deuda Técnica — Backlog

**Última actualización:** 2026-03-15
**Consolidado de:** audit-phase4-v1, pre-launch-audit, security-audit-v1.4 (todos resueltos, archivados)

---

## Performance (nice-to-have)

| ID | Descripción | Impacto |
|----|-------------|---------|
| P3.1 | MapContext value change re-renders 40+ markers en cada selección | Alto en mobile |
| P1.4 | Sin manual chunk splitting (firebase, MUI en un solo chunk) | Cache hit rate |
| DT-4 | `dailyMetrics` Cloud Function hace full collection scans | Billing a escala |

## Arquitectura (nice-to-have)

| ID | Descripción | Impacto |
|----|-------------|---------|
| DT-1 | Dependencia bidireccional services ↔ hooks (invalidateQueryCache) | Testabilidad |
| DT-6 | `BusinessComments` ~670 líneas — mega-component | Mantenibilidad |

## Seguridad (informativo, riesgo aceptado)

| ID | Descripción | Decisión |
|----|-------------|----------|
| I-01 | Cloud Functions triggers sin App Check | Comportamiento de Firebase por diseño |
| I-03 | Datos de negocio estáticos en JSON local | Datos públicos, riesgo aceptado |
