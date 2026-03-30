# Plan: Rediseno navegacion por tabs con 5 pestanas

**Specs:** [158-specs.md](158-specs.md)
**Fecha:** 2026-03-26

---

## Fases de implementacion

### Fase 1: TabShell + TabBar (esqueleto de navegacion)

**Branch:** `feat/158-tab-shell`
**Objetivo:** Reemplazar AppShell por TabShell con 5 tabs. Solo tab Buscar funcional (muestra SearchScreen existente). Las otras 4 tabs muestran placeholders. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/index.ts` | Agregar tipos `TabId`, `SocialSubTab`, `ListsSubTab`, `SearchViewMode` |
| 2 | `src/context/TabContext.tsx` | Crear contexto con `activeTab`, `setActiveTab`, sub-tab states, `searchFilter` para cross-tab navigation |
| 3 | `src/hooks/useTabNavigation.ts` | Crear hook que expone `navigateToSearchWithFilter`, `navigateToSearchWithBusiness`, `navigateToListsSubTab`, `navigateToSocialSubTab` |
| 4 | `src/components/layout/TabBar.tsx` | Crear BottomNavigation con 5 tabs, boton central elevado, badge prop |
| 5 | `src/components/layout/TabShell.tsx` | Crear shell que renderiza TabBar + contenido activo. Monta SearchScreen siempre (display toggle), lazy-load placeholders para las otras 4 tabs |
| 6 | `src/components/layout/MapAppShell.tsx` | Agregar `TabProvider` al provider tree, reemplazar `<AppShell />` por `<TabShell />` |
| 7 | `src/hooks/useNavigateToBusiness.ts` | Agregar `setActiveTab('buscar')` del TabContext al navegar a un comercio |
| 8 | `src/hooks/useDeepLinks.ts` | Agregar soporte para `?tab=xxx` query param, usar TabContext |
| 9 | `src/constants/analyticsEvents.ts` | Agregar `EVT_TAB_SWITCHED`, `EVT_SUB_TAB_SWITCHED` |
| 10 | `src/context/__tests__/TabContext.test.tsx` | Tests de TabContext: estado inicial, setActiveTab, sub-tabs |
| 11 | `src/hooks/__tests__/useTabNavigation.test.ts` | Tests de cross-tab navigation helpers |
| 12 | `src/components/layout/__tests__/TabBar.test.tsx` | Tests: 5 tabs render, active state, badge, central style |
| 13 | `src/components/layout/__tests__/TabShell.test.tsx` | Tests: renders active tab, display none for inactive |

---

### Fase 2: Tab Buscar -- toggle mapa/lista

**Branch:** `feat/158-search-list-view`
**Objetivo:** Agregar toggle mapa/lista en tab Buscar. La vista lista muestra los mismos resultados filtrados. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/search/SearchListView.tsx` | Crear componente: lista vertical de comercios filtrados, row con nombre/categoria/distancia/rating, tap llama onSelectBusiness |
| 2 | `src/components/search/SearchScreen.tsx` | Agregar estado `viewMode`, ToggleButtonGroup (Map/List icons) entre SearchBar y FilterChips, renderizar SearchListView cuando mode='list'. Leer `searchFilter` de TabContext para filtros cross-tab |
| 3 | `src/constants/analyticsEvents.ts` | Agregar `EVT_SEARCH_VIEW_TOGGLED` |
| 4 | `src/components/search/__tests__/SearchListView.test.tsx` | Tests: renderiza lista, tap llama callback, muestra datos correctos |

---

### Fase 3: Tab Listas (migracion de secciones)

