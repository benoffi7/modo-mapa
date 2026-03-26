# Refactoring Log — Preparacion para tabs (#158)

**Branch:** `new-home`
**Fecha:** 2026-03-26
**Tests:** 573/573 passed despues de cada refactor

---

## Resumen de cambios

7 refactors internos que no cambian UI. La app sigue funcionando exactamente igual, pero la arquitectura esta lista para montar las 5 tabs.

## Refactor 1: Split MapContext en SelectionContext + FiltersContext

**Antes:** Un solo `MapProvider` con todo (selection + filters) wrapeando toda la app.
**Despues:** Dos providers independientes:
- `SelectionProvider` (global) — `selectedBusiness`, `activeSharedListId`
- `FiltersProvider` (solo Buscar) — `searchQuery`, `activeFilters`, `activePriceFilter`, `userLocation`

**Archivos creados:**
- `src/context/SelectionContext.tsx`
- `src/context/FiltersContext.tsx`

**Archivos modificados:**
- `src/context/MapContext.tsx` — ahora es barrel de re-exports (backward compat)

**Impacto:** Los 19 archivos que importan de MapContext siguen funcionando sin cambios gracias a los re-exports.

## Refactor 2: Hook useNavigateToBusiness

**Nuevo hook** que encapsula el "comportamiento estandar" del PRD: navegar a un comercio desde cualquier tab.

**Archivo creado:**
- `src/hooks/useNavigateToBusiness.ts`

Acepta `Business` o `string` (business ID). En el futuro agregara cambio de tab a Buscar.

## Refactor 3: Limpieza de SearchBar

**Antes:** SearchBar tenia icono hamburguesa (`MenuIcon` + `onMenuClick`) y `NotificationBell`.
**Despues:** SearchBar es pura busqueda. Sin dependencias de layout.

**Removidos:** `MenuIcon`, `onMenuClick` prop, `NotificationBell`, imports de `useAuth`.

## Refactor 4: Extraccion de SearchScreen

**Antes:** AppShell renderizaba directamente MapView, SearchBar, FilterChips, FABs, BusinessSheet, MapHint.
**Despues:** Todo eso vive en `SearchScreen`, un componente autocontenido.

**Archivo creado:**
- `src/components/search/SearchScreen.tsx`

AppShell ahora renderiza `<SearchScreen />` en lugar de los componentes individuales.

## Refactor 5: APIProvider movido a SearchScreen

**Antes:** `MapAppShell` wrapeaba toda la app con Google Maps `APIProvider` + `MapProvider`.
**Despues:**
- `MapAppShell` solo tiene `SelectionProvider` (global)
- `SearchScreen` tiene su propio `FiltersProvider` + `APIProvider` (Google Maps)

**Beneficio:** Las tabs que no necesitan mapa no cargan Google Maps API.

## Refactor 6: OnboardingProvider

**Antes:** AppShell manejaba `useOnboardingFlow`, `BenefitsDialog`, `AccountBanner`, `ActivityReminder`, `EmailPasswordDialog` directamente.
**Despues:** Todo vive en `OnboardingProvider` como contexto global.

**Archivo creado:**
- `src/context/OnboardingContext.tsx`

**Hook expuesto:** `useOnboarding()` — cualquier tab puede llamar `handleCreateAccount()` o `handleLogin()`.

**SideMenu:** Se removio el `EmailPasswordDialog` duplicado y 3 props (`emailDialogOpen`, `emailDialogTab`, `onEmailDialogClose`).

## Refactor 7: Hook useDeepLinks

**Antes:** Deep links (`?business=xxx`, `?list=xxx`) estaban hardcodeados en AppShell con acceso directo a estado del drawer.
**Despues:** Hook reutilizable `useDeepLinks(onListCallback)`.

**Archivo creado:**
- `src/hooks/useDeepLinks.ts`

---

## Arquitectura resultante

```
App.tsx
  ColorModeProvider
  AuthProvider
  ToastProvider
  ConnectivityProvider
  NotificationsProvider
    Routes
      /admin/* → AdminDashboard
      /* → MapAppShell
              SelectionProvider    ← global (todas las tabs)
              OnboardingProvider   ← global (dialogs de auth)
                AppShell
                  SearchScreen
                    FiltersProvider  ← solo busqueda
                    APIProvider     ← solo Google Maps
                      SearchBar
                      FilterChips
                      MapView
                      FABs
                      BusinessSheet
                      MapHint
                  SideMenu (temporal — se elimina con tabs)
                  NameDialog
                  OfflineIndicator
```

## Proximos pasos

Con esta base modular, el plan de implementacion de tabs puede:
1. Reemplazar AppShell por TabShell
2. Montar SearchScreen en tab Buscar (ya autocontenido)
3. Crear HomeScreen, SocialScreen, ListsScreen, ProfileScreen como nuevas tabs
4. Migrar secciones del SideMenu a sus respectivas tabs
5. Eliminar SideMenu cuando todas las secciones esten migradas
