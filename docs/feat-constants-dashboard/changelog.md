# Changelog — Constants Dashboard

## Archivos creados

| Archivo | Descripcion |
| ------- | ----------- |
| `src/constants/validation.ts` | Limites de longitud, truncamiento, score options |
| `src/constants/cache.ts` | TTLs de cache (business, query, profile) |
| `src/constants/storage.ts` | Keys de localStorage |
| `src/constants/timing.ts` | Intervalos (poll, auto-dismiss, six months) |
| `src/constants/feedback.ts` | Categorias validas de feedback |
| `src/constants/ui.ts` | Colores de graficos, URL agregar comercio |
| `src/constants/map.ts` | Centro Buenos Aires, colores por categoria |
| `src/constants/tags.ts` | Tags predefinidos, IDs validos |
| `src/constants/rankings.ts` | Scoring, medallas, action labels, period options |
| `src/constants/business.ts` | Niveles de precio, simbolos, chips, labels |
| `src/constants/admin.ts` | Email admin, page size, status/abuse labels |
| `src/constants/index.ts` | Barrel re-export de todos los modulos |
| `src/pages/constantsRegistry.ts` | Auto-discovery de constantes via Object.entries |
| `src/pages/ConstantsDashboard.tsx` | Dashboard UI con busqueda, filtro, copy import |

## Archivos modificados

| Archivo | Cambio |
| ------- | ------ |
| `src/types/index.ts` | Movido PREDEFINED_TAGS, PRICE_LEVEL_LABELS, CATEGORY_LABELS a constants; re-exportados |
| `src/services/comments.ts` | Import MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH de constants |
| `src/services/tags.ts` | Import VALID_TAG_IDS, MAX_CUSTOM_TAG_LENGTH de constants; eliminado local |
| `src/services/feedback.ts` | Import VALID_CATEGORIES, MAX_FEEDBACK_LENGTH de constants; eliminado local |
| `src/services/rankings.ts` | Import SCORING de constants; eliminado local |
| `src/context/AuthContext.tsx` | Import MAX_DISPLAY_NAME_LENGTH; reemplazado magic 30 |
| `src/context/ColorModeContext.tsx` | Import STORAGE_KEY_COLOR_MODE; eliminado local STORAGE_KEY |
| `src/utils/analytics.ts` | Import STORAGE_KEY_ANALYTICS_CONSENT; eliminado local LS_KEY |
| `src/hooks/useBusinessDataCache.ts` | Import BUSINESS_CACHE_TTL_MS; eliminado local CACHE_TTL |
| `src/hooks/usePaginatedQuery.ts` | Import QUERY_CACHE_TTL_MS; eliminado local CACHE_TTL |
| `src/hooks/useProfileVisibility.ts` | Import PROFILE_CACHE_TTL_MS; eliminado local CACHE_TTL_MS |
| `src/hooks/useNotifications.ts` | Import POLL_INTERVAL_MS de constants/timing |
| `src/hooks/useVisitHistory.ts` | Import STORAGE_KEY_VISITS, MAX_VISIT_HISTORY; eliminados locales |
| `src/components/map/MapView.tsx` | Import BUENOS_AIRES_CENTER de constants/map |
| `src/components/map/BusinessMarker.tsx` | Import CATEGORY_COLORS de constants/map |
| `src/components/business/BusinessPriceLevel.tsx` | Import LEVELS, LEVEL_SYMBOLS de constants/business |
| `src/components/business/BusinessTags.tsx` | Import MAX_CUSTOM_TAGS_PER_BUSINESS; reemplazado magic 10 |
| `src/components/business/BusinessComments.tsx` | Import MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY |
| `src/components/business/MenuPhotoSection.tsx` | Import SIX_MONTHS_MS de constants/timing |
| `src/components/search/FilterChips.tsx` | Import PRICE_CHIPS de constants/business |
| `src/components/menu/ListFilters.tsx` | Import SCORE_OPTIONS de constants/validation |
| `src/components/menu/RankingItem.tsx` | Import MEDALS de constants/rankings |
| `src/components/menu/UserScoreCard.tsx` | Import ACTION_LABELS de constants/rankings |
| `src/components/menu/RankingsView.tsx` | Import PERIOD_OPTIONS de constants/rankings |
| `src/components/stats/PieChartCard.tsx` | Renombrado COLORS a CHART_COLORS de constants/ui |
| `src/components/admin/AdminGuard.tsx` | Import ADMIN_EMAIL de constants/admin |
| `src/components/admin/FirebaseUsage.tsx` | Import FREE_TIER_READS/WRITES de constants/admin |
| `src/components/admin/ActivityFeed.tsx` | Import ADMIN_PAGE_SIZE de constants/admin |
| `src/components/admin/BackupsPanel.tsx` | Import ADMIN_PAGE_SIZE, AUTO_DISMISS_MS de constants |
| `src/components/admin/AbuseAlerts.tsx` | Import ABUSE_TYPE_COLORS/LABELS, TRUNCATE_DETAIL_PREVIEW |
| `src/components/admin/PhotoReviewCard.tsx` | Import STATUS_CHIP de constants/admin |
| `src/components/admin/PhotoReviewPanel.tsx` | Import STATUS_LABELS de constants/admin |
| `src/components/layout/SideMenu.tsx` | Import ADD_BUSINESS_URL, MAX_DISPLAY_NAME_LENGTH; link Constants en DEV |
| `src/App.tsx` | Lazy import ConstantsDashboard; ruta /dev/constants en DEV |

## Documentacion actualizada

| Archivo | Cambio |
| ------- | ------ |
| `docs/reference/files.md` | Agregado `src/constants/`, `ConstantsDashboard.tsx`, `constantsRegistry.ts` |
| `docs/reference/architecture.md` | Agregada capa constants, ruta /dev/constants, link en footer |
| `docs/reference/features.md` | Agregada seccion Constants Dashboard |
| `docs/reference/patterns.md` | Agregada seccion Constantes centralizadas |
| `docs/reference/data-layer.md` | Agregada seccion Constantes centralizadas |
| `docs/PROJECT_REFERENCE.md` | Agregados patrones constants + dashboard en resumen |
