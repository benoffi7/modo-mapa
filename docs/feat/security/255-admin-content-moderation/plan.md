# Plan: Admin content moderation actions

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Modelo de datos y configuracion

**Branch:** `feat/255-admin-content-moderation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar `ModerationAction`, `ModerationTargetCollection`, `ModerationLog` interfaces |
| 2 | `src/config/collections.ts` | Agregar `MODERATION_LOGS: 'moderationLogs'` |
| 3 | `src/config/adminConverters.ts` | Agregar `moderationLogConverter` (fromFirestore: id, adminId, action, targetCollection, targetDocId, targetUserId, reason, snapshot, timestamp via `toDate`) |
| 4 | `src/constants/admin.ts` | Agregar `MODERATION_ACTION_LABELS` (`delete: 'Eliminado'`, `hide: 'Ocultado'`) y `MODERATION_TARGET_LABELS` (`comments: 'Comentario'`, `ratings: 'Rating'`, `customTags: 'Tag personalizado'`) |
| 5 | `src/constants/messages/admin.ts` | Agregar mensajes de moderacion a `MSG_ADMIN`: `moderateDeleteSuccess` (funcion por tipo), `moderateHideSuccess`, `moderateError`, `moderateConfirmDeleteTitle`, `moderateConfirmHideTitle`, `moderateConfirmDeleteBody`, `moderateConfirmHideBody` |
| 6 | `firestore.rules` | Agregar regla `moderationLogs`: `allow read: if isAdmin(); allow create, update, delete: if false;` |

### Fase 2: Cloud Functions callables

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/moderation.ts` | Crear archivo con helper `writeModerationLog` y 3 callables: `moderateComment`, `moderateRating`, `moderateCustomTag`. Cada una: `assertAdmin` + `ENFORCE_APP_CHECK_ADMIN` + `checkCallableRateLimit('moderate_${auth.uid}', 5)` + input validation + doc existence check + snapshot to moderationLogs + accion (delete/hide) |
| 2 | `functions/src/admin/moderation.ts` | En `moderateComment` delete path: query replies (`parentId == commentId`), batch delete replies. Query commentLikes (`commentId == commentId`), batch delete likes. Si tiene `parentId`, decrementar `replyCount` del padre. Delete doc principal |
| 3 | `functions/src/admin/moderation.ts` | En `moderateComment` hide path: `update({ hidden: true })` |
| 4 | `functions/src/index.ts` | Agregar exports: `export { moderateComment, moderateRating, moderateCustomTag } from './admin/moderation'` |

### Fase 3: Service layer frontend

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/admin/moderation.ts` | Crear archivo con 4 funciones: `moderateComment(commentId, action)`, `moderateRating(ratingId)`, `moderateCustomTag(customTagId)` como wrappers de `httpsCallable`, y `fetchModerationLogs(count)` como query Firestore con `moderationLogConverter` |
| 2 | `src/services/admin/index.ts` | Agregar re-exports: `export { moderateComment, moderateRating, moderateCustomTag, fetchModerationLogs } from './moderation'` |

### Fase 4: Componentes UI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/ModerationActions.tsx` | Crear componente: IconButtons (DeleteOutline, VisibilityOff opcional) + Dialog de confirmacion (`role="alertdialog"`) + loading state en boton Confirmar + llamadas al service layer + toast exito/error via `useToast()` + `useConnectivity().isOffline` para deshabilitar botones offline |
| 2 | `src/components/admin/ModerationLogTable.tsx` | Crear componente: usa `ActivityTable` con columns Fecha, Admin, Accion (chip con color), Tipo, Usuario (ID truncado), Contenido (snapshot truncado a 60 chars) |
| 3 | `src/components/admin/ActivityFeed.tsx` | Agregar import de `ModerationActions`, `ModerationLogTable`, `fetchModerationLogs`. Agregar `ModerationLog[]` al tipo `ActivityData`. Agregar estado `removedIds` (`useState<Set<string>>(new Set())`). Agregar handlers `handleDeleted(id)` y `handleHidden(id)` que agregan al set |
| 4 | `src/components/admin/ActivityFeed.tsx` | En tab 0 (comentarios): agregar columna `{ label: 'Acciones', render: (c) => <ModerationActions itemId={c.id} targetCollection="comments" allowHide emphasized={c.flagged} onDeleted={handleDeleted} onHidden={handleHidden} /> }`. Filtrar `comments` con `.filter(c => !removedIds.has(c.id))` |
| 5 | `src/components/admin/ActivityFeed.tsx` | En tab 1 (ratings): agregar columna Acciones con `<ModerationActions itemId={r.userId + '__' + r.businessId} targetCollection="ratings" onDeleted={handleDeleted} />`. Nota: rating ID es compound `{userId}__{businessId}` |
| 6 | `src/components/admin/ActivityFeed.tsx` | En tab 3 (tags): agregar columna Acciones solo para items de tipo `'custom'`: `render: (t) => t.type === 'custom' ? <ModerationActions itemId={t.id} targetCollection="customTags" onDeleted={handleDeleted} /> : null`. Filtrar merged list con removedIds |
| 7 | `src/components/admin/ActivityFeed.tsx` | Agregar tab 7 "Moderacion ({logs.length})": renderiza `<ModerationLogTable logs={moderationLogs} />`. Agregar `fetchModerationLogs(ADMIN_PAGE_SIZE)` al Promise.all del fetcher |

