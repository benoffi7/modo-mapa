# Specs: Refactor BusinessSheet -- Reducir scroll y mejorar navegacion

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

Este refactor es puramente frontend. No se agregan ni modifican colecciones de Firestore, documentos, ni indices. Todos los tipos existentes (`Rating`, `Comment`, `UserTag`, `CustomTag`, `PriceLevel`, `MenuPhoto`) se mantienen intactos.

No se crean tipos nuevos de Firestore. Los unicos tipos nuevos son interfaces de props locales para componentes React (ver seccion Componentes).

---

## Firestore Rules

Sin cambios. Este refactor no introduce nuevas queries ni modifica las existentes. Los datos siguen fluyendo desde `useBusinessData` (que no se modifica) hacia los componentes hijos via props.

### Rules impact analysis

No hay queries nuevas. Todas las queries existentes permanecen identicas en `useBusinessData.ts` y en los servicios invocados por los componentes (`services/comments.ts`, `services/ratings.ts`, etc.).

| Query (service file) | Collection | Auth context | Rule que permite | Cambio necesario? |
|----------------------|------------|-------------|-----------------|-------------------|
| Sin queries nuevas | -- | -- | -- | No |

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion.

| Collection | New/modified field | In create hasOnly()? | In update affectedKeys().hasOnly()? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| Sin cambios | -- | -- | -- | No |

---

## Cloud Functions

Sin cambios. No se agregan triggers, scheduled functions ni callables.

---

## Componentes

### BusinessSheetHeader (nuevo)

Componente sticky que encapsula el header, acciones y rating compacto. Reemplaza el bloque inline actual de BusinessSheet (lineas 162-210 aprox).

```typescript
interface BusinessSheetHeaderProps {
  business: Business;
  isTrending: boolean;
  ratings: Rating[];
  isLoading: boolean;
  onRatingChange: () => void;
  // Slots para botones de accion (patron existente de BusinessHeader)
  favoriteButton: ReactNode;
  shareButton: ReactNode;
  recommendButton?: ReactNode;
  addToListButton?: ReactNode;
  checkInButton: ReactNode;
}
```

**Donde se renderiza:** Dentro del scroll container de `SwipeableDrawer`, con `position: sticky; top: 0; zIndex: 2` y `bgcolor: 'background.paper'`.

**Contenido:**

1. `BusinessHeader` (existente, sin cambios) -- nombre, categoria, trending badge, botones de accion
2. `CheckInButton` (existente, centrado)
3. Rating compacto inline: promedio numerico + estrellas read-only + contador de opiniones + estrellas del usuario (si autenticado). Es el bloque de las lineas 172-197 de `BusinessRating.tsx` actual, sin la seccion de criterios expandible.

**Comportamiento:**

- Al hacer scroll, el header se pega al borde superior del drawer
- El drag handle queda por encima del header (no es sticky, scrollea con el contenido)
- Separador `Divider` debajo del header

### BusinessSheet (modificado)

Cambios principales:

1. Eliminar las secciones lineales apiladas (rating, price level, tags, menu photo, tabs comentarios/preguntas)
2. Reemplazar por `BusinessSheetHeader` + `Tabs` de MUI con 2 tabs (Info / Opiniones)
3. El state `activeTab` cambia de `'comments' | 'questions'` a `'info' | 'opiniones'`
4. El filtrado `regularComments` se mantiene, se pasa a tab Opiniones
5. Soporte para deep link `?business={id}&tab=info|opiniones`

```typescript
// Nuevo tipo para las tabs del sheet
type BusinessSheetTab = 'info' | 'opiniones';
```

**Layout resultante:**

```text
[drag handle]              <- scrollea
[BusinessSheetHeader]      <- position: sticky, top: 0
  BusinessHeader
  CheckInButton
  Rating compacto
[Divider]
[Tabs: Info | Opiniones]   <- sticky debajo del header
[Tab content]              <- scrollea
```

Las tabs tambien son sticky, pegadas justo debajo del header. Ambos sticky elements usan `position: sticky` con `top` calculado (header: `top: 0`, tabs: `top: {headerHeight}`). El calculo del top de las tabs usa un `ref` en el header para medir su altura.

### InfoTab (nuevo)

Contenido del tab "Info". Componente sin estado propio, recibe todo por props.

