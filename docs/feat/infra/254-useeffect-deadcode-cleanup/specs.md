# Specs: useEffect race conditions + async handlers + dead exports

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No hay cambios en el modelo de datos de Firestore. Este issue es puramente de codigo defensivo y limpieza.

## Firestore Rules

No se requieren cambios en Firestore rules.

### Rules impact analysis

No hay queries nuevas. Todas las queries existentes se mantienen iguales -- solo se agregan guards de cancelacion alrededor.

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | No |

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion.

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

No se requieren cambios en Cloud Functions.

## Componentes

### S1: Cancellation guards en 8 useEffect

Para cada useEffect que llama una funcion async sin guard, agregar el patron `let cancelled = false` + cleanup:

#### 1. `src/hooks/useProfileStats.ts:21`

**Estado actual:** `Promise.all(...).then(([r, f, fl]) => setCounts(...))` sin guard.
**Cambio:** Wrappear en async IIFE con `cancelled` flag y return cleanup.

#### 2. `src/components/business/MenuPhotoSection.tsx:29` (photo URL load)

**Estado actual:** `getMenuPhotoUrl(path).then(setPhotoUrl).catch(...)` sin guard.
**Cambio:** Agregar `let cancelled = false` y condicionar `setPhotoUrl` y `setPhotoUrl(null)` en catch.

#### 3. `src/components/business/MenuPhotoSection.tsx:42` (pending photos check)

**Estado actual:** `getUserPendingPhotos(...).then(...).catch(...)` sin guard.
**Cambio:** Agregar `let cancelled = false` y condicionar ambos `setHasPending`.

#### 4. `src/components/business/RecommendDialog.tsx:37`

**Estado actual:** `countRecommendationsSentToday(userId).then(setSentToday).catch(...)` sin guard.
**Cambio:** Agregar `let cancelled = false`, condicionar `setSentToday` y `setLoadingCount(false)` en finally.

#### 5. `src/components/home/SpecialsSection.tsx:65`

**Estado actual:** `fetchActiveSpecials().then((data) => { if (data.length > 0) setSpecials(data); }).catch(...)` sin guard.
**Cambio:** Agregar `let cancelled = false` y condicionar `setSpecials`.

#### 6. `src/components/lists/SharedListsView.tsx:37` (deep link fetch)

**Estado actual:** `fetchSharedList(sharedListId).then((list) => { if (list) setSelectedList(list); }).catch(...)` sin guard.
**Cambio:** Agregar `let cancelled = false` y condicionar `setSelectedList`.

Nota: Los otros dos useEffect de SharedListsView (lineas 67-74 y 76-80) **ya tienen** `let ignore = false` con cleanup. No necesitan cambio.

#### 7. `src/components/profile/MyFeedbackList.tsx:47`

**Estado actual:** `fetchUserFeedback(user.uid).then(setItems).catch(...).finally(...)` sin guard.
**Cambio:** Agregar `let cancelled = false`, condicionar `setItems` y `setLoading(false)` en finally.

#### 8. `src/components/admin/PhotoReviewCard.tsx:27`

**Estado actual:** `getDownloadURL(ref(storage, path)).then(setImageUrl).catch(...)` sin guard.
**Cambio:** Agregar `let cancelled = false` y condicionar `setImageUrl`.

### S2: try/catch en 3 async handlers

#### 1. `src/components/business/CheckInButton.tsx:26` (handleClick)

**Estado actual:** `handleClick` llama `undoCheckIn()` y `performCheckIn()` con `await` pero sin try/catch. Si alguna lanza excepcion, el error no se captura.
**Cambio:** Wrappear todo el cuerpo en try/catch con `logger.error` y `toast.error(MSG_CHECKIN.error)`.

Nota: Se necesita agregar un mensaje de error al archivo `src/constants/messages/checkin.ts` si no existe.

#### 2. `src/components/profile/CommentsList.tsx:44` (onConfirmDelete)

**Estado actual:** `await deleteComment(comment.id, user.uid)` sin try/catch.
**Cambio:** Wrappear en try/catch con `logger.error` y `toast.error`.

Nota: `onConfirmDelete` es el callback pasado a `useUndoDelete`. El hook ya maneja el flujo, pero si `deleteComment` lanza, el error se propaga sin captura. Se agrega try/catch dentro del callback.

#### 3. `src/components/profile/CommentsList.tsx:58` (handleEditSave)

**Estado actual:** `await editComment(commentId, user.uid, newText)` sin try/catch.
**Cambio:** Wrappear en try/catch con `logger.error` y `toast.error`.

Nota: `handleEditSave` es pasado al hook `useCommentEdit` como `onSave`. El hook llama `await onSave(...)` y si falla, el error se propaga. Se agrega try/catch dentro del callback para dar feedback visual.

### Mutable prop audit

