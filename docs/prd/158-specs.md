# Specs: Rediseno navegacion por tabs con 5 pestanas

**PRD:** [158-redesign-tab-navigation.md](158-redesign-tab-navigation.md)
**Refactoring Log:** [../design/158-refactoring-log.md](../design/158-refactoring-log.md)
**Fecha:** 2026-03-26

---

## Modelo de datos

### Nuevas colecciones

#### `quickActions` (configuracion de acciones rapidas por usuario)

No se crea coleccion nueva. Se agrega un campo `quickActions` al doc existente de `userSettings/{userId}`.

#### `achievements` (definiciones de logros desde admin)

```typescript
// Doc ID: slug del logro (e.g. "explorador", "social", "critico", "viajero")
interface AchievementDefinition {
  id: string;
  label: string;              // "Explorador"
  description: string;        // "Hacé check-in en 10 lugares diferentes"
  icon: string;               // nombre de icono MUI (e.g. "ExploreOutlined")
  condition: AchievementCondition;
  order: number;              // para ordenar en la grilla
  active: boolean;            // admin puede desactivar sin eliminar
  createdAt: Date;
}

interface AchievementCondition {
  metric: 'checkins_unique' | 'follows' | 'recommendations_sent' | 'ratings' | 'comments' | 'localities';
  threshold: number;          // meta a alcanzar (e.g. 10)
}
```

#### `userAchievements` (progreso de logros por usuario)

```typescript
// Doc ID: {userId}__{achievementId}
interface UserAchievement {
  userId: string;
  achievementId: string;
  progress: number;           // valor actual (e.g. 7 de 10)
  completed: boolean;
  completedAt?: Date;
  updatedAt: Date;
}
```

#### `specials` (contenido curado para seccion Especiales de Inicio)

```typescript
// Doc ID: auto-generated
interface Special {
  id: string;
  title: string;
  subtitle: string;
  icon: string;               // nombre de icono MUI
  type: 'featured_list' | 'trending' | 'custom_link';
  referenceId?: string;       // ID de sharedList o trendingBusinesses
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Campos nuevos en colecciones existentes

#### `userSettings/{userId}` -- nuevos campos

```typescript
// Campos agregados al UserSettings existente
interface UserSettingsAdditions {
  quickActions?: QuickActionSlot[];   // 8 slots, orden del usuario
  avatarId?: string;                  // ID del avatar seleccionado (e.g. "cat", "dog")
}

interface QuickActionSlot {
  type: 'category' | 'special' | 'favorites' | 'recientes' | 'visitas';
  value: string;  // BusinessCategory para type=category, "sorprendeme" para special, etc.
  label: string;  // Display label
  icon: string;   // Nombre de icono MUI
}
```

#### `sharedLists/{listId}` -- nuevo campo

```typescript
// Campo agregado al SharedList existente
interface SharedListAdditions {
  icon?: string;  // Nombre de icono de la biblioteca (e.g. "Restaurant", "Coffee")
}
```

#### `users/{userId}` -- nuevo campo

```typescript
interface UserProfileAdditions {
  avatarId?: string;  // Denormalizado para mostrar en feeds sin query extra
}
```

### Nuevos tipos en `src/types/index.ts`

```typescript
export type TabId = 'inicio' | 'social' | 'buscar' | 'listas' | 'perfil';

export type SocialSubTab = 'actividad' | 'seguidos' | 'recomendaciones' | 'rankings';

export type ListsSubTab = 'favoritos' | 'listas' | 'recientes' | 'colaborativas';

export type SearchViewMode = 'map' | 'list';

export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  order: number;
  active: boolean;
  createdAt: Date;
}

export interface AchievementCondition {
  metric: 'checkins_unique' | 'follows' | 'recommendations_sent' | 'ratings' | 'comments' | 'localities';
  threshold: number;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  updatedAt: Date;
}