```typescript
interface InfoTabProps {
  businessId: string;
  businessName: string;
  business: Business;
  // CriteriaSection
  ratings: Rating[];
  isLoading: boolean;
  onRatingChange: () => void;
  // PriceLevel
  priceLevels: PriceLevel[];
  onPriceLevelChange: () => void;
  // Tags
  seedTags: string[];
  userTags: UserTag[];
  customTags: CustomTag[];
  onTagsChange: () => void;
  // MenuPhoto
  menuPhoto: MenuPhoto | null;
  onPhotoChange: () => void;
}
```

**Contenido (en orden):**

1. `CriteriaSection` (nuevo, extraido de BusinessRating)
2. `Divider`
3. `BusinessPriceLevel` (existente, sin cambios)
4. `Divider`
5. `BusinessTags` (existente, sin cambios)
6. `Divider`
7. `MenuPhotoSection` (existente, sin cambios)

### OpinionesTab (nuevo)

Wrapper para el tab "Opiniones". Contiene los sub-tabs existentes de Comentarios/Preguntas.

```typescript
interface OpinionesTabProps {
  businessId: string;
  businessName: string;
  comments: Comment[];
  regularComments: Comment[];
  userCommentLikes: Set<string>;
  isLoading: boolean;
  onCommentsChange: () => void;
  onDirtyChange: (dirty: boolean) => void;
}
```

**Contenido:**

1. Sub-tabs: Comentarios / Preguntas (reutiliza las `Tabs` de MUI que ya existen en BusinessSheet, lineas 232-240)
2. `BusinessComments` (existente, recibe `regularComments`)
3. `BusinessQuestions` (existente, recibe `comments`)

El state de la sub-tab (`'comments' | 'questions'`) vive dentro de `OpinionesTab`.

### CriteriaSection (nuevo, extraido de BusinessRating)

Componente que encapsula la seccion expandible de criterios (~lineas 199-264 de BusinessRating.tsx actual).

```typescript
interface CriteriaSectionProps {
  criteriaAverages: CriteriaAverages;
  myCriteria: RatingCriteria;
  myRating: number | null;
  hasCriteriaData: boolean;
  onCriterionRate: (criterionId: RatingCriterionId, value: number | null) => void;
}
```

**Comportamiento:**

- Toggle expand/collapse via `Chip` "Detalle por criterio" / "Ocultar detalle"
- Muestra promedios de criterios de todos los usuarios
- Muestra rating por criterio del usuario actual (con estrellas interactivas)
- El state `criteriaOpen` es local del componente
- Los handlers de rating de criterio se delegan al padre via `onCriterionRate`

### BusinessRating (modificado)

Queda como componente compacto. Se elimina todo el bloque de criterios (que se mueve a `CriteriaSection`). Lo que queda:

1. Promedio + estrellas read-only + contador
2. "Tu calificacion:" + estrellas interactivas + boton borrar (si autenticado)
3. Los handlers `handleRate`, `handleDeleteRating`, `handleCriterionRate` permanecen aca
4. Exporta `criteriaAverages`, `myCriteria`, `myRating`, `hasCriteriaData` al padre para pasarlos a `CriteriaSection`

Se modifica la interfaz para exponer los datos de criterios:

```typescript
interface BusinessRatingExposed {
  averageRating: number;
  totalRatings: number;
  myRating: number | null;
  myCriteria: RatingCriteria;
  criteriaAverages: CriteriaAverages;
  hasCriteriaData: boolean;
  handleCriterionRate: (criterionId: RatingCriterionId, value: number | null) => void;
}
```

Alternativa mas limpia: extraer la logica de rating a un hook `useBusinessRating` que retorne tanto los datos del rating compacto como los datos de criterios. Asi `BusinessSheetHeader` y `CriteriaSection` consumen del mismo hook sin prop drilling.

**Decision:** Usar el hook `useBusinessRating` (ver seccion Hooks).

### BusinessSheetSkeleton (modificado)

Se actualiza para reflejar el nuevo layout:

1. Skeleton del header (nombre, categoria, acciones, rating compacto)
2. Skeleton de las tabs (2 rectangulos)
3. Skeleton del contenido del tab activo

### Mutable prop audit

