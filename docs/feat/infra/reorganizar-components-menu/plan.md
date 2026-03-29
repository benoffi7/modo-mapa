# Plan: Reorganizar components/menu/

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Mover archivos cross-domain a common/

**Branch:** `refactor/reorganizar-menu`

Mover primero los archivos reutilizables para que los imports cross-domain queden resueltos antes de mover los consumidores.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/menu/PaginatedListShell.tsx` | `git mv` a `src/components/common/PaginatedListShell.tsx` |
| 2 | `src/components/menu/ListFilters.tsx` | `git mv` a `src/components/common/ListFilters.tsx` |

### Fase 2: Mover archivos a social/

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/components/menu/ActivityFeedView.tsx` | `git mv` a `src/components/social/ActivityFeedView.tsx` |
| 4 | `src/components/menu/ActivityFeedItem.tsx` | `git mv` a `src/components/social/ActivityFeedItem.tsx` |
| 5 | `src/components/menu/FollowedList.tsx` | `git mv` a `src/components/social/FollowedList.tsx` |
| 6 | `src/components/menu/ReceivedRecommendations.tsx` | `git mv` a `src/components/social/ReceivedRecommendations.tsx` |
| 7 | `src/components/menu/RankingsView.tsx` | `git mv` a `src/components/social/RankingsView.tsx` |
| 8 | `src/components/menu/RankingItem.tsx` | `git mv` a `src/components/social/RankingItem.tsx` |
| 9 | `src/components/menu/RankingsEmptyState.tsx` | `git mv` a `src/components/social/RankingsEmptyState.tsx` |
| 10 | `src/components/menu/UserProfileModal.tsx` | `git mv` a `src/components/social/UserProfileModal.tsx` |
| 11 | `src/components/menu/UserScoreCard.tsx` | `git mv` a `src/components/social/UserScoreCard.tsx` |
| 12 | `src/components/menu/BadgesList.tsx` | `git mv` a `src/components/social/BadgesList.tsx` |
| 13 | `src/components/menu/ScoreSparkline.tsx` | `git mv` a `src/components/social/ScoreSparkline.tsx` |
| 14 | `src/components/social/ActivityFeedView.tsx` | Actualizar import: `'./PaginatedListShell'` -> `'../common/PaginatedListShell'` |
| 15 | `src/components/social/FollowedList.tsx` | Actualizar import: `'./PaginatedListShell'` -> `'../common/PaginatedListShell'` |
| 16 | `src/components/social/ReceivedRecommendations.tsx` | Actualizar import: `'./PaginatedListShell'` -> `'../common/PaginatedListShell'` |
| 17 | `src/components/social/SocialScreen.tsx` | Actualizar 4 lazy imports de `'../menu/'` a `'./'` |

### Fase 3: Mover archivos a profile/

