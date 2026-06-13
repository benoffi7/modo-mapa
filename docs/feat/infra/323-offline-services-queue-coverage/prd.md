# PRD: Offline — services not using offlineQueue / withOfflineSupport

**Feature:** 323-offline-services-queue-coverage
**Categoria:** infra
**Fecha:** 2026-04-25
**Issue:** #323
**Prioridad:** Alta

---

## Contexto

Modo Mapa se publica como PWA con instalacion desde el navegador y promete trabajo "aun sin conexion". La infraestructura offline existe y esta probada (`offlineQueue.ts` IndexedDB nativo, `offlineInterceptor.ts` con `withOfflineSupport`, `getCountOfflineSafe`, `syncEngine.ts` con replay de 23 `OfflineActionType`s). Todos los `list_*` types y el resto del enum estan registrados en `src/types/offline.ts` y mapeados en `syncEngine.executeAction`.

El audit `/health-check` (2026-04-25, offline-auditor) detecto que esa infraestructura esta **integrada solo en una franja angosta del producto**: hooks de rating/check-in/follow/comment-like + `FavoriteButton`/`RecommendDialog`/`BusinessQuestions`/`ReceivedRecommendations`. Casi todos los demas writes que se disparan desde la UI ejecutan `addDoc`/`setDoc`/`updateDoc`/`deleteDoc` de manera incondicional, sin checkear `useConnectivity().isOffline` ni encolar en IndexedDB. Resultado: **el primer write offline lanza una promise que queda colgada (Firestore con persistencia esta en cache pero igual reintenta y termina en error de red), el usuario ve un spinner infinito o un toast de error confuso, y el dato se pierde**. Esto contradice el contrato de PWA y dispara incidentes silenciosos: check-ins de almuerzo perdidos, listas creadas que desaparecen al sincronizar, comentarios borrados que reaparecen.

## Problema

- Decimos "PWA" en el manifest y mostramos el `OfflineIndicator` chip, pero la mayoria de los writes no se enquean. El usuario percibe que la app *sabe* que esta offline y aun asi pierde su accion. Confianza rota.
- Hay 7 superficies user-facing con riesgo alto de data loss: lists CRUD (`updateList`, `toggleListPublic`, `deleteList`, `removeBusinessFromList`, `addBusinessToList` en componentes de listas), `editComment`/`deleteComment` (en `BusinessComments`, `CommentsList`, `useCommentListBase`), `upsertCriteriaRating`, `markAllRecommendationsAsRead`, `inviteEditor`/`removeEditor`, `markFeedbackViewed`. Mas 2 callables destructivos (`deleteUserAccount`, `cleanAnonymousData`) que pueden colgar la sesion si el usuario los dispara sin red.
- Hay 6 superficies medium-impact donde el usuario silently no ve cambios: `sendFeedback` (con upload a Storage), `updateUserSettings` (toggles del SettingsPanel — toda la "persistencia" se pierde), `updateUserDisplayName`/`updateUserAvatar`, `uploadMenuPhoto`/`reportMenuPhoto`. Adicional: `<img>` de menu photos no tiene `onError` en `MenuPhotoSection`/`MenuPhotoViewer` (Storage URL puede fallar offline → roto visual sin fallback).
- Hay 3 issues de menor severidad pero que impactan auditorias futuras: catalog seeding admin (`saveAllSpecials`, `saveAllAchievements`) deberia gatear con guard simple (`isOffline`) — son admin pero tocan la misma infra; `OfflineIndicator` solo esta montado en `TabShell` (no se ve en modales fullscreen como `BusinessDetailScreen`, `ListDetailScreen`, `MenuPhotoViewer`); el item de `APIProvider` que el issue marca como violacion (`SearchScreen.tsx:145`) ya tiene `MapErrorBoundary` envolviendolo (verificado) — el guard de patterns sigue valido pero en este archivo no hay regression actual.

## Solucion

### S1 — Contract: toda mutacion user-facing debe estar gated o enqueueada

Definir como invariante del proyecto: **cualquier `addDoc`/`setDoc`/`updateDoc`/`deleteDoc`/`writeBatch.commit`/`httpsCallable` que se origina en una accion del usuario (no en sync engine, no en admin) debe pasar por uno de estos tres caminos**:

1. **Encolable** (default para writes simples y reversibles): wrappear en `withOfflineSupport(isOffline, type, meta, payload, onlineAction, toast)`. El servicio queda intacto; solo el caller se modifica. El `OfflineActionType` debe existir en `src/types/offline.ts` y tener su branch en `syncEngine.executeAction`.
2. **Gated** (para operaciones no-encolables: callables destructivos, batches grandes, uploads de archivos): chequear `useConnectivity().isOffline` en el componente y bloquear el CTA con feedback visible. Requisitos del feedback:
   - El usuario debe entender que la accion esta bloqueada por estar offline (no por otra razon).
   - El usuario debe ver el estado offline en el mismo viewport donde intenta la accion (no solo en el TabShell — ver S4).
   - Si el CTA es un `<Button disabled>`, ese disabled debe acompañarse de un texto adyacente o tooltip accesible que explique el motivo (los tooltips de MUI sobre disabled buttons requieren wrapper — el implementador resolvera el detalle tecnico).
   - Si el flujo tiene un dialog de confirmacion (deleteAccount, cleanAnonymousData), el dialog NO debe llegar a mostrarse cuando ya hay offline al apretar el trigger — el toast.error preventivo basta.
   Patron ya usado en `MenuPhotoViewer` (line 60) — replicar la *intencion*, no necesariamente la forma exacta.
3. **Implicito por SDK** (Firestore reads en general): no requiere wrapper, los reads usan persistencia offline de Firestore. No es alcance de este feature.

Excepciones documentadas en `docs/reference/guards/304-offline.md`:

- `src/services/admin/*` — flujo admin con red garantizada
- Tests
- El propio `withOfflineSupport`/`syncEngine`

