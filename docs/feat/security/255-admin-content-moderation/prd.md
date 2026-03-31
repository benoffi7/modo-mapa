# PRD: Admin CRITICAL: Content moderation actions (comments, ratings, custom tags)

**Feature:** 255-admin-content-moderation
**Categoria:** security
**Fecha:** 2026-03-30
**Issue:** #255
**Prioridad:** CRITICAL

---

## Contexto

El admin panel (v2.34.1) tiene 16 tabs incluyendo ActivityFeed que muestra actividad reciente de comentarios, ratings, tags y otros. Los comentarios flaggeados por el sistema de moderacion (`checkModeration()`) se muestran con un chip "Flagged" en la tabla, pero no hay ninguna accion disponible. Actualmente, para eliminar contenido ofensivo, el admin debe acceder directamente a la consola de Firestore. Las Firestore rules solo permiten delete por el owner del documento (`resource.data.userId == request.auth.uid`), sin path de admin delete.

## Problema

- **Sin acciones de moderacion**: El admin panel puede visualizar contenido flaggeado en ActivityFeed pero no puede eliminar, ocultar ni tomar ninguna accion sobre comentarios, ratings o custom tags ofensivos.
- **Dependencia de Firestore Console**: La unica forma de moderar contenido es accediendo directamente a la consola de Firebase, lo cual es lento, propenso a errores y no deja audit trail en la app.
- **Sin audit log de moderacion**: No existe registro de que acciones de moderacion tomo el admin, cuando, ni sobre que contenido. Esto dificulta la rendicion de cuentas y la deteccion de patrones de abuso recurrente.

## Solucion

### S1. Cloud Functions callables de moderacion

Crear 3 Cloud Functions callables nuevas en `functions/src/admin/moderation.ts`:

- **`moderateComment`**: Recibe `{ commentId, action }` donde action es `'delete'` o `'hide'`. Delete elimina el documento y sus replies (cascade). Hide marca `hidden: true` en el doc.
- **`moderateRating`**: Recibe `{ ratingId, action: 'delete' }`. Elimina el rating.
- **`moderateCustomTag`**: Recibe `{ customTagId, action: 'delete' }`. Elimina el custom tag.

Todas las callables siguen el patron existente: `assertAdmin(request.auth)` + `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN` + input validation. Cada accion escribe un documento de audit log en una nueva coleccion `moderationLogs`.

Referencia: `functions/src/admin/feedback.ts` (patron de callable admin con assertAdmin + AppCheck).

### S2. Coleccion `moderationLogs` y audit trail

Nueva coleccion `moderationLogs` con documentos que registran:
- `adminId`, `action` (delete/hide), `targetCollection` (comments/ratings/customTags), `targetDocId`, `targetUserId`, `reason` (opcional), `snapshot` (copia del contenido eliminado para referencia), `timestamp`.

Firestore rules: read por admin, write solo via Admin SDK (Cloud Functions).

### S3. UI de acciones en ActivityFeed

Agregar columna "Acciones" en las tablas de comentarios, ratings y custom tags dentro de `ActivityFeed.tsx`:

- **Comentarios**: Boton de eliminar (IconButton con DeleteOutline) y boton de ocultar (IconButton con VisibilityOff). Los comentarios flaggeados muestran los botones con enfasis (color error).
- **Ratings**: Boton de eliminar.
- **Custom tags**: Boton de eliminar.

Cada accion muestra un dialog de confirmacion (`role="alertdialog"`) antes de ejecutar. Tras la accion, se actualiza la lista local con optimistic UI (elimina el item de la tabla) y se muestra toast de exito/error via `useToast()`.

### S4. Contador de side effects y cascade deletes

Al eliminar contenido via moderacion, las Cloud Functions deben:
- **Comentarios delete**: Eliminar replies huerfanas (cascade, mismo patron que `onCommentDeleted`), decrementar `replyCount` del padre si es reply, eliminar commentLikes asociados.
- **Comentarios hide**: Marcar como `hidden: true`. El frontend ya no mostraria el comentario (requiere filtro en queries existentes, pero eso es out of scope -- el campo `hidden` queda preparado).
- **Ratings delete**: Recalcular el promedio del negocio si hay un sistema de cache de rating promedio.
- **Custom tags delete**: Decrementar contadores relevantes si existen.