### Fase 5: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/admin/moderation.test.ts` | Tests de Cloud Functions: mock pattern de `feedback.test.ts`. Tests: unauthorized, invalid input (3 callables), doc-not-found (3), delete comment happy path, delete comment con replies cascade, delete comment con likes cascade, delete reply (replyCount decrement), hide comment, delete rating, delete custom tag, audit log write verification, rate limit exceeded |
| 2 | `src/services/admin/__tests__/moderation.test.ts` | Tests de service layer: mock `firebase/functions` httpsCallable, mock `firebase/firestore` getDocs. Tests: moderateComment/Rating/CustomTag invocacion, fetchModerationLogs query, error propagation |

### Fase 6: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Agregar coleccion `moderationLogs` a la tabla de colecciones. Agregar `moderationLogConverter` a lista de admin converters. Agregar campo `hidden` a `Comment` interface |
| 2 | `docs/reference/security.md` | Agregar callables de moderacion a la lista de funciones admin con rate limits. Documentar regla de `moderationLogs` |
| 3 | `docs/reference/features.md` | Agregar capacidad de moderacion de contenido en seccion admin |
| 4 | `docs/reference/tests.md` | Agregar archivos de test nuevos al inventario (admin/moderation.test.ts, services/admin/moderation.test.ts) |

---

## Orden de implementacion

1. **Tipos y constantes** (Fase 1, pasos 1-5) -- sin dependencias
2. **Firestore rules** (Fase 1, paso 6) -- sin dependencias
3. **Cloud Functions** (Fase 2) -- depende de tipos (conceptuales, no import directo)
4. **Service layer** (Fase 3) -- depende de collections.ts y adminConverters.ts
5. **Componentes UI** (Fase 4) -- depende de service layer y constantes
6. **Tests** (Fase 5) -- depende de codigo a testear
7. **Docs** (Fase 6) -- ultimo

---

## Riesgos

1. **Cascade delete de commentLikes es costoso para comentarios muy populares.** Mitigacion: los comentarios en prod tienen como maximo ~20 likes. Si un comentario tuviera 500+ likes, el batch delete podria exceder el limite de Firestore (500 writes por batch). La callable usa un solo batch que cubre replies + likes + doc. Si excede 500, se necesitarian batches multiples. Para el volumen actual esto no es un riesgo real.

2. **El rating ID en ActivityFeed es compound pero el render usa campos separados.** El `ActivityTable` itera sobre objetos `Rating` que tienen `userId` y `businessId` por separado. El ID para la callable debe ser `{userId}__{businessId}`. Mitigacion: construir el ID en el render (`r.userId + '__' + r.businessId`) o alternativamente agregar un campo `id` al tipo Rating. Verificar que el converter de ratings incluya el doc ID.

3. **`onCommentDeleted` trigger se dispara tras el delete de la callable.** Esto es correcto -- el trigger maneja counters y aggregates. Pero si la callable ya hizo cascade delete de replies, cada reply eliminada tambien dispara `onCommentDeleted` (que a su vez hace cascade de sus replies). Mitigacion: esto es el comportamiento existente y correcto -- cada reply triggerea su propio cleanup de counters.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente -- usa `src/services/admin/moderation.ts`
- [x] Archivos nuevos en carpeta de dominio correcta: `admin/` en functions, services, y components
- [x] Logica de negocio en services (callables wrappers), no en componentes
- [x] Ningun archivo resultante supera 400 lineas (mayor: ActivityFeed.tsx ~260, moderation.ts functions ~180)

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Agregar callables moderateComment/Rating/CustomTag con rate limits y AppCheck |
| 2 | `docs/reference/firestore.md` | Agregar coleccion moderationLogs, campo hidden en comments, converter |
| 3 | `docs/reference/features.md` | Agregar moderacion de contenido a capacidades admin |
| 4 | `docs/reference/tests.md` | Agregar tests nuevos al inventario |

---

## Criterios de done

- [ ] 3 Cloud Functions callables operativas (moderateComment, moderateRating, moderateCustomTag)
- [ ] Coleccion `moderationLogs` con regla Firestore
- [ ] Botones de accion en ActivityFeed para comments, ratings y custom tags
- [ ] Dialog de confirmacion con role="alertdialog"
- [ ] Optimistic UI (item removido del listado sin refetch)
- [ ] Toast de exito/error
- [ ] Historial de moderacion visible en tab dedicado
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Docs de referencia actualizados (security, firestore, features, tests)