export interface Special {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: 'featured_list' | 'trending' | 'custom_link';
  referenceId?: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickActionSlot {
  type: 'category' | 'special' | 'favorites' | 'recientes' | 'visitas';
  value: string;
  label: string;
  icon: string;
}
```

### Indices Firestore necesarios

| Coleccion | Campos | Tipo |
|-----------|--------|------|
| `achievements` | `active` ASC, `order` ASC | Composite |
| `userAchievements` | `userId` ASC, `completed` ASC | Composite |
| `specials` | `active` ASC, `order` ASC | Composite |

---

## Firestore Rules

### Nuevas reglas

```javascript
// Achievements (definiciones) -- cualquier auth puede leer, solo admin escribe
match /achievements/{docId} {
  allow read: if request.auth != null;
  allow write: if false; // Admin SDK only
}

// User achievements (progreso) -- owner puede leer, Cloud Functions escribe
match /userAchievements/{docId} {
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;
  allow write: if false; // Cloud Functions only
}

// Specials (contenido curado) -- cualquier auth puede leer, solo admin escribe
match /specials/{docId} {
  allow read: if request.auth != null;
  allow write: if false; // Admin SDK only
}
```

### Reglas modificadas

#### `userSettings/{userId}` -- agregar campos al `hasOnly`

```javascript
match /userSettings/{userId} {
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.data.keys().hasOnly([
      'profilePublic', 'notificationsEnabled', 'notifyLikes', 'notifyPhotos',
      'notifyRankings', 'notifyFeedback', 'notifyReplies', 'notifyFollowers',
      'notifyRecommendations', 'analyticsEnabled', 'locality', 'localityLat',
      'localityLng', 'updatedAt',
      // NEW fields for tabs redesign:
      'quickActions', 'avatarId'
    ])
    // ... existing validations ...
    && (!('quickActions' in request.resource.data)
        || (request.resource.data.quickActions is list
            && request.resource.data.quickActions.size() <= 8))
    && (!('avatarId' in request.resource.data)
        || (request.resource.data.avatarId is string
            && request.resource.data.avatarId.size() > 0
            && request.resource.data.avatarId.size() <= 30))
    && request.resource.data.updatedAt == request.time;
}
```

#### `sharedLists/{docId}` -- agregar `icon` al owner update

```javascript
// Owner update: add 'icon' to allowed keys
allow update: if request.auth != null
  && request.resource.data.ownerId == resource.data.ownerId
  && (
    (isListOwner()
      && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['name', 'description', 'isPublic', 'itemCount', 'updatedAt', 'icon']))
    || (isListEditor() /* unchanged */)
  );
```

#### `users/{userId}` -- agregar `avatarId` al update

```javascript
allow update: if request.auth != null && request.auth.uid == userId
  && request.resource.data.displayName is string
  && request.resource.data.displayName.size() > 0
  && request.resource.data.displayName.size() <= 30
  && (!('avatarId' in request.resource.data)
      || (request.resource.data.avatarId is string
          && request.resource.data.avatarId.size() > 0
          && request.resource.data.avatarId.size() <= 30));
```

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchAchievements()` | achievements | Any authenticated | `allow read: if auth != null` | YES -- new rule |
| `fetchUserAchievements(userId)` | userAchievements | Owner reading own | `allow read: if resource.data.userId == auth.uid` | YES -- new rule |
| `fetchSpecials()` | specials | Any authenticated | `allow read: if auth != null` | YES -- new rule |
| `updateQuickActions(userId, slots)` | userSettings | Owner writing own | `allow write: if auth.uid == userId` with hasOnly | YES -- add `quickActions` to hasOnly |
| `updateAvatar(userId, avatarId)` | userSettings | Owner writing own | `allow write: if auth.uid == userId` with hasOnly | YES -- add `avatarId` to hasOnly |
| `updateListIcon(listId, icon)` | sharedLists | Owner updating own | `allow update: if isListOwner()` | YES -- add `icon` to affectedKeys |
| `updateUserAvatar(userId, avatarId)` | users | Owner updating own | `allow update: if auth.uid == userId` | YES -- add `avatarId` validation |
| `fetchUserFavorites(userId)` | favorites | Any authenticated | `allow read: if auth != null` | No |
| `fetchMyCheckIns(userId)` | checkins | Owner reading own | `allow read: if resource.data.userId == auth.uid` | No |
| `useSuggestions` queries | favorites, ratings, userTags | Owner reading own | `allow read: if auth != null` | No |
| `fetchUserNotifications(userId)` | notifications | Owner reading own | `allow read: if resource.data.userId == auth.uid` | No |
| `fetchFollowing(userId)` | follows | Owner reading own | `allow read: if resource.data.followerId == auth.uid` | No |
| `fetchActivityFeed(userId)` | activityFeed/{userId}/items | Owner reading own | `allow read: if auth.uid == userId` | No |

---

## Cloud Functions

### `evaluateAchievements` (trigger)

- **Tipo:** `onDocumentWritten` en multiples colecciones
- **Trigger paths:** `checkins/{docId}`, `follows/{docId}`, `recommendations/{docId}`, `ratings/{docId}`, `comments/{docId}`
- **Logica:**
  1. Extraer `userId` del documento
  2. Leer definiciones activas de `achievements`
  3. Para cada achievement, calcular progreso actual:
     - `checkins_unique`: `COUNT(DISTINCT businessId)` de checkins del usuario
     - `follows`: `followingCount` del doc de users
     - `recommendations_sent`: `COUNT` de recommendations donde `senderId == userId`
     - `ratings`: `COUNT` de ratings del usuario
     - `comments`: `COUNT` de comments del usuario
     - `localities`: `COUNT(DISTINCT locality)` de checkins del usuario (usando location)
  4. Upsert `userAchievements/{userId}__{achievementId}` con progreso actualizado
  5. Si `progress >= threshold` y no estaba completado, marcar `completed: true, completedAt: now`