**Branch:** `feat/158-lists-tab`
**Objetivo:** Tab Listas funcional con 4 sub-tabs. Migra FavoritesList, SharedListsView, RecentVisits+CheckInsView (unificados), y listas colaborativas. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/RecentsUnifiedTab.tsx` | Crear componente que combina `useVisitHistory()` + `useMyCheckIns()` en lista unificada ordenada por fecha. Pasa `onSelectBusiness` a cada item |
| 2 | `src/components/lists/CollaborativeTab.tsx` | Crear componente que filtra sharedLists donde user es editor no owner. Reutiliza card visual de SharedListsView |
| 3 | `src/components/lists/ListsScreen.tsx` | Crear pantalla con MUI Tabs (Favoritos, Listas, Recientes, Colaborativas). Lazy-load cada sub-tab. Wire `onSelectBusiness` a `useNavigateToBusiness()` |
| 4 | `src/components/layout/TabShell.tsx` | Reemplazar placeholder de tab Listas por `ListsScreen` (lazy) |
| 5 | `src/components/menu/FavoritesList.tsx` | Adaptar para funcionar standalone (sin SideMenu context). Asegurar que `onSelectBusiness` prop funciona correctamente |
| 6 | `src/components/menu/SharedListsView.tsx` | Adaptar para standalone. Agregar prop `filterCollaborative: boolean` para separar listas propias de colaborativas |

---

### Fase 4: Tab Social (migracion de secciones)

**Branch:** `feat/158-social-tab`
**Objetivo:** Tab Social funcional con 4 sub-tabs. Migra ActivityFeedView, FollowedList, ReceivedRecommendations, RankingsView. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/social/SocialScreen.tsx` | Crear pantalla con MUI Tabs (Actividad, Seguidos, Recomendaciones, Rankings). Lazy-load cada sub-tab. Wire `onSelectBusiness` a `useNavigateToBusiness()`. Badge en sub-tab Recomendaciones usando `useUnreadRecommendations()` |
| 2 | `src/components/layout/TabShell.tsx` | Reemplazar placeholder de tab Social por `SocialScreen` (lazy) |
| 3 | `src/components/menu/ActivityFeedView.tsx` | Adaptar para standalone: asegurar que `onItemClick` prop navega a comercio via `useNavigateToBusiness` |
| 4 | `src/components/menu/FollowedList.tsx` | Adaptar para standalone: `UserProfileSheet` abre como bottom sheet inline (ya funciona asi) |
| 5 | `src/components/menu/ReceivedRecommendations.tsx` | Adaptar para standalone: onSelectBusiness prop funcional |
| 6 | `src/components/menu/RankingsView.tsx` | Adaptar para standalone: onSelectBusiness prop funcional |

---

### Fase 5: Tab Perfil -- estructura basica + migracion settings

