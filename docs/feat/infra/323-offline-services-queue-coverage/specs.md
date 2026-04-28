# Specs: Offline — services not using offlineQueue / withOfflineSupport

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-25
**Issue:** [#323](https://github.com/benoffi7/modo-mapa/issues/323)

---

## Resumen tecnico

El feature **no introduce** colecciones nuevas de Firestore, ni rules nuevas, ni Cloud Functions nuevas. Todo el trabajo vive en tres capas:

1. **`src/types/offline.ts`** — 3 nuevos `OfflineActionType` + 3 nuevas interfaces de payload.
2. **`src/services/syncEngine.ts`** — 3 nuevos branches en `executeAction`.
3. **`src/services/offlineInterceptor.ts`** — sin cambios de firma.
4. **Callers (`src/components/*`, `src/hooks/*`)** — 13+ callsites pasan a estar wrappeados o gated. La logica vive en el caller, no en el service.
5. **`scripts/pre-staging-check.sh`** — extension con greps de callers que detecten violaciones de contrato S1, mas un Check 7 dedicado que veta `withOfflineSupport('list_delete', ...)` (B2 Ciclo 2).
6. **0 hooks nuevos.** El hook `usePendingActions` propuesto en Ciclo 1 fue **eliminado del scope #323** (B1 Ciclo 2 — decision usuario opcion (a)). Tracked como follow-up cuando la UI de comments tenga optimistic UI con id correlacionable.

---

## Modelo de datos

### Tipos nuevos en `src/types/offline.ts`

#### Extension de `OfflineActionType`

```ts
export type OfflineActionType =
  | 'rating_upsert'
  | 'rating_delete'
  | 'comment_create'
  | 'favorite_add'
  | 'favorite_remove'
  | 'price_level_upsert'
  | 'price_level_delete'
  | 'tag_add'
  | 'tag_remove'
  | 'comment_like'
  | 'comment_unlike'
  | 'checkin_create'
  | 'checkin_delete'
  | 'follow_add'
  | 'follow_remove'
  | 'recommendation_create'
  | 'recommendation_read'
  | 'list_create'
  | 'list_update'
  | 'list_toggle_public'
  | 'list_delete'           // conservado: branch defensivo para queues pre-#323 (S2.1)
  | 'list_item_add'
  | 'list_item_remove'
  // NEW (#323)
  | 'comment_edit'
  | 'comment_delete'
  | 'rating_criteria_upsert';
```

Total final del enum: **26** (23 + 3).

#### Nuevas interfaces de payload

```ts
/** Edit de comment ya sincronizado. Replay → editComment(commentId, userId, text). */
export interface CommentEditPayload {
  commentId: string;
  text: string;
}

/** Delete de comment ya sincronizado. Replay → deleteComment(commentId, userId).
 * onCommentDeleted Cloud Function se encarga del cascade server-side. */
export interface CommentDeletePayload {
  commentId: string;
}

/** Upsert parcial de un criterio individual de rating.
 * Replay → upsertCriteriaRating(userId, businessId, { [criterionId]: value }).
 * El service hace merge no-destructivo con criterios existentes. */
export interface RatingCriteriaUpsertPayload {
  criterionId: string;
  value: number; // 1-5, validado por el service
}
```

#### Extension de la union `OfflineActionPayload`

Diff conceptual sobre la union actual (`src/types/offline.ts:49-68`). Solo se agregan 3 variantes nuevas; el resto del orden y `EmptyPayload` al final se mantienen tal como estan hoy.

```diff
 export type OfflineActionPayload =
   | RatingUpsertPayload
   | RatingDeletePayload
   | CommentCreatePayload
   | FavoriteTogglePayload
   | PriceLevelUpsertPayload
   | PriceLevelDeletePayload
   | TagTogglePayload
   | CommentLikePayload
   | CheckinCreatePayload
   | CheckinDeletePayload
   | FollowPayload
   | RecommendationPayload
   // Lists domain (#304)
   | ListCreatePayload
   | ListUpdatePayload
   | ListTogglePublicPayload
   | ListDeletePayload
   | ListItemAddPayload
+  // NEW (#323)
+  | CommentEditPayload
+  | CommentDeletePayload
+  | RatingCriteriaUpsertPayload
   | EmptyPayload;
```

**Nota Importante #3 Ciclo 2:** la union completa (incluyendo `ListItemRemovePayload` etc. si la rama actual los tuviera) debe leerse desde el archivo en disco al momento de implementar; este diff agrega exclusivamente las 3 lineas marcadas con `+`. Si entre Ciclo 2 y la implementacion algun otro feature toca la union, el diff se aplica igual sobre la version vigente.

#### Notas

- `OfflineAction` (estructura del documento IndexedDB) **no cambia**: ya soporta `referenceId` y `listId` opcionales. `comment_edit`/`comment_delete` reusan `businessId` (cuyo valor es el `businessId` del comment para el evento `EVT_OFFLINE_ACTION_QUEUED`). El `commentId` real va dentro del payload.
- No hay validacion runtime de la discriminated union (consistente con el resto de la queue). El `as` cast en `syncEngine` se hace solo dentro de cada `case`.

---

## Firestore Rules

**Sin cambios.** Este feature no modifica `firestore.rules`.

### Rules impact analysis

| Query (replay path en syncEngine) | Collection | Auth context | Rule que la permite | Cambio? |
|----------------------------------|-----------|-------------|---------------------|---------|
| `editComment(commentId, userId, text)` | `comments` | usuario autenticado, doc del usuario | `affectedKeys().hasOnly(['text','updatedAt'])` + ownership existente | NO |
| `deleteComment(commentId, userId)` | `comments` | usuario autenticado, doc del usuario | rule existente para `delete: if isAuthor()` | NO |
| `upsertCriteriaRating(userId, businessId, partial)` | `ratings` | usuario autenticado, doc del usuario | rule existente para upsert con merge | NO |

Las tres operaciones ya existen online (callers actuales las invocan). El sync engine solo las re-ejecuta tras reconectar; pasan por las mismas rules. **No hay nueva superficie de escritura.**

### Field whitelist check

| Collection | Campo nuevo/modificado | Cambio? |
|-----------|----------------------|---------|
| `comments` | ninguno (replay reutiliza editComment/deleteComment existente) | NO |
| `ratings` | ninguno (replay reutiliza upsertCriteriaRating) | NO |

---

## Cloud Functions

**Sin cambios.** El feature no agrega ni modifica Cloud Functions. Las funciones existentes (`onCommentDeleted`, `onCommentUpdated`) absorben los replays sin diferencia respecto a online.

**Nota tecnica (S5 PRD, re-moderacion):** el replay de `comment_edit` produce el mismo `update` que un edit online. El trigger `onCommentUpdated` (`functions/src/triggers/comments.ts:113-142`) levanta el flag `flagged: true` si el nuevo texto pasa moderacion. Sticky moderation (preservar flag tras edit) es out-of-scope.

---

## Seed Data

**N/A.** El feature no introduce colecciones nuevas ni campos requeridos en colecciones existentes.

---

## Componentes

### Componentes modificados (no se crean nuevos)

#### `src/components/business/BusinessComments.tsx`

- **Editar comment (line 163, `handleSaveEdit`)**: wrappear `editComment(...)` con `withOfflineSupport('comment_edit', ...)`.
- **Botones Edit/Delete por fila**: **NO se gatea por `comment_create` pendiente** (B1 Ciclo 2 — out of scope). Si el usuario crea un comment offline y lo edita/elimina antes de reconectar, el replay del edit/delete falla con doc-no-existe → `OFFLINE_MAX_RETRIES` → `toast.error` informativo. Documentado como **limitacion conocida** y trackeado como follow-up.
- **Snackbar diferenciado**: `useCommentListBase` ya retorna `deleteSnackbarProps`; el componente debe leer `isOffline` del base y omitir el `action="Deshacer"` cuando offline (ver S3.1 PRD).

#### `src/components/profile/CommentsList.tsx`

- **Edit (line 70)**: wrappear con `withOfflineSupport('comment_edit', ...)`.
- **Delete (line 52)**: wrappear con `withOfflineSupport('comment_delete', ...)` dentro de `onConfirmDelete`. El `useUndoDelete` setTimeout sigue siendo 5000ms (real default del hook, no 4000ms como menciona el PRD a titulo descriptivo).
- **Snackbar (line 226-235)**: usar `useConnectivity().isOffline` para decidir si renderizar el `<Button>Deshacer</Button>` como `action`. Si `isOffline=true`, no renderizar action y sustituir `message` por `"Eliminado offline (se sincronizará cuando vuelvas online)"`.

#### `src/components/lists/ListDetailScreen.tsx`

- **`handleColorChange`/`handleIconChange` (lines 74-81, 138-148)**: wrappear `updateList(...)` con `withOfflineSupport('list_update', ...)`.
- **`handleTogglePublic` (lines 83-94)**: wrappear `toggleListPublic(...)` con `withOfflineSupport('list_toggle_public', ...)`.
- **`handleDelete` (lines 106-115)**: gated. Antes del `await deleteList(...)`, agregar `if (isOffline) { toast.warning(MSG_OFFLINE.deleteListBlocked); setConfirmDeleteOpen(false); return; }`. Boton "Eliminar lista" en toolbar (line 181) debe estar `disabled={isOffline}`. Boton confirmar del Dialog (line 284) debe estar `disabled={isOffline}` con `title={isOffline ? 'Requiere conexión' : undefined}`.
- **`handleRemoveItem` (lines 117-127)**: wrappear con `withOfflineSupport('list_item_remove', ...)`.
- **OfflineIndicator visible**: la pantalla se renderiza fuera de `TabShell` (es un panel modal). Tras subir `<OfflineIndicator />` al `App.tsx` root (S4 PRD), este componente lo recibira automaticamente.

#### `src/components/business/AddToListDialog.tsx`

- **`handleToggle` (lines 90-109)**: wrappear `addBusinessToList`/`removeBusinessFromList` con `withOfflineSupport('list_item_add'|'list_item_remove', ...)`.
- **`handleCreate` (lines 111-132)**: wrappear `createList` con `withOfflineSupport('list_create', ...)`. Pasar `listId` cliente-side via `generateListId()` para optimistic UI consistente con #304.

#### `src/components/lists/CreateListDialog.tsx`

- **`handleCreate` (lines 40-60)**: wrappear `createList(...)` con `withOfflineSupport('list_create', ...)` con `listId` generado en cliente. Optimistic UI: el callback `onCreated(listId, name, desc, icon)` puede dispararse igual offline (devuelve el listId pre-generado).

#### `src/components/lists/FavoritesList.tsx`

- **`handleRemoveFavorite` (lines 98-104)**: wrappear `removeFavorite(...)` con `withOfflineSupport('favorite_remove', ...)`. Es la unica llamada a `removeFavorite` que NO esta wrappeada hoy (`FavoriteButton` si lo esta).

#### `src/components/lists/EditorsDialog.tsx`

- **YA tiene `isOffline` gate** (line 64-67) y `disabled={removing === editor.uid || isOffline}` (line 102). **Confirmar y agregar test** que el caller respeta offline.

#### `src/components/lists/InviteEditorDialog.tsx`

- **YA tiene `disabled={isInviting || !email.trim() || isOffline}`** (line 58). **Confirmar y agregar test**.

#### `src/components/auth/DeleteAccountDialog.tsx`

- **YA tiene `isOffline` guard** (line 52) y `disabled={formDisabled}` con `formDisabled = !password || loading || isOffline` (line 79). **Confirmar y agregar test**. Ajustar copy del Alert (line 95-99) si hace falta voseo: ya esta correcto (`"Necesitás conexión a internet para eliminar tu cuenta."`).

#### `src/components/profile/SettingsMenu.tsx`

- **`handleConfirm` (line 56)**: agregar guard `if (isAnonymous && isOffline) { setError(MSG_OFFLINE.cleanAnonOffline); return; }` antes del `cleanAnonymousData()`. Boton "Empezar de cero" con `disabled={loading || (isAnonymous && isOffline)}`.

#### `src/components/profile/FeedbackForm.tsx`

- **`handleSubmit` (line 86)**: gated. Boton submit con `disabled={isSubmitting || !message.trim() || isOffline}`. Si el usuario abre el form y va offline, mostrar Alert "Necesitás conexión para enviar feedback (incluye archivos)".

#### `src/components/profile/MyFeedbackList.tsx`

- **`handleToggle` (line 63)**: agregar `if (useConnectivity().isOffline) return;` antes del `markFeedbackViewed`. Es fire-and-forget, no es critico.

#### `src/components/business/MenuPhotoUpload.tsx`

- Boton de seleccionar archivo: `disabled={isOffline}` con tooltip "Requiere conexión". Si el componente abre un dialog, agregar Alert "Necesitás conexión para subir fotos".

#### `src/components/business/MenuPhotoViewer.tsx`

- **YA esta gated** (PRD line 89). Confirmar test.

#### `src/components/social/ReceivedRecommendations.tsx`

- **`useEffect` (lines 52-59)**: wrappear `markAllRecommendationsAsRead(userId)` con guard `if (isOffline) return;`. Es batch write, no encolable. El badge se reconcilia al re-fetch tras volver online.

#### `src/components/admin/SpecialsPanel.tsx` + `AchievementsPanel.tsx`

- **`saveAllSpecials` (line 87)** y **`saveAllAchievements` (line 84)**: gated. Boton "Guardar" con `disabled={saving || isOffline}` con tooltip "Requiere conexión".

### Mutable prop audit

No aplica. El feature no cambia la forma en que los componentes reciben datos como props ni introduce nuevos editable details.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|--------------------|-----------------|
| `ListDetailScreen` (existing) | `list: SharedList` | `color, isPublic, itemCount, editorIds, icon` (existente) | YES (ya lo hace) | `onBack(updated)` (ya lo hace) |

### Component hierarchy change: OfflineIndicator

**Mover** `<OfflineIndicator />` desde `src/components/layout/TabShell.tsx:71` al root en `src/App.tsx`, dentro del `<ConnectivityProvider>` y por encima de `<Routes>`. Es `position: fixed` asi que no rompe layout. Garantiza visibilidad en cualquier ruta (BusinessDetailScreen, ListDetailScreen, MenuPhotoViewer, dialogs de auth).

```tsx
// src/App.tsx (pseudo)
<ConnectivityProvider>
  <NotificationsProvider>
    <OfflineIndicator />  {/* NUEVO: aqui */}
    <Routes>...</Routes>
  </NotificationsProvider>
</ConnectivityProvider>
```

Eliminar el render duplicado en `TabShell.tsx:71`.

---

## Textos de usuario

Todos los textos nuevos van a `src/constants/messages/offline.ts`. Voseo verificado.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `"No podés eliminar listas sin conexión, intentá de nuevo cuando vuelvas online"` | toast en `ListDetailScreen.handleDelete` | voseo + tildes |
| `"Eliminado offline (se sincronizará cuando vuelvas online)"` | snackbar `useCommentListBase`/`CommentsList` cuando `isOffline` | sin "Deshacer" |
| `"Sincronizando..."` | badge en row de comment con `comment_edit` pendiente | reusar copy de `OfflineIndicator` si conviene |
| `"Necesitás conexión estable para eliminar tu cuenta — esta acción es irreversible"` | toast/Alert en `DeleteAccountDialog` | voseo (correccion OBS#5 PRD) |
| `"Necesitás conexión para enviar feedback"` | Alert en `FeedbackForm` | voseo (correccion OBS#5 PRD) |
| `"Necesitás conexión para limpiar tus datos anónimos"` | error en `SettingsMenu` | voseo |
| `"Necesitás conexión para subir fotos"` | Alert en `MenuPhotoUpload` | voseo |
| `"Requiere conexión"` | tooltip generico en botones gated | reusar |

### Nuevas keys en `src/constants/messages/offline.ts`

Solo se listan las **keys nuevas** que el feature agrega al objeto `MSG_OFFLINE` existente (Importante #4 Ciclo 2 — evitar copy/paste descuidado). Las keys actuales (`syncing`, `syncSuccess`, `syncFailed`, `noConnection`, `noConnectionPending`, `emptyPending`) **no se tocan**.

```ts
// src/constants/messages/offline.ts — agregar al objeto existente:

deleteListBlocked: 'No podés eliminar listas sin conexión, intentá de nuevo cuando vuelvas online',
commentDeletedOffline: 'Eliminado offline (se sincronizará cuando vuelvas online)',
commentEditingSync: 'Sincronizando...',
deleteAccountOffline: 'Necesitás conexión estable para eliminar tu cuenta — esta acción es irreversible',
feedbackOffline: 'Necesitás conexión para enviar feedback',
cleanAnonOffline: 'Necesitás conexión para limpiar tus datos anónimos',
uploadPhotoOffline: 'Necesitás conexión para subir fotos',
requiresConnection: 'Requiere conexión',
```

`waitingSync` queda **fuera** porque el gate "Esperando sincronización" desaparece del scope (B1 Ciclo 2). El test `MSG_OFFLINE` (`offline.test.ts`) debe extenderse para cubrir las 8 keys nuevas.

---

## Hooks

### Hook eliminado del scope: ~~`usePendingActions`~~ (B1 Ciclo 2)

**Decision usuario Ciclo 2 (opcion (a)):** el hook `usePendingActions` queda **fuera del scope de #323**. No se crea el archivo `src/hooks/usePendingActions.ts` ni el test asociado.

**Por que se baja:**

- El hook propuesto en Ciclo 1 servia para deshabilitar Edit/Delete sobre un comment con `comment_create` pendiente.
- La correlacion entre el `commentId` cliente y el `actionId` del `comment_create` enqueado requiere optimistic UI con id temporal (que hoy `useCommentListBase.handleSubmitReply` no expone).
- Implementarlo con una heuristica fragil (businessId + userId + createdAt) o agregar plumbing que no se va a consumir es scope creep.

**Limitacion conocida (resultado de bajar el hook):**

> Si un usuario crea un comment offline (encolado como `comment_create`) y antes de reconectar lo edita o elimina, los replays subsiguientes (`comment_edit`/`comment_delete`) referenciaran un `commentId` que **todavia no existe** en Firestore. El syncEngine ejecutara `comment_create` primero (orden por `createdAt`) y luego intentara `comment_edit`/`comment_delete`; si la timing del cliente fue mas rapida que el rondtrip, el doc ya esta — todo bien. Si el `commentId` que la UI uso era temporal (no el id final de Firestore), el replay falla con doc-no-existe → `OFFLINE_MAX_RETRIES` → `toast.error` visible al usuario despues de reconectar.

Esta limitacion se acepta deliberadamente. Tracked como **follow-up issue** para implementar id correlacionable cuando la demanda lo justifique. Documentado en `docs/reference/guards/304-offline.md` (paso del plan en Fase E).

**Tests removidos del scope:**

- `src/hooks/__tests__/usePendingActions.test.ts` — eliminado del listado.
- `BusinessComments.editOffline.test.tsx` — se mantiene para "edit offline → enquea + toast", pero **se elimina** la asercion "boton disabled + tooltip cuando hasPendingCreate".

**Tests que se mantienen (replay con doc-no-existe → toast.error):**

- `src/services/__tests__/syncEngine.commentEdit.test.ts` debe cubrir el caso "commentId no existe en server" → `editComment` lanza → reintentos → `failed` → analytics `EVT_OFFLINE_ACTION_FAILED` (existente).
- Idem para `comment_delete`.

### Hook modificado: `src/hooks/useUserSettings.ts`

**Cambio principal:** agregar flush effect que escribe el state local completo al volver online.

**Implementation pseudocode:**

```ts
// Agregar al hook:
const { isOffline } = useConnectivity();
const pendingSettingsRef = useRef<Partial<UserSettings> | null>(null);

const updateSetting = useCallback((key, value) => {
  if (!user) return;
  setOptimistic((prev) => ({ ...prev, [key]: value }));

  if (isOffline) {
    // Acumular en ref (no enviar a Firestore)
    pendingSettingsRef.current = { ...(pendingSettingsRef.current ?? {}), [key]: value };
    return;
  }

  updateUserSettings(user.uid, { [key]: value }).catch((err) => {
    logger.error('[useUserSettings] updateUserSettings failed:', err);
    setOptimistic((prev) => { const next = { ...prev }; delete next[key]; return next; });
    toast.warning(MSG_COMMON.settingUpdateError);
  });
}, [user, toast, isOffline]);

// Flush effect al reconectar
useEffect(() => {
  let cancelled = false;
  if (!isOffline && user && pendingSettingsRef.current) {
    const snapshot = pendingSettingsRef.current;
    pendingSettingsRef.current = null;
    updateUserSettings(user.uid, snapshot).catch((err) => {
      if (cancelled) return;
      logger.error('[useUserSettings] flush failed:', err);
      toast.warning(MSG_COMMON.settingUpdateError);
    });
  }
  return () => { cancelled = true; };
}, [isOffline, user, toast]);
```

**Aplicar el mismo patron** a `updateLocality`, `clearLocality`, `updateDigestFrequency`. Cada uno acumula su valor parcial en `pendingSettingsRef.current` cuando offline.

**Nota multi-tab (S5 PRD):** el flush escribe el snapshot de la tab que reconecta. No hace merge con server. Si dos tabs hacen cambios offline distintos, la ultima en sincronizar gana. Documentado en S5 PRD; sin codigo adicional.

### Hook modificado: `src/hooks/useBusinessRating.ts`

**Cambio:** wrappear `upsertCriteriaRating` con `withOfflineSupport`.

```ts
// handleCriterionRate (line 142):
const handleCriterionRate = useCallback(async (criterionId, value) => {
  if (!user || !value) return;
  setPendingCriteria((prev) => ({ ...(prev ?? {}), [criterionId]: value }));
  try {
    await withBusyFlag('rating_submit', async () => {
      await withOfflineSupport(
        isOffline,
        'rating_criteria_upsert',
        { userId: user.uid, businessId, businessName },
        { criterionId, value },
        () => upsertCriteriaRating(user.uid, businessId, { [criterionId]: value }),
        toast,
      );
    });
    onRatingChange();
  } catch {
    setPendingCriteria((prev) => { ... });
    toast.error(MSG_BUSINESS.criteriaError);
  }
}, [user, businessId, businessName, isOffline, onRatingChange, toast]);
```

### Hook modificado: `src/hooks/useCommentListBase.ts`

**Cambio:** wrappear el `deleteComment` dentro de `onConfirmDeleteComment`.

```ts
const onConfirmDeleteComment = useCallback(async (comment) => {
  if (!user) return;
  await withOfflineSupport(
    isOffline,
    'comment_delete',
    { userId: user.uid, businessId, businessName },
    { commentId: comment.id },
    () => deleteComment(comment.id, user.uid),
    toast,
  );
}, [user, isOffline, businessId, businessName, toast]);
```

**Snackbar offline (S3.1 PRD):** el `deleteSnackbarProps` retorna del `useUndoDelete`. Cuando `isOffline`, el caller (`BusinessComments`/`CommentsList`) decide si renderizar `<Button>Deshacer</Button>` como `action`. **No se modifica `useUndoDelete` ni la firma de `withOfflineSupport`.** El message se sustituye por `MSG_OFFLINE.commentDeletedOffline`.

**Online path = sin cambios funcionales:** `withOfflineSupport` con `isOffline=false` ejecuta `onlineAction` directamente. El setTimeout 5000ms del `useUndoDelete` sigue funcionando como hoy: si el usuario presiona "Deshacer" antes del timeout, `confirmDelete` nunca se invoca y `withOfflineSupport` nunca se llama.

### Hooks modificados: `src/hooks/useFollowedTags.ts` + `src/hooks/useInterestsFeed.ts`

Ambos llaman `updateUserSettings(...)` directamente (PRD S3 lines 75, 97 y 46 respectivamente).

**Decision tecnica Ciclo 2 (Importante #2): NO centralizar via `useUserSettings`.** Cada hook mantiene su propio camino de escritura con su propio `pendingRef` y flush effect local.

**Razon:**

- `useFollowedTags` y `useInterestsFeed` tienen su propio estado interno (lista de tags seguidos, lista de interests) que no es subset del state de `useUserSettings`. Centralizar significaria que `useUserSettings` necesite conocer estos campos especificos, rompiendo encapsulamiento.
- La invocacion del flush al reconectar puede coordinarse exponiendo `flushPendingSettings()` desde `useUserSettings` y llamandolo desde un effect en cada hook que tambien sabe cuando volver a sincronizar su parte. Pero esto es opcional — el patron mas simple es: cada hook tiene su propio effect `useEffect(() => { if (!isOffline && pendingRef.current) flushLocal() }, [isOffline])`.

**Implementacion concreta:**

- `useUserSettings` expone publicamente la funcion `flushPendingSettings()` (newly exposed) que escribe `pendingSettingsRef.current` en Firestore. **No es invocada desde fuera por defecto** — sirve como API estable por si otros hooks quieren coordinarse.
- `useFollowedTags` y `useInterestsFeed` replican el patron localmente: cuando offline, acumulan el cambio en su propio `pendingRef`; cuando se detecta `isOffline=false`, ejecutan su propio `updateUserSettings(...)` directo con el snapshot acumulado.
- **Cada hook mantiene su propio camino.** Sin abstraccion compartida ni helper centralizado.

**Resultado:** mas codigo (3 implementaciones de la misma idea), pero cada hook es independiente. Aceptable para 3 hooks; si crece a >5, refactor a un helper compartido se trackeara aparte.

---

## Servicios

### Servicios modificados

**Ninguno.** Los services (`comments.ts`, `ratings.ts`, `sharedLists.ts`, `favorites.ts`, etc.) **no se tocan**. Mantienen su contrato actual; los nuevos `OfflineActionType` los re-invocan sin bypass.

### `src/services/syncEngine.ts` — 3 nuevos branches

**Path:** `src/services/syncEngine.ts:executeAction`

**Branches a agregar (despues de `case 'list_item_remove'`):**

```ts
case 'comment_edit': {
  const { commentId, text } = p as CommentEditPayload;
  const { editComment } = await import('./comments');
  await editComment(commentId, userId, text);
  break;
}

case 'comment_delete': {
  const { commentId } = p as CommentDeletePayload;
  const { deleteComment } = await import('./comments');
  await deleteComment(commentId, userId);
  break;
}

case 'rating_criteria_upsert': {
  const { criterionId, value } = p as RatingCriteriaUpsertPayload;
  const { upsertCriteriaRating } = await import('./ratings');
  await upsertCriteriaRating(userId, businessId, { [criterionId]: value });
  break;
}
```

**Nota sobre el branch defensivo `list_delete` (S2.1 PRD):** el branch existente (`syncEngine.ts:149-155`) **se mantiene tal cual**. No se borra ni se modifica. Replaya queues persistentes pre-#323. Nuevos `list_delete` no se encuen (ver `ListDetailScreen.handleDelete` arriba). Test de regresion documentado en seccion Tests.

**Pseudocodigo de cada branch nuevo:**

#### `comment_edit`

```
Input: action = { type: 'comment_edit', userId, businessId, payload: { commentId, text } }
1. Lazy-import editComment.
2. Llamar editComment(commentId, userId, text).
3. editComment hace updateDoc(comments/{commentId}, { text, updatedAt: serverTimestamp() }).
4. Si Firestore rules rechazan (ownership o text > 500), throw → syncEngine reintenta hasta OFFLINE_MAX_RETRIES → marca failed.
5. Si succede: trigger onCommentUpdated re-modera (responsabilidad existente, no de #323).
```

#### `comment_delete`

```
Input: action = { type: 'comment_delete', userId, businessId, payload: { commentId } }
1. Lazy-import deleteComment.
2. Llamar deleteComment(commentId, userId).
3. deleteComment hace deleteDoc(comments/{commentId}).
4. Trigger onCommentDeleted hace cascade de replies + decrement de replyCount + ajuste de rankings (existente).
5. Si rules rechazan (no owner) → retry → failed.
```

#### `rating_criteria_upsert`

```
Input: action = { type: 'rating_criteria_upsert', userId, businessId, payload: { criterionId, value } }
1. Lazy-import upsertCriteriaRating.
2. Llamar upsertCriteriaRating(userId, businessId, { [criterionId]: value }).
3. upsertCriteriaRating internamente:
   a. Lee rating doc existente (debe existir — si no, throw "Calificá con estrellas antes de agregar detalle por criterio").
   b. Hace merge no-destructivo: { criteria: { ...existingCriteria, [criterionId]: value } }.
   c. setDoc con merge.
4. Replay ordering (S5 PRD): si la queue tiene rating_upsert + rating_criteria_upsert del mismo (userId, businessId), el orden por createdAt garantiza global primero. Si el global no esta, el criteria throw informa "Calificá con estrellas...". Aceptable.
```

---

## Wrapper integrations: tabla detallada

Los 13+ callers HIGH/MEDIUM con archivo:linea exacto y diff conceptual.

### HIGH (S2 PRD)

| # | Archivo | Linea | Caller actual | Cambio (diff conceptual) |
|---|---------|-------|---------------|--------------------------|
| 1 | `src/components/business/BusinessComments.tsx` | 163 | `await editComment(editingId, user.uid, editText.trim())` | Wrappear con `withOfflineSupport('comment_edit', { userId, businessId, businessName }, { commentId: editingId, text: editText.trim() }, () => editComment(...), toast)`. |
| 2 | `src/components/profile/CommentsList.tsx` | 70 | `await editComment(commentId, user.uid, newText)` | Idem item 1 (sin `businessName`, no esta en scope). |
| 3 | `src/components/profile/CommentsList.tsx` | 52 | `await deleteComment(comment.id, user.uid)` | Wrappear con `withOfflineSupport('comment_delete', ...)`. **Snackbar diferenciado**: en el render del `<Snackbar>` (line 226), no renderizar `action={<Button>Deshacer</Button>}` cuando `isOffline=true`; sustituir `message` por `MSG_OFFLINE.commentDeletedOffline`. |
| 4 | `src/hooks/useCommentListBase.ts` | 48 | `await deleteComment(comment.id, user.uid)` (dentro de `onConfirmDeleteComment`) | Wrappear con `withOfflineSupport('comment_delete', ...)`. Idem snackbar diferenciado en el caller (`BusinessComments` lee `isOffline` de base). |
| 5 | `src/hooks/useBusinessRating.ts` | 147 | `await upsertCriteriaRating(user.uid, businessId, { [criterionId]: value })` | Wrappear con `withOfflineSupport('rating_criteria_upsert', { userId, businessId, businessName }, { criterionId, value }, () => upsertCriteriaRating(...), toast)`. |
| 6 | `src/components/lists/CreateListDialog.tsx` | 45 | `return createList(user.uid, name, desc, selectedIcon)` | Wrappear con `withOfflineSupport('list_create', { userId, businessId: '', listId: generatedId }, { name, description: desc, icon: selectedIcon }, () => createList(user.uid, name, desc, selectedIcon, generatedId), toast)`. Pasar `generatedId` para optimistic UI. |
| 7 | `src/components/business/AddToListDialog.tsx` | 116 | `const listId = await createList(user.uid, newName)` | Idem item 6. Recordar el `listId` cliente-side. |
| 8 | `src/components/business/AddToListDialog.tsx` | 100, 118 | `await addBusinessToList(listId, businessId, ...)` | Wrappear con `withOfflineSupport('list_item_add', { userId, businessId, listId }, { addedBy }, () => addBusinessToList(...), toast)`. |
| 9 | `src/components/business/AddToListDialog.tsx` | 95 | `await removeBusinessFromList(listId, businessId)` | Wrappear con `withOfflineSupport('list_item_remove', { userId, businessId, listId }, {}, () => removeBusinessFromList(...), toast)`. |
| 10 | `src/components/lists/ListDetailScreen.tsx` | 77 | `await updateList(list.id, list.name, list.description, hex)` | Wrappear con `withOfflineSupport('list_update', { userId: user.uid, businessId: '', listId: list.id }, { name: list.name, description: list.description, color: hex }, () => updateList(...), toast)`. |
| 11 | `src/components/lists/ListDetailScreen.tsx` | 142 | `await updateList(list.id, list.name, list.description, undefined, icon.id)` | Idem item 10 con `icon: icon.id` en payload. |
| 12 | `src/components/lists/ListDetailScreen.tsx` | 88 | `await toggleListPublic(list.id, newValue)` | Wrappear con `withOfflineSupport('list_toggle_public', { userId, businessId: '', listId: list.id }, { isPublic: newValue }, () => toggleListPublic(...), toast)`. |
| 13 | `src/components/lists/ListDetailScreen.tsx` | 108 | `await deleteList(list.id, list.ownerId)` | **Gated** (no encolable). Antes: `if (isOffline) { toast.warning(MSG_OFFLINE.deleteListBlocked); setConfirmDeleteOpen(false); return; }`. Boton del Dialog (line 284) `disabled={isOffline}`. |
| 14 | `src/components/lists/ListDetailScreen.tsx` | 121 | `await removeBusinessFromList(list.id, item.businessId)` | Wrappear con `withOfflineSupport('list_item_remove', ...)` idem item 9. |
| 15 | `src/components/lists/FavoritesList.tsx` | 100 | `await removeFavorite(user.uid, menuTarget.businessId)` | Wrappear con `withOfflineSupport('favorite_remove', { userId, businessId: menuTarget.businessId }, { action: 'remove' }, () => removeFavorite(...), toast)`. |
| 16 | `src/components/social/ReceivedRecommendations.tsx` | 55 | `markAllRecommendationsAsRead(userId).catch(...)` | **Gated**. Agregar `if (isOffline) return;` antes. |
| 17 | `src/components/lists/InviteEditorDialog.tsx` | 35 | `await inviteEditor(listId, email.trim())` | YA gated (line 58). Confirmar con test. |
| 18 | `src/components/lists/EditorsDialog.tsx` | 70 | `await removeEditor(listId, targetUid)` | YA gated (line 64). Confirmar con test. |
| 19 | `src/components/auth/DeleteAccountDialog.tsx` | 56 | `await deleteAccount(user, password)` | YA gated (line 52, 79). Confirmar test + ajustar copy a voseo si hace falta. **Nota tecnica (correccion Ciclo 2 Importante #1):** `deleteAccount` (`src/services/emailAuth.ts:130`) no es un callable directo — es una funcion local del SDK que (a) hace `reauthenticateWithCredential` con el SDK auth, y (b) **internamente** invoca el callable `deleteUserAccount`. Ambos pasos requieren red, por eso gatear el caller es correcto y suficiente. |
| 20 | `src/components/profile/SettingsMenu.tsx` | 62 | `await cleanAnonymousData()` | **Gated**. Agregar `if (isOffline) { setError(MSG_OFFLINE.cleanAnonOffline); setLoading(false); return; }` antes. |

### MEDIUM (S3 PRD)

| # | Archivo | Linea | Caller actual | Cambio |
|---|---------|-------|---------------|--------|
| 21 | `src/components/profile/FeedbackForm.tsx` | 86 | `await sendFeedback(...)` | **Gated**. Boton submit con `disabled={isSubmitting || !message.trim() || isOffline}`. Alert offline en el form. |
| 22 | `src/hooks/useUserSettings.ts` | 53, 70, 83, 96 | `updateUserSettings(user.uid, ...)` | Acumular en `pendingSettingsRef` cuando offline + flush effect al reconectar (ver Hook section). |
| 23 | `src/hooks/useFollowedTags.ts` | 75, 97 | `updateUserSettings(...)` | Idem item 22. |
| 24 | `src/hooks/useInterestsFeed.ts` | 46 | `updateUserSettings(...)` | Idem item 22. |
| 25 | `src/components/profile/MyFeedbackList.tsx` | 63 | `await markFeedbackViewed(fb.id)` | **Gated**. `if (isOffline) return;` antes. Fire-and-forget, sin feedback al usuario. |
| 26 | `src/components/business/MenuPhotoUpload.tsx` | 55 | `await uploadMenuPhoto(...)` | **Gated**. Boton upload `disabled={isOffline}`. Alert offline en el dialog. |
| 27 | `src/components/business/MenuPhotoViewer.tsx` | 35 | `await reportMenuPhoto(...)` | YA gated (PRD line 89). Confirmar test. |

### LOW (S4 PRD)

| # | Archivo | Linea | Caller actual | Cambio |
|---|---------|-------|---------------|--------|
| 28 | `src/components/admin/SpecialsPanel.tsx` | 87 | `await saveAllSpecials(specials)` | **Gated**. Boton "Guardar" `disabled={saving || isOffline}` + tooltip. |
| 29 | `src/components/admin/AchievementsPanel.tsx` | 84 | `await saveAllAchievements(achievements)` | Idem item 28. |
| 30 | `src/App.tsx` (nuevo) | (root) | — | Montar `<OfflineIndicator />` en root, dentro de `<ConnectivityProvider>`. Quitar de `TabShell.tsx:71`. |

---

## Snackbar diferenciado online/offline (S3.1 PRD)

### Pseudocodigo en `useCommentListBase.ts` + `BusinessComments.tsx`

```ts
// useCommentListBase.ts:
const onConfirmDeleteComment = useCallback(async (comment) => {
  if (!user) return;
  await withOfflineSupport(
    isOffline,
    'comment_delete',
    { userId: user.uid, businessId, businessName },
    { commentId: comment.id },
    () => deleteComment(comment.id, user.uid),
    toast,
  );
}, [user, isOffline, businessId, businessName, toast]);

// El message del snackbar se decide en el caller:
const deleteMessage = isOffline
  ? MSG_OFFLINE.commentDeletedOffline   // "Eliminado offline (se sincronizará cuando vuelvas online)"
  : MSG_COMMENT.deleteSuccess;          // "Comentario eliminado"

const { isPendingDelete, markForDelete, snackbarProps } = useUndoDelete<Comment>({
  onConfirmDelete: onConfirmDeleteComment,
  onDeleteComplete: onCommentsChange,
  message: deleteMessage,  // ← variable
});
```

### Pseudocodigo en `CommentsList.tsx` (Snackbar render)

```tsx
// Antes (line 226-235):
<Snackbar
  open={snackbarProps.open}
  message={snackbarProps.message}
  ...
  action={
    <Button color="primary" size="small" onClick={snackbarProps.onUndo}>Deshacer</Button>
  }
/>

// Despues:
const { isOffline } = useConnectivity();

<Snackbar
  open={snackbarProps.open}
  message={isOffline ? MSG_OFFLINE.commentDeletedOffline : MSG_COMMENT.deleteSuccess}
  autoHideDuration={snackbarProps.autoHideDuration}
  onClose={snackbarProps.onClose}
  action={
    isOffline
      ? undefined  // Sin "Deshacer" cuando offline
      : <Button color="primary" size="small" onClick={snackbarProps.onUndo}>Deshacer</Button>
  }
/>
```

### Garantia funcional (online path)

- `withOfflineSupport(isOffline=false, ...)` ejecuta `onlineAction()` directo sin enqueue (`offlineInterceptor.ts:22-24`).
- El `useUndoDelete` usa setTimeout interno con `timeout=5000` (default real, `useUndoDelete.ts:29`). Si el usuario presiona "Deshacer" antes, `confirmDelete` nunca corre → `withOfflineSupport` nunca se llama → `deleteComment` nunca se ejecuta. Comportamiento online sin cambios.
- **Importante**: el PRD menciona "4s" en S3.1 a titulo descriptivo. El timeout real es 5000ms (verificado en `useUndoDelete.ts:29`). El caller no debe forzar literal — usa el default del hook.

### Para `comment_edit` (badge "Sincronizando...")

```tsx
// CommentRow.tsx (componente que renderiza una fila):
// Si la accion comment_edit del comment esta pending en queue (o si el caller decide
// mostrar el optimistic state), agregar al lado del texto un Chip:

<Chip
  size="small"
  label={MSG_OFFLINE.commentEditingSync}  // "Sincronizando..."
  icon={<SyncIcon sx={{ animation: 'spin 1s linear infinite' }} />}
/>
```

**Decision para el plan:** la UI optimista del edit se resuelve a **nivel del componente local**: cuando el usuario edita offline, mostrar el texto nuevo con el chip "Sincronizando..." hasta que se reconecte (`useConnectivity().isOffline` indica el estado global). Sin observador del queue, sin selector adicional (B1 Ciclo 2). Si el replay falla, el chip desaparece y el snackbar de error toma el control via los handlers existentes de `withOfflineSupport`.

---

## pre-staging-check.sh extension (S6.1 PRD)

**Path:** `scripts/pre-staging-check.sh` (existente — extender, no crear nuevo).

### Greps a agregar

#### Check 6: Mutadores user-facing sin wrapper en componentes/hooks

```bash
# ---------- 6. User-facing mutators must be wrapped or gated ----------
check
echo "6) User-facing mutators wrapped/gated in components and hooks"

MUTATORS=(
  "addComment" "editComment" "deleteComment"
  "toggleCommentLike"
  "toggleFavorite" "removeFavorite"
  "upsertRating" "deleteRating" "upsertCriteriaRating"
  "addCheckin" "deleteCheckin"
  "upsertPriceLevel" "deletePriceLevel"
  "addBusinessTag" "removeBusinessTag"
  "followUser" "unfollowUser"
  "createList" "updateList" "toggleListPublic" "deleteList"
  "addBusinessToList" "removeBusinessFromList"
  "sendRecommendation" "markRecommendationAsRead" "markAllRecommendationsAsRead"
  "inviteEditor" "removeEditor"
  "deleteAccount" "cleanAnonymousData"
  "sendFeedback" "markFeedbackViewed"
  "updateUserSettings" "updateUserDisplayName" "updateUserAvatar"
  "uploadMenuPhoto" "reportMenuPhoto"
  "saveAllSpecials" "saveAllAchievements"
)

VIOLATIONS=""
for fn in "${MUTATORS[@]}"; do
  # Buscar invocaciones (await fn(... | fn(...).then) en src/components/ y src/hooks/.
  # Excluir imports y declaraciones (lineas que tienen "import" o "export function").
  HITS=$(grep -rn "\b${fn}(" "$REPO_ROOT/src/components/" "$REPO_ROOT/src/hooks/" \
    --include='*.ts' --include='*.tsx' \
    | grep -v 'import' \
    | grep -v 'export function' \
    | grep -v '__tests__' \
    | grep -v '\.test\.' \
    | grep -v 'pre-staging-check:allow' \
    || true)

  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file=$(echo "$hit" | cut -d: -f1)
    linenum=$(echo "$hit" | cut -d: -f2)

    # Heuristica de cumplimiento:
    # 1. ¿Hay withOfflineSupport en las 5 lineas anteriores?
    PRE_CONTEXT=$(sed -n "$((linenum - 5)),$((linenum))p" "$file" 2>/dev/null || true)
    if echo "$PRE_CONTEXT" | grep -q 'withOfflineSupport'; then
      continue
    fi
    # 2. ¿Hay isOffline guard cercano (10 lineas anteriores)?
    PRE_CONTEXT_WIDE=$(sed -n "$((linenum - 10)),$((linenum))p" "$file" 2>/dev/null || true)
    if echo "$PRE_CONTEXT_WIDE" | grep -qE 'isOffline\s*\)|if\s*\(\s*isOffline|disabled.*isOffline'; then
      continue
    fi
    # 3. ¿Comentario whitelist en la linea?
    LINE=$(sed -n "${linenum}p" "$file" 2>/dev/null || true)
    if echo "$LINE" | grep -q 'pre-staging-check:allow'; then
      continue
    fi

    VIOLATIONS+="$hit\n"
  done <<< "$HITS"
done

if [ -z "$VIOLATIONS" ]; then
  pass "all user-facing mutator calls are wrapped or gated"
else
  echo -e "$VIOLATIONS"
  fail "found user-facing mutators without withOfflineSupport or isOffline guard. See docs/reference/guards/304-offline.md"
fi
```

#### Check 7: `list_delete` nunca debe estar wrappeado en `withOfflineSupport` (B2 Ciclo 2)

```bash
# ---------- 7. list_delete must never be enqueued (B2 #323) ----------
check
echo "7) list_delete must not be wrapped in withOfflineSupport"

# Buscar matches literales de withOfflineSupport('list_delete' o "list_delete" en src/.
# El branch en syncEngine queda excluido (no llama withOfflineSupport, esta dentro de executeAction).
LIST_DELETE_HITS=$(grep -rnE "withOfflineSupport\(\s*['\"]list_delete['\"]" "$REPO_ROOT/src/" \
  --include='*.ts' --include='*.tsx' \
  | grep -v '__tests__' \
  | grep -v '\.test\.' \
  || true)

if [ -z "$LIST_DELETE_HITS" ]; then
  pass "no callers wrap list_delete in withOfflineSupport"
else
  echo "$LIST_DELETE_HITS"
  fail "list_delete is bloqueado offline (#323 S2.1). Gatear el caller con isOffline guard. Tipo conservado solo como branch defensivo en syncEngine para queues pre-#323. Ver docs/reference/guards/304-offline.md R4."
fi
```

**Razon (B2 Ciclo 2):** la guard #304 R4 declara `list_delete` como "tipo definido para replay defensivo, **bloqueado para nuevas escrituras offline**". El test #322 podria reactivar accidentalmente la wrapper (regresion silenciosa). Este check vetar el patron en CI. **No se borra el tipo ni el branch defensivo en syncEngine** — se borra la posibilidad de que un caller nuevo lo enquee.

### Whitelist documentada (en el script y en `docs/reference/guards/304-offline.md`)

- `src/services/**` — definiciones, no callers.
- `src/services/admin/**` — admin con red garantizada.
- `src/services/syncEngine.ts` — replay path (incluye el branch defensivo `case 'list_delete'`).
- `src/services/offlineInterceptor.ts` — la wrapper misma.
- `src/**/__tests__/**`, `src/**/*.test.ts`, `src/**/*.test.tsx` — tests.
- Lineas individuales con comentario `// pre-staging-check:allow` — escape hatch para casos limite (debe acompañarse de comentario que justifique). **Nota O1 Ciclo 2:** el escape hatch existe a proposito para falsos positivos legitimos; antes de usarlo en codigo nuevo, abrir issue para evaluar si la heuristica de Check 6 puede mejorar para que el caso entre solo. **Sweep legacy:** la primera ejecucion del script va a destapar matches existentes que no son violaciones — el plan incluye barrer esos casos uno por uno (whitelistear o reescribir el caller) antes de marcar el check como `fail` en CI.

### Definicion de "violacion"

Hit en `src/components/` o `src/hooks/` que:

- NO tiene `withOfflineSupport` en las 5 lineas previas, AND
- NO tiene `isOffline` guard en las 10 lineas previas, AND
- NO tiene `pre-staging-check:allow` en la misma linea.

Exit code 1 con archivo + linea.

### Falsos positivos esperados

Bajos pero **no nulos**. El bloque de scope cercano (5-10 lineas) cubre la mayoria de los casos. Casos exoticos (wrapper en helper externo o factory, gate en `useEffect` con dependencia que escapa al rango de 10 lineas, callbacks que ya estan dentro de un closure gateado mas arriba) se whitelistean caso por caso con comentario `// pre-staging-check:allow: <razon>`. **El plan incluye un paso de sweep legacy** (revisar matches existentes antes de habilitar el check como `fail`) — caso contrario CI rompe en la primera corrida.

### Test de regresion del propio script (SC2.4 PRD)

**Path del test:** `scripts/__tests__/pre-staging-check.test.sh` (nuevo) o equivalente en CI.

**Forma (O3 Ciclo 2 — usar `git rev-parse --show-toplevel` o `$REPO_ROOT` para portabilidad):**

```bash
#!/usr/bin/env bash
# Test que verifica que pre-staging-check.sh detecta violaciones.

set -e

# Resolver REPO_ROOT del repo real (no hardcodear /home/walrus/...).
# Funciona en local y en CI.
REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"

TEMP=$(mktemp -d)
trap "rm -rf $TEMP" EXIT

# Crear un archivo "fake" en src/components/test/ con un editComment directo
mkdir -p "$TEMP/src/components/test"
cat > "$TEMP/src/components/test/Bad.tsx" <<EOF
import { editComment } from '../../services/comments';
export function Bad() {
  return <button onClick={() => editComment('a', 'b', 'c')}>Bad</button>;
}
EOF

# Run el script con REPO_ROOT del temp dir
cd "$TEMP"
git init -q
git add -A
git -c user.email=test@test git -c user.name=test commit -q -m "test fixture" || git commit -q -m "test fixture"

# Copiar el script desde el repo real
cp "$REPO_ROOT/scripts/pre-staging-check.sh" ./
chmod +x ./pre-staging-check.sh

# Setear REPO_ROOT para el script (o que el script lo derive con git rev-parse)
REPO_ROOT="$TEMP" ./pre-staging-check.sh 2>&1 > /tmp/pre-check-out.log || true

# Esperar exit code 1 con archivo "Bad.tsx" mencionado
if grep -q "Bad.tsx" /tmp/pre-check-out.log; then
  echo "PASS: script detected violation"
  exit 0
else
  echo "FAIL: script did not detect violation"
  cat /tmp/pre-check-out.log
  exit 1
fi
```

**Nota O3:** el script `pre-staging-check.sh` debe definir `REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"` al inicio para que el test (y cualquier otro consumidor) pueda overridarlo via env var. Si el script actual hardcodea la ruta, el plan debe incluir el fix.

**Integrar en CI:** agregar step en `.github/workflows/*.yml` (jobs `lint` o `pre-merge`). Reusar el step que ya corre `pre-staging-check.sh`. Si no existe step, agregar uno nuevo despues del `npm run build`. Sugerencia (a confirmar por el plan): correr `bash scripts/__tests__/pre-staging-check.test.sh` directamente.

---

## Tests

Politica `docs/reference/tests.md`: cobertura >= 80% del codigo nuevo.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/__tests__/syncEngine.commentEdit.test.ts` | Branch `comment_edit`: payload bien formado → llama `editComment(commentId, userId, text)`. Payload mal formado → throw. | Service |
| `src/services/__tests__/syncEngine.commentDelete.test.ts` | Branch `comment_delete`: payload bien formado → llama `deleteComment(commentId, userId)`. | Service |
| `src/services/__tests__/syncEngine.criteriaUpsert.test.ts` | Branch `rating_criteria_upsert`: llama `upsertCriteriaRating(userId, businessId, { [criterionId]: value })`. Test merge con criteria existente. | Service |
| `src/services/__tests__/syncEngine.listDelete.defensive.test.ts` | **Test defensivo S2.1**: una accion `list_delete` enqueada manualmente (simulando queue pre-#323) sigue replayando correctamente — llama `deleteList(listId, ownerId)`. | Service |
| `src/hooks/__tests__/useBusinessRating.criteriaOffline.test.ts` | `handleCriterionRate` con `isOffline=true` → enquea `rating_criteria_upsert`. Online → llama directo. | Hook |
| `src/hooks/__tests__/useCommentListBase.deleteOffline.test.ts` | `onConfirmDeleteComment` offline → enquea `comment_delete`. Online → llama directo. | Hook |
| `src/hooks/__tests__/useUserSettings.flush.test.ts` | **Test SC2.2 PRD**: setear `updateSetting('notifyLikes', true)` con `isOffline=true` → no llama service, acumula en pendingRef. Cambiar `isOffline=false` → flush effect dispara `updateUserSettings(uid, { notifyLikes: true })`. Verificar `cancelled` cleanup en unmount. Verificar que `flushPendingSettings()` esta exportado y que invocarlo manualmente flush-ea sin esperar el effect (Importante #2). | Hook |
| `src/hooks/__tests__/useFollowedTags.flushOffline.test.ts` | Mismo patron en hook propio (Importante #2 Ciclo 2 — sin centralizar): toggle de tag offline acumula en pendingRef local; reconectar dispara `updateUserSettings` con el snapshot. | Hook |
| `src/hooks/__tests__/useInterestsFeed.flushOffline.test.ts` | Mismo patron en hook propio. | Hook |
| `src/services/__tests__/syncEngine.commentEdit.docNotFound.test.ts` | **Test limitacion conocida (B1 Ciclo 2):** payload `comment_edit` con `commentId` que no existe en server → `editComment` lanza `not-found` → `OFFLINE_MAX_RETRIES` → action `failed` → analytics `EVT_OFFLINE_ACTION_FAILED`. Verifica que el flujo "create offline + edit antes de reconectar" produce error visible al usuario tras reconectar. | Service |
| `src/services/__tests__/syncEngine.commentDelete.docNotFound.test.ts` | Idem para `comment_delete`. | Service |
| `src/components/business/__tests__/BusinessComments.editOffline.test.tsx` | Edit offline → enquea + toast `OFFLINE_ENQUEUED_MSG`. **(B1 Ciclo 2)** Sin asercion sobre "boton disabled cuando hasPendingCreate" — ese gate sale del scope. | Component |
| `src/components/profile/__tests__/CommentsList.snackbarOffline.test.tsx` | Online: snackbar con "Deshacer". Offline: snackbar con copy `commentDeletedOffline` y SIN action "Deshacer". | Component |
| `src/components/lists/__tests__/ListDetailScreen.offline.test.tsx` | Cada CTA respeta offline: rename (enquea), toggle public (enquea), delete (gated, toast warning), remove item (enquea). | Component |
| `src/components/lists/__tests__/ListDetailScreen.indicator.test.tsx` | **Test SC2.3 PRD**: render `ListDetailScreen` con `isOffline=true` mockeado en `ConnectivityContext` → `OfflineIndicator` chip CloudOff montado en viewport. | Component |
| `src/components/business/__tests__/AddToListDialog.offline.test.tsx` | Add/remove/create offline → cada uno enquea con type correcto. | Component |
| `src/components/lists/__tests__/CreateListDialog.offline.test.tsx` | Create offline → enquea `list_create` + invoca `onCreated(listId, ...)` con id pre-generado. | Component |
| `src/components/lists/__tests__/EditorsDialog.offline.test.tsx` | Boton remove disabled offline. Click cuando offline → toast warning, no llama service. | Component |
| `src/components/lists/__tests__/InviteEditorDialog.offline.test.tsx` | Boton submit disabled offline + tooltip. | Component |
| `src/components/auth/__tests__/DeleteAccountDialog.offline.test.tsx` | Submit disabled offline. Alert con copy en voseo. | Component |
| `src/components/profile/__tests__/SettingsMenu.offline.test.tsx` | "Empezar de cero" en anonimo: gated offline → setError con MSG_OFFLINE.cleanAnonOffline. | Component |
| `src/components/profile/__tests__/FeedbackForm.offline.test.tsx` | Submit disabled offline. | Component |
| `src/components/admin/__tests__/SpecialsPanel.offline.test.tsx` | Save disabled offline. | Component |
| `src/components/admin/__tests__/AchievementsPanel.offline.test.tsx` | Save disabled offline. | Component |
| `src/components/lists/__tests__/FavoritesList.removeOffline.test.tsx` | `handleRemoveFavorite` offline → enquea `favorite_remove`. | Component |
| `src/components/social/__tests__/ReceivedRecommendations.offline.test.tsx` | `markAllRecommendationsAsRead` no se llama offline. | Component |
| `scripts/__tests__/pre-staging-check.test.sh` | **Test SC2.4 PRD**: branch artificial con `await editComment(...)` directo en componente → `pre-staging-check.sh` exit code 1 con archivo + linea. | Script |

### Mock strategy

- `useConnectivity` mock con `vi.hoisted()` (consistente con feedback `feedback_vitest_mock_patterns.md`).
- `vi.mock('../services/offlineInterceptor', ...)` para spy `withOfflineSupport`.
- Vi.mock de `../services/comments`, `../services/ratings`, `../services/sharedLists` para spy las llamadas.
- En tests de hooks: `useAuth` mock con `user.uid`, `useToast` mock con jest.fn().
- En tests de syncEngine: usar `_resetSyncingForTest` y reset del `dbInstance` via `_resetForTest` cuando aplique.

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (3 branches + nuevos guards).
- Todos los paths condicionales online/offline.
- Side effects: `enqueue` con payload correcto, `EVT_OFFLINE_ACTION_QUEUED` trackeado, toast.error o disabled state segun corresponda.

---

## Analytics

**Sin nuevos eventos.**

- Los 3 nuevos `OfflineActionType` emiten `EVT_OFFLINE_ACTION_QUEUED` con `action_type` correcto via `withOfflineSupport` (automatico, sin codigo nuevo).
- **NO se agrega `EVT_OFFLINE_GATE_BLOCKED`** (decision Sofia Ciclo 1, PRD Out of Scope).

---

## Offline

(Esta seccion describe el efecto neto del feature sobre el comportamiento offline.)

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Reads de Firestore | Persistencia offline SDK (existente, sin cambios) | n/a | IndexedDB (Firestore) |
| Pending actions queue | IndexedDB nativa (existente) | `OFFLINE_QUEUE_MAX_AGE_MS` | IndexedDB (`OFFLINE_DB_NAME`) |
| User settings offline | `pendingSettingsRef` en `useUserSettings` | hasta unmount o reconnect | React ref (memoria) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|--------------------|
| `comment_edit` | Encolada con payload `{ commentId, text }` | Replay; si server-side ya no existe el doc → fail tras `OFFLINE_MAX_RETRIES` |
| `comment_delete` | Encolada con payload `{ commentId }` | Replay; cascade via `onCommentDeleted` |
| `rating_criteria_upsert` | Encolada con payload `{ criterionId, value }` | Merge no-destructivo en `upsertCriteriaRating`. Orden por `createdAt`: global rating primero, criteria despues |
| `list_create/update/toggle_public/item_add/item_remove/favorite_remove` | Encolada con payloads existentes | Replay; conflicts ya manejados por #304 |
| `list_delete` (**bloqueado** offline) | Gated en caller; nuevos NO se encuen. Branch defensivo en syncEngine para queues pre-#323 | n/a |
| Settings (`useUserSettings`) | State local + flush effect al reconectar | Snapshot local gana; multi-tab "last writer wins" |
| Funciones que requieren red (delete account [SDK auth + callable interno `deleteUserAccount`], clean anon [callable], invite/remove editor [callable], mark all recs read [batch write], send feedback [Storage + Firestore], upload menu photo [Storage], save admin [batch write]) | **Bloqueados** (gated) | Sin replay |

### Fallback UI

- `<OfflineIndicator />` montado en `App.tsx` root → visible en cualquier viewport.
- Botones gated con `disabled={isOffline}` + tooltip o Alert.
- Toasts informativos cuando se enquea (existentes via `withOfflineSupport`).
- Snackbar diferenciado para `comment_delete`/`comment_edit` (S3.1).

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| `BusinessComments` (existing) | Boton Editar/Eliminar (existente) | "Editar comentario" / "Eliminar comentario" (existente) | 44x44px (existente) | (B1 Ciclo 2 — sin gate por `hasPendingCreate`) Si el replay falla por doc-no-existe, `withOfflineSupport` ya emite `toast.error` + analytics. |
| `ListDetailScreen` (toolbar) | IconButton Eliminar lista (line 181) | "Eliminar lista" (existente) | 44x44px (existente) | `disabled={isOffline}` + tooltip "Requiere conexión" |
| `EditorsDialog` (existing) | IconButton Remover editor (line 102) | `"Remover {displayName}"` (existente) | 44x44px (existente) | `disabled={isOffline}` (existente) |
| `OfflineIndicator` (movido a App.tsx root) | Chip | `role="status"` + `aria-live="polite"` (validado en `src/components/ui/OfflineIndicator.tsx:24-25` — O2 Ciclo 2 confirmado: los attrs ya existen y se mantienen tras mover a App.tsx) | n/a | n/a |

### Reglas

- Tooltips MUI sobre `<Button disabled>` requieren wrapper `<span>` para que el tooltip funcione (limitacion conocida de MUI). El implementador resuelve.
- Cuando un boton se deshabilita offline, el `aria-disabled` se aplica automaticamente por MUI.
- No se cambia ningun touch target.
- No se introducen nuevos `<Typography onClick>` ni `<Box onClick>`.

---

## Decisiones tecnicas

### 1. `list_delete` queda como branch defensivo (S2.1)

**Decision:** mantener tipo + payload + branch en syncEngine. Gatear el caller.

**Alternativa rechazada:** borrar el tipo y el branch. Causaria breaking change para usuarios con queue persistente pre-#323 (sus actions `list_delete` quedarian sin handler → toast.error en sync).

### 2. Firma de `withOfflineSupport` no cambia (I3 PRD)

**Decision:** el caller diferencia el snackbar online/offline chequeando `isOffline` ANTES de invocar `withOfflineSupport`.

**Alternativa rechazada:** modificar `withOfflineSupport` para devolver `{ enqueued: boolean, actionId?: string }`. Requeriria cambiar todos los callers wrappeados (10+) y abriria la puerta a undo de acciones encoladas — scope creep.

### 3. ~~`usePendingActions` es un selector~~ → Hook eliminado del scope (B1 Ciclo 2)

**Decision Ciclo 2:** el hook `usePendingActions` se baja del scope #323 (decision usuario opcion (a)). La UX completa de "no permitir edit/delete de un comment con `comment_create` pendiente" queda como follow-up. La limitacion conocida (toast.error tras reconectar si el replay del edit/delete encuentra doc-no-existe) se acepta y se documenta en `docs/reference/guards/304-offline.md`.

**Alternativa rechazada:** entregar el hook con API stub pero sin consumidor. Codigo dead-on-arrival que solo agrega superficie de mantenimiento.

### 4. Settings flush al reconectar usa state local de la tab, no merge con server (S5 multi-tab)

**Decision:** el effect escribe el snapshot acumulado en `pendingSettingsRef` cuando `isOffline=false`. No lee server primero.

**Alternativa rechazada:** lock optimistic + merge con server. Demasiada complejidad para el caso de uso (settings son eventually consistent y la UI re-fetch al reconectar via fetcher de `useAsyncData`).

### 5. `useFollowedTags` y `useInterestsFeed` mantienen su propio camino (Importante #2 Ciclo 2)

**Decision:** cada hook tiene su propio `pendingRef` + flush effect local. **No se centraliza** via `useUserSettings`.

**Alternativa rechazada:** delegar la escritura al hook centralizado y exponer un setter unico. Rompe encapsulamiento — `useUserSettings` necesitaria conocer campos especificos (`followedTags`, `interests`) que pertenecen a sus respectivos hooks.

**Implementacion detalle:** `useUserSettings` expone `flushPendingSettings()` publicamente como API estable, pero los otros hooks NO la consumen — replican el patron localmente. Aceptable para 3 hooks; refactor a helper si crece a >5.

### 6. Snackbar offline para `comment_delete` no tiene "Deshacer"

**Decision:** el caller (no el hook) sustituye el `action` del Snackbar por `undefined` cuando `isOffline`. Mensaje cambia a `commentDeletedOffline`.

**Alternativa rechazada:** "Deshacer offline" que llamaria `offlineQueue.remove(actionId)`. Requiere exponer `actionId` en `withOfflineSupport` (ver decision 2). Out of scope.

### 7. OfflineIndicator se mueve al root (App.tsx) y no se duplica

**Decision:** un solo `<OfflineIndicator />` en el arbol. Quitar el de `TabShell.tsx:71`.

**Alternativa rechazada:** montar dos copias (uno en TabShell, otro en App). Duplicaria `role="status"` con el mismo evento → mal a11y.

### 8. Re-moderacion en `comment_edit` replay queda con comportamiento online (PRD S5)

**Decision:** el replay produce el mismo result que un edit online. Sticky moderation (preservar flag tras edit) → out of scope (decision producto, follow-up).

---

## Hardening de seguridad

### Firestore rules requeridas

**Ninguna.** El feature no escribe a colecciones nuevas ni con campos nuevos.

### Rate limiting

**Sin cambios.** Los rate limits server-side existentes (cooldown de comments, etc.) cubren el replay (que pasa por los services existentes).

### Vectores de ataque mitigados

| Ataque | Mitigacion existente | Archivo |
|--------|---------------------|---------|
| IndexedDB queue local saturada por bot → al reconectar dispara N writes | `OFFLINE_QUEUE_MAX_ITEMS` en `enqueue()` rechaza con error. `OFFLINE_MAX_RETRIES` por accion. Rate limits server-side cortan el flow. | `src/services/offlineQueue.ts:63`, server-side cooldowns |
| `comment_edit` replay con commentId ajeno | `editComment` valida ownership server-side via Firestore rules (`affectedKeys().hasOnly(['text','updatedAt'])` + ownership existente) | `firestore.rules` (sin cambios) |
| `comment_delete` replay masivo silencioso | Cooldown server-side existente para comments writes; deletes pasan por `onCommentDeleted` que cascade-ea. Queue local limita por device. | server-side |
| `rating_criteria_upsert` replay de criteria invalido | `upsertCriteriaRating` valida `value` integer 1-5 (`ratings.ts:62-66`) | `src/services/ratings.ts` |

---

## Deuda tecnica: mitigacion incorporada

Issues abiertos consultados:

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #304 (cerrado, guard) | Activar el guard #304 en CI (hoy documentado pero no enforced). Extension con greps de callers (S6.1). | Fase de pre-staging-check (script extension + test de regresion) |
| #322 (abierto) | Cross-dep ligero: nuevos types replayan via services que pasan por rules. No bloquea, coordinar orden de merge si ambos aterrizan en la misma sprint. | Sin paso explicito; mencionar en notas de merge |
| #324 (abierto) | Overlap de archivos (`ListDetailScreen.tsx`, hooks de comments). Coordinar orden de merge para evitar conflictos. | Sin paso explicito; mencionar en notas de merge |

Si el plan toca un archivo con deuda tecnica conocida, se incluye el fix en el plan. Verificar:

- `useCommentListBase.ts` y `ListDetailScreen.tsx` cerca del limite 400 LOC. **Si despues de los cambios superan 400 LOC**, extraer sub-hook `useListMutations(list)` o `useCommentMutations()`. **El plan debe medir antes y despues.**

---

## Out of scope explicito

Reiterado del PRD para que el implementador no se desvie:

1. **Edit/delete de comments NO sincronizados.** (B1 Ciclo 2 — opcion (a) usuario.) El hook `usePendingActions` y la UI de "boton disabled cuando hasPendingCreate" quedan **fuera del scope #323**. Limitacion conocida: si el usuario crea un comment offline y lo edita/elimina antes de reconectar, los replays subsiguientes pueden fallar con doc-no-existe → `toast.error` informativo. Documentado en `docs/reference/guards/304-offline.md` (paso del plan). Tracked como **follow-up issue** para implementar id correlacionable cuando la demanda lo justifique.
2. **Sticky moderation.** El replay de `comment_edit` levanta el flag igual que online. Cambiar este comportamiento es decision de producto, no de #323.
3. **Undo de acciones encoladas offline.** El undo solo funciona online (donde la accion real corre dentro del setTimeout). Offline → no hay undo. Tracked como follow-up si surge demanda.
4. **Coordinacion cross-device** del mismo usuario. Si mobile encola edit y desktop encola delete, gana el que reconecta primero; el otro falla con doc-no-existe → `OFFLINE_MAX_RETRIES` → toast.error informativo.
5. **`EVT_OFFLINE_GATE_BLOCKED` analytics.** Decision: NO agregar.
6. **Reescribir servicios** para que ellos mismos encuen. El patron actual (caller wrappea) es deliberado.
7. **Soportar offline para uploads de Storage** (`uploadMenuPhoto`, `sendFeedback` con archivo). Requiere persistir archivo en IndexedDB y resumir upload — feature aparte.
8. **Optimistic UI para writes encolados en lists** (mostrar la lista creada antes de sincronizar). Existe parcialmente via #304 con `generateListId()`; ampliarlo es out-of-scope.
9. **Cambios al UI del `OfflineIndicator`** (icono, copy). Solo se mueve donde se monta.

---

## Rollout: orden recomendado para el plan

Fases recomendadas (el plan las refinara):

### Fase A — Foundation (HIGH, sin breaking changes)

1. Agregar 3 `OfflineActionType` + payloads en `src/types/offline.ts`.
2. Agregar 3 branches en `src/services/syncEngine.ts:executeAction`.
3. Tests de los 3 branches + branch defensivo `list_delete` + tests de doc-no-existe (B1 limitacion conocida).
4. Agregar nuevas keys a `src/constants/messages/offline.ts` + extender `offline.test.ts`.
5. ~~Crear `src/hooks/usePendingActions.ts`~~ — **eliminado del scope (B1 Ciclo 2).** Documentar la limitacion conocida en `docs/reference/guards/304-offline.md` y abrir issue de follow-up.
6. Crear extension de `scripts/pre-staging-check.sh` (Check 6 + **Check 7 list_delete veto**, B2 Ciclo 2) + test de regresion (con `git rev-parse --show-toplevel`/`$REPO_ROOT`, O3 Ciclo 2) + integrarlo en CI. **Sweep legacy primero**: revisar matches existentes de Check 6 antes de habilitar como `fail`.

### Fase B — HIGH callers (S2 PRD)

7. Wrappear edits/deletes de comments (BusinessComments, CommentsList, useCommentListBase) + snackbar diferenciado.
8. Wrappear `upsertCriteriaRating` en `useBusinessRating`.
9. Wrappear lists CRUD (CreateListDialog, AddToListDialog, ListDetailScreen) — incluye gating de `deleteList`.
10. Wrappear `removeFavorite` en FavoritesList.
11. Confirmar gates existentes en EditorsDialog, InviteEditorDialog, DeleteAccountDialog (agregar tests).
12. Agregar gate en SettingsMenu (`cleanAnonymousData`).

### Fase C — MEDIUM callers (S3 PRD)

13. Gatear `sendFeedback` en FeedbackForm.
14. Modificar `useUserSettings` con flush effect + ref pattern (cleanup `let cancelled = false`).
15. Replicar el patron en `useFollowedTags`, `useInterestsFeed`.
16. Gatear `markFeedbackViewed` en MyFeedbackList.
17. Gatear `markAllRecommendationsAsRead` en ReceivedRecommendations.
18. Gatear `uploadMenuPhoto` en MenuPhotoUpload.

### Fase D — LOW + indicator (S4 PRD)

19. Gatear `saveAllSpecials`, `saveAllAchievements` en admin panels.
20. Mover `<OfflineIndicator />` de TabShell a App.tsx root. Eliminar el render de TabShell.
21. Render test SC2.3 (`OfflineIndicator` visible en `ListDetailScreen`).

### Fase E — Documentacion (OBLIGATORIA)

22. Actualizar `docs/reference/patterns.md` (seccion offline + contract S1).
23. Actualizar `docs/reference/features.md` (cobertura offline mejorada).
24. Actualizar `docs/reference/guards/304-offline.md` (nuevos types, archivos cubiertos, decision `list_delete`, lista de mutadores en pre-staging-check).
25. Verificar que `docs/_sidebar.md` referencia el nuevo specs/plan.
26. Verificar copy en voseo en todos los strings nuevos (correccion OBS#5 PRD aplicada en este specs).

---

## Validacion Tecnica

**Arquitecto**: Diego (Solution Architect)
**Fecha**: 2026-04-25
**Estado Ciclo 2**: VALIDADO CON OBSERVACIONES

### Veredicto

Tras Ciclo 1 (NO VALIDADO — 2 BLOQUEANTES + 4 IMPORTANTES + 3 OBSERVACIONES) y la respuesta de specs-plan-writer aplicando los fixes, **todos los hallazgos quedaron cerrados**. El scope reducido de B1 (eliminar `usePendingActions` por decision usuario opcion (a)) es coherente: no hay referencias huerfanas en el specs, y la limitacion conocida (replay de `comment_edit`/`comment_delete` con doc-no-existe → toast.error tras reconectar) esta documentada en multiples lugares del specs y trackeada como follow-up.

### Cerrado en Ciclo 2

#### Bloqueantes
- **B1: `usePendingActions` esqueleto sin enforcement** → resuelto por **bajada de scope** (opcion (a) usuario):
  - Hook eliminado del archivo a crear y de los tests.
  - Limitacion conocida documentada explicitamente en Resumen tecnico (linea 18), BusinessComments component (linea 169), Hook section "Hook eliminado del scope" (linea 303-327), Tabla Tests (linea 859-861), Accesibilidad (linea 940), Decision tecnica #3 (linea 968), Out of scope #1 (linea 1052), Rollout Fase A paso 5 (linea 1074).
  - Tests reemplazados: `usePendingActions.test.ts` removido, `BusinessComments.editOffline.test.tsx` mantenido sin la asercion `hasPendingCreate`, agregados `syncEngine.commentEdit.docNotFound.test.ts` y `syncEngine.commentDelete.docNotFound.test.ts` cubriendo el path failure.
  - Plan paso explicito para abrir issue follow-up (id correlacionable) y actualizar `docs/reference/guards/304-offline.md`.
  - **Verificacion sin referencias huerfanas:** grep de `usePendingActions`, `hasPendingCreate`, `waitingSync` muestra solo menciones marcadas explicitamente como out-of-scope.

- **B2: `list_delete` sin enforcement automatico** → resuelto:
  - Check 7 dedicado en `pre-staging-check.sh` (specs lineas 738-759) con regex literal `withOfflineSupport\(\s*['\"]list_delete['\"]` que detecta wrappers de `list_delete` en `src/` (excluyendo tests) y falla con exit code 1.
  - Razonamiento explicitado: el tipo y el branch defensivo en syncEngine se mantienen para queues pre-#323; lo que se veta es que un caller nuevo lo enquee.

#### Importantes
- **I1: `deleteAccount` no es callable real** → resuelto: nota tecnica en fila #19 (linea 550) y fila Callables en tabla Offline (linea 925) corregidas con la cadena exacta "SDK auth + callable interno `deleteUserAccount`". **Verificado en `src/services/emailAuth.ts:130`** — la funcion hace `reauthenticateWithCredential` + invoca callable `deleteUserAccount`.

- **I2: `useFollowedTags`/`useInterestsFeed` delegacion** → resuelto: decision tecnica explicita "NO centralizar"; cada hook mantiene `pendingRef` + flush effect local. `useUserSettings` expone `flushPendingSettings()` publicamente como API estable pero NO es consumida (decision aceptable para 3 hooks; refactor si crece a >5). Reflejado en Hook section (linea 427-444), Decision tecnica #5 (linea 980-986), tests `useFollowedTags.flushOffline.test.ts` y `useInterestsFeed.flushOffline.test.ts`.

- **I3: `OfflineActionPayload` union mostrada como subset** → resuelto: bloque ts reemplazado por **diff conceptual** (3 lineas marcadas `+`, resto preservado). Nota explicita "el diff se aplica sobre la version vigente al momento de implementar". Verificado contra `src/types/offline.ts:49-68` que la union actual coincide con el bloque del diff.

- **I4: `MSG_OFFLINE` structure** → resuelto: solo se listan las 8 keys nuevas; las keys actuales (`syncing`, `syncSuccess`, etc.) NO se duplican. `waitingSync` removida (efecto colateral correcto de B1). Test `offline.test.ts` debe extenderse para cubrir las 8 keys nuevas.

#### Observaciones
- **O1: grep S6.1 falsos positivos** → resuelto: subseccion "Falsos positivos esperados" reescrita con casos concretos; escape hatch `// pre-staging-check:allow:` documentado con justificacion obligatoria; paso de **sweep legacy** agregado al plan antes de habilitar el check como `fail` en CI.

- **O2: `OfflineIndicator` a11y attrs** → resuelto: validado en `src/components/ui/OfflineIndicator.tsx:24-25` (`role="status"` + `aria-live="polite"` ya existen); tabla de Accesibilidad actualizada con la cita exacta.

- **O3: test del script con `$REPO_ROOT`** → resuelto: test reescrito con `REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"`; nota agregada que `pre-staging-check.sh` debe definir esta variable al inicio para portabilidad.

### Observaciones tecnicas residuales (no bloqueantes para el plan)

- **O4 (nueva, no bloqueante):** el pseudocodigo de `useUserSettings.ts` (linea 335-371) implementa el flush dentro de un `useEffect` inline. La decision tecnica declara que `flushPendingSettings()` se exporta como API publica estable, pero el pseudocodigo no la extrae como funcion nombrada. **Pablo (plan reviewer) deberia verificar** que el plan incluya el paso explicito "extraer la logica del flush a una funcion `flushPendingSettings()` con `useCallback` y exponerla en el return del hook". Sin este paso, el implementador podria dejar el effect inline y el test `useUserSettings.flush.test.ts` (que verifica invocacion manual de `flushPendingSettings()`) fallaria. Es trivial de resolver pero conviene marcarlo en el plan.

### Riesgos tecnicos a vigilar durante implementacion

- **Sweep legacy de Check 6**: la primera ejecucion del script va a destapar matches existentes que no son violaciones. El plan debe reservar tiempo para barrer el listado y decidir whitelistear/refactor caso por caso ANTES de habilitar el check como `fail` en CI. Sin este paso, CI rompe.
- **Limites de archivos**: `useCommentListBase.ts` y `ListDetailScreen.tsx` cerca del limite 400 LOC; el plan debe medir antes/despues y planificar extraccion (sub-hook `useListMutations`/`useCommentMutations`) si superan.
- **Cross-deps**: #322 (en flight) y #324 (overlap de archivos `ListDetailScreen.tsx`, hooks de comments). Coordinar orden de merge con el equipo.
- **Limitacion conocida B1**: el toast.error tras reconectar para "edit/delete de comment offline-created" es UX degradada conscientemente aceptada. Si el feature recibe feedback negativo de usuarios reales, el follow-up con id correlacionable debe priorizarse.

### Cambios verificados sin re-leer

- Total enum `OfflineActionType`: 23 + 3 = 26 (correcto).
- 3 nuevas interfaces de payload: `CommentEditPayload`, `CommentDeletePayload`, `RatingCriteriaUpsertPayload` (correctos).
- 3 nuevos branches en `syncEngine.executeAction` con lazy-import (consistente con el patron actual).
- 8 nuevas keys en `MSG_OFFLINE` (sin duplicar las existentes).
- Check 6 + Check 7 en `pre-staging-check.sh` con escape hatch `// pre-staging-check:allow:`.
- `<OfflineIndicator />` se mueve de `TabShell.tsx:71` a `App.tsx` root.

### Listo para pasar a plan?

**Si, con observaciones.**

- BLOQUEANTES: 0 abiertos.
- IMPORTANTES: 0 abiertos.
- OBSERVACIONES: 1 nueva (O4 — pseudocodigo de `useUserSettings` no extrae `flushPendingSettings` como funcion nombrada). No bloqueante para el plan; Pablo (plan reviewer) la verifica al validar el plan.

**Sello Diego: VALIDADO CON OBSERVACIONES.**

Pablo puede empezar a redactar el plan. Recomiendo que el plan:
1. Refleje el sweep legacy de Check 6 antes de habilitar como `fail`.
2. Mida LOC en `useCommentListBase.ts` y `ListDetailScreen.tsx` antes/despues, con extraccion de sub-hook si superan 400.
3. Incluya paso explicito para extraer `flushPendingSettings()` como funcion nombrada exportada del return del hook (O4).
4. Coordine orden de merge con #322 y #324.
5. Abra issue de follow-up para id correlacionable (B1 limitacion conocida).