- **Batch:** Usa `writeBatch` para actualizar multiples logros en una sola operacion

### `manageSpecials` (callable, admin only)

- **Tipo:** Cloud Function callable
- **Logica:** CRUD de docs en coleccion `specials`
- **Validacion:** `assertAdmin` + App Check

### `manageAchievements` (callable, admin only)

- **Tipo:** Cloud Function callable
- **Logica:** CRUD de docs en coleccion `achievements`
- **Validacion:** `assertAdmin` + App Check

---

## Componentes

### Nuevos componentes

#### `src/components/layout/TabShell.tsx`

- **Props:** ninguna (lee de TabContext)
- **Renderiza:** dentro de `MapAppShell`, reemplaza a `AppShell`
- **Comportamiento:**
  - Renderiza el tab activo + `TabBar` fijo abajo
  - Usa `React.lazy()` para cada screen excepto la activa
  - Mantiene las screens montadas con `display: none` para preservar estado (excepto Buscar que siempre esta montado para mantener el mapa)
  - Altura: `100dvh` menos alto del TabBar (56px)

#### `src/components/layout/TabBar.tsx`

- **Props:** `activeTab: TabId`, `onTabChange: (tab: TabId) => void`, `notificationBadge: number`
- **Renderiza:** fijo abajo del viewport
- **Comportamiento:**
  - MUI `BottomNavigation` con 5 `BottomNavigationAction`
  - Boton central (Buscar) con estilo elevado: `sx={{ transform: 'translateY(-8px)' }}`, `Paper` circular con sombra
  - Badge en tab Perfil cuando `notificationBadge > 0`
  - Iconos: `Home`, `People`, `Search` (central), `ListAlt`, `Person`
  - Labels: "Inicio", "Social", "Buscar", "Listas", "Perfil"

#### `src/components/home/HomeScreen.tsx`

- **Props:** ninguna
- **Renderiza:** en tab Inicio
- **Comportamiento:**
  - Header con saludo dinamico (logica de hora) + nombre del usuario (de `useAuth`)
  - Subtitulo: localidad del usuario (de `useUserSettings`) o "Oficina"
  - Scrollable vertical con secciones: QuickActions, SpecialsSection, RecentSearches, ForYouSection

#### `src/components/home/GreetingHeader.tsx`

- **Props:** ninguna (usa `useAuth` + `useUserSettings`)
- **Renderiza:** dentro de HomeScreen, arriba de todo
- **Comportamiento:**
  - Calcula saludo por hora: 5-12 "Buenos dias", 12-19 "Buenas tardes", 19-5 "Buenas noches"
  - Muestra nombre del usuario de `useAuth().displayName`
  - Subtitulo con localidad de `userSettings.locality` o "Oficina" por defecto

#### `src/components/home/QuickActions.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de HomeScreen
- **Comportamiento:**
  - Grilla 2x4 (8 slots) con iconos y labels
  - Lee configuracion del usuario desde `useUserSettings().quickActions`
  - Defaults si no hay config: 7 categorias (`CATEGORY_LABELS`) + "Sorprendeme"
  - Modo edicion: toggle con boton "Editar"
  - En modo edicion: slots arrastrables, opciones extra aparecen abajo
  - Tap en slot normal: llama `useTabNavigation().navigateToSearchWithFilter(filter)` que cambia a tab Buscar en modo lista con filtro aplicado
  - Persistencia via `updateQuickActions()` service

#### `src/components/home/SpecialsSection.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de HomeScreen
- **Comportamiento:**
  - Lee docs de coleccion `specials` con `useSpecials()` hook
  - 3 items visibles, cada uno con icono + titulo + subtitulo + flecha derecha
  - Tap: navega segun `type` -- `featured_list` abre lista en tab Listas, `trending` abre en tab Social > Rankings

#### `src/components/home/RecentSearches.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de HomeScreen
- **Comportamiento:**
  - Lee busquedas recientes de localStorage (nuevo storage key)
  - Combina con visitas recientes de `useVisitHistory()`
  - Muestra 4 chips max (2 filas de 2)
  - Tap chip: navega a tab Buscar con query pre-llenada

#### `src/components/home/ForYouSection.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de HomeScreen
- **Comportamiento:**
  - Reutiliza `useSuggestions()` hook existente
  - Cards en scroll horizontal con nombre, categoria, commentCount, likeCount
  - Tap card: llama `useNavigateToBusiness()` (que ahora incluye cambio de tab)

#### `src/components/social/SocialScreen.tsx`