Ningun componente nuevo recibe datos como props y permite al usuario modificarlos directamente. Los componentes nuevos (`BusinessSheetHeader`, `InfoTab`, `OpinionesTab`, `CriteriaSection`) son wrappers de layout que delegan las mutaciones a los componentes existentes (que ya manejan su propio state optimista).

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| BusinessSheetHeader | ratings, business | rating del usuario (via estrellas) | NO (delegado a useBusinessRating) | onRatingChange |
| CriteriaSection | myCriteria, criteriaAverages | rating por criterio | NO (state en useBusinessRating) | onCriterionRate |
| InfoTab | multiples | precio, tags, foto | NO (cada sub-componente maneja su state) | callbacks individuales |
| OpinionesTab | comments | comentarios, preguntas | sub-tab activa (local) | onCommentsChange, onDirtyChange |

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Info" | Tab label en BusinessSheet | Sin tilde |
| "Opiniones" | Tab label en BusinessSheet | Sin tilde |
| "Comentarios" | Sub-tab label en OpinionesTab | Ya existe |
| "Preguntas" | Sub-tab label en OpinionesTab | Ya existe |
| "Detalle por criterio" | Chip en CriteriaSection | Ya existe en BusinessRating |
| "Ocultar detalle" | Chip en CriteriaSection | Ya existe en BusinessRating |

---

## Hooks

### useBusinessRating (nuevo)

Extrae la logica de calculo y mutacion de rating de `BusinessRating.tsx`. Permite que `BusinessSheetHeader` (rating compacto) y `CriteriaSection` (criterios expandibles) consuman la misma fuente de datos sin duplicar logica.

```typescript
interface UseBusinessRatingParams {
  businessId: string;
  businessName?: string;
  ratings: Rating[];
  isLoading: boolean;
  onRatingChange: () => void;
}

interface UseBusinessRatingReturn {
  averageRating: number;
  totalRatings: number;
  myRating: number | null;
  myCriteria: RatingCriteria;
  criteriaAverages: CriteriaAverages;
  hasCriteriaData: boolean;
  handleRate: (event: unknown, value: number | null) => Promise<void>;
  handleDeleteRating: () => Promise<void>;
  handleCriterionRate: (criterionId: RatingCriterionId, value: number | null) => Promise<void>;
}
```

**Dependencias:** `useAuth`, `useToast`, `useConnectivity`, `withOfflineSupport`, `upsertRating`, `deleteRating`, `upsertCriteriaRating`.

**Caching:** Sin cache propio. Consume `ratings` del padre que ya viene cacheado via `useBusinessData`.

### useCommentListBase (nuevo)

Hook que encapsula la logica compartida entre `BusinessComments` y `BusinessQuestions`. Reduce ~150 lineas de duplicacion.

```typescript
interface UseCommentListBaseParams {
  businessId: string;
  businessName?: string;
  comments: Comment[];
  userCommentLikes: Set<string>;
  onCommentsChange: () => void;
  deleteMessage: string;
}

interface UseCommentListBaseReturn {
  // Auth
  user: User | null;
  displayName: string;
  // Connectivity
  isOffline: boolean;
  // Profile visibility
  profileVisibility: Map<string, boolean>;
  // Undo delete
  isPendingDelete: (id: string) => boolean;
  handleDelete: (comment: Comment) => void;
  deleteSnackbarProps: SnackbarProps;
  // Optimistic likes
  isLiked: (commentId: string) => boolean;
  getLikeCount: (commentId: string, serverCount: number) => number;
  handleToggleLike: (commentId: string) => Promise<void>;
  // Reply state
  replyingTo: { id: string; userName: string } | null;
  replyText: string;
  replyInputRef: RefObject<HTMLInputElement>;
  setReplyText: (text: string) => void;
  handleStartReply: (comment: Comment) => void;
  handleCancelReply: () => void;
  handleSubmitReply: () => Promise<void>;
  isSubmitting: boolean;
  // Profile
  profileUser: { id: string; name: string } | null;
  handleShowProfile: (userId: string, userName: string) => void;
  closeProfile: () => void;
  // Rate limit
  userCommentsToday: number;
}
```

**Logica compartida extraida:**