**Branch:** `feat/158-profile-tab`
**Objetivo:** Tab Perfil funcional con header, onboarding, stats (sin logros), y menu de ajustes con todas las secciones migradas. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/AvatarHeader.tsx` | Crear componente: avatar placeholder (icono generico por ahora) + nombre de `useAuth()` + tap handler (noop hasta Fase 7) |
| 2 | `src/components/profile/StatsCards.tsx` | Crear componente: 4 cards horizontales (Lugares, Resenas, Seguidores, Favoritos). Datos de `useUserProfile` + `useMyCheckIns`. Tap handlers wired a `useTabNavigation()` |
| 3 | `src/components/profile/SettingsMenu.tsx` | Crear componente: 5 items (Notificaciones, Pendientes, Privacidad, Configuracion, Ayuda). Badge en Notificaciones de `useNotifications().unreadCount`. Pendientes condicional via `useConnectivity`. Cada item abre sub-pantalla via estado local |
| 4 | `src/components/profile/ReviewsDetail.tsx` | Crear componente: pantalla con CommentsList + RatingsList combinados, flecha atras |
| 5 | `src/components/profile/ProfileScreen.tsx` | Crear pantalla scrollable: AvatarHeader, OnboardingChecklist (condicional), StatsCards, placeholder para logros, SettingsMenu. Sub-pantallas (ReviewsDetail, NotificationList, settings sub-screens) via estado local con stack |
| 6 | `src/components/layout/TabShell.tsx` | Reemplazar placeholder de tab Perfil por `ProfileScreen` (lazy). Pasar `notificationBadge` al TabBar |
| 7 | `src/components/menu/OnboardingChecklist.tsx` | Adaptar para standalone en ProfileScreen (sin dependencia de SideMenu) |
| 8 | `src/components/menu/SettingsPanel.tsx` | Adaptar para standalone |
| 9 | `src/components/menu/FeedbackForm.tsx` | Adaptar para standalone |
| 10 | `src/components/menu/HelpSection.tsx` | Adaptar para standalone |
| 11 | `src/components/menu/PrivacyPolicy.tsx` | Adaptar para standalone |
| 12 | `src/components/menu/PendingActionsSection.tsx` | Adaptar para standalone |
| 13 | `src/components/notifications/NotificationList.tsx` | Adaptar para uso en ProfileScreen sub-pantalla (sin dependencia de bell icon) |
| 14 | `src/constants/analyticsEvents.ts` | Agregar `EVT_STATS_CARD_TAPPED` |
| 15 | `src/components/profile/__tests__/StatsCards.test.tsx` | Tests: 4 cards render, numeros, tap navega |

---

### Fase 6: Tab Inicio -- HomeScreen

**Branch:** `feat/158-home-tab`
**Objetivo:** Tab Inicio funcional con saludo, acciones rapidas (no editables aun), especiales, busquedas recientes, y para ti. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/storage.ts` | Agregar `STORAGE_KEY_RECENT_SEARCHES` |
| 2 | `src/hooks/useRecentSearches.ts` | Crear hook: lee/escribe localStorage, max 20 entries, dedup |
| 3 | `src/services/specials.ts` | Crear service: `fetchSpecials()` query a coleccion `specials` |
| 4 | `src/hooks/useSpecials.ts` | Crear hook: wraps `useAsyncData(fetchSpecials)` |
| 5 | `src/config/collections.ts` | Agregar `SPECIALS: 'specials'`, `ACHIEVEMENTS: 'achievements'`, `USER_ACHIEVEMENTS: 'userAchievements'` |
| 6 | `src/config/converters.ts` | Agregar `specialConverter`, `achievementConverter`, `userAchievementConverter` |
| 7 | `src/components/home/GreetingHeader.tsx` | Crear componente: saludo por hora + nombre + localidad |
| 8 | `src/components/home/QuickActions.tsx` | Crear componente: grilla 2x4 con defaults (7 categorias + Sorprendeme). Sin edicion aun. Tap navega a Buscar con filtro via `useTabNavigation()` |
| 9 | `src/components/home/SpecialsSection.tsx` | Crear componente: 3 items de `useSpecials()`, icono+titulo+subtitulo+flecha. Tap navega segun type |
| 10 | `src/components/home/RecentSearches.tsx` | Crear componente: 4 chips de `useRecentSearches()` + `useVisitHistory()`. Tap navega a Buscar |
| 11 | `src/components/home/ForYouSection.tsx` | Crear componente: cards horizontales de `useSuggestions()`. Tap usa `useNavigateToBusiness()` |
| 12 | `src/components/home/HomeScreen.tsx` | Crear pantalla scrollable: GreetingHeader, QuickActions, SpecialsSection, RecentSearches, ForYouSection |
| 13 | `src/components/layout/TabShell.tsx` | Reemplazar placeholder de tab Inicio por `HomeScreen` (lazy) |
| 14 | `src/components/search/SearchScreen.tsx` | Agregar logica para guardar busquedas en `useRecentSearches().addSearch()` al buscar |
| 15 | `src/constants/analyticsEvents.ts` | Agregar `EVT_QUICK_ACTION_TAPPED`, `EVT_SPECIAL_TAPPED`, `EVT_RECENT_SEARCH_TAPPED`, `EVT_FOR_YOU_TAPPED` |
| 16 | `src/components/home/__tests__/GreetingHeader.test.tsx` | Tests: saludo por hora, nombre, localidad |
| 17 | `src/components/home/__tests__/QuickActions.test.tsx` | Tests: 8 slots, default config, tap navega |
| 18 | `src/hooks/__tests__/useRecentSearches.test.ts` | Tests: localStorage, dedup, max entries |
| 19 | `src/hooks/__tests__/useSpecials.test.ts` | Tests: fetch, error handling |
| 20 | `src/services/__tests__/specials.test.ts` | Tests: Firestore query |

### Fase 6b: Firestore rules + Specials admin

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar reglas para `achievements`, `userAchievements`, `specials`. Modificar `userSettings` hasOnly para `quickActions` y `avatarId`. Modificar `sharedLists` owner update para `icon`. Modificar `users` update para `avatarId` |
| 2 | `functions/src/admin/specials.ts` | Crear callable `manageSpecials` para CRUD de specials (admin only) |
| 3 | `functions/src/index.ts` | Exportar nuevas functions |
| 4 | `src/components/admin/SpecialsEditor.tsx` | (Opcional) Panel admin basico para gestionar specials -- puede posponerse a otra PR |

---

### Fase 7: Nuevas features -- avatares, iconos de listas, acciones editables

