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
| `editComment` | `BusinessComments.tsx:163`, `CommentsList.tsx:70`, `useCommentListBase.ts` | wrappear con `withOfflineSupport('comment_edit', ...)` (nuevo type) o, si decidimos no agregar type, gatear con `isOffline` y deshabilitar el modo edit |
| `deleteComment` | `CommentsList.tsx:52`, `useCommentListBase.ts:48` (via `useUndoDelete`) | wrappear con `withOfflineSupport('comment_delete', ...)` (nuevo type — los undo-delete ya tienen UI de pending, encaja bien) |
| `upsertCriteriaRating` | `useBusinessRating.ts:147` | wrappear con `'rating_upsert'` reutilizando el type existente con el branch que recibe `criteria` parcial — o agregar `'rating_criteria_upsert'` para distinguir replay (preferido por claridad de payload) |
| `createList` | `CreateListDialog.tsx:45`, `AddToListDialog.tsx:116` | wrappear con `'list_create'` (ya existe). Generar `listId` client-side via `generateListId()` para optimistic UI |
| `updateList` | `ListDetailScreen.tsx:77,142` | wrappear con `'list_update'` (ya existe) |
| `toggleListPublic` | `ListDetailScreen.tsx:88` | wrappear con `'list_toggle_public'` (ya existe) |
| `deleteList` | `ListDetailScreen.tsx:108` | **gated** (no encolable: cascade delete inseguro). `isOffline` → toast.error + return. Confirmado por #304 |
| `addBusinessToList` | `AddToListDialog.tsx:100,118` | wrappear con `'list_item_add'` (ya existe) |
| `removeBusinessFromList` | `ListDetailScreen.tsx:121`, `AddToListDialog.tsx:95`, `FavoritesList.tsx:100` | wrappear con `'list_item_remove'` (ya existe) |
| `markAllRecommendationsAsRead` | `ReceivedRecommendations.tsx:55` | gated (writeBatch — no encolable). Si `isOffline`, no llamar; el unread badge se reconcilia al volver |
| `inviteEditor` (callable) | `InviteEditorDialog.tsx:35` | gated. El boton se deshabilita y muestra "Requiere conexion" |
| `removeEditor` (callable) | `EditorsDialog.tsx:70` | gated. Idem inviteEditor |
| `deleteAccount` (callable destructivo) | `DeleteAccountDialog.tsx:56` | gated. Si offline, toast.error con mensaje claro de seguridad ("Necesitas conexion estable para eliminar tu cuenta — esta accion es irreversible") y abortar |
| `cleanAnonymousData` (callable destructivo) | `SettingsMenu.tsx:62` | gated. Idem deleteAccount |
| `removeFavorite` directo | `FavoritesList.tsx:100` | wrappear con `'favorite_remove'` (ya existe). Hoy es la unica llamada a removeFavorite que NO esta wrappeada (FavoriteButton si lo esta) |

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

- La queue procesa en orden de `createdAt` (ya garantizado por `getPending` con sort). Si el usuario edita y luego elimina un comment offline, ambas se enquen — al sincronizar, el edit corre primero (succede), luego el delete corre (succede); resultado consistente con la intencion del usuario.
- Si el usuario elimina y luego intenta editar el mismo comment offline (caso raro: la UI debe deshabilitar el edit despues de un delete pendiente, pero por defensa): el edit fallara en el servidor con "doc no existe" tras el delete; el syncEngine reintenta hasta `OFFLINE_MAX_RETRIES` y luego marca `failed`. Aceptable. La UI debe asegurarse de que la lista de comentarios no muestre comentarios marcados como pending-delete (ver requisito en S2).
- Multi-tab: `useUserSettings` flush escribe la version mas reciente del state local cuando se reconecta. Si dos tabs hacen cambios offline distintos al mismo userSettings doc, el orden de flush sera por tab — la ultima en sincronizar gana. Aceptable: settings son eventually consistent y la UI se actualiza con un re-fetch al reconectar.

NO se agrega type para `markAllRecommendationsAsRead`, `inviteEditor`, `removeEditor`, `deleteAccount`, `cleanAnonymousData`, `sendFeedback`, `uploadMenuPhoto`, `saveAllSpecials`, `saveAllAchievements`, `updateUserSettings`, `updateUserDisplayName`, `updateUserAvatar` — son **gated**, no encolables.

### S6 — Tests de regresion

Aprovechar que `docs/reference/guards/304-offline.md` ya tiene los `grep` patterns. Los specs deberian:

1. Asegurar que `pre-staging-check.sh` corre los 3 greps del guard (mutaciones, callables, getCountFromServer) y falla si hay nuevos hits no whitelisted.
2. Agregar tests unitarios para los 3 nuevos branches en `syncEngine.executeAction` (`comment_edit`, `comment_delete`, `rating_criteria_upsert`).
3. Tests de componentes para verificar que los botones HIGH (lists CRUD, callables) se deshabilitan correctamente cuando `isOffline=true`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Definir contract en `docs/reference/patterns.md` (offline section) | Alta | S |
| Agregar 3 nuevos `OfflineActionType` + payloads en `types/offline.ts` | Alta | S |
| Agregar 3 nuevos branches en `syncEngine.executeAction` | Alta | S |
| Wrappear edits/deletes de comments (3 callsites) | Alta | M |
| Wrappear lists CRUD (5 callsites en 3 archivos) | Alta | M |
| Wrappear `upsertCriteriaRating` (1 callsite) | Alta | S |
| Wrappear `removeFavorite` directo en FavoritesList (1 callsite) | Alta | S |
| Gatear callables HIGH (5 callsites: invite/remove editor, delete account, cleanAnon, deleteList) | Alta | M |
| Gatear writes MEDIUM (sendFeedback, settings flush, displayName/avatar, uploadMenuPhoto, markAllRecsRead, markFeedbackViewed) | Media | M |
| Gatear admin LOW (saveAllSpecials, saveAllAchievements) | Baja | S |
| Subir OfflineIndicator a App.tsx (root) para cubrir todos los viewports | Baja | S |
| Tests de regresion para syncEngine (3 nuevos branches) | Alta | S |
| Tests de componentes para gating offline (3-5 lugares clave) | Alta | M |
| Actualizar `pre-staging-check.sh` para correr greps del guard de #304 | Alta | S |
| Actualizar `docs/reference/guards/304-offline.md` con los nuevos types y archivos cubiertos | Media | S |

**Esfuerzo total estimado:** L (15-20 horas, no XL porque los servicios mismos NO se tocan — solo callers + types + tests).

---

## Out of Scope

- Reescribir servicios para que ellos mismos encuen (el patron actual de "caller-wrappea" es deliberado y permite que el sync engine los reutilice como `onlineAction`).
- Soportar offline para uploads de Storage (`uploadMenuPhoto`, `sendFeedback` con archivo). Esos requeririan persistir el archivo en IndexedDB y resumir el upload — feature aparte.
- Optimistic UI para writes recien encolados en lists (mostrar la lista creada en `useUserLists` antes de que sincronice). Esto ya existe parcialmente via #304 con `generateListId()`, pero ampliarlo a updates/toggles esta fuera de este PRD.
- Cambios al UI del `OfflineIndicator` (icono, copy). Solo se evalua donde se monta.
- Reemplazar el `<APIProvider>` guard — ya esta correcto. No tocar.

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
| `src/components/business/BusinessComments.tsx` | Component | Que el boton "Editar" de un comentario propio se deshabilite o funcione offline |
| `src/components/profile/CommentsList.tsx` | Component | Idem para list view |
| `src/components/lists/ListDetailScreen.tsx` | Component | Que cada CTA de la pantalla (rename, toggle public, delete, remove item) respete offline |
| `src/components/business/AddToListDialog.tsx` | Component | Que add/remove/create se enquen offline |
| `src/components/lists/EditorsDialog.tsx` + `InviteEditorDialog.tsx` | Component | Botones disabled offline + tooltip/toast |
| `src/components/auth/DeleteAccountDialog.tsx` | Component | Submit disabled offline + mensaje seguridad |
| `src/components/profile/SettingsMenu.tsx` | Component | "Empezar de cero" gated offline |
| `src/components/profile/FeedbackForm.tsx` | Component | Submit disabled offline |
| `src/components/admin/SpecialsPanel.tsx` + `AchievementsPanel.tsx` | Component | Save disabled offline |
| `src/hooks/useUserSettings.ts` | Hook | Flush al volver online — los toggles offline se aplican cuando vuelve la red |
| `pre-staging-check.sh` | Script | Que los greps del guard #304 corren y bloquean nuevos hits |

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
| #304 (cerrado) | Define los `list_*` types y el guard que este PRD ejecuta | Reusar el guard tal cual; agregar nuevos types como continuacion natural |
| #294 (cerrado) | logger.error nunca dentro de `if (DEV)` | Confirmar que ningun handler nuevo lo viola |

### Mitigacion incorporada

Este PRD **es en si mismo** la mitigacion: cierra una vulnerabilidad de UX (data loss silencioso) que el guard de #304 detecta pero que no estaba enforced en CI hasta ahora. Items concretos de mitigacion:

