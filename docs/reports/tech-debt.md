# Deuda Técnica — Backlog

**Última actualización:** 2026-03-25
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
| DT-11 | `SharedListsView.tsx` 703 líneas + Firestore inline queries | ✅ v2.27.1 — Extraído SharedListDetailView, CreateListDialog, InviteEditorDialog. Queries movidas a services. 703→398 líneas |
| DT-12 | Bundle size: Google Maps + Sentry en main chunk | ✅ v2.27.5 — Google Maps lazy-loaded con MapAppShell, Sentry ya lazy. Index 448→269 KB (−40%) |

---

## Pendientes

Sin deuda técnica pendiente.

### Bundle size (referencia 2026-03-25)

| Chunk | Raw | Gzipped | Contenido |
|-------|-----|---------|-----------|
| `index-*.js` | 269 KB | 88 KB | react, react-dom, react-router-dom, app code |
| `MapAppShell-*.js` | 137 KB | 48 KB | AppShell + map components (lazy-loaded) |
| `google-maps-*.js` | 21 KB | 8 KB | @vis.gl/react-google-maps (lazy-loaded) |
| `mui-*.js` | 468 KB | 142 KB | @mui/material (tree-shaken) |
| `firebase-*.js` | 465 KB | 142 KB | firebase/firestore, firebase/auth, firebase/storage |
| `recharts-*.js` | 375 KB | 110 KB | recharts (admin + stats only) |

---

## Seguridad (informativo, riesgo aceptado)

| ID | Descripción | Decisión |
|----|-------------|----------|
| I-01 | Cloud Functions triggers sin App Check | Comportamiento de Firebase por diseño |
| I-03 | Datos de negocio estáticos en JSON local | Datos públicos, riesgo aceptado |