No aplica. No se agregan componentes con props editables.

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `"Error al hacer check-in"` | toast en CheckInButton | Agregar como `MSG_CHECKIN.error` en `constants/messages/checkin.ts` |
| `"No se pudo eliminar el comentario"` | toast en CommentsList.onConfirmDelete | Agregar como `MSG_COMMON.deleteError` en `constants/messages/common.ts` (si no existe) |
| `"No se pudo guardar la edicion"` | toast en CommentsList.handleEditSave | Agregar como `MSG_COMMON.editError` en `constants/messages/common.ts` (si no existe) |

## Hooks

No se crean hooks nuevos. Se modifica `useProfileStats.ts` (agregar cancellation guard).

## Servicios

No se modifican servicios.

## S3: Eliminar dead exports

### Constantes que se eliminan completamente (no usadas en ningun lugar)

| Constante | Archivo | Accion |
|-----------|---------|--------|
| `OFFLINE_BACKOFF_BASE_MS` | `src/constants/offline.ts` | Eliminar linea 11 |
| `MAX_EDITORS_PER_LIST` | `src/constants/lists.ts` | Eliminar lineas 4-5 (archivo queda solo con `MAX_LISTS`) |
| `ADD_BUSINESS_URL` | `src/constants/ui.ts` | Eliminar lineas 8-9 |
| `TRUNCATE_COMMENT_PREVIEW` | `src/constants/validation.ts` | Eliminar linea 8 |
| `TRUNCATE_DETAIL_PREVIEW` | `src/constants/validation.ts` | Eliminar linea 9 |
| `TRUNCATE_USER_ID` | `src/constants/validation.ts` | Eliminar linea 10 |
| `MIN_RATING` | `src/constants/validation.ts` | Eliminar linea 20 |
| `MAX_RATING` | `src/constants/validation.ts` | Eliminar linea 21 |
| `MAX_CHECKINS_PER_DAY` | `src/constants/checkin.ts` | Eliminar lineas 7-8 |
| `FOLLOWS_PAGE_SIZE` | `src/constants/social.ts` | Eliminar linea 2 |
| `MAX_FOLLOWS` (social.ts) | `src/constants/social.ts` | Eliminar linea 1 (archivo queda vacio, eliminar archivo) |

Nota: `MAX_FOLLOWS` de `constants/social.ts` tampoco se importa en ningun lugar. `follows.ts` tiene su propia constante local `const MAX_FOLLOWS = 200` en linea 23. Verificar que `constants/social.ts` no sea re-exportado desde un barrel antes de eliminar.

### Constantes cuyo `export` se remueve (usadas internamente en su archivo)

| Constante | Archivo | Accion |
|-----------|---------|--------|
| `PASSWORD_MIN_LENGTH` | `src/constants/auth.ts` | Eliminar linea (redundante con `PASSWORD_RULES.minLength = 8`) |
| `PASSWORD_RULES` | `src/constants/auth.ts` | Remover `export` keyword (usado solo por `validatePassword` en el mismo archivo) |
| `BADGES` | `src/constants/badges.ts` | Remover `export` keyword (usado solo por `evaluateBadges` en el mismo archivo) |

### Collection getters que se eliminan completamente (nunca usados)

| Getter | Archivo | Accion |
|--------|---------|--------|
| `getListItemsCollection` | `src/services/sharedLists.ts` | Eliminar funcion (lineas 30-32) |
| `getPriceLevelsCollection` | `src/services/priceLevels.ts` | Eliminar funcion (lineas 13-16) |

### Collection getters cuyo `export` se remueve (usados internamente)

| Getter | Archivo | Accion |
|--------|---------|--------|
| `getCheckinsCollection` | `src/services/checkins.ts` | Remover `export` keyword |
| `getSharedListsCollection` | `src/services/sharedLists.ts` | Remover `export` keyword |
| `getFollowsCollection` | `src/services/follows.ts` | Remover `export` keyword |

### Verificacion de barrel exports

Se verifico que ninguna de las constantes/getters eliminados esta re-exportada desde `src/constants/index.ts` ni `src/services/index.ts`.

Se necesita verificar si `constants/social.ts` es re-exportado desde `constants/index.ts`. Si `MAX_FOLLOWS` es re-exportado, actualizar el barrel.

### Impacto en tests

`src/services/comments.test.ts` importa `getCommentsCollection` -- NO se toca (ese getter SI se usa externamente).

Verificar si algun test importa los getters a eliminar/deexportar:

- `getCheckinsCollection`: verificar `checkins.test.ts`
- `getSharedListsCollection`: verificar `sharedLists.test.ts`

Si los tests importan estas funciones, actualizar los tests para no depender de la funcion deexportada.

## Integracion