- **Props:** ninguna
- **Renderiza:** en tab Social
- **Comportamiento:**
  - MUI `Tabs` con 4 sub-tabs: Actividad, Seguidos, Recomendaciones, Rankings
  - Lazy-loads cada sub-tab content
  - Reutiliza componentes existentes: `ActivityFeedView`, `FollowedList`, `ReceivedRecommendations`, `RankingsView`
  - Pasa `onSelectBusiness` wired a `useNavigateToBusiness().navigateToBusiness`

#### `src/components/search/SearchListView.tsx`

- **Props:** `businesses: Business[]`, `onSelectBusiness: (biz: Business) => void`
- **Renderiza:** dentro de SearchScreen cuando `viewMode === 'list'`
- **Comportamiento:**
  - Lista vertical scrolleable de los mismos resultados filtrados del mapa
  - Cada row: nombre, categoria, distancia, rating promedio
  - Tap: llama `onSelectBusiness`

#### `src/components/lists/ListsScreen.tsx`

- **Props:** ninguna
- **Renderiza:** en tab Listas
- **Comportamiento:**
  - Titulo "Mis Listas"
  - MUI `Tabs` con 4 sub-tabs con iconos: Favoritos, Listas, Recientes, Colaborativas
  - Reutiliza: `FavoritesList`, `SharedListsView`, `RecentVisits` + `CheckInsView` (unificados), `CollaborativeTab`
  - Pasa `onSelectBusiness` wired a `useNavigateToBusiness().navigateToBusiness`

#### `src/components/lists/CollaborativeTab.tsx`

- **Props:** `onSelectBusiness: (biz: Business) => void`
- **Renderiza:** dentro de ListsScreen
- **Comportamiento:**
  - Filtra `sharedLists` donde el usuario es editor pero no owner
  - Misma card visual que SharedListsView
  - Reutiliza `SharedListDetailView` para el detalle

#### `src/components/lists/RecentsUnifiedTab.tsx`

- **Props:** `onSelectBusiness: (biz: Business) => void`
- **Renderiza:** dentro de ListsScreen, sub-tab "Recientes"
- **Comportamiento:**
  - Combina datos de `useVisitHistory()` (recientes de localStorage) y `useMyCheckIns()` (check-ins de Firestore)
  - Muestra en lista unificada ordenada por fecha, mas recientes primero
  - Infinite scroll
  - Tap: llama `onSelectBusiness`

#### `src/components/profile/ProfileScreen.tsx`

- **Props:** ninguna
- **Renderiza:** en tab Perfil
- **Comportamiento:**
  - Scrollable vertical
  - Secciones: AvatarHeader, OnboardingChecklist (si incompleto), StatsCards, AchievementsSection, SettingsMenu

#### `src/components/profile/AvatarHeader.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de ProfileScreen, arriba de todo
- **Comportamiento:**
  - Muestra avatar del usuario (icono de la biblioteca, default si no hay seleccion)
  - Nombre debajo
  - Tap en avatar abre `AvatarPicker`

#### `src/components/profile/AvatarPicker.tsx`

- **Props:** `open: boolean`, `onClose: () => void`, `currentAvatarId: string | null`
- **Renderiza:** como Dialog
- **Comportamiento:**
  - Grilla de avatares disponibles (set cerrado de ~20 iconos de animales/personajes)
  - Tap selecciona y persiste via `updateAvatar()` service
  - Avatares definidos como constantes en `src/constants/avatars.ts`

#### `src/components/profile/StatsCards.tsx`

- **Props:** ninguna (usa `useUserProfile`, `useMyCheckIns`)
- **Renderiza:** dentro de ProfileScreen
- **Comportamiento:**
  - 4 cards horizontales: Lugares (check-ins), Resenas (ratings + comments), Seguidores (followersCount), Favoritos (favorites count)
  - Tap Lugares: navega a tab Listas > Recientes
  - Tap Resenas: navega a detalle de resenas (nueva sub-pantalla dentro de Perfil con CommentsList + RatingsList)
  - Tap Seguidores: navega a tab Social > Seguidos
  - Tap Favoritos: navega a tab Listas > Favoritos

#### `src/components/profile/AchievementsSection.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de ProfileScreen
- **Comportamiento:**
  - Lee logros con `useAchievements()` hook
  - Muestra cards horizontales, ordenadas por completitud (mas cerca de completar primero)
  - Cada card: icono + label + LinearProgress + porcentaje
  - Tap: navega a `AchievementsGrid`

#### `src/components/profile/AchievementsGrid.tsx`

- **Props:** `onBack: () => void`
- **Renderiza:** como pantalla dentro de tab Perfil (con flecha atras)
- **Comportamiento:**
  - Grilla completa de todos los logros
  - Tap en logro abre Dialog con descripcion de como completarlo
  - Reutiliza datos de `useAchievements()`