Cualquier violacion del contract es bloqueante en `pre-staging-check.sh` (ya tenemos los `grep` patterns en el guard de #304 — esto los usa).

### S2 — Cobertura de superficies HIGH (writes user-facing, data loss real)

Cada item especifica el patron a aplicar. Resumen:

| Superficie | Archivo caller | Accion requerida |
|-----------|----------------|------------------|
| `editComment` | `BusinessComments.tsx:163`, `CommentsList.tsx:70`, `useCommentListBase.ts` | wrappear con `withOfflineSupport('comment_edit', ...)` (nuevo type). **Gated por presencia de pending `comment_create` del mismo comment** (ver S5): si la UI detecta que el comment todavia no se sincronizo, los botones "Editar"/"Eliminar" quedan disabled con tooltip "Esperando sincronización" |
| `deleteComment` | `CommentsList.tsx:52`, `useCommentListBase.ts:48` (via `useUndoDelete`) | wrappear con `withOfflineSupport('comment_delete', ...)` (nuevo type). **Gated por presencia de pending `comment_create` del mismo comment** (ver S5). Snackbar diferenciado online vs offline (ver S3 / decision sobre undo) |
| `upsertCriteriaRating` | `useBusinessRating.ts:147` | wrappear con `'rating_upsert'` reutilizando el type existente con el branch que recibe `criteria` parcial — o agregar `'rating_criteria_upsert'` para distinguir replay (preferido por claridad de payload) |
| `createList` | `CreateListDialog.tsx:45`, `AddToListDialog.tsx:116` | wrappear con `'list_create'` (ya existe). Generar `listId` client-side via `generateListId()` para optimistic UI |
| `updateList` | `ListDetailScreen.tsx:77,142` | wrappear con `'list_update'` (ya existe) |
| `toggleListPublic` | `ListDetailScreen.tsx:88` | wrappear con `'list_toggle_public'` (ya existe) |
| `deleteList` | `ListDetailScreen.tsx:108` | **gated en el caller** (no encolable a pesar de tipo existente). Ver decision detallada abajo. `isOffline` → toast "No podés eliminar listas sin conexión, intentá de nuevo cuando vuelvas online" + return |
| `addBusinessToList` | `AddToListDialog.tsx:100,118` | wrappear con `'list_item_add'` (ya existe) |
| `removeBusinessFromList` | `ListDetailScreen.tsx:121`, `AddToListDialog.tsx:95`, `FavoritesList.tsx:100` | wrappear con `'list_item_remove'` (ya existe) |
| `markAllRecommendationsAsRead` | `ReceivedRecommendations.tsx:55` | gated (writeBatch — no encolable). Si `isOffline`, no llamar; el unread badge se reconcilia al volver |
| `inviteEditor` (callable) | `InviteEditorDialog.tsx:35` | gated. El boton se deshabilita y muestra "Requiere conexion" |
| `removeEditor` (callable) | `EditorsDialog.tsx:70` | gated. Idem inviteEditor |
| `deleteAccount` (callable destructivo) | `DeleteAccountDialog.tsx:56` | gated. Si offline, toast.error con mensaje claro de seguridad ("Necesitas conexion estable para eliminar tu cuenta — esta accion es irreversible") y abortar |
| `cleanAnonymousData` (callable destructivo) | `SettingsMenu.tsx:62` | gated. Idem deleteAccount |
| `removeFavorite` directo | `FavoritesList.tsx:100` | wrappear con `'favorite_remove'` (ya existe). Hoy es la unica llamada a removeFavorite que NO esta wrappeada (FavoriteButton si lo esta) |

#### S2.1 — Decision sobre `list_delete` (resolucion bloqueante Sofia Ciclo 1)

`OfflineActionType.list_delete` ya existe en `src/types/offline.ts:24`, su payload `ListDeletePayload` esta definido, y `syncEngine.ts:149-155` tiene el branch correspondiente. **Decision: conservar el tipo + branch + payload, gatear el caller**.

Justificacion:
- **No borrar el tipo**: borrarlo seria breaking change para queues persistentes pre-#323. Si un usuario instalo la PWA antes de este feature y tiene una accion `list_delete` enqueued en su IndexedDB local, al cargar la nueva version el syncEngine debe poder replayarla. El branch existente lo asegura (defensivo).
- **No encolar nuevas**: el caller (`ListDetailScreen.tsx:108`, futuros callers como `useDeleteList` si se extrae) **gatea con `isOffline` antes de invocar `withOfflineSupport`**. Si offline → toast con mensaje en voseo ("No podés eliminar listas sin conexión, intentá de nuevo cuando vuelvas online") y NO encolar. Cascade delete sobre listas con N items es inseguro de replayar a ciegas (cambios concurrentes server-side, ownership transfer, etc).
- **Consistencia con #304**: el guard `docs/reference/guards/304-offline.md` ya documenta esta excepcion como "list_delete (bloqueada offline, pero tipo definido para replay)". Este PRD la formaliza en codigo.

Resultado neto: el branch en syncEngine es defensivo (replay de queues legacy), el contrato del PRD lo declara explicitamente, y nuevos `list_delete` no se encuen.

### S3 — Cobertura de superficies MEDIUM (silent fail, no data loss critico)

| Superficie | Archivo caller | Accion |
|-----------|----------------|--------|
| `updateUserSettings` | `useUserSettings.ts:53,70,83,96`, `useFollowedTags.ts:75,97`, `useInterestsFeed.ts:46` | gated. Settings se gestionan optimistically (state local); si `isOffline` el state local cambia pero el writeback no se ejecuta. Al volver online, hacer flush del **state actual completo** (no replay de cada toggle individual) via un effect. Si el usuario cierra la app antes de reconectar, los cambios offline se pierden — aceptable, settings son eventually consistent y no hay riesgo de inconsistencia server-side. La UI debe reconciliar al re-fetch tras reconectar |
| `updateUserDisplayName` / `updateUserAvatar` | hook que las llama (AuthContext o Profile screen) | gated. El boton "Guardar" deshabilitado offline. No se enquean (forman parte de `users` que tiene `keys().hasOnly()` muy estricto y ownership) |
| `sendFeedback` | `FeedbackForm.tsx:86` | gated. Submit deshabilitado offline. Razon: tiene upload a Storage que no es encolable + payload con archivos |
| `markFeedbackViewed` | `MyFeedbackList.tsx:63` | fire-and-forget existente; cambiar a guard `if (isOffline) return` (no es importante perder un viewed flag) |
| `uploadMenuPhoto` | `MenuPhotoUpload.tsx:55` | gated **desde el momento de abrir el dialog** — no permitir que el usuario seleccione el archivo si esta offline, para evitar que pierda tiempo eligiendo y luego se le rechaze. Storage `uploadBytesResumable` no es encolable; tiene heartbeat propio |
| `reportMenuPhoto` (callable) | `MenuPhotoViewer.tsx:35` | **YA gated** correctamente (line 60). Solo confirmar que el patron quede documentado |
| `<img>` sin onError | `MenuPhotoSection.tsx:83` (ya tiene), `MenuPhotoViewer.tsx:79` (ya tiene) | **YA tienen onError**. El issue lo marca como gap pero la version actual ya lo cubre. Auditar que no hayamos roto el comportamiento; agregar tests si faltan |

Nota tecnica para `useUserSettings`: hoy los toggles ejecutan `updateUserSettings(...).catch(...)`. Para mantener la promesa de PWA, agregar:

```ts
// Pseudo:
useEffect(() => {
  if (!isOffline && pendingSettingsRef.current) {
    updateUserSettings(user.uid, pendingSettingsRef.current).catch(...);
    pendingSettingsRef.current = null;
  }
}, [isOffline, user?.uid]);
```

El flush escribe el **state local de la tab** (no merge con server) — explicitado en S5 multi-tab.

#### S3.1 — `comment_delete` / `comment_edit` offline + undo (resolucion importante Sofia Ciclo 1)

El caller actual de delete (`useCommentListBase.ts:48` via `useUndoDelete`) hace optimistic remove + `setTimeout(4s)` + opcion "Deshacer" en snackbar. Al integrar `withOfflineSupport`, **el undo offline NO aplica**. Decision:

- **Online** (comportamiento actual, sin cambios): `withOfflineSupport` ejecuta directo (no encola — ver `offlineInterceptor.ts:22-24`). Snackbar mantiene "Deshacer" + setTimeout 4s. Si el usuario presiona "Deshacer", el delete nunca llega a ejecutarse (ya que la accion real corre dentro del `setTimeout`, no antes). Sin cambios sobre lo existente.
- **Offline**: la accion se encola. Snackbar muestra **"Eliminado offline (se sincronizara cuando vuelvas online)"** **sin boton "Deshacer"**. Una vez encolado, el undo no es practico (requeriria modificar la firma de `withOfflineSupport` para devolver `actionId` y exponer un `offlineQueue.remove(actionId)` desde la UI — scope creep).
- **Firma de `withOfflineSupport` SIN cambios**: el wrapper sigue como esta (no devuelve `actionId`, no se modifica). El caller diferencia los dos paths chequeando `isOffline` y eligiendo el snackbar correcto antes de invocar el wrapper.

Mismo patron para `comment_edit`:

- **Online**: comportamiento actual, edit instantaneo + toast.
- **Offline**: optimistic UI con badge "Sincronizando..." en la entrada de comment editada. Una vez encolada, no hay undo posible — el edit se aplica al reconectar. Si el usuario quiere revertir, debe editar de nuevo (offline u online).

Esto **NO afecta la firma publica de `withOfflineSupport`** ni `offlineQueue`. La logica de "elegir snackbar" vive en el caller (componente o sub-hook).

### S4 — Cobertura de superficies LOW

| Superficie | Accion |
|-----------|--------|
| `saveAllSpecials` / `saveAllAchievements` (admin) | Gated client-side: si `isOffline`, deshabilitar boton "Guardar". Es admin pero el pattern guard documentado lo permite (`src/services/admin/*` excepcion no aplica porque viven en `src/services/`). Decision: gated, no enqueue, mensaje claro |
| `<APIProvider>` en `SearchScreen.tsx:145` | **YA esta wrappeado** en `MapErrorBoundary` (line 144). Confirmar que el guard `grep` siga pasando y agregar test de regresion si no existe |
| `OfflineIndicator` solo en `TabShell` | Mover el indicador a un nivel mas alto. **Decision producto: subir al root** (`App.tsx`) para que se vea en cualquier ruta/dialog full-screen (BusinessDetailScreen, ListDetailScreen, MenuPhotoViewer, dialogs de auth). Es `position: fixed` asi que no rompe layout. Garantia funcional: en cualquier viewport donde el usuario pueda intentar una accion gated, ve el chip CloudOff antes de intentar |

### S5 — OfflineActionType: nuevos types o reuso

Decisiones que valida Sofia (ver Validacion Funcional):

- **`comment_edit`** (NUEVO): payload `{ commentId, text }`. Replay en syncEngine debe llamar `editComment(commentId, userId, text)`. Justificacion: hoy no hay forma de encolar edits de comments y son una accion comun en mobile.
- **`comment_delete`** (NUEVO): payload `{ commentId }`. Replay llama `deleteComment(commentId, userId)`. Las delete-cascades son server-side via `onCommentDeleted` Cloud Function — encolar el delete del root es seguro.
- **`rating_criteria_upsert`** (NUEVO): payload `{ criterionId, value }`. Replay llama `upsertCriteriaRating(userId, businessId, { [criterionId]: value })`. Mas claro que reusar `rating_upsert` con un payload mixto.

Total: 3 types nuevos. Total final del enum: 26 (23 + 3).

**Replay order y conflictos en queue de un mismo recurso**:

- La queue procesa en orden de `createdAt` (ya garantizado por `getPending` con sort). Si el usuario edita y luego elimina un comment **ya sincronizado** offline, ambas se enquen — al sincronizar, el edit corre primero (succede), luego el delete corre (succede); resultado consistente con la intencion del usuario.
- Si el usuario elimina y luego intenta editar el mismo comment offline (caso raro: la UI debe deshabilitar el edit despues de un delete pendiente, pero por defensa): el edit fallara en el servidor con "doc no existe" tras el delete; el syncEngine reintenta hasta `OFFLINE_MAX_RETRIES` y luego marca `failed`. Aceptable. La UI debe asegurarse de que la lista de comentarios no muestre comentarios marcados como pending-delete (ver requisito en S2).
- **`comment_create + comment_edit` / `comment_delete` del mismo comment offline** (resolucion bloqueante Sofia Ciclo 1): **out-of-scope #323**. Solo permitir `edit`/`delete` de comments **ya sincronizados**. La UI **deshabilita** los botones "Editar" y "Eliminar" en cualquier comment que tenga un `comment_create` pendiente en la queue. Implementacion sugerida:
  - `useOfflineQueue` (o un hook nuevo `usePendingActions(commentId)`) expone `hasPendingCreate(localCommentId)` consultando la queue por `type === 'comment_create'` con el local id correspondiente.
  - Si retorna `true`, los botones de edit/delete quedan `disabled` con `<Tooltip title="Esperando sincronización">`.
  - Esto evita el problema de "comment recien creado offline no tiene `commentId` server-side" — directamente no se permite editarlo hasta que sincronice.
  - Documentado explicitamente en Out of Scope: "Edit/delete de un comment que aun no se sincronizo. Tracked como follow-up si surge demanda real (probable: tunear UX para que el edit pendiente se aplique al ack del create)."
- **`rating_upsert + rating_criteria_upsert` del mismo rating**: el orden por `createdAt` garantiza global-primero. El merge semantics de `upsertCriteriaRating` debe respetar el global (`upsertCriteriaRating(userId, businessId, { [criterionId]: value })` hace merge no destructivo del campo `criteria`). Confirmar con test explicito (caller online: write global + write criteria; caller offline: queue las dos; replay: queda igual).
- **Multi-device del mismo usuario**: queue de mobile con edit, queue de desktop con delete. Reconectar primero desktop = delete pasa; mobile reconecta luego = edit falla con doc-no-existe → `OFFLINE_MAX_RETRIES` → `failed` → toast.error informativo. Aceptable; coordinacion cross-device es out-of-scope.
- **Multi-tab `useUserSettings`**: el flush escribe el **state local de la tab** (no merge con server). Si dos tabs hacen cambios offline distintos al mismo userSettings doc, el orden de flush sera por tab — la ultima en sincronizar gana. Aceptable: settings son eventually consistent y la UI se actualiza con un re-fetch al reconectar. **Nota explicita** (resolucion observacion Sofia): el flush no hace merge con server; escribe el snapshot local completo al volver online.

**Re-moderacion en `comment_edit` replay** (resolucion importante Sofia Ciclo 1): el replay de `comment_edit` produce el **mismo resultado que un edit online**. La re-moderacion es responsabilidad del trigger `onCommentUpdated` (`functions/src/triggers/comments.ts:113-142`); este PRD no la modifica. Si el comment estaba `flagged: true` y el edit lo limpia, el flag se levanta — ese comportamiento existe online y no es regresion de #323. Cambiar la moderacion (ej: sticky moderation que retiene flags tras edit) es out-of-scope; tracked como follow-up si producto decide cambiarlo.

NO se agrega type para `markAllRecommendationsAsRead`, `inviteEditor`, `removeEditor`, `deleteAccount`, `cleanAnonymousData`, `sendFeedback`, `uploadMenuPhoto`, `saveAllSpecials`, `saveAllAchievements`, `updateUserSettings`, `updateUserDisplayName`, `updateUserAvatar` — son **gated**, no encolables.

### S6 — Tests de regresion y cobertura de callers

Aprovechar que `docs/reference/guards/304-offline.md` ya tiene los `grep` patterns. Los specs deberian:

1. Asegurar que `pre-staging-check.sh` corre los 3 greps del guard (mutaciones, callables, getCountFromServer) y falla si hay nuevos hits no whitelisted.
2. **Agregar greps de callers** que detecten violaciones del contrato S1 desde el lado de quien invoca (ver S6.1).
3. Agregar tests unitarios para los 3 nuevos branches en `syncEngine.executeAction` (`comment_edit`, `comment_delete`, `rating_criteria_upsert`).
4. Tests de componentes para verificar que los botones HIGH (lists CRUD, callables) se deshabilitan correctamente cuando `isOffline=true`.

#### S6.1 — Cobertura de callers en `pre-staging-check.sh` (resolucion bloqueante Sofia Ciclo 1)

El guard #304 corre `grep "addDoc|setDoc|updateDoc" src/services/`. Eso cubre **definiciones** de servicios, no **invocaciones** desde componentes. El contrato S1 se viola tipicamente desde `src/components/` o `src/hooks/` cuando alguien importa `editComment(...)` directo sin envolver. Para cerrar el loop, **agregar a `scripts/pre-staging-check.sh`** un nuevo grep dedicado a callers.

**Path del script**: `scripts/pre-staging-check.sh` (existente; este PRD lo extiende).

**Lista de mutadores user-facing** que el grep debe vigilar (callers en `src/components/` y `src/hooks/`):

```
addComment, editComment, deleteComment,
toggleCommentLike,
toggleFavorite, removeFavorite,
upsertRating, deleteRating, upsertCriteriaRating,
addCheckin, deleteCheckin,
upsertPriceLevel, deletePriceLevel,
addBusinessTag, removeBusinessTag,
followUser, unfollowUser,
createList, updateList, toggleListPublic, deleteList,
addBusinessToList, removeBusinessFromList,
sendRecommendation, markRecommendationAsRead, markAllRecommendationsAsRead,
inviteEditor, removeEditor,
deleteAccount, cleanAnonymousData,
sendFeedback, markFeedbackViewed,
updateUserSettings, updateUserDisplayName, updateUserAvatar,
uploadMenuPhoto, reportMenuPhoto,
saveAllSpecials, saveAllAchievements
```

**Heuristica**: para cada nombre de la lista, buscar invocaciones en `src/components/` y `src/hooks/`. Para cada hit, validar que cumpla **al menos uno** de:

- Esta envuelto en una llamada a `withOfflineSupport(...)` cercana en el mismo archivo (mismo bloque de scope, heuristica `grep -B5 -A0` con `withOfflineSupport`).
- El componente/hook tiene un `disabled={... isOffline ...}` o un guard `if (isOffline) ... return` cercano al callsite.
- El archivo esta en la whitelist documentada.

**Whitelist documentada** (no son violaciones — el script las ignora):

- `src/services/**` (definiciones, no callers)
- `src/services/admin/**` (admin con red garantizada — ver S1 excepciones)
- `src/services/syncEngine.ts` (replay de la queue, por diseño no usa wrapper)
- `src/services/offlineInterceptor.ts` (la wrapper misma)
- `src/**/__tests__/**`, `src/**/*.test.ts`, `src/**/*.test.tsx` (tests)

**Definicion de "violacion"**: un hit en componente/hook que no cumple ninguna de las condiciones de cumplimiento ni esta en whitelist. El script imprime el archivo + linea y exit code 1 → bloquea el push.

**Falsos positivos esperados**: bajo. La heuristica del bloque de scope cercano (`-B5`) es laxa pero suficiente para uso real. Casos limite (ej: `withOfflineSupport` en una funcion declarada en un archivo distinto y exportada) se whitelistean caso por caso con un comentario `// pre-staging-check:allow` en la linea del callsite.

**Test de regresion del propio script**: agregar un test en CI que crea un branch artificial con un nuevo `await editComment(...)` directo en un componente nuevo, corre `pre-staging-check.sh`, y verifica que el script falla con exit code 1 mencionando el archivo. Esto asegura que el guard no se "rompe en silencio" si alguien rompe la heuristica.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Definir contract en `docs/reference/patterns.md` (offline section) | Alta | S |
| Agregar 3 nuevos `OfflineActionType` + payloads en `types/offline.ts` | Alta | S |
| Agregar 3 nuevos branches en `syncEngine.executeAction` | Alta | S |
| Wrappear edits/deletes de comments (3 callsites) + **gating por pending `comment_create`** (S5 / B3) | Alta | M |
| **Hook `usePendingActions(commentId)` o equivalente** para detectar pending creates | Alta | S |
| Wrappear lists CRUD (5 callsites en 3 archivos) | Alta | M |
| Wrappear `upsertCriteriaRating` (1 callsite) | Alta | S |
| Wrappear `removeFavorite` directo en FavoritesList (1 callsite) | Alta | S |
| Gatear callables HIGH (5 callsites: invite/remove editor, delete account, cleanAnon, deleteList) | Alta | M |
| **Snackbar diferenciado online/offline para comment delete/edit** (S3.1 / I3) | Alta | S |
| Gatear writes MEDIUM (sendFeedback, settings flush, displayName/avatar, uploadMenuPhoto, markAllRecsRead, markFeedbackViewed) | Media | M |
| Gatear admin LOW (saveAllSpecials, saveAllAchievements) | Baja | S |
| Subir OfflineIndicator a App.tsx (root) para cubrir todos los viewports | Baja | S |
| Tests de regresion para syncEngine (3 nuevos branches + branch defensivo `list_delete`) | Alta | S |
| Tests de componentes para gating offline (3-5 lugares clave) | Alta | M |
| **Render test SC2.3** — `OfflineIndicator` visible en `ListDetailScreen` (route ajena a TabShell) | Media | S |
| **Test especifico SC2.2** — settings flush al reconectar | Media | S |
| Actualizar `pre-staging-check.sh` con greps existentes #304 **+ greps de callers nuevos S6.1** | Alta | M |
| **Test de regresion del propio script** `pre-staging-check.sh` (SC2.4) | Alta | S |
| Actualizar `docs/reference/guards/304-offline.md` con los nuevos types, archivos cubiertos y decision sobre `list_delete` | Media | S |

**Esfuerzo total estimado:** L (18-24 horas — sigue siendo L, no XL: los servicios mismos NO se tocan; el incremento sobre la estimacion previa cubre los greps de callers, hook de pending-actions y tests granulares).

---

## Out of Scope

- Reescribir servicios para que ellos mismos encuen (el patron actual de "caller-wrappea" es deliberado y permite que el sync engine los reutilice como `onlineAction`).
- Soportar offline para uploads de Storage (`uploadMenuPhoto`, `sendFeedback` con archivo). Esos requeririan persistir el archivo en IndexedDB y resumir el upload — feature aparte.
- Optimistic UI para writes recien encolados en lists (mostrar la lista creada en `useUserLists` antes de que sincronice). Esto ya existe parcialmente via #304 con `generateListId()`, pero ampliarlo a updates/toggles esta fuera de este PRD.
- Cambios al UI del `OfflineIndicator` (icono, copy). Solo se evalua donde se monta.
- Reemplazar el `<APIProvider>` guard — ya esta correcto. No tocar.
- **Edit/delete de un comment que aun no se sincronizo offline** (`comment_create` pendiente). La UI deshabilita esos botones hasta que el create sincronice. Tracked como follow-up si surge demanda real (probable: tunear UX para que el edit pendiente se aplique al ack del create).
- **Undo de un `comment_delete` o `comment_edit` ya encolado offline**. El undo solo funciona online (ya que ahi la accion real corre dentro del setTimeout). Tracked como follow-up si surge demanda real (requeriria modificar la firma de `withOfflineSupport` para exponer `actionId`).
- **Sticky moderation** (que el flag `flagged: true` se preserve tras un `comment_edit` que limpia el texto). El comportamiento online actual lo levanta; este PRD no lo modifica. Decision de producto si se prioriza.
- **Coordinacion cross-device** del mismo usuario (queues distintas en mobile y desktop con conflictos). El conflict se resuelve via `OFFLINE_MAX_RETRIES` + toast.error — no hay merge logic.
- **`EVT_OFFLINE_GATE_BLOCKED` analytics event**. Decision (Sofia Ciclo 1): NO agregar evento nuevo. Sin valor analitico claro vs el costo de mantenerlo.

---

## Tests

Politica de `docs/reference/tests.md`: cobertura >= 80% del codigo nuevo.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/syncEngine.ts` | Service | 3 nuevos branches (`comment_edit`, `comment_delete`, `rating_criteria_upsert`) — happy path + payload mal formado |
| `src/types/offline.ts` | Types | Si hay validacion runtime (no la hay hoy), testear discriminated union |
| `src/hooks/useBusinessRating.ts` | Hook | Que `handleCriterionRate` enquee cuando offline (test ya existe — extender) |
| `src/hooks/useCommentListBase.ts` | Hook | Que delete/edit pasen por `withOfflineSupport` |
| `src/components/business/BusinessComments.tsx` | Component | Que el boton "Editar" de un comentario propio se deshabilite o funcione offline. **Test adicional**: si el comment tiene `comment_create` pending en queue, los botones Edit/Delete quedan disabled con tooltip "Esperando sincronización" |
| `src/components/profile/CommentsList.tsx` | Component | Idem para list view. Test adicional: snackbar diferenciado online (con "Deshacer") vs offline (sin "Deshacer") |
| `src/components/lists/ListDetailScreen.tsx` | Component | Que cada CTA de la pantalla (rename, toggle public, delete, remove item) respete offline |
| `src/components/business/AddToListDialog.tsx` | Component | Que add/remove/create se enquen offline |
| `src/components/lists/EditorsDialog.tsx` + `InviteEditorDialog.tsx` | Component | Botones disabled offline + tooltip/toast |
| `src/components/auth/DeleteAccountDialog.tsx` | Component | Submit disabled offline + mensaje seguridad |
| `src/components/profile/SettingsMenu.tsx` | Component | "Empezar de cero" gated offline |
| `src/components/profile/FeedbackForm.tsx` | Component | Submit disabled offline |
| `src/components/admin/SpecialsPanel.tsx` + `AchievementsPanel.tsx` | Component | Save disabled offline |
| `src/hooks/useUserSettings.ts` | Hook | Flush al volver online — los toggles offline se aplican cuando vuelve la red. **Test especifico SC2.2**: pending settings escritos offline se aplican via flush effect (no via replay de toggles individuales) |
| `src/services/syncEngine.ts` (defensivo) | Service | Que `list_delete` branch sigue replayando correctamente queues pre-#323 (test del comportamiento defensivo S2.1) |
| `scripts/pre-staging-check.sh` | Script | Greps de servicios (existentes) + **greps de callers nuevos S6.1** corren y bloquean nuevos hits. Test de regresion del propio script: branch artificial con `await editComment(...)` directo en componente nuevo → exit code 1 |
| `src/components/lists/ListDetailScreen.tsx` (extra para SC2.3) | Component | Render test que confirma `OfflineIndicator` montado en viewport cuando `isOffline=true` (cubre routes ajenas a TabShell) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (3 branches de syncEngine + nuevos guards en componentes)
- Tests de validacion para todos los inputs del usuario (re-uso de tests existentes de los services)
- Todos los paths condicionales cubiertos (online vs offline)
- Side effects verificados:
  - Cuando se enquea, `enqueue` se llama con el payload correcto + `EVT_OFFLINE_ACTION_QUEUED` se trackea
  - Cuando se gatea, `toast.error` (o disabled state) aparece y la funcion service NO se llama
  - Cuando se vuelve online, el flush de `useUserSettings` ejecuta y el state se reconcilia

---

## Seguridad

Esta feature NO agrega nuevas superficies de escritura ni cambia rules. La superficie afectada es **el camino entre componente y servicio**.

- [ ] Confirmar que los nuevos `OfflineActionType` no permiten escribir campos que las rules ya prohiben (los services ya validan; el sync engine los re-ejecuta sin bypass)
- [ ] `comment_edit` y `comment_delete` siguen pasando por `editComment`/`deleteComment` que ya validan ownership server-side
- [ ] Callables destructivos (`deleteAccount`, `cleanAnonymousData`) gated con mensaje de seguridad — evita dispararlos sin confirmacion de red estable
- [ ] No exponer datos en queue: el payload de `comment_edit` contiene texto del usuario que vive en IndexedDB del propio dispositivo (igual que el resto de la queue) — sin cambio de threat model

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| IndexedDB queue local | Bot llena la queue (`OFFLINE_QUEUE_MAX_ITEMS`) y al volver online dispara N writes | Ya existe limite en `enqueue()` que rechaza con error. El sync engine respeta `OFFLINE_MAX_RETRIES` por accion. Rate limits server-side (existing) cortan el flow. No se agrega nueva mitigacion |
| `comment_edit` replay | Edit de comment ajeno via payload modificado en IndexedDB | `editComment` ya valida ownership server-side via Firestore rules (`affectedKeys().hasOnly(['text','updatedAt'])` + ownership). Sin cambios |
| `comment_delete` replay | Delete masivo silencioso en sync | Cooldown server-side existente para comments writes; deletes pasan por `onCommentDeleted` que cascade-ea — no hay rate limit sobre el delete root, pero la queue local lo limita por device |

NO escribe a Firestore con campos nuevos. NO agrega userSettings nuevos. NO agrega rules. **No hay items del checklist de "feature escribe a Firestore" aplicables aqui.**

---

## Deuda tecnica y seguridad

Issues abiertos consultados (`gh issue list`):

- No hay issues abiertos con label `security` ni `tech debt` que crucen con este feature.
- Issues abiertos relacionados con el mismo audit del 2026-04-25:
  - #322 — security: firestore rules type guards + bootstrap admin path (no relacionado)
  - #324 — performance: allBusinesses.find() x13 (no relacionado)
  - #325 — perf-instrumentation (no relacionado)
  - #326 — ui-ux touch targets (no relacionado)

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #304 (cerrado) | Define los `list_*` types y el guard que este PRD ejecuta | Reusar el guard tal cual; agregar nuevos types como continuacion natural; mantener `list_delete` como branch defensivo (ver S2.1) |
| #294 (cerrado) | logger.error nunca dentro de `if (DEV)` | Confirmar que ningun handler nuevo lo viola |
| #322 (abierto) | security: firestore rules type guards + bootstrap admin path | Cross-dep ligero: este PRD no cambia rules, pero los nuevos types (`comment_edit`, `comment_delete`, `rating_criteria_upsert`) replayan via servicios que pasan por las rules existentes. Si #322 endurece guards, los nuevos types deben seguir pasando. No bloquea, pero coordinar orden de merge si ambos aterrizan en la misma sprint |
| #324 (abierto) | performance: `allBusinesses.find()` x13 | No relacionado a offline en si, pero tocan archivos overlap (`ListDetailScreen.tsx`, hooks de comments). Si ambos avanzan en paralelo, planear orden de merge para evitar conflictos de merge |

### Mitigacion incorporada

Este PRD **es en si mismo** la mitigacion: cierra una vulnerabilidad de UX (data loss silencioso) que el guard de #304 detecta pero que no estaba enforced en CI hasta ahora. Items concretos de mitigacion:

- Activar `pre-staging-check.sh` con los 3 greps del guard de #304 (hoy esta documentado pero no automatizado en CI). Mitiga regresiones futuras.
- **Extender `pre-staging-check.sh` con greps de callers** (S6.1) — cubre el angulo que #304 dejo abierto: violaciones del contrato desde `src/components/` y `src/hooks/`. Mitiga el riesgo de "agregar un nuevo write user-facing sin wrapper y que pase CI silenciosamente".
- Agregar entrada explicita al `docs/reference/patterns.md` con el contract de S1 — hoy esta implicito en codigo.
- Mantener `list_delete` branch defensivo en `syncEngine` (S2.1) — mitiga riesgo de replay roto en queues persistentes pre-#323.

---

## Robustez del codigo

Los hooks/componentes a modificar ya tienen patrones de cancelacion y try/catch (verifique `useCheckIn`, `useBusinessRating`, `useCommentListBase`). Mantener.

### Checklist de hooks async

- [ ] `useUserSettings.ts` flush al volver online: el `useEffect` debe tener `let cancelled = false; return () => { cancelled = true; }`
- [ ] Cada handler async modificado conserva su `try/catch` con `toast.error` actual
- [ ] No hay `setState` despues de operaciones async sin guard de unmount (revisar especificamente los handlers de `ListDetailScreen`)
- [ ] No agregar funciones exportadas no usadas (los nuevos types no requieren funciones nuevas)
- [ ] No hay archivos nuevos en `src/hooks/` (este feature NO crea hooks nuevos — solo modifica existentes)
- [ ] No se agregan keys de localStorage (ningun caso lo necesita)
- [ ] Ningun archivo modificado debe superar 400 lineas. `useCommentListBase.ts` y `ListDetailScreen.tsx` estan cerca del limite — verificar antes/despues. Si superan 400 al agregar guards, extraer un sub-hook
- [ ] `logger.error` nunca dentro de `if (import.meta.env.DEV)`

### Checklist de observabilidad

- [ ] Los 3 nuevos types deben emitir `EVT_OFFLINE_ACTION_QUEUED` con el `action_type` correcto (lo hace `withOfflineSupport` automaticamente — confirmar)
- [ ] **NO se agrega `EVT_OFFLINE_GATE_BLOCKED`** (decision Sofia Ciclo 1): sin valor analitico claro vs el costo de mantenerlo. Si en el futuro producto necesita medir intentos offline, evaluar como follow-up
- [ ] No se agregan services con queries Firestore nuevas — no aplica `measureAsync`

### Checklist offline

- Este PRD **es** el checklist offline. Aplicar a cada formulario/dialogo modificado:
  - [ ] Submit deshabilitado cuando `isOffline` (excepto si esta wrappeado en `withOfflineSupport`)
  - [ ] Toast de error al intentar accion gated muestra mensaje claro: "Necesitas conexion para [accion]"
  - [ ] Los catches existentes muestran `toast.error` en todos los environments

### Checklist de documentacion

- [ ] Actualizar `docs/reference/patterns.md` seccion "Offline queue" con los 3 types nuevos
- [ ] Actualizar `docs/reference/features.md` con la mejora a la cobertura offline
- [ ] Actualizar `docs/reference/guards/304-offline.md` con los nuevos types y archivos cubiertos
- [ ] No se agregan colecciones de Firestore — no aplica `firestore.md`
- [ ] No se agregan secciones de HomeScreen — no aplica
- [ ] No se agregan analytics events nuevos al dominio publico — la lista de `OfflineActionType` se actualiza en `types/offline.ts` (no es un barrel)

---

## Offline

(Esta seccion es ironica — el feature *es* offline. Aqui describe el efecto neto sobre el comportamiento offline del producto.)

### Data flows

| Operacion | Tipo | Estrategia offline (post-feature) | Fallback UI |
|-----------|------|-----------------------------------|-------------|
| Edit/delete comment | write | Encolada (`comment_edit`/`comment_delete`) | Toast "Guardado offline" |
| Criteria rating | write | Encolada (`rating_criteria_upsert`) | Toast "Guardado offline" |
| Lists CRUD (excepto delete) | write | Encolada (types existentes `list_*`) | Toast "Guardado offline" |
| `deleteList` | write | **Bloqueada** — boton disabled offline | Tooltip "Requiere conexion" |
| Add/remove favorite (FavoritesList path) | write | Encolada (type existente `favorite_remove`) | Toast "Guardado offline" |
| Callables editores listas | callable | Bloqueada — boton disabled offline | Tooltip "Requiere conexion" |
| Callables destructivos auth | callable | Bloqueada con mensaje claro | Toast.error |
| Settings | write | State local optimistic + flush al reconectar | Sin feedback explicito (settings se ven aplicados) |
| DisplayName/avatar | write | Bloqueada — boton "Guardar" disabled | Disabled state |
| Feedback submit | write+upload | Bloqueada — boton disabled | Disabled + toast si intentan |
| Mark all recommendations read | batch write | Bloqueada — fire-and-forget pero con `if (isOffline) return` | Sin feedback (badge se reconcilia al volver) |
| Mark feedback viewed | write | Bloqueada — `if (isOffline) return` | Sin feedback (no critico) |
| Upload menu photo | Storage upload | Bloqueada — boton disabled | Disabled state |
| Report menu photo | callable | Ya bloqueada (existing) | Tooltip ya existe |
| Admin save specials/achievements | batch write | Bloqueada — boton disabled | Disabled state |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (Firestore SDK default — sin cambios)
- [x] Writes: tienen queue offline (encolables) o `disabled` UI (gated) — este es el corazon del feature
- [x] APIs externas (callables): gated con feedback visual
- [x] UI: indicador de estado offline visible en TabShell (mejora a evaluar para BusinessDetailScreen)
- [x] Datos criticos: ya cacheados (read-cache de #197 sigue intacto)

### Esfuerzo offline adicional: L

---

## Modularizacion y % monolitico

El feature **mejora** el % monolitico al consolidar el patron offline en un contrato unico. Los servicios siguen sin saber de offline (su responsabilidad sigue siendo Firestore writes). Los hooks/componentes ganan disciplina de patron.

### Checklist modularizacion

- [x] Logica de offline vive en `withOfflineSupport` (service) y `useConnectivity` (context). Componentes solo orquestan
- [x] Componentes nuevos no se agregan; los existentes ganan parametros (`isOffline` ya viene del context, no requiere prop drilling)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] No se agregan props nuevas con noop handlers
- [x] Ningun componente modificado importa directamente Firestore — los services intactos
- [x] Archivos en `src/hooks/` siguen conteniendo hooks de React
- [x] No se crean archivos nuevos en `src/hooks/`
- [x] Converters intactos
- [x] Archivos modificados quedan en su carpeta de dominio
- [x] No se necesita context global nuevo (`ConnectivityContext` ya cubre el caso)
- [x] Verificar que `useCommentListBase.ts`, `ListDetailScreen.tsx`, `BusinessComments.tsx` no superen 400 lineas post-cambio. Si lo hacen, extraer sub-hook `useListMutations(list)` u `useCommentMutations()`

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Mismo contexto (`useConnectivity`); no se agregan imports cruzados |
| Estado global | = | Reusa `ConnectivityContext` y `ToastContext`; nada nuevo |
| Firebase coupling | - (mejora) | Los gates centralizan el "no tocar Firebase offline" — antes estaba disperso o ausente |
| Organizacion por dominio | = | Cada cambio queda en su carpeta de dominio (lists/, business/, profile/, auth/, admin/) |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] Botones que se deshabilitan offline mantienen `aria-label` descriptivo cuando esten en `IconButton`
- [ ] Tooltips ("Requiere conexion") usan el patron de MUI Tooltip que ya es accesible (no agregar custom)
- [ ] Botones con `disabled` no requieren `aria-disabled` adicional (MUI lo aplica)
- [ ] Touch targets siguen >= 44x44 px (no se cambian sizes)
- [ ] Indicador de offline (`OfflineIndicator`) ya tiene `role="status"` + `aria-live="polite"` (verificado)
- [ ] Si se replica el `OfflineIndicator` en BusinessDetailScreen, el segundo no debe duplicar el `role="status"` para el mismo evento — montar solo uno por viewport

### Checklist de copy

- [ ] Mensajes en espanol con tildes correctas y **voseo coherente** en todo el body del PRD y en strings finales: "Necesitás conexión para [X]", "No podés eliminar listas sin conexión, intentá de nuevo cuando vuelvas online", "Volvé cuando tengas conexión".
- [ ] Voseo consistente: "Calificá", "Editá", "Necesitás", "Volvé", "Intentá", "Esperá" — NO usar "Necesitas", "Vuelve", "Intenta" (resolucion observacion Sofia Ciclo 1).
- [ ] Terminologia: "comercios" no "negocios", "reseñas" no "reviews".
- [ ] Centralizar mensajes nuevos en `src/constants/messages/offline.ts` o reusar `MSG_OFFLINE` existente.
- [ ] Mensajes accionables: "Volvé cuando tengas conexión" en vez de "Error".

---

## Success Criteria

1. **SC1 — Cero writes user-facing fuera del contract en CI** (cubre S1 + S6): `pre-staging-check.sh` corre los 3 `grep` patterns del guard de #304 **mas** los nuevos greps de callers (S6.1) y falla el push si aparece un hit nuevo no whitelisted. Verificable:
   - Ejecutar el script post-merge sobre el HEAD y confirmar 0 violaciones.
   - **Branch artificial con un write nuevo en componente sin wrap falla `pre-staging-check.sh`** con exit code 1 mencionando el archivo y la linea (test de regresion del propio script).

2. **SC2.1 — HIGH (S2) cubierto por tests** (7 callers): cada uno de los 7 callsites HIGH tiene al menos 1 test que verifica:
   - Online → ejecuta directo (no encola).
   - Offline → encola con `OfflineActionType` correcto **o** UI gated con `disabled` + toast.
   - Para `editComment`/`deleteComment`: verificar gated por presencia de pending `comment_create` del mismo comment (boton disabled + tooltip).

3. **SC2.2 — MEDIUM (S3) cubierto por tests** (6 callers): cada uno de los 6 callsites MEDIUM tiene al menos 1 test del comportamiento offline (gated o flush-on-reconnect). **Test especifico requerido**: "settings flush al reconectar" — verifica que pending settings escritos offline se aplican al volver online via flush effect (no via replay de toggles individuales).

4. **SC2.3 — LOW (S4) verificable**: `OfflineIndicator` visible en routes ajenas a `TabShell`. Verificable con render test en `ListDetailScreen` (que no envuelve a TabShell directamente) que confirma el chip CloudOff montado en el viewport cuando `isOffline=true`. Tambien verificable manualmente en `BusinessDetailScreen`, `MenuPhotoViewer`, `DeleteAccountDialog`.

5. **SC2.4 — `pre-staging-check.sh` actualizado y verificable**: el script tiene los nuevos greps de callers (S6.1), whitelist documentada, y un test de regresion que crea un branch artificial con `await editComment(...)` directo en componente nuevo y verifica que el script falla con exit code 1.

6. **SC3 — 3 nuevos `OfflineActionType` operativos**: `comment_edit`, `comment_delete`, `rating_criteria_upsert` definidos en `types/offline.ts`, mapeados en `syncEngine.executeAction`, con tests de replay (online path) y enqueue (offline path), cobertura >= 80% sobre los 3 branches nuevos.

7. **SC4 — No regresion en operaciones existentes**: `useCheckIn`, `useFollow`, `useBusinessRating.handleRate`, `FavoriteButton`, `RecommendDialog`, `BusinessComments.handleSubmit`, `useCommentListBase.handleSubmitReply`, `useCommentListBase.handleToggleLike`, `BusinessQuestions`, `ReceivedRecommendations.markAsRead`, `BusinessTags`, `BusinessPriceLevel` siguen funcionando offline igual que antes (re-correr tests existentes; no se modifican). `list_delete` de queues persistentes pre-#323 sigue replayando correctamente (test del branch defensivo en syncEngine).

8. **SC5 — Documentacion actualizada**: `patterns.md` (seccion Offline + contract S1), `features.md` (cobertura offline), `guards/304-offline.md` (lista de archivos cubiertos, nuevos types, decision sobre `list_delete`) reflejan el estado post-merge.

---

## Validacion Funcional

**Auditor**: Sofia (analisis funcional)
**Fecha Ciclo 1**: 2026-04-25 — NO VALIDADO (3 BLOQUEANTE + 3 IMPORTANTE + 4 OBSERVACION)
**Fecha Ciclo 2**: 2026-04-25 — **VALIDADO CON OBSERVACIONES**
**Estado actual**: Listo para `specs-plan-writer`. Hay una observacion menor abierta (voseo inconsistente dentro del propio PRD) que NO bloquea el avance — puede limpiarse en una pasada posterior de copy/cami.

### Veredicto Sofia — Ciclo 2

**Estado**: VALIDADO CON OBSERVACIONES

#### Cerrado en esta iteracion

- **BLOQUEANTE #1** "`list_delete` contradice infra existente" → resuelto en PRD (S2.1). La sub-seccion explicita la decision (conservar tipo + branch + payload, gatear el caller), justifica por que no se borra el branch (queues persistentes pre-#323), por que no se encolan nuevos (cascade unsafe en replay) y como queda alineado con guard #304. Tabla S2 fila `deleteList` actualizada con el toast en voseo. Sin ambiguedades para el implementador.
- **BLOQUEANTE #2** "Grep #304 no cubre callers" → resuelto en PRD (S6.1). Path del script (`scripts/pre-staging-check.sh`) confirmado existente. Lista de mutadores cerrada (~30 nombres), heuristica de cumplimiento (3 condiciones), whitelist documentada (servicios, admin, syncEngine, interceptor, tests), definicion clara de "violacion" (exit code 1 con archivo + linea), y test de regresion del propio script (SC2.4). El implementador no necesita inventar criterios.
- **BLOQUEANTE #3** "Replay ordering: `comment_create + comment_edit` offline" → resuelto en PRD (S5 sub-bullet "comment_create + comment_edit / comment_delete del mismo comment offline" + Out of Scope). UI deshabilita botones Edit/Delete con tooltip "Esperando sincronización" mientras hay un `comment_create` pendiente; hook sugerido `usePendingActions(commentId)` agregado a Scope. Tabla S2 fila comments refleja la dependencia. Cero ambiguedad sobre el comportamiento.
- **IMPORTANTE #1** "Re-moderacion en `comment_edit` replay" → resuelto en PRD (S5 parrafo final + Out of Scope). El replay produce el mismo resultado que un edit online; sticky moderation queda como follow-up de producto, no de #323.
- **IMPORTANTE #2** "Scope size — criterios granulares" → resuelto en PRD. Success Criteria refactorizado en SC1, SC2.1, SC2.2, SC2.3, SC2.4, SC3, SC4, SC5. Cada uno tiene un metodo de verificacion concreto (test, render test, branch artificial CI, re-correr suite existente). Si el feature termina mergeandose en varias entregas, cada entrega tiene un criterio propio.
- **IMPORTANTE #3** "`comment_delete` offline + `useUndoDelete` (firma de `withOfflineSupport`)" → resuelto en PRD (S3.1). La firma del wrapper no cambia; el caller diferencia online (snackbar con "Deshacer") vs offline (snackbar sin "Deshacer", copy "Eliminado offline (se sincronizara cuando vuelvas online)"). Mismo patron para `comment_edit` (badge "Sincronizando..."). Undo de acciones encoladas → follow-up.
- **IMPORTANTE #4** "`EVT_OFFLINE_GATE_BLOCKED` analytics" → justificado: NO agregar. Decision tomada por producto, anclada en checklist de observabilidad y en Out of Scope. Si en el futuro hay necesidad analitica, se evalua aparte.
- **OBSERVACION #1** "voseo coherente en el body" → parcialmente cerrado: checklist de copy ahora prescribe voseo y lista las formas correctas. Sin embargo el cuerpo del PRD aun tiene dos strings en tuteo (ver hallazgo nuevo abajo).
- **OBSERVACION #2** "S5 multi-tab settings flush" → cerrado: nota explicita "el flush escribe el state local de la tab, no merge con server".
- **OBSERVACION #3** "cross-deps con #322 y #324" → cerrado: filas agregadas en tabla "Issues relacionados" con accion sugerida (coordinar orden de merge).
- **OBSERVACION #4** "archivos cerca de 400 LOC" → cerrado: nota mantenida en checklist de modularizacion; con la decision I3 (firma del wrapper sin cambios) el riesgo de superar 400 LOC baja.

#### Hallazgos nuevos del Ciclo 2 (regresion check del propio PRD)

- **OBSERVACION #5 (nueva)** "Voseo inconsistente dentro del propio PRD".
  - **Seccion afectada**: Tabla S2, fila `deleteAccount` (cuerpo "Si offline, toast.error con mensaje claro de seguridad...") y Checklist offline (item "Toast de error al intentar accion gated muestra mensaje claro").
  - **Hueco concreto**: el checklist de copy del PRD lista explicitamente "NO usar 'Necesitas'" como regla. Sin embargo dos strings ejemplo del propio PRD usan tuteo:
    - Tabla S2 propone como toast: `"Necesitas conexion estable para eliminar tu cuenta — esta accion es irreversible"`.
    - Checklist offline propone: `"Necesitas conexion para [accion]"`.
  - **Escenario real**: el implementador toma la frase literal del PRD para el toast y comitea con tuteo, contradiciendo el checklist del propio documento. Despues cami marca el lint y se rehace el copy.
  - **Por que es OBSERVACION y no IMPORTANTE**: el implementador tiene el checklist de copy enfrente y cualquier reviewer (cami, manu) lo va a corregir antes del merge. No bloquea specs/plan ni la implementacion. Es solo deuda dentro del documento.
  - **Que necesitamos**: en una proxima pasada (o cuando prd-writer toque el doc por otro motivo), reemplazar las dos ocurrencias por voseo: `"Necesitás conexión estable..."` y `"Necesitás conexión para..."`.

#### Abierto (informativo, no bloquea)

- Ninguno bloqueante. La OBSERVACION #5 queda asentada como deuda menor de copy.

#### Observaciones para el implementador

- Cuando wrappees los snackbars online/offline en S3.1, verifica que el `timeout` real del hook `useUndoDelete` (`src/hooks/useUndoDelete.ts:29`) es 5000ms por default — el PRD menciona "4s" en S3.1 a titulo descriptivo, el valor real lo toma el hook. No fuerces un literal en el caller.
- El hook sugerido `usePendingActions(commentId)` puede materializarse como un selector encima del `useOfflineQueue` existente (no requiere nueva infra, solo lectura filtrada). Definirlo en specs/plan.
- Cuando ejecutes el flush de `useUserSettings` al reconectar, asegurate del `let cancelled = false; return () => { cancelled = true; }` (esta en checklist de robustez, pero es facil olvidarlo en `useEffect` con dependencia `[isOffline, user?.uid]`).
- El test de regresion de `pre-staging-check.sh` (SC2.4) deberia correr en el job de CI, no solo localmente — `specs-plan-writer` define el job; sugerir reutilizar el step existente que corre el script.

### Listo para specs-plan-writer?

**Si, con observacion** — la OBSERVACION #5 (voseo inconsistente dentro del PRD) no bloquea ni la planificacion ni la implementacion. Si `prd-writer` toca el doc por otro motivo, aprovechar para corregir las dos lineas.

— Sofia, 2026-04-25 (Ciclo 1: NO VALIDADO / Ciclo 2: VALIDADO CON OBSERVACIONES)