### Archivos modificados

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/hooks/useProfileStats.ts` | Cancellation guard |
| `src/components/business/MenuPhotoSection.tsx` | 2 cancellation guards |
| `src/components/business/RecommendDialog.tsx` | Cancellation guard |
| `src/components/home/SpecialsSection.tsx` | Cancellation guard |
| `src/components/lists/SharedListsView.tsx` | Cancellation guard (deep link effect) |
| `src/components/profile/MyFeedbackList.tsx` | Cancellation guard |
| `src/components/admin/PhotoReviewCard.tsx` | Cancellation guard |
| `src/components/business/CheckInButton.tsx` | try/catch en handleClick |
| `src/components/profile/CommentsList.tsx` | try/catch en onConfirmDelete y handleEditSave |
| `src/constants/offline.ts` | Eliminar 1 constante |
| `src/constants/lists.ts` | Eliminar 1 constante |
| `src/constants/ui.ts` | Eliminar 1 constante |
| `src/constants/validation.ts` | Eliminar 5 constantes |
| `src/constants/checkin.ts` | Eliminar 1 constante |
| `src/constants/social.ts` | Eliminar archivo completo |
| `src/constants/auth.ts` | Eliminar `PASSWORD_MIN_LENGTH`, deexportar `PASSWORD_RULES` |
| `src/constants/badges.ts` | Deexportar `BADGES` |
| `src/services/sharedLists.ts` | Eliminar `getListItemsCollection`, deexportar `getSharedListsCollection` |
| `src/services/priceLevels.ts` | Eliminar `getPriceLevelsCollection` |
| `src/services/follows.ts` | Deexportar `getFollowsCollection` |
| `src/services/checkins.ts` | Deexportar `getCheckinsCollection` |
| `src/constants/messages/checkin.ts` | Agregar mensaje de error |
| `src/constants/messages/common.ts` | Agregar mensajes de error si no existen |

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes. `PhotoReviewCard` importa `firebase/storage` directamente, pero eso es un issue existente (admin component) y fuera de scope.
- [x] **Duplicated constants**: Las constantes eliminadas estan duplicadas en algunos casos (`MAX_FOLLOWS` en social.ts y follows.ts local) -- la eliminacion resuelve la duplicacion.
- [x] **Context-first data**: No aplica -- no se agregan queries nuevas.
- [x] **Silent .catch**: No se agregan `.catch(() => {})`. Los try/catch nuevos usan `logger.error` + `toast.error`.
- [x] **Stale props**: No aplica.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| Tests existentes | Verificar que siguen pasando tras los cambios | Regresion |
| `src/services/checkins.test.ts` | Si importa `getCheckinsCollection`, actualizar import | Fix |

Los cambios son defensivos (guards y try/catch). No se crea logica nueva que requiera tests dedicados. El criterio es que `npm run test:run` y `npm run lint` pasen sin errores.

## Analytics

No se agregan nuevos eventos de analytics.

---

## Offline

### Cache strategy

No hay cambios en la estrategia de cache. Los cancellation guards no afectan el comportamiento offline -- solo previenen setState en componentes desmontados.

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | Sin cambios | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| CheckInButton (try/catch) | `useCheckIn` ya usa `withOfflineSupport` | Sin cambios |
| CommentsList delete/edit | Servicios existentes | Sin cambios |

### Fallback UI

Los try/catch nuevos muestran toast de error, lo cual mejora el feedback offline (antes el error se perdia silenciosamente).

---

## Decisiones tecnicas

1. **Deexportar vs eliminar**: Para constantes/getters usados internamente pero nunca importados externamente, se remueve el `export` keyword en vez de eliminar. Esto mantiene la funcionalidad interna intacta y reduce el surface area de API publica.

2. **Eliminar archivo `social.ts`**: Ambas constantes (`MAX_FOLLOWS`, `FOLLOWS_PAGE_SIZE`) son dead. `follows.ts` ya tiene sus propias constantes locales. El archivo se elimina y se actualiza el barrel si es necesario.

3. **`PASSWORD_MIN_LENGTH` redundante**: El valor `8` ya esta en `PASSWORD_RULES.minLength`. Se elimina la constante standalone para evitar divergencia.

4. **try/catch en callbacks de hooks**: Para `onConfirmDelete` y `handleEditSave` en CommentsList, se agrega try/catch dentro del callback (no en el hook consumidor) porque el error handling con toast necesita acceso al contexto del componente.

---

## Hardening de seguridad

No se agregan superficies nuevas. Los cambios son puramente defensivos.

### Firestore rules requeridas

Ninguna.

### Rate limiting

No aplica.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | N/A | N/A |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de tech debt o seguridad relevantes.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #254 | Race conditions en useEffect, error handling sin feedback, dead exports | Todo el plan |

Los propios cambios de este issue SON la resolucion de deuda tecnica detectada en la auditoria.
