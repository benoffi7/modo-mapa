# PRD #187 — Admin: Visibilidad de Rankings y Trending

## Contexto

`userRankings` y `trendingBusinesses` son colecciones pre-computadas por Cloud Functions (crons). Sin visibilidad en admin, no hay forma de detectar si un cron fallo silenciosamente o verificar que los datos estan actualizados.

## Requisitos

### Seccion Rankings en panel existente (DashboardOverview o nuevo sub-panel)
- Opcion A: agregar seccion colapsable en DashboardOverview
- Opcion B: agregar sub-tab en un panel existente (ej: Usuarios)
- Recomendacion: seccion en DashboardOverview por ser health-check de infraestructura

#### Rankings
- Ultimo periodo computado (ej: "Semanal - semana del 2026-03-17")
- Timestamp de ultima ejecucion del cron
- Health indicator: verde si <7 dias, amarillo si 7-14, rojo si >14
- Distribucion de tiers: cuantos usuarios en Bronce/Plata/Oro/Diamante (pie chart)
- Top 5 del ranking actual

#### Trending
- Lista de comercios trending actuales (del documento `trendingBusinesses/current`)
- Timestamp de ultima actualizacion
- Health indicator: verde si <24h, amarillo si 24-48h, rojo si >48h (cron corre a 3 AM ART)
- Score y breakdown por comercio

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/services/admin.ts` | Agregar `fetchRankingStats()`, `fetchTrendingCurrent()` |
| `src/types/admin.ts` | Agregar `RankingStats`, `TrendingSnapshot` interfaces |
| `src/components/admin/DashboardOverview.tsx` | Agregar secciones Rankings Health y Trending Health |
| `src/components/admin/StatCard.tsx` | Verificar soporte para health indicator (color condicional) |

## Patron a seguir

- Rankings: leer `userRankings` collection, ultimo documento por timestamp. Contar tiers con reduce client-side
- Trending: leer documento `trendingBusinesses/current` directamente
- Health indicators: similar al patron de `QuotaBar` en FirebaseUsage (color condicional segun threshold)
- PieChart de tiers: reusar `PieChartCard` existente

## Tests

- `fetchRankingStats` retorna distribucion de tiers correcta
- `fetchTrendingCurrent` retorna snapshot actual
- Health indicators cambian de color segun freshness
- Top 5 ranking renderiza correctamente

## Seguridad

- Solo lectura, admin-only (AdminGuard)
- No exponer scores individuales detallados — solo top 5 y distribucion

## Fuera de scope

- Forzar re-ejecucion de crons desde admin
- Editar rankings manualmente
- Historico de snapshots trending