#### `src/components/profile/SettingsMenu.tsx`

- **Props:** ninguna
- **Renderiza:** dentro de ProfileScreen
- **Comportamiento:**
  - Lista de 5 items con icono + nombre + flecha
  - Notificaciones: badge con `unreadCount` de `useNotifications()`
  - Pendientes: solo visible si hay acciones offline (`useConnectivity`)
  - Cada item navega a sub-pantalla dentro de Perfil
  - Reutiliza: `NotificationList`, `PendingActionsSection`, `SettingsPanel`, `HelpSection`, `PrivacyPolicy`, `FeedbackForm`

#### `src/components/lists/IconPicker.tsx`

- **Props:** `open: boolean`, `onClose: () => void`, `currentIcon: string | null`, `onSelect: (icon: string) => void`
- **Renderiza:** como Dialog
- **Comportamiento:**
  - Grilla de ~30 iconos disponibles para listas
  - Iconos definidos como constantes en `src/constants/listIcons.ts`
  - Tap selecciona y llama `onSelect`

### Componentes modificados

#### `src/components/layout/AppShell.tsx` -- reemplazado por TabShell

Se elimina. Todo su contenido migra a `TabShell`.

#### `src/components/layout/MapAppShell.tsx` -- renderiza TabShell

```typescript
export default function MapAppShell() {
  return (
    <SelectionProvider>
      <OnboardingProvider>
        <TabProvider>
          <TabShell />
        </TabProvider>
      </OnboardingProvider>
    </SelectionProvider>
  );
}
```

#### `src/components/search/SearchBar.tsx` -- sin cambios adicionales

Ya limpio de hamburguesa y campana (refactoring log, Refactor 3).

#### `src/components/search/SearchScreen.tsx` -- agregar toggle mapa/lista

- Agrega estado `viewMode: SearchViewMode` (default 'map')
- Renderiza `SearchListView` cuando `viewMode === 'list'`
- Agrega `ToggleButtonGroup` entre SearchBar y FilterChips
- Persiste busquedas en localStorage para RecentSearches

#### `src/components/layout/SideMenu.tsx` -- eliminar

Se elimina junto con `SideMenuNav.tsx`.

#### `src/components/notifications/NotificationBell.tsx` -- eliminar

La logica ya vive en `NotificationsContext`. El componente visual se reemplaza por badge en SettingsMenu.

#### `src/components/menu/SharedListsView.tsx` -- agregar IconPicker

- Al crear/editar lista, agregar boton para elegir icono
- Card visual muestra icono elegido

---

## Hooks

### `useTabNavigation` (nuevo)

```typescript
function useTabNavigation(): {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  navigateToSearchWithFilter: (filter: { category?: BusinessCategory; tag?: string; query?: string }) => void;
  navigateToSearchWithBusiness: (businessOrId: Business | string) => void;
  navigateToListsSubTab: (subTab: ListsSubTab) => void;
  navigateToSocialSubTab: (subTab: SocialSubTab) => void;
}
```

- **Dependencias:** `TabContext`
- **Caching:** ninguno (estado en contexto)
- Lee y escribe el tab activo del `TabContext`
- `navigateToSearchWithFilter` cambia a tab Buscar + aplica filtro via `FiltersContext`
- `navigateToSearchWithBusiness` extiende `useNavigateToBusiness` con cambio de tab

### `useNavigateToBusiness` (modificado)

```typescript
// ANTES: solo setSelectedBusiness
// DESPUES: tambien cambia a tab Buscar
function useNavigateToBusiness(): {
  navigateToBusiness: (businessOrId: Business | string) => void;
}
```

- **Cambio:** Agrega `setActiveTab('buscar')` del TabContext antes de setSelectedBusiness

### `useSpecials` (nuevo)