- Activar `pre-staging-check.sh` con los 3 greps del guard de #304 (hoy esta documentado pero no automatizado en CI). Mitiga regresiones futuras.
- Agregar entrada explicita al `docs/reference/patterns.md` con el contract de S1 — hoy esta implicito en codigo.

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
- [ ] Agregar `EVT_OFFLINE_GATE_BLOCKED` o reusar uno existente para trackear cuando un boton se deshabilita por offline (instrumenta cuanto la gente intenta usar la app sin red)
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

- [ ] Mensajes en espanol con tildes correctas: "Necesitas conexion para [X]", "Sin conexion — [accion] requiere internet"
- [ ] Voseo: "Calificá", "Editá", "Necesitás conexion" — mantener tono existente
- [ ] Terminologia: "comercios" no "negocios", "reseñas" no "reviews"
- [ ] Centralizar mensajes nuevos en `src/constants/messages/offline.ts` o reusar `MSG_OFFLINE` existente
- [ ] Mensajes accionables: "Volve cuando tengas conexion" en vez de "Error"

---

## Success Criteria

1. **Cero writes user-facing fuera del contract en CI**: el `pre-staging-check.sh` corre los 3 `grep` patterns del guard de #304 y falla el push si aparece un hit nuevo no whitelisted. Verificable: ejecutar el script post-merge sobre el HEAD y confirmar 0 violaciones; ejecutar sobre un branch artificial con un write nuevo sin wrap y confirmar que falla.
2. **Cobertura concreta verificable**: las 7 superficies HIGH (S2) y 6 MEDIUM (S3) tienen al menos 1 test que verifica el comportamiento offline (gated o encolado). Verificable: cobertura de los 3 nuevos branches de syncEngine >= 80%; tests de componentes de los 13 callers ejecutan en CI.
3. **3 nuevos `OfflineActionType` operativos**: `comment_edit`, `comment_delete`, `rating_criteria_upsert` definidos en `types/offline.ts`, mapeados en `syncEngine.executeAction`, con tests de replay (online path) y enqueue (offline path).
4. **No regresion en operaciones existentes**: `useCheckIn`, `useFollow`, `useBusinessRating.handleRate`, `FavoriteButton`, `RecommendDialog`, `BusinessComments.handleSubmit`, `useCommentListBase.handleSubmitReply`, `useCommentListBase.handleToggleLike`, `BusinessQuestions`, `ReceivedRecommendations.markAsRead`, `BusinessTags`, `BusinessPriceLevel` siguen funcionando offline igual que antes (re-correr tests existentes; no se modifican).
5. **Indicador offline visible globalmente**: el `OfflineIndicator` aparece en cualquier ruta/dialog donde el usuario pueda intentar un write gated (verificable manualmente en BusinessDetailScreen, ListDetailScreen, MenuPhotoViewer, DeleteAccountDialog).
6. **Documentacion actualizada**: `patterns.md` (seccion Offline), `features.md` (cobertura offline), `guards/304-offline.md` (lista de archivos cubiertos y nuevos types) reflejan el estado post-merge.

---

## Validacion Funcional

**Estado**: PENDIENTE — Sofia debe ejecutar Ciclo 1 antes de pasar a specs/plan.

El prd-writer realizo una auto-revision aplicando el checklist de Sofia y resolvio in-line los siguientes hallazgos antes de cerrar el PRD:

- Replay order y conflictos en queue cuando un mismo recurso tiene multiples actions encoladas (S5).
- Definicion de "gated" UX feedback con requisitos funcionales testeables (no implementacion concreta) (S1.2).
- Flush de userSettings al volver online: que pasa si usuario cierra la app antes de reconectar (S3).
- Upload de menu photo: gating temprano (al abrir el dialog, no al submit) (S3).
- OfflineIndicator placement: decision tomada (subir al root) en lugar de dejar opcion abierta (S4).
- Success Criteria reforzados con condiciones de verificacion concretas.

**Posibles hallazgos abiertos para Sofia**:

- Scope size: 13 callsites HIGH/MEDIUM + types nuevos + tests + script de CI. Esfuerzo estimado L. Sofia puede sugerir partir en dos PRDs (HIGH first; MEDIUM/LOW como follow-up). Si lo hace, el implementador (o tech-lead `manu`) decide.
- "auditar onError" en `MenuPhotoSection`/`MenuPhotoViewer` (S3) puede ser ambiguo — lo refine como "agregar test de regresion que verifique que `<img onError>` se dispara y la UI muestra fallback".
- Para `comment_edit`/`comment_delete` no se discutio si la UI debe mostrar visualmente que un comment esta pending (texto tachado, banner "Sincronizando"). Decision producto pendiente.
- No se valido si el replay de `comment_edit` deberia respetar un timestamp de moderacion (si el comment fue flaggeado mientras la queue esperaba, el edit lo reabre en re-moderacion via `onCommentUpdated`).
