# Specs: Reorganizar components/menu/

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios en el modelo de datos. Este es un refactor puramente organizacional que mueve archivos y actualiza paths de imports.

## Firestore Rules

No hay cambios en Firestore rules.

### Rules impact analysis

N/A -- no se agregan ni modifican queries.

### Field whitelist check

N/A -- no se agregan ni modifican campos.

## Cloud Functions

N/A -- no se modifican Cloud Functions.

## Componentes

Este refactor no crea ni modifica la logica de ningun componente. Solo cambia la ubicacion fisica de 42 archivos. A continuacion se documenta el mapeo exacto de cada archivo.

### Archivos a mover a `components/social/`

| Archivo | Lineas | Importado por | Imports internos (dentro de menu/) |
|---------|--------|---------------|-------------------------------------|
| `ActivityFeedView.tsx` | 64 | SocialScreen (lazy) | PaginatedListShell, ActivityFeedItem, PullToRefreshWrapper |
| `ActivityFeedItem.tsx` | 48 | ActivityFeedView | -- |
| `FollowedList.tsx` | 135 | SocialScreen (lazy) | PaginatedListShell, PullToRefreshWrapper |
| `ReceivedRecommendations.tsx` | 140 | SocialScreen (lazy) | PaginatedListShell, PullToRefreshWrapper |
| `RankingsView.tsx` | 163 | SocialScreen (lazy) | RankingItem, RankingsEmptyState, UserProfileModal, UserScoreCard, PullToRefreshWrapper |
| `RankingItem.tsx` | 95 | RankingsView | -- |
| `RankingsEmptyState.tsx` | 60 | RankingsView | -- |
| `UserProfileModal.tsx` | 112 | RankingsView | BadgesList |
| `UserScoreCard.tsx` | 252 | RankingsView | BadgesList, ScoreSparkline |
| `BadgesList.tsx` | 54 | UserScoreCard, UserProfileModal | -- |
| `ScoreSparkline.tsx` | 49 | UserScoreCard | -- |

**Total: 11 archivos**

### Archivos a mover a `components/profile/`

| Archivo | Lineas | Importado por | Imports internos (dentro de menu/) |
|---------|--------|---------------|-------------------------------------|
| `SettingsPanel.tsx` | 175 | ProfileScreen (lazy) | LocalityPicker, AccountSection |
| `AccountSection.tsx` | 162 | SettingsPanel | -- |
| `LocalityPicker.tsx` | 144 | SettingsPanel | -- |
| `OnboardingChecklist.tsx` | 184 | ProfileScreen (lazy) | -- |
| `PendingActionsSection.tsx` | 155 | ProfileScreen (lazy) | -- |
| `EditDisplayNameDialog.tsx` | 64 | ProfileScreen (lazy) | -- |
| `HelpSection.tsx` | 234 | ProfileScreen (lazy) | -- |
| `FeedbackForm.tsx` | 268 | ProfileScreen (lazy) | MyFeedbackList (lazy) |
| `MyFeedbackList.tsx` | 151 | FeedbackForm (lazy) | -- |
| `PrivacyPolicy.tsx` | 277 | ProfileScreen (lazy) | -- |
| `CommentsList.tsx` | 475 | ProfileScreen (lazy) | PaginatedListShell, CommentsStats, CommentsToolbar, useCommentsListFilters, useVirtualizedList, PullToRefreshWrapper |
| `CommentsStats.tsx` | 64 | CommentsList | -- |
| `CommentsToolbar.tsx` | 88 | CommentsList | -- |
| `CommentItem.tsx` | 226 | Ninguno (orphaned, pero semanticamente pertenece a profile) | -- |
| `useCommentsListFilters.ts` | 123 | CommentsList | -- |
| `useVirtualizedList.ts` | 49 | CommentsList | -- |
| `RatingsList.tsx` | 159 | ProfileScreen (lazy) | ListFilters, PullToRefreshWrapper |
| `StatsView.tsx` | 77 | ProfileScreen (lazy) | -- |
| `CheckInsView.tsx` | 76 | No importado externamente (orphaned, semanticamente profile) | PullToRefreshWrapper |

**Total: 19 archivos**

Nota: el PRD lista 21 archivos para profile, pero `CommentItem.tsx` es un archivo no importado por nadie (hay un `CommentItem` inline dentro de `CommentsList.tsx`). Se incluye igual para vaciarlo de menu/. `CheckInsView.tsx` tampoco tiene consumidor externo actual.

### Archivos a mover a `components/lists/`

| Archivo | Lineas | Importado por | Imports internos (dentro de menu/) |
|---------|--------|---------------|-------------------------------------|
| `FavoritesList.tsx` | 263 | ListsScreen (lazy) | ListFilters, PullToRefreshWrapper |
| `SharedListsView.tsx` | 188 | ListsScreen (lazy) | CreateListDialog, PullToRefreshWrapper, ListCardGrid (lists/), ListDetailScreen (lists/) |
| `SharedListDetailView.tsx` | 166 | SharedListsView | -- |
| `CreateListDialog.tsx` | 62 | ListsScreen (directo), SharedListsView | -- |
| `EditorsDialog.tsx` | 117 | SharedListDetailView o ListDetailScreen | -- |
| `InviteEditorDialog.tsx` | 61 | EditorsDialog | -- |

**Total: 6 archivos**

### Archivos a mover a `components/home/`

| Archivo | Lineas | Importado por | Imports internos (dentro de menu/) |
|---------|--------|---------------|-------------------------------------|
| `SuggestionsView.tsx` | 190 | Ninguno (orphaned de side-menu) | ListFilters, TrendingList |
| `TrendingList.tsx` | 61 | SuggestionsView | TrendingBusinessCard |
| `TrendingBusinessCard.tsx` | 75 | TrendingList | -- |
| `RecentVisits.tsx` | 67 | Ninguno (orphaned de side-menu) | -- |

