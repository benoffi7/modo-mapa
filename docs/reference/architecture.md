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

```text
HomeScreen (scrollable)
  ├─ GreetingHeader (saludo por hora + nombre + localidad)
  ├─ QuickActions (grilla 2x4, editable, localStorage)
  ├─ SpecialsSection (3 items curados, placeholder → Firestore)
  ├─ RecentSearches (4 chips de visitas recientes)
  └─ ForYouSection (cards horizontales de useSuggestions)
```

## Tab: Social (SocialScreen)

```text
SocialScreen
  ├─ Tabs: Actividad | Seguidos | Recomendaciones | Rankings
  ├─ ActivityFeedView (infinite scroll, seguidos)
  ├─ FollowedList (lista + buscador + UserProfileSheet)
  ├─ ReceivedRecommendations (con badge no leidas)
  ├─ RankingsView (semanal/mensual/anual/all-time)
  └─ UserProfileSheet (bottom sheet para perfiles)
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
  └─ BusinessSheet (bottom sheet de comercio)
```

## Tab: Listas (ListsScreen)

```text
ListsScreen
  ├─ Tabs: Favoritos | Listas | Recientes | Colaborativas
  ├─ FavoritesList (sort by nombre/distancia/rating)
  ├─ SharedListsView (grilla cards, CRUD, privacidad)
  ├─ RecentsUnifiedTab (visitas + check-ins unificados)
  └─ CollaborativeTab (listas donde soy editor invitado)
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
