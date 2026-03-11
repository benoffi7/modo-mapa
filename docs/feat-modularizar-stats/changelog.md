# Changelog — Modularización de componentes de estadísticas

## Archivos creados

- `src/types/metrics.ts` — Tipos compartidos: PublicMetrics, TopTagEntry,
  TopBusinessEntry, TopRatedEntry
- `src/components/stats/PieChartCard.tsx` — Componente pie chart (movido desde admin)
- `src/components/stats/TopList.tsx` — Componente top list (movido desde admin),
  con ordenamiento automático de mayor a menor
- `src/components/stats/index.ts` — Barrel export de componentes stats
- `src/hooks/usePublicMetrics.ts` — Hook para obtener métricas públicas de dailyMetrics
- `src/components/menu/StatsView.tsx` — Vista de estadísticas para el menú lateral
  público
- `docs/feat-modularizar-stats/prd.md` — PRD
- `docs/feat-modularizar-stats/specs.md` — Especificaciones técnicas
- `docs/feat-modularizar-stats/plan.md` — Plan técnico
- `docs/feat-modularizar-stats/changelog.md` — Este archivo

## Archivos modificados

- `src/types/admin.ts` — DailyMetrics ahora extiende PublicMetrics
- `src/components/admin/DashboardOverview.tsx` — Usa componentes de stats/ y
  usePublicMetrics hook. "Mejor calificados" ordena por avgScore
- `src/components/admin/FirebaseUsage.tsx` — Import de PieChartCard actualizado a stats/
- `src/components/admin/UsersPanel.tsx` — Import de TopList actualizado a stats/
- `src/components/layout/SideMenu.tsx` — Nueva sección "Estadísticas" con StatsView
- `firestore.rules` — dailyMetrics ahora permite lectura a usuarios autenticados

## Archivos eliminados

- `src/components/admin/charts/PieChartCard.tsx` — Movido a stats/
- `src/components/admin/TopList.tsx` — Movido a stats/