**Total: 4 archivos**

Nota: estos 4 archivos no tienen consumidor externo. Eran parte del side-menu y quedaron huerfanos tras la migracion a tabs. Se mueven a `home/` por afinidad de dominio segun el PRD.

### Archivos a mover a `components/common/`

| Archivo | Lineas | Importado por | Imports internos |
|---------|--------|---------------|-----------------|
| `PaginatedListShell.tsx` | 119 | CommentsList, FollowedList, ReceivedRecommendations, ActivityFeedView | -- |
| `ListFilters.tsx` | 122 | SuggestionsView, FavoritesList, RatingsList | -- |

**Total: 2 archivos**

### Mutable prop audit

N/A -- no se crean ni modifican componentes editables.

## Textos de usuario

N/A -- no hay textos nuevos ni modificados.

## Hooks

No se crean ni modifican hooks. Los dos hooks que se mueven (`useCommentsListFilters.ts`, `useVirtualizedList.ts`) mantienen su logica intacta; solo cambian de directorio.

## Servicios

N/A -- no se modifican servicios.

## Integracion

### Archivos consumidores que requieren actualizacion de imports

| Archivo | Imports a actualizar | Tipo de import |
|---------|---------------------|----------------|
| `src/components/profile/ProfileScreen.tsx` | 10 lazy imports de `../menu/` a `./` | lazy |
| `src/components/social/SocialScreen.tsx` | 4 lazy imports de `../menu/` a `./` | lazy |
| `src/components/lists/ListsScreen.tsx` | 1 directo + 2 lazy de `../menu/` a `./` | directo + lazy |

### Imports internos entre archivos movidos

Archivos que se mueven al **mismo directorio** mantienen sus imports `./` sin cambios:

- CommentsList -> CommentsStats, CommentsToolbar, useCommentsListFilters, useVirtualizedList (todos a `profile/`)
- TrendingList -> TrendingBusinessCard (ambos a `home/`)
- RankingsView -> RankingItem, RankingsEmptyState, UserProfileModal, UserScoreCard (todos a `social/`)
- UserScoreCard -> BadgesList, ScoreSparkline (todos a `social/`)
- UserProfileModal -> BadgesList (ambos a `social/`)
- SettingsPanel -> LocalityPicker, AccountSection (todos a `profile/`)
- FeedbackForm -> MyFeedbackList (ambos a `profile/`)
- SharedListsView -> CreateListDialog (ambos a `lists/`)

Archivos que referencian componentes que se mueven a un **directorio diferente** necesitan actualizacion:

| Archivo (destino) | Import actual | Import nuevo |
|-------------------|--------------|-------------|
| `CommentsList.tsx` (profile/) | `./PaginatedListShell` | `../common/PaginatedListShell` |
| `FollowedList.tsx` (social/) | `./PaginatedListShell` | `../common/PaginatedListShell` |
| `ReceivedRecommendations.tsx` (social/) | `./PaginatedListShell` | `../common/PaginatedListShell` |
| `ActivityFeedView.tsx` (social/) | `./PaginatedListShell` | `../common/PaginatedListShell` |
| `SuggestionsView.tsx` (home/) | `./ListFilters` | `../common/ListFilters` |
| `FavoritesList.tsx` (lists/) | `./ListFilters` | `../common/ListFilters` |
| `RatingsList.tsx` (profile/) | `./ListFilters` | `../common/ListFilters` |
| `SuggestionsView.tsx` (home/) | `./TrendingList` | `./TrendingList` | (mismo dir, sin cambio) |

### Preventive checklist

- [x] **Service layer**: Ningun componente movido importa `firebase/firestore` para writes -- todos usan `src/services/`
- [x] **Duplicated constants**: No se duplican constantes
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No se modifica logica
- [x] **Stale props**: No se modifica logica de componentes

## Tests

Este refactor no agrega logica nueva. La validacion es que la suite existente siga pasando sin cambios.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| Suite existente (1131 tests) | Todos pasan sin modificaciones | Regresion |

Nota: los archivos de `menu/` no tienen tests unitarios propios. Los hooks `useCommentsListFilters` y `useVirtualizedList` tampoco tienen tests en el inventario actual.

## Analytics

N/A -- no se agregan ni modifican eventos de analytics.

---

## Offline

No hay impacto en comportamiento offline.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | Sin cambios | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | Sin cambios | N/A |

### Fallback UI

Sin cambios.

---

## Decisiones tecnicas

1. **CommentItem.tsx orphaned**: Existe un `CommentItem.tsx` standalone en `menu/` que no es importado por ningun archivo (hay un `CommentItem` inline definido dentro de `CommentsList.tsx`). Se mueve a `profile/` junto con los demas archivos de comentarios para vaciar `menu/` completamente. No se intenta resolver la duplicacion en este refactor (out of scope).

2. **Archivos orphaned (SuggestionsView, TrendingList, TrendingBusinessCard, RecentVisits, CheckInsView)**: Estos 5 archivos no tienen consumidor externo -- eran parte del side-menu eliminado en v3.0.0. Se mueven a sus directorios de dominio igualmente para vaciar `menu/`. Si en el futuro se integran en sus respectivas tabs, ya estaran en la ubicacion correcta.

3. **PaginatedListShell y ListFilters a common/**: Estos dos componentes son usados por archivos de 3+ dominios distintos. Moverlos a `common/` en vez de a un dominio especifico evita crear dependencias cross-domain innecesarias.

4. **No renaming**: Los archivos mantienen sus nombres exactos. Los imports relativos `./` entre archivos del mismo directorio no necesitan cambios cuando ambos se mueven juntos.