| Paso | Archivo | Cambio |
|------|---------|--------|
| 18 | `src/components/menu/SettingsPanel.tsx` | `git mv` a `src/components/profile/SettingsPanel.tsx` |
| 19 | `src/components/menu/AccountSection.tsx` | `git mv` a `src/components/profile/AccountSection.tsx` |
| 20 | `src/components/menu/LocalityPicker.tsx` | `git mv` a `src/components/profile/LocalityPicker.tsx` |
| 21 | `src/components/menu/OnboardingChecklist.tsx` | `git mv` a `src/components/profile/OnboardingChecklist.tsx` |
| 22 | `src/components/menu/PendingActionsSection.tsx` | `git mv` a `src/components/profile/PendingActionsSection.tsx` |
| 23 | `src/components/menu/EditDisplayNameDialog.tsx` | `git mv` a `src/components/profile/EditDisplayNameDialog.tsx` |
| 24 | `src/components/menu/HelpSection.tsx` | `git mv` a `src/components/profile/HelpSection.tsx` |
| 25 | `src/components/menu/FeedbackForm.tsx` | `git mv` a `src/components/profile/FeedbackForm.tsx` |
| 26 | `src/components/menu/MyFeedbackList.tsx` | `git mv` a `src/components/profile/MyFeedbackList.tsx` |
| 27 | `src/components/menu/PrivacyPolicy.tsx` | `git mv` a `src/components/profile/PrivacyPolicy.tsx` |
| 28 | `src/components/menu/CommentsList.tsx` | `git mv` a `src/components/profile/CommentsList.tsx` |
| 29 | `src/components/menu/CommentsStats.tsx` | `git mv` a `src/components/profile/CommentsStats.tsx` |
| 30 | `src/components/menu/CommentsToolbar.tsx` | `git mv` a `src/components/profile/CommentsToolbar.tsx` |
| 31 | `src/components/menu/CommentItem.tsx` | `git mv` a `src/components/profile/CommentItem.tsx` |
| 32 | `src/components/menu/useCommentsListFilters.ts` | `git mv` a `src/components/profile/useCommentsListFilters.ts` |
| 33 | `src/components/menu/useVirtualizedList.ts` | `git mv` a `src/components/profile/useVirtualizedList.ts` |
| 34 | `src/components/menu/RatingsList.tsx` | `git mv` a `src/components/profile/RatingsList.tsx` |
| 35 | `src/components/menu/StatsView.tsx` | `git mv` a `src/components/profile/StatsView.tsx` |
| 36 | `src/components/menu/CheckInsView.tsx` | `git mv` a `src/components/profile/CheckInsView.tsx` |
| 37 | `src/components/profile/CommentsList.tsx` | Actualizar import: `'./PaginatedListShell'` -> `'../common/PaginatedListShell'` |
| 38 | `src/components/profile/RatingsList.tsx` | Actualizar import: `'./ListFilters'` -> `'../common/ListFilters'` |
| 39 | `src/components/profile/ProfileScreen.tsx` | Actualizar 10 lazy imports de `'../menu/'` a `'./'` |

### Fase 4: Mover archivos a lists/

| Paso | Archivo | Cambio |
|------|---------|--------|
| 40 | `src/components/menu/FavoritesList.tsx` | `git mv` a `src/components/lists/FavoritesList.tsx` |
| 41 | `src/components/menu/SharedListsView.tsx` | `git mv` a `src/components/lists/SharedListsView.tsx` |
| 42 | `src/components/menu/SharedListDetailView.tsx` | `git mv` a `src/components/lists/SharedListDetailView.tsx` |
| 43 | `src/components/menu/CreateListDialog.tsx` | `git mv` a `src/components/lists/CreateListDialog.tsx` |
| 44 | `src/components/menu/EditorsDialog.tsx` | `git mv` a `src/components/lists/EditorsDialog.tsx` |
| 45 | `src/components/menu/InviteEditorDialog.tsx` | `git mv` a `src/components/lists/InviteEditorDialog.tsx` |
| 46 | `src/components/lists/FavoritesList.tsx` | Actualizar import: `'./ListFilters'` -> `'../common/ListFilters'` |
| 47 | `src/components/lists/ListsScreen.tsx` | Actualizar 1 directo + 2 lazy imports de `'../menu/'` a `'./'` |

### Fase 5: Mover archivos a home/

| Paso | Archivo | Cambio |
|------|---------|--------|
| 48 | `src/components/menu/SuggestionsView.tsx` | `git mv` a `src/components/home/SuggestionsView.tsx` |
| 49 | `src/components/menu/TrendingList.tsx` | `git mv` a `src/components/home/TrendingList.tsx` |
| 50 | `src/components/menu/TrendingBusinessCard.tsx` | `git mv` a `src/components/home/TrendingBusinessCard.tsx` |
| 51 | `src/components/menu/RecentVisits.tsx` | `git mv` a `src/components/home/RecentVisits.tsx` |
| 52 | `src/components/home/SuggestionsView.tsx` | Actualizar import: `'./ListFilters'` -> `'../common/ListFilters'` |

