# Specs: Centralize user-facing text strings

**PRD:** [5-centralize-texts.md](5-centralize-texts.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay cambios al modelo de datos de Firestore. Este es un refactor puramente frontend de strings literales a constantes centralizadas.

## Firestore Rules

Sin cambios.

### Rules impact analysis

No hay queries nuevas. No aplica.

## Cloud Functions

Sin cambios.

---

## Estructura de archivos de mensajes

Crear un directorio `src/constants/messages/` con archivos por dominio. Cada archivo exporta un objeto `const` con strings agrupados por tipo de operacion (success, error, info, warning, empty states, labels).

### Convencion de nombres

- Archivo: dominio en singular (`business.ts`, `list.ts`, `comment.ts`)
- Exportacion: `MSG_{DOMAIN}` como objeto con claves descriptivas en camelCase
- Tipos de claves: `{accion}Success`, `{accion}Error`, `empty`, `{contexto}Label`

### Archivos a crear

#### `src/constants/messages/index.ts`

Barrel re-export de todos los modulos de mensajes.

#### `src/constants/messages/business.ts`

```typescript
export const MSG_BUSINESS = {
  ratingSuccess: '!Genial! Tambien podes dejar un comentario.',
  ratingError: 'No se pudo guardar la calificacion',
  ratingDeleteError: 'No se pudo borrar la calificacion',
  criteriaError: 'No se pudo guardar el criterio',
  favoriteAdded: 'Agregado a favoritos',
  favoriteRemoved: 'Removido de favoritos',
  favoriteError: 'No se pudo actualizar favoritos',
  emptyRatings: 'Sin calificaciones aun',
  emptyPriceLevel: 'Sin votos de nivel de gasto',
  emptyMenuPhoto: 'No hay foto del menu',
  noBusinessesFound: 'No se encontraron comercios',
  noRatingsLabel: 'sin calificaciones',
} as const;
```

#### `src/constants/messages/comment.ts`

```typescript
export const MSG_COMMENT = {
  publishSuccess: 'Comentario publicado',
  editSuccess: 'Comentario editado',
  publishError: 'No se pudo publicar el comentario',
  likeError: 'No se pudo actualizar el like',
  replySuccess: 'Respuesta publicada',
  replyError: 'No se pudo publicar la respuesta',
  emptyOwn: 'No dejaste comentarios todavia',
  emptyBusiness: 'No hay comentarios para este comercio',
  favoriteHint: 'Guarda tus favoritos tocando el corazon.',
} as const;
```

#### `src/constants/messages/question.ts`

```typescript
export const MSG_QUESTION = {
  publishSuccess: 'Pregunta publicada',
  publishError: 'No se pudo publicar la pregunta',
  likeError: 'No se pudo actualizar el like',
  replySuccess: 'Respuesta publicada',
  replyError: 'No se pudo publicar la respuesta',
} as const;
```

#### `src/constants/messages/list.ts`

```typescript
export const MSG_LIST = {
  createSuccess: 'Lista creada',
  createError: 'No se pudo crear la lista',
  createAndAddSuccess: 'Lista creada y comercio agregado',
  deleteSuccess: 'Lista eliminada',
  deleteError: 'Error al eliminar lista',
  updateError: 'No se pudo actualizar la lista',
  colorError: 'Error al cambiar color',
  visibilityPublic: 'Lista publica',
  visibilityPrivate: 'Lista privada',
  visibilityError: 'Error al cambiar visibilidad',
  linkCopied: 'Link copiado',
  itemRemoved: 'Comercio removido',
  copySuccess: 'Lista copiada a Mis Listas',
  copyError: 'No se pudo copiar',
  addFavoritesError: 'Error al agregar favoritos',
  emptyLists: 'No tenes listas todavia',
  emptyCollaborative: 'No participas en listas colaborativas todavia',
  emptyNoLists: 'No tenes listas. Crea una para empezar.',
  editorInvited: (email: string) => `Editor invitado: ${email}` as const,
  editorRemoved: 'Editor removido',
  editorInviteError: 'No se pudo invitar',
  editorRemoveError: 'No se pudo remover',
  favoritesAdded: (count: number) =>
    count > 0
      ? `${count} ${count === 1 ? 'favorito agregado' : 'favoritos agregados'} a la lista`
      : 'Todos los comercios ya estaban en la lista',
} as const;
```

#### `src/constants/messages/auth.ts` (new file, not the existing `constants/auth.ts`)

```typescript
export const MSG_AUTH = {
  verificationSent: 'Email de verificacion enviado',
  verificationError: 'No se pudo enviar el email',
  verificationSuccess: '!Email verificado!',
  verificationPending: 'Todavia no verificado. Revisa tu bandeja de entrada.',
  deleteSuccess: 'Tu cuenta y datos fueron eliminados permanentemente',
  loginRequired: 'Inicia sesion para registrar visitas',
} as const;
```

#### `src/constants/messages/social.ts`

```typescript
export const MSG_SOCIAL = {
  followError: 'Error al actualizar seguimiento',
  recommendSuccess: 'Recomendacion enviada',
  recommendError: 'Error al enviar recomendacion',
  emptyFollowed: 'No seguis a nadie todavia',
  emptyActivity: 'No hay actividad reciente',
  emptyRecommendations: 'Todavia no recibiste recomendaciones',
} as const;
```

#### `src/constants/messages/checkin.ts`

```typescript
export const MSG_CHECKIN = {
  success: 'Visita registrada',
  removed: 'Visita desmarcada',
  tooFar: 'Parece que no estas cerca de este comercio',
  emptyVisits: 'Todavia no registraste visitas',
} as const;
```

#### `src/constants/messages/feedback.ts` (new file, not the existing `constants/feedback.ts`)

```typescript
export const MSG_FEEDBACK = {
  mediaTooBig: 'La imagen es muy grande. Maximo 10 MB.',
  emptyFeedback: 'No enviaste feedback todavia',
} as const;
```

#### `src/constants/messages/offline.ts`

```typescript
export const MSG_OFFLINE = {
  syncing: (count: number) =>
    `Sincronizando ${count} ${count === 1 ? 'accion' : 'acciones'}...`,
  syncSuccess: (count: number) =>
    `${count} ${count === 1 ? 'accion sincronizada' : 'acciones sincronizadas'}`,
  syncFailed: (count: number) =>
    `${count} ${count === 1 ? 'accion fallo' : 'acciones fallaron'}`,
  noConnection: 'Sin conexion',
  noConnectionPending: (count: number) =>
    `Sin conexion - ${count} pendiente${count > 1 ? 's' : ''}`,
  emptyPending: 'No hay acciones pendientes',
} as const;
```

#### `src/constants/messages/admin.ts`

```typescript
export const MSG_ADMIN = {
  featuredToggleSuccess: (wasFeatured: boolean) =>
    wasFeatured ? 'Quitada de destacadas' : 'Marcada como destacada',
  featuredToggleError: 'Error al cambiar estado',
} as const;
```

#### `src/constants/messages/onboarding.ts`

```typescript
export const MSG_ONBOARDING = {
  checklistComplete: '!Completaste todos los primeros pasos!',
  surpriseAllVisited: '!Ya visitaste todos! Te sorprendemos con uno al azar.',
  surpriseSuccess: (name: string) => `!Sorpresa! Descubri ${name}`,
} as const;
```

#### `src/constants/messages/common.ts`

```typescript
export const MSG_COMMON = {
  genericError: 'Ocurrio un error. Intenta de nuevo.',
  noResults: 'No se encontraron resultados',
  noUsersFound: 'No se encontraron usuarios',
  publicProfileHint: 'Quizas el usuario no tenga el perfil publico',
} as const;
```

### Barrel re-export

```typescript
// src/constants/messages/index.ts
export { MSG_BUSINESS } from './business';
export { MSG_COMMENT } from './comment';
export { MSG_QUESTION } from './question';
export { MSG_LIST } from './list';
export { MSG_AUTH } from './auth';
export { MSG_SOCIAL } from './social';
export { MSG_CHECKIN } from './checkin';
export { MSG_FEEDBACK } from './feedback';
export { MSG_OFFLINE } from './offline';
export { MSG_ADMIN } from './admin';
export { MSG_ONBOARDING } from './onboarding';
export { MSG_COMMON } from './common';
```

### Constants barrel update

Agregar `export * from './messages';` en `src/constants/index.ts`.

---

## Componentes

No se crean componentes nuevos. Se modifican 21 archivos de componentes y 2 hooks para reemplazar strings literales por constantes importadas.

### Archivos a modificar (toast calls)

| Archivo | Dominio de mensajes | Cantidad de reemplazos |
|---------|---------------------|----------------------|
| `src/components/business/BusinessRating.tsx` | `MSG_BUSINESS` | 4 |
| `src/components/business/BusinessComments.tsx` | `MSG_COMMENT` | 7 |
| `src/components/business/BusinessQuestions.tsx` | `MSG_QUESTION` | 5 |
| `src/components/business/FavoriteButton.tsx` | `MSG_BUSINESS` | 3 |
| `src/components/business/AddToListDialog.tsx` | `MSG_LIST` | 3 |
| `src/components/business/CheckInButton.tsx` | `MSG_CHECKIN`, `MSG_AUTH` | 4 |
| `src/components/business/RecommendDialog.tsx` | `MSG_SOCIAL` | 2 |
| `src/components/lists/ListDetailScreen.tsx` | `MSG_LIST` | 7 |
| `src/components/menu/CreateListDialog.tsx` | `MSG_LIST` | 2 |
| `src/components/menu/SharedListDetailView.tsx` | `MSG_LIST` | 5 |
| `src/components/menu/InviteEditorDialog.tsx` | `MSG_LIST` | 2 |
| `src/components/menu/EditorsDialog.tsx` | `MSG_LIST` | 2 |
| `src/components/menu/FeedbackForm.tsx` | `MSG_FEEDBACK` | 1 |
| `src/components/menu/OnboardingChecklist.tsx` | `MSG_ONBOARDING` | 1 |
| `src/components/admin/FeaturedListsPanel.tsx` | `MSG_ADMIN` | 2 |
| `src/components/admin/AbuseAlerts.tsx` | (dynamic, keep inline) | 0 |
| `src/components/auth/DeleteAccountDialog.tsx` | `MSG_AUTH` | 1 |
| `src/components/onboarding/VerificationNudge.tsx` | `MSG_AUTH` | 4 |
| `src/context/ConnectivityContext.tsx` | `MSG_OFFLINE` | 3 |
| `src/hooks/useFollow.ts` | `MSG_SOCIAL` | 1 |
| `src/hooks/useSurpriseMe.ts` | `MSG_ONBOARDING` | 2 |

### Archivos a modificar (empty states y labels) -- Fase 2

| Archivo | Dominio | Reemplazos |
|---------|---------|------------|
| `src/components/business/BusinessRating.tsx` | `MSG_BUSINESS` | 1 |
| `src/components/business/BusinessPriceLevel.tsx` | `MSG_BUSINESS` | 1 |
| `src/components/business/MenuPhotoSection.tsx` | `MSG_BUSINESS` | 1 |
| `src/components/map/BusinessMarker.tsx` | `MSG_BUSINESS` | 1 |
| `src/components/map/MapView.tsx` | `MSG_BUSINESS` | 1 |
| `src/components/search/SearchListView.tsx` | `MSG_BUSINESS` | 1 |
| `src/components/notifications/NotificationList.tsx` | `MSG_COMMON` | 1 |
| `src/components/profile/NotificationsSection.tsx` | `MSG_COMMON` | 1 |
| `src/components/business/AddToListDialog.tsx` | `MSG_LIST` | 1 |
| `src/components/lists/CollaborativeTab.tsx` | `MSG_LIST` | 1 |
| `src/components/lists/RecentsUnifiedTab.tsx` | `MSG_CHECKIN` | 1 |
| `src/components/menu/CommentsList.tsx` | `MSG_COMMENT` | 3 |
| `src/components/menu/TrendingList.tsx` | `MSG_COMMON` | 1 |
| `src/components/menu/CheckInsView.tsx` | `MSG_CHECKIN` | 1 |
| `src/components/menu/RankingsEmptyState.tsx` | `MSG_COMMON` | 1 |
| `src/components/menu/FollowedList.tsx` | `MSG_SOCIAL` | 1 |
| `src/components/menu/StatsView.tsx` | `MSG_COMMON` | 1 |
| `src/components/menu/ActivityFeedView.tsx` | `MSG_SOCIAL` | 1 |
| `src/components/menu/SharedListsView.tsx` | `MSG_LIST` | 1 |
| `src/components/menu/PendingActionsSection.tsx` | `MSG_OFFLINE` | 1 |
| `src/components/menu/MyFeedbackList.tsx` | `MSG_FEEDBACK` | 1 |
| `src/components/menu/ReceivedRecommendations.tsx` | `MSG_SOCIAL` | 1 |
| `src/components/ui/OfflineIndicator.tsx` | `MSG_OFFLINE` | 2 |
| `src/components/UserSearchField.tsx` | `MSG_COMMON` | 2 |

**Nota:** `AbuseAlerts.tsx` tiene un toast con template string complejo y contextual (nombres de alerta). Se deja inline por ser contenido admin, no user-facing critico.

---

## Hooks

No se crean hooks nuevos. Los hooks `useFollow` y `useSurpriseMe` solo necesitan cambiar imports de strings a constantes.

---

## Servicios

Sin cambios en servicios. Los toasts se emiten desde componentes/hooks, no desde servicios.

---

## Integracion

### Barrel update

`src/constants/index.ts` debe agregar:

```typescript
export * from './messages';
```

### Patron existente respetado

El proyecto ya centraliza constantes por dominio en `src/constants/` (auth, feedback, business, etc.). Los archivos de mensajes siguen el mismo patron pero en un subdirectorio `messages/` para separar strings de configuracion de strings de UI copy.

### Test updates

Los tests existentes que verifican strings de toast deben actualizarse para importar las constantes o verificar contra ellas.

---

## Tests

Este refactor no agrega logica nueva. Los archivos de mensajes son constantes puras (excepcion de testing policy: "Constantes sin logica"). Sin embargo, hay dos aspectos a testear:

1. Los archivos que tienen funciones generadoras de strings (templates con parametros) necesitan un test minimo.
2. Los tests existentes que hacen assertions contra strings literales de toast deben actualizarse.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/constants/messages/messages.test.ts` | Funciones template: `MSG_LIST.editorInvited`, `MSG_LIST.favoritesAdded`, `MSG_OFFLINE.syncing/syncSuccess/syncFailed/noConnectionPending`, `MSG_ONBOARDING.surpriseSuccess`, `MSG_ADMIN.featuredToggleSuccess` | Unit |
| `src/components/onboarding/VerificationNudge.test.tsx` | Actualizar strings hardcodeados a usar constantes de `MSG_AUTH` | Update |
| `src/components/ui/OfflineIndicator.test.tsx` | Actualizar strings hardcodeados a usar constantes de `MSG_OFFLINE` | Update |

### Casos a cubrir (messages.test.ts)

- Template functions devuelven strings correctos con parametros tipicos
- `MSG_LIST.favoritesAdded(0)` devuelve mensaje "ya estaban"
- `MSG_LIST.favoritesAdded(1)` usa singular
- `MSG_LIST.favoritesAdded(5)` usa plural
- `MSG_OFFLINE.syncing(1)` usa singular
- `MSG_OFFLINE.syncing(3)` usa plural
- `MSG_OFFLINE.noConnectionPending(1)` sin "s"
- `MSG_OFFLINE.noConnectionPending(5)` con "s"

### Mock strategy

No se necesitan mocks. Son funciones puras.

### Criterio de aceptacion

- 100% cobertura en funciones template
- Tests existentes pasan con strings actualizados

---

## Analytics

Sin cambios. No se agregan eventos nuevos.

---

## Offline

Sin impacto. Este refactor no afecta comportamiento offline.

---

## Decisiones tecnicas

### 1. Subdirectorio `messages/` en vez de archivos planos en `constants/`

**Decision:** Crear `src/constants/messages/` como subdirectorio.

**Razon:** Ya hay 25 archivos en `src/constants/`. Agregar 12 mas los mezclaria con archivos de configuracion (thresholds, limits, regexes). El subdirectorio separa claramente copy de UI de configuracion tecnica.

### 2. Objetos `MSG_*` en vez de exports individuales

**Decision:** Exportar un objeto por dominio (`MSG_BUSINESS`, `MSG_LIST`) en vez de constantes individuales (`BUSINESS_RATING_SUCCESS`, `BUSINESS_RATING_ERROR`).

**Razon:** Namespace implicito evita colisiones de nombres. `MSG_BUSINESS.ratingError` es mas legible que `BUSINESS_RATING_ERROR`. El tree-shaking de Vite maneja objetos `as const` eficientemente.

### 3. Template functions para strings dinamicos

**Decision:** Usar funciones arrow `(param) => string` dentro del objeto `as const` para strings con interpolacion.

**Razon:** Mantiene la logica de pluralizacion/interpolacion junto al string base. Es testeable. El `as const` asegura tipado estricto en el return.

### 4. AbuseAlerts.tsx queda inline

**Decision:** No centralizar el toast de `AbuseAlerts.tsx`.

**Razon:** Es un toast admin con template string que incluye datos contextuales variables. No es user-facing critico y centralizarlo no aporta valor de auditoria.

### 5. Tildes y signos

**Decision:** Todos los strings centralizados deben usar tildes correctas y signos de apertura segun el patron de "Espanol argentino consistente" documentado en patterns.md.

**Razon:** Centralizar los strings es la oportunidad para corregir inconsistencias existentes (ej: algunos toasts ya usan tildes, otros no).