```typescript
function useSpecials(): {
  specials: Special[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

- **Dependencias:** `useAsyncData`, `fetchSpecials` service
- **Caching:** `useAsyncData` con refresh al montar HomeScreen

### `useAchievements` (nuevo)

```typescript
function useAchievements(): {
  achievements: Array<AchievementDefinition & { progress: number; completed: boolean }>;
  isLoading: boolean;
  error: string | null;
}
```

- **Dependencias:** `useAuth`, `useAsyncData`
- **Caching:** `useAsyncData` con TTL interno, refresca al montar ProfileScreen
- Combina datos de `achievements` (definiciones) con `userAchievements` (progreso del usuario)

### `useRecentSearches` (nuevo)

```typescript
function useRecentSearches(): {
  searches: Array<{ query: string; type: 'text' | 'business'; businessId?: string; timestamp: number }>;
  addSearch: (query: string, type: 'text' | 'business', businessId?: string) => void;
  clearSearches: () => void;
}
```

- **Dependencias:** ninguna (localStorage)
- **Storage:** `STORAGE_KEY_RECENT_SEARCHES` en localStorage
- Max 20 entries, dedup por query

### `useDeepLinks` (modificado)

- **Cambio:** Agrega soporte para `?tab=xxx` query param
- Usa `TabContext` para cambiar al tab correspondiente

---

## Servicios

### `src/services/specials.ts` (nuevo)

```typescript
async function fetchSpecials(): Promise<Special[]>;
```

- Lee coleccion `specials` donde `active == true`, ordered by `order`
- Usa `withConverter<Special>()`

### `src/services/achievements.ts` (nuevo)

```typescript
async function fetchAchievementDefinitions(): Promise<AchievementDefinition[]>;
async function fetchUserAchievements(userId: string): Promise<UserAchievement[]>;
```

- `fetchAchievementDefinitions`: lee `achievements` donde `active == true`, ordered by `order`
- `fetchUserAchievements`: lee `userAchievements` donde `userId == userId`

### `src/services/quickActions.ts` (nuevo)

```typescript
async function updateQuickActions(userId: string, slots: QuickActionSlot[]): Promise<void>;
```

- Actualiza `userSettings/{userId}` con campo `quickActions`
- Valida max 8 slots client-side antes de escribir

### `src/services/avatars.ts` (nuevo)

```typescript
async function updateUserAvatar(userId: string, avatarId: string): Promise<void>;
```

- Actualiza `userSettings/{userId}` con campo `avatarId`
- Tambien actualiza `users/{userId}` con `avatarId` (denormalizacion para feeds)

### `src/services/sharedLists.ts` (modificado)

```typescript
// NUEVO:
async function updateListIcon(listId: string, icon: string): Promise<void>;
// Agrega campo `icon` al shared list doc

// MODIFICADO:
async function createList(userId: string, name: string, description?: string, icon?: string): Promise<string>;
// Acepta icon opcional al crear
```

---

## Integracion

### TabContext como nuevo contexto global

```
MapAppShell
  SelectionProvider
  OnboardingProvider
  TabProvider          <-- NUEVO
    TabShell           <-- reemplaza AppShell
