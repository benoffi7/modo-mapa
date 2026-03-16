# Deuda Técnica — Backlog

**Última actualización:** 2026-03-16
**Consolidado de:** audit-phase4-v1, pre-launch-audit, security-audit-v1.4

---

## Resueltos

| ID | Descripción | Resolución |
|----|-------------|------------|
| P1.4 | Sin manual chunk splitting (firebase, MUI en un solo chunk) | ✅ Ya configurado en vite.config.ts |
| DT-1 | Dependencia bidireccional services ↔ hooks (invalidateQueryCache) | ✅ v2.14.1 — sharedLists.ts importa de services/queryCache |
| P3.1 | MapContext value change re-renders 40+ markers | ✅ v2.14.1 — selectedId string comparison + memo markers |
| DT-4 | `dailyMetrics` Cloud Function hace full collection scans | ✅ v2.14.1 — limit(10000) en userTags scan |
| DT-6 | `BusinessComments` ~527 líneas mega-component | ✅ v2.14.2 — Extraído CommentInput (77 líneas). Reducido a 474 líneas |
| DT-7 | `writesByCollection` en dailyMetrics nunca se computa | ✅ Ya implementado — trackWrite() en triggers escribe a dailyMetrics en tiempo real |
| DT-8 | `AbuseAlerts` 643 líneas mega-component | ✅ v2.14.2 — Extraído alertsHelpers.ts (95 líneas) + KpiCard.tsx (29 líneas). Reducido a 238 líneas |
| DT-9 | `CommentsList` 699 líneas mega-component | ✅ v2.14.3 — Extraído CommentsStats.tsx (64) + CommentsToolbar.tsx (88). Reducido a 586 líneas |
| DT-10 | `SideMenu` 504 líneas con 12 nav items | ✅ v2.14.3 — Extraído SideMenuNav.tsx (106). Reducido a 396 líneas |

---

## Pendientes

Sin items pendientes. Se creó una [directiva de tamaño de archivos](../reference/file-size-directive.md) para prevenir la acumulación futura de componentes grandes (límite: 400 líneas).

Próximos items de mejora están en el [Backlog de Producto](backlog-producto.md).

---

## Seguridad (informativo, riesgo aceptado)

| ID | Descripción | Decisión |
|----|-------------|----------|
| I-01 | Cloud Functions triggers sin App Check | Comportamiento de Firebase por diseño |
| I-03 | Datos de negocio estáticos en JSON local | Datos públicos, riesgo aceptado |
