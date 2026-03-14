# Rankings - Issues de Mejora

Fecha: 2026-03-14
Estado: Implementado en branch `feat/rankings-improvements`

## Lista de Issues

| # | Issue | Descripción | Estado |
|---|-------|-------------|--------|
| #86 | [Indicador de tendencia](https://github.com/benoffi7/modo-mapa/issues/86) | Flechas mostrando si el usuario subió/bajó posiciones vs período anterior | Implementado |
| #87 | [Período All-time](https://github.com/benoffi7/modo-mapa/issues/87) | 4to tab con ranking acumulado histórico total | Implementado |
| #88 | [Mejorar empty state](https://github.com/benoffi7/modo-mapa/issues/88) | Empty state motivacional con call-to-action cuando no hay datos | Implementado |
| #89 | [Desglose visual (bar chart)](https://github.com/benoffi7/modo-mapa/issues/89) | Reemplazar chips por mini bar chart horizontal en UserScoreCard | Implementado |
| #90 | [Sistema de badges/logros](https://github.com/benoffi7/modo-mapa/issues/90) | Badges que premian hitos: primera reseña, top 3 semanal, etc. (11 badges) | Implementado |
| #91 | [Animaciones de entrada](https://github.com/benoffi7/modo-mapa/issues/91) | Staggered fade-in al renderizar la lista de rankings | Implementado |
| #93 | [Racha (streak)](https://github.com/benoffi7/modo-mapa/issues/93) | Días consecutivos con actividad del usuario | Implementado (UI ready, backend field opcional) |
| #94 | [Niveles/tiers](https://github.com/benoffi7/modo-mapa/issues/94) | Bronce, Plata, Oro, Diamante basado en score acumulado | Implementado |
| #95 | [Filtro por zona/ciudad](https://github.com/benoffi7/modo-mapa/issues/95) | Rankings locales vs globales por zona geográfica | UI placeholder (próximamente) |
| #96 | [Perfil público de usuario](https://github.com/benoffi7/modo-mapa/issues/96) | Ver estadísticas de otro usuario al tocarlo en el ranking | Implementado |
| #97 | [Compartir logro](https://github.com/benoffi7/modo-mapa/issues/97) | Botón para compartir posición en redes sociales (Web Share API) | Implementado |
| #98 | [Gráfico de evolución](https://github.com/benoffi7/modo-mapa/issues/98) | Mini line chart con evolución del score en el tiempo | Implementado |
| #99 | [Pull-to-refresh](https://github.com/benoffi7/modo-mapa/issues/99) | Botón/gesto para refrescar rankings manualmente | Implementado |

## Archivos creados

- `src/components/menu/RankingsEmptyState.tsx`
- `src/components/menu/UserProfileModal.tsx`
- `src/components/menu/BadgesList.tsx`
- `src/components/menu/ScoreSparkline.tsx`
- `src/constants/badges.ts`

## Archivos modificados

- `src/components/menu/RankingsView.tsx`
- `src/components/menu/RankingItem.tsx`
- `src/components/menu/UserScoreCard.tsx`
- `src/components/menu/HelpSection.tsx`
- `src/components/menu/PrivacyPolicy.tsx`
- `src/constants/rankings.ts`
- `src/constants/index.ts`
- `src/hooks/useRankings.ts`
- `src/services/rankings.ts`
- `src/types/index.ts`
- `functions/src/scheduled/rankings.ts`
- `functions/src/index.ts`
- `scripts/dev-env.sh`
- `scripts/seed-admin-data.mjs`
- `docs/reference/features.md`
- `docs/reference/PROJECT_REFERENCE.md`

## Auditorías ejecutadas

- Dark mode: 2 issues encontrados y corregidos (BAR_COLORS, TIERS con pares light/dark)
- Architecture: sin violaciones críticas, deuda menor corregida (barrel export, memoize)
- Security: sin críticos, 3 fixes aplicados (safeCount, .select(), memory 1GiB)
- Privacy policy: actualizada con rankings, badges, streak, share
- UI review: fixes aplicados (alpha(), aria-labels, gap chips)