```

### Conexion de componentes existentes del SideMenu a tabs

Cada componente que hoy vive lazy-loaded en SideMenu se monta lazy-loaded en su nueva tab screen:

| Componente existente | Antes (SideMenu) | Despues (Tab) |
|---------------------|-------------------|---------------|
| `FavoritesList` | SideMenu section="favorites" | ListsScreen sub-tab "Favoritos" |
| `RecentVisits` | SideMenu section="recent" | RecentsUnifiedTab (combinado) |
| `CheckInsView` | SideMenu section="checkins" | RecentsUnifiedTab (combinado) |
| `CommentsList` | SideMenu section="comments" | ProfileScreen > Resenas detail |
| `RatingsList` | SideMenu section="ratings" | ProfileScreen > Resenas detail |
| `SharedListsView` | SideMenu section="lists" | ListsScreen sub-tab "Listas" |
| `SuggestionsView` | SideMenu section="suggestions" | ForYouSection (re-styled as cards) |
| `RankingsView` | SideMenu section="rankings" | SocialScreen sub-tab "Rankings" |
| `FollowedList` | SideMenu section="following" | SocialScreen sub-tab "Seguidos" |
| `ActivityFeedView` | SideMenu section="activity" | SocialScreen sub-tab "Actividad" |
| `ReceivedRecommendations` | SideMenu section="recommendations" | SocialScreen sub-tab "Recomendaciones" |
| `OnboardingChecklist` | SideMenu section="onboarding" | ProfileScreen (inline) |
| `FeedbackForm` | SideMenu section="feedback" | ProfileScreen > Ayuda > Feedback |
| `HelpSection` | SideMenu section="help" | ProfileScreen > Ayuda |
| `SettingsPanel` | SideMenu section="settings" | ProfileScreen > Configuracion |
| `PrivacyPolicy` | SideMenu section="privacy" | ProfileScreen > Privacidad |
| `PendingActionsSection` | SideMenu section="pending" | ProfileScreen > Pendientes |
| `StatsView` | SideMenu section="stats" | Eliminado (reemplazado por StatsCards en Perfil) |

### Props de interaccion wired (sin noop)

| Componente | Prop | Handler real |
|-----------|------|-------------|
| `FavoritesList` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `SuggestionsView` / `ForYouSection` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `RankingsView` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `ActivityFeedView` | `onItemClick` | `useNavigateToBusiness().navigateToBusiness` |
| `ReceivedRecommendations` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `SharedListsView` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `CollaborativeTab` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `RecentsUnifiedTab` | `onSelectBusiness` | `useNavigateToBusiness().navigateToBusiness` |
| `SearchListView` | `onSelectBusiness` | `useSelection().setSelectedBusiness` (ya en tab Buscar) |
| `QuickActions` | tap slot | `useTabNavigation().navigateToSearchWithFilter(...)` |
| `RecentSearches` | tap chip | `useTabNavigation().navigateToSearchWithFilter({ query })` |
| `StatsCards` | tap Lugares | `useTabNavigation().navigateToListsSubTab('recientes')` |
| `StatsCards` | tap Resenas | setState para mostrar ReviewsDetail dentro de ProfileScreen |
| `StatsCards` | tap Seguidores | `useTabNavigation().navigateToSocialSubTab('seguidos')` |
| `StatsCards` | tap Favoritos | `useTabNavigation().navigateToListsSubTab('favoritos')` |
| `SpecialsSection` | tap item | `useTabNavigation().navigateToListsSubTab('listas')` o `navigateToSocialSubTab('rankings')` segun `type` |
| `AchievementsSection` | tap | setState para mostrar AchievementsGrid dentro de ProfileScreen |

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/context/__tests__/TabContext.test.tsx` | Tab state, setActiveTab, sub-tab state | Unit |
| `src/hooks/__tests__/useTabNavigation.test.ts` | navigateToSearchWithFilter, navigateToSearchWithBusiness, sub-tab navigation | Unit |
| `src/hooks/__tests__/useNavigateToBusiness.test.ts` | Tab switch + business selection | Unit (update existing) |
| `src/hooks/__tests__/useRecentSearches.test.ts` | localStorage read/write, dedup, max entries | Unit |
| `src/hooks/__tests__/useAchievements.test.ts` | Combines definitions + progress, loading states | Unit |
| `src/hooks/__tests__/useSpecials.test.ts` | Fetch + error handling | Unit |
| `src/services/__tests__/specials.test.ts` | Firestore query, converter | Unit |
| `src/services/__tests__/achievements.test.ts` | Firestore queries, converter | Unit |
| `src/services/__tests__/quickActions.test.ts` | Validation, Firestore write | Unit |
| `src/services/__tests__/avatars.test.ts` | Dual write (userSettings + users) | Unit |
| `src/components/layout/__tests__/TabBar.test.tsx` | 5 tabs render, active state, badge, central button style | Component |
| `src/components/layout/__tests__/TabShell.test.tsx` | Renders active tab, lazy loads others, preserves state | Component |
| `src/components/home/__tests__/GreetingHeader.test.tsx` | Saludo por hora, nombre, localidad | Component |
| `src/components/home/__tests__/QuickActions.test.tsx` | 8 slots render, default config, tap navigates | Component |
| `src/components/search/__tests__/SearchListView.test.tsx` | Lista de resultados, tap llama onSelectBusiness | Component |
| `src/components/profile/__tests__/StatsCards.test.tsx` | 4 cards render, numbers, tap navigates | Component |
| `src/components/profile/__tests__/AchievementsSection.test.tsx` | Progress bars, sorting, tap navigates | Component |
| `functions/src/triggers/__tests__/achievements.test.ts` | Trigger logic, progress calc, completion detection | Unit |

### Casos a cubrir

- Tab navigation: switching between all 5 tabs preserves state
- Standard behavior: tap business in any tab switches to Buscar + opens sheet
- Quick actions: default config for new users, edit mode, persistence
- Achievements: progress calculation from Firestore data, completion threshold
- Search toggle: map/list mode switch preserves filter state
- Deep links: `?tab=social` navigates correctly
- Offline: quick actions and avatar changes work offline

### Mock strategy

- Firestore: mock SDK functions (existing pattern)
- TabContext: mock provider wrapping test components
- useAuth: mock via context (existing pattern)
- localStorage: use `vi.stubGlobal` for storage
- Analytics: mock `trackEvent` (existing pattern)

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos
- Tests de navigation entre tabs
- Tests de integracion: StatsCards tap -> tab switch

---

## Analytics

### Nuevos eventos