### S5. Seccion de historial de moderacion en admin

Agregar un sub-tab o seccion dentro de ActivityFeed (o como tab nuevo) que muestre los `moderationLogs` recientes. Columnas: fecha, admin, accion, tipo de contenido, usuario afectado, snapshot del contenido.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Cloud Function `moderateComment` (delete + hide + cascade) | Must | M |
| Cloud Function `moderateRating` (delete) | Must | S |
| Cloud Function `moderateCustomTag` (delete) | Must | S |
| Coleccion `moderationLogs` + Firestore rules | Must | S |
| Audit log write en cada accion de moderacion | Must | S |
| UI: botones de accion en ActivityFeed (comments, ratings, customTags) | Must | M |
| UI: dialog de confirmacion con `role="alertdialog"` | Must | S |
| Optimistic UI + toast de exito/error | Must | S |
| Service layer: `src/services/admin/moderation.ts` (callables wrapper) | Must | S |
| Seccion de historial de moderacion en admin | Should | M |
| Tests: Cloud Functions callables | Must | M |
| Tests: service layer frontend | Must | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Moderacion automatica (auto-delete de contenido flaggeado sin intervencion humana)
- Filtro de contenido `hidden` en queries del usuario final (el campo queda preparado pero el filtro se implementa aparte)
- Ban de usuarios o suspension temporal de cuentas
- Moderacion de fotos de menu (ya existe un flujo separado en PhotoReviewPanel)
- Notificacion al usuario cuyo contenido fue moderado (se puede agregar como follow-up)
- Moderacion de userTags predefinidos (solo custom tags, los predefinidos son controlados por el sistema)
- Bulk moderation (acciones masivas sobre multiples items a la vez)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/admin/moderation.ts` | Callable | assertAdmin gate, input validation (missing/invalid commentId, ratingId, customTagId, action), doc-not-found, delete path (cascade comments), hide path, audit log write, AppCheck enforcement |
| `src/services/admin/moderation.ts` | Service | httpsCallable invocation, error propagation, parameter passing |
| `functions/src/admin/moderation.test.ts` | Unit | Happy path delete comment, delete comment with replies (cascade), hide comment, delete rating, delete custom tag, unauthorized access, invalid input, doc not found |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (commentId, ratingId, customTagId, action strings)
- Todos los paths condicionales cubiertos (delete vs hide, con/sin replies, doc exists/not-found)
- Side effects verificados (audit log write, cascade deletes, counter decrements)

---

## Seguridad

- [x] Todas las callables usan `assertAdmin(request.auth)` -- patron existente en `functions/src/helpers/assertAdmin.ts`
- [x] Todas las callables usan `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN` -- patron existente
- [ ] Input validation: `commentId`/`ratingId`/`customTagId` deben ser strings no vacios
- [ ] Input validation: `action` debe ser uno de los valores permitidos (`'delete'` o `'hide'` para comments, `'delete'` para ratings/customTags)
- [ ] Doc existence check antes de operar (404 si no existe)
- [ ] Snapshot del contenido moderado guardado en `moderationLogs` antes de eliminar
- [ ] `moderationLogs` rules: read solo por admin, create/update/delete solo via Admin SDK
- [ ] Rate limit en callables de moderacion (5/min por admin) via `checkCallableRateLimit()`
- [ ] Logging seguro: no loggear contenido completo del documento en Cloud Functions logs (solo IDs)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `moderateComment` callable | Llamadas masivas para borrar todo el contenido | assertAdmin + AppCheck + rate limit 5/min |
| `moderateRating` callable | Eliminacion masiva de ratings | assertAdmin + AppCheck + rate limit 5/min |
| `moderateCustomTag` callable | Eliminacion masiva de tags | assertAdmin + AppCheck + rate limit 5/min |
| `moderationLogs` coleccion | Lectura de datos de moderacion por no-admin | Firestore rules: `allow read: if isAdmin()` |

Si el feature escribe a Firestore (moderationLogs):
- [ ] Create rule: solo Admin SDK (Cloud Functions) -- `allow create: if false`
- [ ] No hay campos writables por clientes
- [ ] Rate limit server-side en callable -- 5/min por admin

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Ninguno abierto actualmente | -- | -- |

Nota: El backlog tiene 0 issues de seguridad abiertos y 0 de tech debt abiertos (solo #168 bloqueado por deps upstream). La 3ra ronda de auditoria esta completada con 0 vulnerabilidades restantes. Este feature no agrava deuda existente.

### Mitigacion incorporada

- Las Firestore rules actuales para comments, ratings y customTags solo permiten delete por owner. Este feature NO modifica esas rules -- las callables usan Admin SDK (server-side) que bypasea rules. Esto es el patron correcto: las acciones de moderacion deben ser server-only, nunca client-side rules.
- El patron de cascade delete de comentarios ya existe en `onCommentDeleted` trigger. La callable de moderacion debe reutilizar la misma logica o invocar el mismo helper.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] Los handlers de accion de moderacion en ActivityFeed tienen `try/catch` con toast de error
- [ ] No hay `setState` despues de operaciones async sin guard de unmount (usar patron de cancelled flag si se refetchea)
- [ ] Los dialogs de confirmacion deshabilitan el boton mientras la operacion esta en progreso (loading state)
- [ ] Archivos nuevos no superan 300 lineas (warn) ni 400 lineas (blocker)

### Checklist de documentacion

- [ ] `docs/reference/features.md` actualizado con la nueva capacidad de moderacion en admin
- [ ] `docs/reference/firestore.md` actualizado con coleccion `moderationLogs`
- [ ] `docs/reference/security.md` actualizado con nuevas callables y rate limits
- [ ] `docs/reference/patterns.md` actualizado si se establece un patron nuevo de moderacion admin

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Fetch activity data (comments, ratings, tags) | read | Firestore persistent cache (ya existe en prod) | AdminPanelWrapper muestra error state |
| Moderar contenido (delete/hide) | write | No soportado offline -- requiere confirmacion server-side | Boton deshabilitado o toast de error si offline |
| Fetch moderation logs | read | Firestore persistent cache | Empty state con mensaje |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (ya habilitado globalmente en prod)
- [ ] Writes: NO tienen queue offline -- las acciones de moderacion requieren confirmacion del servidor (no queremos moderar contenido offline y aplicar despues)
- [ ] APIs externas: N/A
- [ ] UI: el admin panel ya tiene manejo de error en `AdminPanelWrapper`
- [x] Datos criticos: N/A para admin panel (no es critico offline)

### Esfuerzo offline adicional: S

Minimo -- solo asegurar que los botones de accion se deshabiliten si no hay conectividad.

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica de negocio en `src/services/admin/moderation.ts` (no inline en componente)
- [ ] Cloud Functions en `functions/src/admin/moderation.ts` (archivo dedicado, no appendear a feedback.ts)
- [ ] UI de acciones como componente extraido (ej: `ModerationActions.tsx` en `src/components/admin/`) si los botones + dialog superan 50 lineas
- [ ] Ningun componente nuevo importa directamente de `firebase/functions` -- usa service layer
- [ ] Constantes de moderacion (action types, rate limits) en `src/constants/admin.ts`
- [ ] Mensajes de toast en `src/constants/messages/admin.ts`
- [ ] Tipos nuevos (`ModerationLog`, `ModerationAction`) en `src/types/admin.ts`
- [ ] Converter para `moderationLogs` en `src/config/converters/` (archivo de dominio admin)
- [ ] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Acciones agregadas a ActivityFeed existente, logica en service layer |
| Estado global | = | No crea contexto nuevo, usa useToast existente |
| Firebase coupling | = | Callable wrappers en services/admin/moderation.ts |
| Organizacion por dominio | + | Nuevo archivo moderation.ts tanto en services como en functions, correctamente ubicado |

---

## Success Criteria

1. El admin puede eliminar un comentario flaggeado desde ActivityFeed y el comentario desaparece de la tabla con confirmacion visual (toast exito).
2. El admin puede ocultar un comentario (marcarlo como hidden) como alternativa a eliminarlo.
3. El admin puede eliminar ratings y custom tags ofensivos desde ActivityFeed.
4. Cada accion de moderacion genera un registro en `moderationLogs` con snapshot del contenido, timestamp y admin ID.
5. Las Cloud Functions de moderacion rechazan llamadas de no-admin con error apropiado y tienen rate limit de 5/min.
6. Tests de Cloud Functions con cobertura >= 80% cubriendo happy path, validacion, auth, y cascade deletes.
