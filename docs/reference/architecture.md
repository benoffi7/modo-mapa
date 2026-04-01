# Arquitectura v2 — Navegacion por Tabs

## Arbol de providers

```text
main.tsx
  └─ BrowserRouter
       └─ App.tsx
            ├─ ColorModeProvider
            ├─ AuthProvider
            ├─ ToastProvider
            ├─ ConnectivityProvider
            ├─ NotificationsProvider
            └─ Routes
                 ├─ [/dev/theme] ThemePlayground (lazy, DEV only)
                 ├─ [/dev/constants] ConstantsDashboard (lazy, DEV only)
                 ├─ [/admin/*] AdminDashboard (lazy)
                 └─ [/*] MapAppShell
                      ├─ SelectionProvider (global)
                      ├─ TabProvider (global)
                      └─ OnboardingProvider (global)
                           └─ TabShell
```

## Tab Shell

TabShell es el componente raiz de la app. Renderiza las 5 tabs y el TabBar.

```text
TabShell
  ├─ OfflineIndicator
  ├─ TabContent (x5, display toggle por tab activa)
  │    ├─ HomeScreen (tab Inicio)
  │    ├─ SocialScreen (tab Social)
  │    ├─ SearchScreen (tab Buscar)
  │    ├─ ListsScreen (tab Listas)
  │    └─ ProfileScreen (tab Perfil)
  ├─ NameDialog
  └─ TabBar (BottomNavigation, 5 tabs, boton central elevado)
```

## Tab: Inicio (HomeScreen)

HomeScreen usa un array declarativo `HOME_SECTIONS` (definido en `homeSections.ts`) para renderizar secciones con `lazy()` + `Suspense`. Agregar una seccion nueva requiere solo una entrada en el array, sin modificar JSX.

```text
HomeScreen (scrollable, iterador sobre HOME_SECTIONS)
  ├─ GreetingHeader (saludo por hora + nombre + localidad)
  ├─ RatingPromptBanner (condicional, fuera del array)
  ├─ QuickActions (grilla 2x4, editable, localStorage)
  ├─ SpecialsSection (3 items curados, placeholder → Firestore)
  ├─ TrendingNearYouSection (trending por proximidad)
  ├─ YourInterestsSection (tags seguidos)
  ├─ RecentSearches (4 chips de visitas recientes)
  ├─ ForYouSection (cards horizontales de useSuggestions)
  └─ ActivityDigestSection (digest de actividad)
```

## Tab: Social (SocialScreen)

```text
SocialScreen
  ├─ Tabs: Actividad | Seguidos | Recomendaciones | Rankings
  ├─ ActivityFeedView (infinite scroll, seguidos)
  ├─ FollowedList (lista + buscador + UserProfileSheet)
  ├─ ReceivedRecommendations (con badge no leidas)
  ├─ RankingsView (semanal/mensual/anual/all-time)
  └─ UserProfileSheet (bottom sheet shell → UserProfileContent)
```

## Tab: Buscar (SearchScreen)

```text
SearchScreen
  ├─ FiltersProvider (solo esta tab)
  ├─ APIProvider (Google Maps, solo esta tab)
  ├─ SearchBar (busqueda pura, sin hamburguesa)
  ├─ FilterChips (tags + precio)
  ├─ ViewToggle (mapa/lista)
  ├─ MapView + FABs + MapHint (vista mapa)
  ├─ SearchListView (vista lista, sorted by distance)
  └─ BusinessSheet (bottom sheet shell → BusinessSheetContent)
```

## Tab: Listas (ListsScreen)

```text
ListsScreen
  ├─ Chip tabs: Favoritos | Listas | Recientes | Social
  ├─ FavoritesList (cards con rating, distancia, corazon)
  ├─ SharedListsView
  │    ├─ Featured lists (scroll horizontal)
  │    ├─ ListCardGrid (grilla 2 columnas con iconos de color)
  │    └─ ListDetailScreen (detalle con acciones CRUD)
  ├─ RecentsUnifiedTab (visitas + check-ins unificados)
  └─ CollaborativeTab (misma grilla, readOnly detail)
```

### Design System

Ver [design-system.md](design-system.md) para tokens completos.

```text
src/theme/cards.ts — cardSx, iconCircleSx, dashedButtonSx
src/constants/ui.ts — NAV_CHIP_SX (chips de sub-tabs)
src/constants/avatars.ts — 20 avatares
src/constants/listIcons.ts — 30 iconos + validacion
src/components/lists/ColorPicker.tsx — 8 colores + sanitizeListColor
```

## Tab: Perfil (ProfileScreen)

```text
ProfileScreen (scrollable, sub-pantallas con back)
  ├─ Avatar (tap → AvatarPicker, 20 emojis)
  ├─ Nombre
  ├─ OnboardingChecklist (condicional)
  ├─ StatsCards (Lugares, Resenas, Seguidores, Favoritos)
  ├─ AchievementsSection (cards con barra progreso → AchievementsGrid)
  └─ SettingsMenu
       ├─ Notificaciones (badge + NotificationsSection)
       ├─ Pendientes (condicional si offline)
       ├─ Privacidad y ajuste (SettingsPanel + PrivacyPolicy)
       ├─ Configuracion (SettingsPanel)
       └─ Ayuda y soporte (HelpSection + FeedbackForm)
```

## Contextos

| Contexto | Scope | Contenido |
|----------|-------|-----------|
| SelectionProvider | Global | selectedBusiness, activeSharedListId |
| TabProvider | Global | activeTab, socialSubTab, listsSubTab, searchFilter |
| OnboardingProvider | Global | handleCreateAccount, handleLogin, BenefitsDialog, AccountBanner |
| FiltersProvider | Solo SearchScreen | searchQuery, activeFilters, activePriceFilter, userLocation |
| AuthProvider | Global (App.tsx) | user, displayName, authMethod |
| NotificationsProvider | Global (App.tsx) | notifications, markRead, markAllRead |
| ConnectivityProvider | Global (App.tsx) | isOffline, pendingActions |
| ToastProvider | Global (App.tsx) | toast messages |
| ColorModeProvider | Global (App.tsx) | dark/light mode |

## Hooks de navegacion

| Hook | Uso |
|------|-----|
| `useTab()` | Lee/escribe tab activa y sub-tabs |
| `useTabNavigation()` | Helpers: navigateToSearch, navigateToSearchWithFilter, navigateToSocialSubTab, navigateToListsSubTab |
| `useNavigateToBusiness()` | Comportamiento estandar: setActiveTab('buscar') + setSelectedBusiness |
| `useDeepLinks()` | ?business=xxx, ?tab=xxx |

## Comportamiento estandar

Al tocar un comercio desde cualquier tab:
1. Se cambia a tab Buscar
2. Se centra el mapa en el comercio
3. Se abre el BusinessSheet
4. El usuario queda en tab Buscar

## Archivos eliminados (v1 → v2)

- `src/components/layout/AppShell.tsx` → reemplazado por TabShell
- `src/components/layout/SideMenu.tsx` → reemplazado por tabs
- `src/components/layout/SideMenuNav.tsx` → reemplazado por tabs
- `src/components/notifications/NotificationBell.tsx` → reemplazado por badge en Perfil
