# Changelog: Comments Improvements

## Archivos creados

| Archivo | Descripcion |
|---------|-------------|
| `src/utils/text.ts` | Funcion `truncate` compartida |
| `src/hooks/useUndoDelete.ts` | Hook para undo-delete con timer cleanup |
| `src/hooks/useSwipeActions.ts` | Hook para swipe-to-reveal en mobile |
| `src/components/menu/PaginatedListShell.tsx` | Shell reutilizable para listas paginadas |
| `src/components/business/CommentRow.tsx` | Componente memoizado extraido de BusinessComments |

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/components/menu/CommentsList.tsx` | Reescrito completo: skeleton, empty state, preview, sorting, search, edit inline, filter, stats, swipe, PaginatedListShell |
| `src/components/business/BusinessComments.tsx` | useUndoDelete, CommentRow extraction, dark mode fixes, useCallback en handlers |
| `src/components/menu/RatingsList.tsx` | Dark mode fix (`#ccc` → `action.disabled`) |
| `src/components/menu/FavoritesList.tsx` | Dark mode fixes (`#ccc`, `#ea4335`) |
| `src/components/user/UserProfileSheet.tsx` | truncate import, dark mode fixes (`#dadce0`, `#1a73e8`) |
| `src/components/business/BusinessSheet.tsx` | Dark mode fix (`#dadce0` → `divider`) |
| `src/components/map/LocationFAB.tsx` | Dark mode fixes (`#fff`, `#666`, `#f5f5f5`) |
| `src/components/map/MapView.tsx` | Dark mode fix (rgba → theme-aware) |
| `src/components/notifications/NotificationItem.tsx` | Dark mode fix (`#34a853` → `success.main`) |
| `src/components/search/FilterChips.tsx` | Dark mode fixes (shadows → theme.shadows) |
| `src/components/menu/FeedbackForm.tsx` | Dark mode fix (`#34a853` → `success.main`) |
| `src/components/layout/SideMenu.tsx` | Dark mode fixes (8 iconos + avatar) |
| `src/components/admin/charts/LineChartCard.tsx` | Dark mode fix (`#ccc`) |
| `src/constants/ui.ts` | LIKE_COLOR, RANKINGS_COLOR, STATS_COLOR |
| `src/hooks/usePaginatedQuery.ts` | QueryConstraint[] generico, cacheKey, loadAll, error string |
| `src/hooks/usePaginatedQuery.test.ts` | Actualizado para error: string |
| `src/components/menu/HelpSection.tsx` | Nuevas funcionalidades de comentarios |
| `docs/reference/features.md` | Actualizado menu lateral comentarios |
| `docs/reference/files.md` | 5 archivos nuevos agregados |
| `docs/reference/patterns.md` | 5 patrones nuevos documentados |
| `docs/reference/issues.md` | 11 issues (#101-#111) agregados |
| `docs/reference/PROJECT_REFERENCE.md` | Menu lateral y patrones actualizados |

## Issues resueltos

#101, #102, #103, #104, #105, #106, #107, #108, #109, #110, #111

## Deuda tecnica resuelta

- DT-1: `useUndoDelete` hook (elimina duplicacion + memory leak)
- DT-2: `truncate` extraido a utils
- DT-3: 27 colores hardcodeados → theme tokens (dark mode)
- DT-4: `CommentRow` extraido de BusinessComments
- DT-5: `usePaginatedQuery` con constraints genericos
- DT-6: `PaginatedListShell` wrapper reutilizable