1. Hooks base: `useAuth`, `useToast`, `useConnectivity`
2. `useProfileVisibility(commentUserIds)`
3. `useUndoDelete` con `deleteComment`
4. `useOptimisticLikes` con `likeComment`/`unlikeComment` + `withOfflineSupport`
5. Reply state management (replyingTo, replyText, replyInputRef, submit, cancel)
6. Profile user state (profileUser, handleShowProfile, closeProfile)
7. `handleToggleLike` con error handling y toast
8. `userCommentsToday` calculation
9. `isSubmitting` state

**Logica que NO se extrae (queda en cada componente):**

- `BusinessComments`: sorting (useCommentSort no, es inline), useCommentEdit, useCommentThreads, dirty tracking, submit comment
- `BusinessQuestions`: useQuestionThreads, submit question, best answer logic, noopEdit handlers

**Parametro `expandThread`:** El reply handler necesita expandir el thread al responder. Se recibe como parametro opcional:

```typescript
interface UseCommentListBaseParams {
  // ...
  expandThread?: (id: string) => void;
}
```

---

## Servicios

Sin cambios. Todos los servicios existentes (`services/comments.ts`, `services/ratings.ts`, etc.) se mantienen intactos. `useBusinessData` no se modifica.

---

## Integracion

### BusinessSheet.tsx

1. Importar `BusinessSheetHeader`, `InfoTab`, `OpinionesTab`
2. Instanciar `useBusinessRating` con los datos de `useBusinessData`
3. Eliminar el bloque de secciones lineales (lineas 162-260)
4. Reemplazar con: `BusinessSheetHeader` (sticky) + `Tabs` (sticky) + contenido del tab activo
5. Cambiar `activeTab` state de `'comments' | 'questions'` a `BusinessSheetTab` (`'info' | 'opiniones'`)
6. Pasar `onDirtyChange` y `commentsDirty` al tab Opiniones
7. Agregar `headerRef` para medir la altura del header sticky

### useDeepLinks.ts

1. Agregar lectura del parametro `sheetTab` del URL: `?business={id}&tab=opiniones`
2. El parametro `tab` ya se usa para las tabs de la app (`inicio`, `social`, etc.). Para evitar conflicto, usar un nuevo parametro `sheetTab` con valores `info|opiniones`
3. Exponer el `sheetTab` via un nuevo state en `SelectionContext` o retornarlo desde el hook

**Decision:** Agregar `selectedBusinessTab` a `SelectionContext` para que BusinessSheet pueda leerlo. Cuando `useDeepLinks` detecta `?business=X&sheetTab=opiniones`, setea `setSelectedBusiness(biz)` y `setSelectedBusinessTab('opiniones')`.

### SelectionContext (MapContext.tsx)

Agregar:

```typescript
selectedBusinessTab: BusinessSheetTab | null;
setSelectedBusinessTab: (tab: BusinessSheetTab | null) => void;
```

Default: `null` (BusinessSheet usa 'info' cuando es null).

### analyticsEvents.ts

Agregar:

```typescript
export const EVT_BUSINESS_SHEET_TAB_CHANGED = 'business_sheet_tab_changed';
```

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/__tests__/useBusinessRating.test.ts` | Calculo de promedios, rating optimista, delete rating, criterion rating, error handling | Hook |
| `src/hooks/__tests__/useCommentListBase.test.ts` | Inicializacion, likes optimistas, undo delete, reply flow, rate limit, profile visibility | Hook |
| `src/components/business/__tests__/CriteriaSection.test.tsx` | Expand/collapse, render promedios, interaccion estrellas, disabled sin rating global | Component |
| `src/components/business/__tests__/BusinessSheetHeader.test.tsx` | Render con/sin trending, con/sin usuario, rating compacto, sticky positioning | Component |
| `src/components/business/__tests__/BusinessSheet.test.tsx` | Tab switching, deep link sheetTab, default tab, skeleton while loading | Component |

### Casos a cubrir

- `useBusinessRating`: calculo correcto con 0, 1, N ratings; optimistic update y revert; criterio individual update y revert; first rating toast
- `useCommentListBase`: toggleLike success/error, delete + undo, reply submit + cancel, userCommentsToday calc, profile visibility delegation
- `CriteriaSection`: toggle abre/cierra, no render si no hay datos y no hay user, estrellas de criterio disabled sin myRating, llamada a onCriterionRate
- `BusinessSheetHeader`: render nombre/categoria/trending, botones de accion condicionales, rating promedio con estrellas
- `BusinessSheet`: tab cambia contenido visible, deep link abre tab correcta, skeleton durante loading

### Mock strategy

- Firestore: mock SDK functions (patron existente)
- `useAuth`: mock context
- `useToast`: mock context
- `useConnectivity`: mock `{ isOffline: false }`
- `withOfflineSupport`: mock que ejecuta la accion directamente
- `useBusinessData`: mock return value

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos (tabs, auth states, offline)
- Side effects verificados (analytics `business_sheet_tab_changed`, deep link update)

---

## Analytics

| Evento | Parametros | Donde se dispara |
|--------|-----------|-----------------|
| `business_sheet_tab_changed` | `{ business_id: string, tab: 'info' \| 'opiniones', previous_tab: string }` | BusinessSheet, al cambiar de tab |

Se usa la constante `EVT_BUSINESS_SHEET_TAB_CHANGED` de `constants/analyticsEvents.ts`.

---

## Offline

Este refactor no modifica el flujo de datos. Todos los componentes reorganizados siguen recibiendo datos de `useBusinessData` que ya tiene soporte offline completo (3-tier cache + `withOfflineSupport` para escrituras).

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Tab activa del sheet | State local React | Session | RAM |
| Todos los datos del comercio | Sin cambio (`useBusinessData`) | 5min memory / 24h IndexedDB | Memory + IDB |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Todas las escrituras | Sin cambio (`withOfflineSupport` existente) | Last-write-wins (existente) |

### Fallback UI

Sin cambios. `StaleBanner` y `OfflineIndicator` existentes cubren todos los estados offline.

---

## Decisiones tecnicas

### 1. Hook `useBusinessRating` en lugar de prop drilling

**Decision:** Extraer la logica de rating a un hook que se instancia una vez en `BusinessSheet` y sus valores se pasan tanto a `BusinessSheetHeader` (rating compacto) como a `CriteriaSection` (criterios expandibles).

**Alternativa:** Dejar la logica en `BusinessRating` y hacer que exporte un ref imperativo. Rechazada porque rompe el patron declarativo del proyecto.

**Alternativa:** Duplicar el calculo en ambos componentes. Rechazada por DRY y por el riesgo de divergencia.

### 2. Dos tabs en lugar de tres

**Decision:** 2 tabs (Info / Opiniones). La foto de menu va dentro del tab Info.

**Razon:** No hay fotos del local mas alla de la foto de menu. Un tab "Fotos" con un solo item seria un tab casi vacio que degrada la UX. Cuando se implemente `#fotos-local`, se puede agregar el tercer tab.

### 3. Deep link con `sheetTab` en lugar de reutilizar `tab`

**Decision:** Usar `?sheetTab=opiniones` como parametro separado de `?tab=social`.

**Razon:** El parametro `tab` ya se usa en `useDeepLinks` para navegar entre las 5 tabs principales de la app. Reutilizarlo crearia ambiguedad. Un parametro separado es explicito y no requiere logica de disambiguation.

### 4. Sticky header con CSS puro

**Decision:** Usar `position: sticky` en el header y las tabs, sin libreria adicional.

**Razon:** CSS sticky funciona nativamente dentro del scroll container del `SwipeableDrawer`. No requiere calculo de scroll position ni IntersectionObserver. El unico detalle es medir la altura del header para calcular el `top` de las tabs (se usa un `ref` + `ResizeObserver` o simplemente un valor fijo ya que el header tiene altura predecible).

### 5. useCommentListBase como hook, no como HOC ni render props

**Decision:** Hook que retorna state y handlers. Los componentes `BusinessComments` y `BusinessQuestions` lo consumen y componen su UI particular.

**Razon:** Consistente con el patron del proyecto (hooks extraidos como `useOptimisticLikes`, `useUndoDelete`, etc.). Un HOC o render props agregarian indirection innecesaria.

### 6. Fade transition entre tabs

**Decision:** Incluir como nice-to-have. Se implementa con CSS `@keyframes fadeIn` (200ms), reutilizando la animacion que ya existe en BusinessSheet (linea 151). Se aplica al contenido del tab activo via una `key` que cambia con el tab, forzando re-mount con animacion.

**Alternativa:** `React.TransitionGroup` o `framer-motion`. Rechazadas por agregar dependencias innecesarias para una transicion tan simple.