```typescript
// En src/constants/analyticsEvents.ts

// Tab navigation events
export const EVT_TAB_SWITCHED = 'tab_switched';           // { from: TabId, to: TabId }
export const EVT_SUB_TAB_SWITCHED = 'sub_tab_switched';   // { tab: TabId, sub_tab: string }

// Home screen events
export const EVT_QUICK_ACTION_TAPPED = 'quick_action_tapped';   // { type, value }
export const EVT_QUICK_ACTIONS_EDITED = 'quick_actions_edited'; // { slots_changed: number }
export const EVT_SPECIAL_TAPPED = 'special_tapped';             // { special_id, type }
export const EVT_RECENT_SEARCH_TAPPED = 'recent_search_tapped'; // { query_type: 'text'|'business' }
export const EVT_FOR_YOU_TAPPED = 'for_you_tapped';             // { business_id }

// Profile events
export const EVT_AVATAR_CHANGED = 'avatar_changed';             // { avatar_id }
export const EVT_ACHIEVEMENT_VIEWED = 'achievement_viewed';     // { achievement_id }
export const EVT_ACHIEVEMENTS_GRID_OPENED = 'achievements_grid_opened';
export const EVT_STATS_CARD_TAPPED = 'stats_card_tapped';       // { card: 'lugares'|'resenas'|'seguidores'|'favoritos' }

// Search events
export const EVT_SEARCH_VIEW_TOGGLED = 'search_view_toggled';   // { mode: 'map'|'list' }

// Lists events
export const EVT_LIST_ICON_CHANGED = 'list_icon_changed';       // { list_id }
```

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Quick actions config | Firestore persistent cache + localStorage fallback | Session | IndexedDB (Firestore) + localStorage |
| Specials | Firestore persistent cache | 1 hora (stale ok) | IndexedDB (Firestore) |
| Achievement definitions | Firestore persistent cache | 24 horas (rarely changes) | IndexedDB (Firestore) |
| User achievements progress | Firestore persistent cache | Session | IndexedDB (Firestore) |
| Recent searches | localStorage (ya offline-first) | Indefinido | localStorage |
| Visit history | localStorage (ya offline-first) | Indefinido | localStorage |
| Avatar selection | Firestore persistent cache | Session | IndexedDB (Firestore) |
| Tab state | In-memory (context) | Session | None |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Update quick actions | `withOfflineSupport` wrapper | Last-write-wins (full array replace) |
| Update avatar | `withOfflineSupport` wrapper | Last-write-wins |
| Update list icon | `withOfflineSupport` wrapper | Last-write-wins |

### Fallback UI

- HomeScreen: muestra QuickActions con defaults si config no carga. Specials muestra skeleton o mensaje "Sin conexion". ForYou muestra cached suggestions.
- Achievements: muestra ultimo estado cacheado de progreso. Si no hay cache, muestra solo las definiciones con progreso 0.
- SearchListView: mismos resultados que el mapa (datos estaticos de `businesses.json`), sin interacciones online.

---

## Decisiones tecnicas

### 1. Tabs mantienen estado montado (no desmontan)

**Decision:** Las 5 tabs se renderizan siempre pero con `display: none` para las inactivas.
**Razon:** Evita perder estado de scroll, datos cargados, y posicion del mapa. Re-montar el mapa de Google Maps es costoso (~2s).
**Alternativa rechazada:** React Router con rutas por tab -- agrega complejidad sin beneficio real para una SPA mobile-first donde las tabs son de primer nivel.

### 2. TabContext en lugar de React Router para tabs

**Decision:** Estado de tabs manejado por contexto React, no por rutas.
**Razon:** Las tabs son estado de UI, no de navegacion. Los deep links (`?tab=xxx`) se manejan por el hook `useDeepLinks` existente. Esto evita re-renders globales por cambio de URL y mantiene compatibilidad con el mapa montado.
**Alternativa rechazada:** `react-router-dom` tabs -- requiere desmontar/remontar componentes, no preserva estado del mapa.

### 3. No usar react-beautiful-dnd para Quick Actions

**Decision:** Usar HTML5 Drag and Drop nativo con touch polyfill minimo.
**Razon:** react-beautiful-dnd esta deprecado y su sucesor (pragmatic-drag-and-drop) es pesado. Para una grilla de 8 items fijos, drag nativo con touch events es suficiente y no agrega dependencias.
**Alternativa rechazada:** `@dnd-kit/core` -- demasiado heavy para 8 items.

### 4. Achievements evaluados por Cloud Functions, no cliente

**Decision:** El progreso de logros se calcula en Cloud Functions triggers, no en el cliente.
**Razon:** Seguridad (el cliente no puede falsificar progreso) + consistencia (no depende de que el usuario abra la app) + escalabilidad (las condiciones pueden cambiar desde admin sin redeploy).
**Alternativa rechazada:** Calcular progreso client-side al abrir Perfil -- vulnerable a manipulacion y requiere queries adicionales en cada apertura.

### 5. Denormalizacion de avatarId en users doc

**Decision:** `avatarId` se guarda tanto en `userSettings` (para el usuario) como en `users` (para otros).
**Razon:** Los activity feed items y rankings ya leen de `users` para mostrar `displayName`. Agregar `avatarId` ahi evita queries adicionales al mostrar avatares en feeds y rankings.

### 6. Specials como coleccion separada (no config doc)

**Decision:** Coleccion `specials` con docs individuales, no un campo array en `config/specials`.
**Razon:** Permite queries mas eficientes, paginacion futura, y CRUD individual desde admin sin race conditions de array updates. Tambien facilita agregar mas de 3 especiales sin limites de tamano de doc.