### Fase 6: Eliminar menu/ y verificar

| Paso | Archivo | Cambio |
|------|---------|--------|
| 53 | `src/components/menu/` | Verificar que el directorio esta vacio; `rmdir` |
| 54 | -- | Ejecutar `npm run build` y verificar 0 errores TypeScript |
| 55 | -- | Ejecutar `npm run lint` y verificar 0 errores nuevos |
| 56 | -- | Ejecutar `npm run test:run` y verificar 1131 tests pasan |

### Fase 7: Actualizar documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 57 | `docs/reference/files.md` | Eliminar seccion `menu/`, agregar archivos a sus nuevos directorios |
| 58 | `docs/reference/architecture.md` | Sin cambios necesarios (ya refleja la estructura de tabs; no lista archivos de `menu/` individualmente) |

---

## Orden de implementacion

1. **Fase 1** (common/) -- primero, porque PaginatedListShell y ListFilters son dependencias de archivos en multiples dominios
2. **Fases 2-5** (social/, profile/, lists/, home/) -- en cualquier orden, pero cada fase debe completarse entera antes de la siguiente para evitar imports rotos parciales
3. **Fase 6** (verificacion) -- despues de mover todos los archivos
4. **Fase 7** (docs) -- al final

Nota: todas las fases pueden ejecutarse en un solo commit. La separacion en fases es logica, no implica commits separados.

---

## Estimacion de archivos resultantes

Ningun archivo cambia de tamano. Solo se reubican. Verificacion de archivos >200 lineas en sus nuevos directorios:

| Archivo (destino) | Lineas | Estado |
|-------------------|--------|--------|
| `profile/CommentsList.tsx` | 475 | WARNING -- ya existia asi, out of scope para este refactor |
| `profile/PrivacyPolicy.tsx` | 277 | Aceptable |
| `profile/FeedbackForm.tsx` | 268 | Aceptable |
| `lists/FavoritesList.tsx` | 263 | Aceptable |
| `social/UserScoreCard.tsx` | 252 | Aceptable |
| `profile/HelpSection.tsx` | 234 | Aceptable |
| `profile/CommentItem.tsx` | 226 | Aceptable |

`CommentsList.tsx` supera las 400 lineas pero su descomposicion esta fuera del scope de este refactor (PRD explicito: "No refactorizar la logica interna de ningun componente movido").

---

## Riesgos

1. **Imports rotos no detectados por TypeScript**: Si algun archivo importa desde `menu/` con un path que TypeScript resuelve pero Vite no, el build podria pasar pero fallar en runtime. **Mitigacion**: verificar con `npm run build` (Vite bundling) y testear lazy loading de cada tab en dev.

2. **Git history fragmentation**: `git mv` preserva el historial si Git detecta el rename (>50% similarity). Con archivos que solo cambian 1-2 imports internos, el threshold se mantiene. **Mitigacion**: usar `git mv` en vez de delete+create.

3. **Merge conflicts con branch actual (new-home)**: Si hay cambios pendientes en archivos de `menu/` en la branch actual, el refactor generara conflictos. **Mitigacion**: ejecutar este refactor desde `main` en una branch dedicada, y resolver conflictos al integrar.

---

## Criterios de done

- [ ] El directorio `src/components/menu/` no existe
- [ ] Los 42 archivos estan distribuidos en `social/` (11), `profile/` (19), `lists/` (6), `home/` (4), `common/` (2)
- [ ] `npm run build` compila sin errores TypeScript
- [ ] Los 1131 tests pasan sin modificaciones (`npm run test:run`)
- [ ] `npm run lint` pasa sin errores nuevos
- [ ] Las 4 tabs de la app cargan correctamente en `dev:full`
- [ ] `docs/reference/files.md` actualizado
- [ ] No se modifico la logica interna de ningun componente (solo imports)