**Branch:** `feat/158-new-features`
**Objetivo:** Agregar biblioteca de avatares, iconos para listas, y edicion de acciones rapidas. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/avatars.ts` | Crear constante `AVATAR_OPTIONS`: array de ~20 avatares con id, label, iconName |
| 2 | `src/constants/listIcons.ts` | Crear constante `LIST_ICON_OPTIONS`: array de ~30 iconos con id, label, iconName |
| 3 | `src/services/avatars.ts` | Crear service: `updateUserAvatar(userId, avatarId)` -- dual write a userSettings + users |
| 4 | `src/services/quickActions.ts` | Crear service: `updateQuickActions(userId, slots)` -- write a userSettings |
| 5 | `src/components/profile/AvatarPicker.tsx` | Crear dialog: grilla de avatares, tap selecciona, persiste via service |
| 6 | `src/components/profile/AvatarHeader.tsx` | Conectar tap a AvatarPicker. Mostrar avatar seleccionado de userSettings. Pasar `onSelect` al picker wired a `updateUserAvatar` |
| 7 | `src/components/lists/IconPicker.tsx` | Crear dialog: grilla de iconos, tap llama onSelect |
| 8 | `src/components/menu/SharedListsView.tsx` | Agregar boton de icono en card de lista + en CreateListDialog. Wire a `updateListIcon` service |
| 9 | `src/components/menu/CreateListDialog.tsx` | Agregar IconPicker opcional al crear lista |
| 10 | `src/services/sharedLists.ts` | Agregar `updateListIcon()`, modificar `createList()` para aceptar icon |
| 11 | `src/components/home/QuickActions.tsx` | Agregar modo edicion: boton "Editar", drag-and-drop nativo, opciones extra (Favoritos, Recientes, Visitas). Persistir via `updateQuickActions()` |
| 12 | `src/constants/analyticsEvents.ts` | Agregar `EVT_AVATAR_CHANGED`, `EVT_QUICK_ACTIONS_EDITED`, `EVT_LIST_ICON_CHANGED` |
| 13 | `src/services/__tests__/avatars.test.ts` | Tests: dual write |
| 14 | `src/services/__tests__/quickActions.test.ts` | Tests: validation, write |

---

### Fase 8: Motor de logros

**Branch:** `feat/158-achievements`
**Objetivo:** Sistema de achievements funcional con evaluacion server-side, progreso visible en Perfil, grilla completa. App funcional tras esta fase.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/achievements.ts` | Crear service: `fetchAchievementDefinitions()`, `fetchUserAchievements(userId)` |
| 2 | `src/hooks/useAchievements.ts` | Crear hook: combina definiciones + progreso, sorted by completion |
| 3 | `functions/src/triggers/achievements.ts` | Crear trigger `evaluateAchievements` en `onDocumentWritten` para checkins, follows, recommendations, ratings, comments. Calcula progreso, upsert en userAchievements |
| 4 | `functions/src/admin/achievements.ts` | Crear callable `manageAchievements` para CRUD de definiciones (admin only) |
| 5 | `functions/src/index.ts` | Exportar nuevos triggers y callables |
| 6 | `src/components/profile/AchievementsSection.tsx` | Crear componente: cards horizontales con LinearProgress, sorted by completion. Tap navega a grid |
| 7 | `src/components/profile/AchievementsGrid.tsx` | Crear componente: grilla completa, tap en logro abre Dialog con descripcion |
| 8 | `src/components/profile/ProfileScreen.tsx` | Reemplazar placeholder de logros por AchievementsSection. Agregar AchievementsGrid como sub-pantalla |
| 9 | `src/constants/analyticsEvents.ts` | Agregar `EVT_ACHIEVEMENT_VIEWED`, `EVT_ACHIEVEMENTS_GRID_OPENED` |
| 10 | `src/hooks/__tests__/useAchievements.test.ts` | Tests: combine definitions + progress |
| 11 | `src/services/__tests__/achievements.test.ts` | Tests: Firestore queries |
| 12 | `src/components/profile/__tests__/AchievementsSection.test.tsx` | Tests: progress bars, sorting, tap |
| 13 | `functions/src/triggers/__tests__/achievements.test.ts` | Tests: trigger logic, progress calc, completion |

---

### Fase 9: Eliminacion de SideMenu + limpieza

**Branch:** `feat/158-remove-sidemenu`
**Objetivo:** Eliminar SideMenu, SideMenuNav, NotificationBell, y todo codigo muerto del drawer. App funcional tras esta fase (verificar que nada se rompe).

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/layout/SideMenu.tsx` | Eliminar archivo |
| 2 | `src/components/layout/SideMenuNav.tsx` | Eliminar archivo |
| 3 | `src/components/notifications/NotificationBell.tsx` | Eliminar archivo |
| 4 | `src/components/auth/NameDialog.tsx` | Eliminar o mover a OnboardingContext (dialog de nombre ya no se muestra standalone) |
| 5 | `src/components/layout/AppShell.tsx` | Eliminar archivo (ya reemplazado por TabShell en Fase 1) |
| 6 | `src/hooks/useSurpriseMe.ts` | Verificar que se usa desde QuickActions, no desde SideMenu. Si queda huerfano, eliminarlo |
| 7 | `src/components/menu/StatsView.tsx` | Eliminar (reemplazado por StatsCards en ProfileScreen) |
| 8 | Imports en todo el proyecto | Buscar y eliminar imports de SideMenu, SideMenuNav, NotificationBell, AppShell, StatsView |
| 9 | Tests existentes | Actualizar tests que referencien SideMenu o AppShell |

---

## Orden de implementacion

1. **Fase 1** (TabShell + TabBar) -- fundacion, todo lo demas depende de esto
2. **Fase 2** (Search list view) -- independiente, mejora tab existente
3. **Fase 3** (Tab Listas) -- depende de Fase 1
4. **Fase 4** (Tab Social) -- depende de Fase 1, parallelizable con Fase 3
5. **Fase 5** (Tab Perfil basico) -- depende de Fase 1
6. **Fase 6 + 6b** (Tab Inicio + rules) -- depende de Fase 1
7. **Fase 7** (Avatares + iconos + acciones editables) -- depende de Fases 5 y 6
8. **Fase 8** (Motor de logros) -- depende de Fase 5 y 6b (rules)
9. **Fase 9** (Limpieza SideMenu) -- depende de Fases 3, 4, 5, 6 (todas las migraciones completas)

```
Fase 1 (shell)
  |
  ├── Fase 2 (search toggle)
  ├── Fase 3 (listas) ──┐
  ├── Fase 4 (social) ──┤
  ├── Fase 5 (perfil) ──┤──── Fase 9 (cleanup)
  └── Fase 6 (inicio) ──┘
       |       |
       |       └── Fase 6b (rules)
       |                |
       └── Fase 7 (features) ── depende de 5 + 6
                        |
                   Fase 8 (logros) ── depende de 5 + 6b
```

Fases 3 y 4 pueden desarrollarse en paralelo si se trabaja en branches separados.

---

## Riesgos

### 1. Performance del mapa siempre montado

**Riesgo:** Mantener Google Maps montado (con `display: none`) puede consumir memoria.
**Mitigacion:** Google Maps API con `@vis.gl/react-google-maps` ya optimiza el canvas cuando no es visible. Medir memoria en DevTools antes y despues. Si es problema, desmontar el mapa (solo el mapa, no SearchScreen) al salir de tab Buscar y re-montar al volver.

### 2. Regresion en componentes migrados

**Riesgo:** Componentes del SideMenu asumen contexto del drawer (width, scroll position, callbacks).
**Mitigacion:** Cada fase adapta los componentes antes de integrarlos. Los tests existentes de hooks (usePaginatedQuery, useListFilters, etc.) cubren la logica. Se agrega smoke test visual manual en cada fase.

### 3. Tamano de bundle con 5 tabs

**Riesgo:** Todas las tabs cargando (aunque lazy) pueden aumentar el bundle total.
**Mitigacion:** `React.lazy()` ya esta en uso para todas las secciones del SideMenu. Las tabs no-activas se cargan bajo demanda. El mapa (el chunk mas pesado) ya se carga al inicio. Monitorear con `vite-plugin-visualizer`.

---

## Criterios de done

- [ ] 5 tabs funcionales con navegacion correcta
- [ ] Todas las 19 secciones del SideMenu accesibles desde su nueva ubicacion
- [ ] SideMenu eliminado completamente (sin codigo muerto)
- [ ] Comportamiento estandar: tap comercio en cualquier tab -> Buscar + mapa centrado + sheet abierto
- [ ] Toggle mapa/lista en tab Buscar funcional
- [ ] Acciones rapidas editables con persistencia
- [ ] Motor de logros con evaluacion server-side
- [ ] Biblioteca de avatares funcional
- [ ] Biblioteca de iconos para listas funcional
- [ ] Busquedas recientes funcional
- [ ] Seccion Especiales con datos de Firestore
- [ ] Tests pasan con >= 80% cobertura en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Firestore rules actualizadas y deployadas
- [ ] Cloud Functions de logros deployadas
- [ ] Analytics events implementados para todas las nuevas interacciones
- [ ] Offline: acciones rapidas, avatar, e icono de lista funcionan offline con withOfflineSupport
