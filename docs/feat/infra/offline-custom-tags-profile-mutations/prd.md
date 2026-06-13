# PRD: Offline support para custom tags y profile mutations

**Feature:** offline-custom-tags-profile-mutations
**Categoria:** infra
**Fecha:** 2026-06-09
**Issue:** #344
**Prioridad:** Media (severidad HIGH/MEDIUM en /health-check)

---

## Contexto

El proyecto ya tiene una cola offline madura (`withOfflineSupport` + `OfflineActionType` de 26 variantes, `syncEngine` con registry de handlers tipados, #304/#323/#335). El audit `/health-check` detectó dos huecos: el CRUD de **custom tags** en `BusinessTags.tsx` ejecuta `addDoc/updateDoc/deleteDoc` directos sin `withOfflineSupport` ni guard `isOffline` (mientras que `addUserTag`/`removeUserTag` del mismo componente SÍ están cubiertos), y las **profile mutations** (`setDisplayName`/`setAvatarId`) escriben sin feedback offline al usuario.

## Problema

- `createCustomTag`/`updateCustomTag`/`deleteCustomTag` (BusinessTags.tsx:139,141,154) corren writes directos sin gate offline. Estando offline: el write queda buffered por Firestore sin feedback al usuario ni replay tipado por el `syncEngine`, rompiendo el contrato de "Guardado offline — se sincronizará al reconectar" que el resto del componente sí cumple.
- `createCustomTag` usa `addDoc` (ID auto-generado por Firestore). Encolar un `custom_tag_create` offline no produce un ID estable, por lo que un `update`/`delete` posterior del mismo tag offline no tiene a qué referenciar — mismo problema que resolvió `generateListId()` en #304 para listas.
- `setDisplayName` (AuthContext.tsx:130) y `setAvatarId` (AuthContext.tsx:140) escriben sin guard; `EditDisplayNameDialog` (botón Guardar) y `AvatarPicker` no tienen awareness de offline, así que el usuario no sabe que el cambio quedó pendiente.

## Solucion

### S1 — Custom tag CRUD con `withOfflineSupport` + ID client-side

Tres nuevas variantes de `OfflineActionType`: `custom_tag_create`, `custom_tag_update`, `custom_tag_delete`. Patrón idéntico al de listas (#304):

- Agregar `generateCustomTagId()` a `services/tags.ts` (espejo de `generateListId()` en `sharedLists.ts`): `doc(collection(db, COLLECTIONS.CUSTOM_TAGS)).id`. Migrar `createCustomTag` para aceptar un `tagId?` opcional y usar `setDoc(doc(..., tagId))` cuando viene, conservando `addDoc` como fallback online (mismo shape que `createList`).
- En `BusinessTags.handleSaveCustomTag` y `handleDelete`, wrappear con `withOfflineSupport(isOffline, 'custom_tag_*', { userId, businessId, businessName }, payload, onlineAction, toast)`. El componente ya tiene `isOffline` de `useConnectivity()` y `toast` — alinear con el patrón existente de `handleToggleTag` (líneas 86-101).
- Generar el `tagId` client-side **antes** de encolar (tanto online como offline) para que el optimistic UI y un eventual `update`/`delete` offline referencien el mismo doc.
- Registrar los 3 handlers en `registerOfflineHandlers.ts` (el `Record<OfflineActionType, OfflineHandler>` fuerza exhaustividad en compile-time — agregar el tipo sin handler rompe el build).
- Payloads tipados en `types/offline.ts`: `CustomTagCreatePayload { label: string }`, `CustomTagUpdatePayload { tagId: string; label: string }`, `CustomTagDeletePayload { tagId: string }`. El `tagId` del create va en `OfflineAction.referenceId` (campo genérico existente) o se deriva del doc ID — definir en specs cuál, alineado con cómo `list_create` usa `listId`.

**Ordering del replay (create → update/delete del mismo tag offline)**: como el `syncEngine` procesa la cola en orden FIFO (`getPending` ordena por `createdAt`), un `custom_tag_create` encolado antes de un `custom_tag_update`/`delete` del mismo `tagId` se replaya primero — el doc ya existe cuando llega el update/delete. A diferencia de `comment_edit`/`comment_delete` (#340 W6), aquí NO se necesita un guard de "edit no confirmado" porque el create y el update/delete comparten el `tagId` client-side y el orden FIFO garantiza la secuencia. Caso a cubrir en tests: crear tag offline → editarlo offline → reconectar ⇒ ambas acciones se aplican en orden y el doc final tiene el label editado. Caso límite: crear offline → eliminar offline ⇒ el delete del mismo `tagId` puede fallar si el create falló permanentemente (>= `OFFLINE_MAX_RETRIES`); especificar en specs que un delete de un tag cuyo create nunca persistió es un no-op tolerable (deleteDoc de doc inexistente no lanza en Firestore).

**Seguridad** (security.md): la regla `customTags` ya valida `hasOnly(['userId','businessId','label','createdAt'])`, `label` 1-30, `isValidBusinessId`, `createdAt == request.time`, y `affectedKeys().hasOnly(['label'])` en update. El cambio de `addDoc` → `setDoc` con ID client-side NO afecta las rules (el ID del doc no se valida; lo que importa son los campos). Validar que `setDoc` no introduzca campos extra fuera del whitelist.

### S2 — Feedback offline en profile mutations

- `EditDisplayNameDialog`: importar `useConnectivity`, agregar `|| isOffline` al `disabled` del botón Guardar + `Tooltip` "Requiere conexión". Mismo patrón usado en operaciones destructivas bloqueadas (#304/#323).
- `AvatarPicker`: recibe `isOffline` por prop desde su consumidor `ProfileScreen.tsx` (que ya tiene `useConnectivity()` e `isOffline` en scope, verificado) — el componente es props-driven puro y NO debe importar contextos (ver modularización). Deshabilita los `ButtonBase` de avatares con feedback visual cuando offline.
- `AuthContext.setDisplayName`/`setAvatarId`: estas mutaciones escriben a la colección `users` (no a una colección con `OfflineActionType` propio). Decisión de producto a definir en specs: (a) bloquear con guard offline + toast (más simple, consistente con el resto del issue que pide "deshabilitar + tooltip"), o (b) crear `OfflineActionType` `profile_displayname_update`/`profile_avatar_update` con replay. **El issue pide la opción (a)** ("agregar `|| isOffline` al `disabled` + tooltip"). Adoptar (a): gate en UI, sin nuevos action types para profile.

**UX**: el tooltip "Requiere conexión" y el `disabled` deben ser consistentes con los gates offline ya existentes. Para custom tags, en cambio, NO se bloquea — se encola y se muestra el toast `OFFLINE_ENQUEUED_MSG` (custom tags son no-destructivos y replayables, a diferencia de profile que toca la colección `users` sin handler de replay).

### S3 — Analytics y observabilidad

Reusar `EVT_OFFLINE_ACTION_QUEUED` (ya disparado dentro de `withOfflineSupport` con `action_type`). No hace falta evento nuevo. Verificar que `custom_tag_create/update/delete` aparezcan en el reporte de tipos encolados sin cambios adicionales.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| 3 nuevas variantes `OfflineActionType` + payloads tipados (`types/offline.ts`) | Alta | S |
| `generateCustomTagId()` + `createCustomTag(tagId?)` en `services/tags.ts` | Alta | S |
| Wrap `withOfflineSupport` en `BusinessTags` (create/update/delete) | Alta | M |
| 3 handlers en `registerOfflineHandlers.ts` | Alta | S |
| Gate offline + tooltip en `EditDisplayNameDialog` | Media | S |
| Prop `isOffline` + disabled en `AvatarPicker` | Media | S |
| Guard offline en `AuthContext.setDisplayName`/`setAvatarId` (opción a) | Media | S |
| Tests (offline.ts, tags.ts, registerOfflineHandlers, BusinessTags, dialogs) | Alta | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Replay con `OfflineActionType` propio para profile mutations (displayName/avatar) — se gatea en UI, no se encola (decisión S2 opción a).
- Limpieza del dead code `inviteListEditor`/`removeListEditor` sin callers (sharedLists.ts:159,167) — reportado en severidad Baja del issue; tratarlo en issue separado de tech debt.
- Optimistic UI nuevo para custom tags más allá del refetch `onTagsChange()` ya existente.
- Cambios en las Firestore rules de `customTags` (las actuales ya cubren el caso; solo se agregan rules tests).

---

## Tests

Política tests.md: >= 80% cobertura del código nuevo. Branches global ya en 81.86% — no bajar.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/tags.ts` | Service | `generateCustomTagId` devuelve ID no vacío; `createCustomTag` con `tagId` usa `setDoc` en ese ID, sin `tagId` usa `addDoc`; validación label 1-30 sigue lanzando |
| `src/services/registerOfflineHandlers.ts` | Registry | Los 3 handlers `custom_tag_*` invocan el service correcto con payload deserializado; `custom_tag_update`/`delete` requieren `tagId` (referenceId); exhaustividad compile-time |
| `src/services/offlineInterceptor.ts` | Service | (existente) `withOfflineSupport` encola `custom_tag_*` con meta correcta y dispara `EVT_OFFLINE_ACTION_QUEUED` |
| `src/components/business/BusinessTags.tsx` | Componente | create/update/delete online ejecutan el service; offline encolan + toast `OFFLINE_ENQUEUED_MSG`; tagId estable entre create y delete offline |
| `src/services/syncEngine.ts` (o `registerOfflineHandlers`) | Replay ordering | crear+editar mismo tag offline → al drenar, ambas aplican en orden FIFO y el doc final tiene el label editado; delete de tag cuyo create falló es no-op tolerable |
| `src/components/profile/EditDisplayNameDialog.tsx` | Componente | botón Guardar `disabled` cuando `isOffline`; tooltip "Requiere conexión" presente |
| `src/components/profile/AvatarPicker.tsx` | Componente | avatares `disabled` cuando prop `isOffline=true`; onSelect no se dispara offline |
| `tests/rules/customTags.rules.test.ts` | Rules | allow create con ID client-side + label válido; deny label > 30; deny campo extra; deny update fuera de `label`; deny delete de otro owner (marca checkbox `customTags` en inventario tests.md) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (label 1-30)
- Todos los paths condicionales cubiertos (online vs offline; create con/sin tagId)
- Side effects verificados (enqueue en IndexedDB, `trackEvent`, refetch `onTagsChange`)

---

## Seguridad

- [ ] La regla `customTags` create mantiene `keys().hasOnly(['userId','businessId','label','createdAt'])` — el cambio `addDoc`→`setDoc` con ID client-side no agrega campos
- [ ] `label` valida `is string` + `size()` 1-30 (ya presente); `setDoc` no debe enviar `label` sin trim ni > 30
- [ ] Update rule conserva `affectedKeys().hasOnly(['label'])` — campos immutables (`userId`, `businessId`, `createdAt`) fuera de la lista
- [ ] Ownership en update/delete vía `resource.data.userId == request.auth.uid` (ya presente)
- [ ] ID generado client-side NO se valida en rules — confirmar que no abre vector (el doc ID arbitrario está OK; los campos son lo validado, y el `businessId` del payload pasa por `isValidBusinessId`)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `customTags` create con ID client-side | Colisión/overwrite de doc de otro usuario via `setDoc` en ID arbitrario | El whitelist + `userId == request.auth.uid` impide escribir un doc con userId ajeno; un overwrite requeriría conocer un docId existente Y pasar ownership — rule lo bloquea |
| Replay de cola corrupta | `custom_tag_update`/`delete` con tagId apuntando a doc ajeno | Rule de update/delete valida ownership server-side; el replay no bypasea rules |
| Spam de tags offline | Encolar N tags offline → drenar todos al reconectar | Rate limit server-side ya existe: `customTags` 10/business + 50/día por usuario (trigger `customTags.ts` con `checkRateLimit`); el replay respeta el límite |

Custom tags escribe a Firestore:

- [x] Create rule tiene `hasOnly()` con whitelist (existente, sin cambios)
- [x] CADA campo en `hasOnly()` tiene validacion de tipo (`label is string`, `createdAt == request.time`)
- [x] Campos string tienen limite de longitud (`label.size() <= 30`)
- [x] Update rule tiene `affectedKeys().hasOnly(['label'])`
- [x] Campos immutables (userId, businessId) no estan en affectedKeys
- [x] Rate limit server-side ya existe en trigger `customTags.ts` (10/business + 50/día, con delete on exceed) — NO se introduce colección nueva
- [ ] Agregar rules test allow+delete para `customTags` (inventario tests.md lo lista como pendiente)

Profile mutations (colección `users`):

- [x] La regla `users` update ya valida `affectedKeys().hasOnly(['displayName','displayNameLower','avatarId'])` + `displayNameLower == displayName.lower()` (#322 R12) — no se tocan rules

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #344 (este) | resuelve | Cierra el hueco offline de custom tags + feedback profile |
| Dead code `inviteListEditor`/`removeListEditor` sin callers (sharedLists.ts:159,167) | identificado en el audit (severidad Baja) | NO resolver acá — issue separado de tech debt para evitar scope creep |
| #335 (`createPendingByUserStore` factory followup) | no afecta | Profile mutations NO usan el patrón pendingByUser (se gatean, no se batch-flushean) |

> Antes de specs/plan correr `gh issue list --label security --state open` y `--label "tech debt"` para confirmar que no hay deuda de rules de `customTags` o `users` abierta que este feature deba considerar.

### Mitigacion incorporada

- Cierra el hueco de replay tipado para custom tags (antes: write buffered sin feedback).
- Agrega el primer rules test de `customTags` (inventario tests.md lo tiene pendiente) — paso explícito en el plan.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] Handlers async en `BusinessTags` (`handleSaveCustomTag`, `handleDelete`) tienen `try/catch` con `logger.error` + (vía `withOfflineSupport`) toast offline — alinear con `handleToggleTag` existente
- [ ] No hay `setState` tras async sin guard (componente memoizado, refetch via callback)
- [ ] `generateCustomTagId`/`createCustomTag` viven en `services/` (no en hooks)
- [ ] Constantes nuevas (action type strings) NO son magic strings — van en `types/offline.ts` como parte de la union
- [ ] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)`
- [ ] Archivos nuevos/modificados no superan 300 (warn) / 400 (blocker) líneas — `BusinessTags.tsx` está en 271; los wraps no deben empujarlo sobre 300, extraer handlers a hook si crece

### Checklist de observabilidad

- [ ] No hay Cloud Function nueva (trigger `customTags.ts` ya existe con rate limit + `trackFunctionTiming` si aplica)
- [ ] `generateCustomTagId`/`createCustomTag` no son queries nuevas (writes) — no requieren `measureAsync`
- [ ] `EVT_OFFLINE_ACTION_QUEUED` reusado (ya registrado); verificar que `custom_tag_*` aparezcan como `action_type` válidos en el reporte

### Checklist offline

- [ ] `EditDisplayNameDialog` y `AvatarPicker` deshabilitan submit cuando `isOffline`
- [ ] Custom tags NO se deshabilitan — se encolan con toast (no-destructivo, replayable)
- [ ] Error handlers muestran feedback en todos los environments (toast offline vía `withOfflineSupport`)

### Checklist de documentacion

- [ ] Nuevos action types documentados en `types/offline.ts` (no appendear al barrel; van en el archivo de dominio offline)
- [ ] `docs/reference/patterns.md` — actualizar "Offline action types" (26 → 29 tipos) y nota de `generateCustomTagId` espejo de `generateListId`
- [ ] `docs/reference/features.md` — nota de custom tags offline
- [ ] `docs/reference/firestore.md` — sin colección nueva; nota de ID client-side en `customTags`
- [ ] `docs/reference/security.md` — marcar rules test de `customTags` cubierto

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| Crear custom tag | write | Encolar `custom_tag_create` con tagId client-side | Toast "Guardado offline" + chip aparece (refetch al reconectar) |
| Editar custom tag | write | Encolar `custom_tag_update` (referencia tagId) | Toast "Guardado offline" |
| Eliminar custom tag | write | Encolar `custom_tag_delete` (referencia tagId) | Toast "Guardado offline" |
| Cambiar displayName | write | Bloqueado offline (gate UI) | Botón disabled + tooltip "Requiere conexión" |
| Cambiar avatar | write | Bloqueado offline (gate UI) | ButtonBase disabled |
| Leer tags del comercio | read | Persistencia offline Firestore + readCache (existente) | StaleBanner (existente) |

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline (existente, sin cambio)
- [ ] Writes custom tags: queue offline tipado vía `withOfflineSupport`
- [ ] Writes profile: gate UI (no queue, decisión S2 opción a)
- [ ] APIs externas: N/A (solo Firestore)
- [ ] UI: tooltip "Requiere conexión" en profile; toast offline en custom tags
- [ ] Datos criticos: tags ya cacheados vía readCache 3-tier

### Esfuerzo offline adicional: M

---

## Modularizacion y % monolitico

Proyecto en 30% monolitico. Este feature mantiene o reduce el acoplamiento.

### Checklist modularizacion

- [ ] Lógica de generación de ID y persistencia en `services/tags.ts` (no en componente)
- [ ] `AvatarPicker` sigue props-driven puro — recibe `isOffline` por prop, NO importa `useConnectivity` (evita acoplar un componente de dominio profile a un contexto de layout)
- [ ] `EditDisplayNameDialog` ya consume `useAuth`; importar `useConnectivity` es aceptable (es un dialog de feature, no de layout) — pero preferir prop si el consumidor ya tiene `isOffline`
- [ ] No se agregan useState de negocio a AppShell/SideMenu
- [ ] Handlers reales (no noop) — `onSelect`, `onSave`, `onConfirm` ya cableados
- [ ] Ningún componente importa de `firebase/firestore` — los writes pasan por `services/tags.ts`
- [ ] Handlers en `src/services/` (no en `src/hooks/` — no usan React hooks)
- [ ] `BusinessTags.tsx` no supera 400 líneas (vigilar 300; extraer custom-tag handlers a hook si excede)
- [ ] `custom_tag_*` payloads en `types/offline.ts` (archivo de dominio, no append a barrel)
- [ ] Archivos en carpeta de dominio correcta (`business/`, `profile/`) — no `menu/`

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | `BusinessTags` ya usa `useConnectivity`; `AvatarPicker` recibe prop, no nuevo import cruzado |
| Estado global | = | Sin contexto nuevo; reusa `ConnectivityContext` + cola IndexedDB existente |
| Firebase coupling | = | Writes en `services/tags.ts`; ID generado en service, no en componente |
| Organizacion por dominio | = | Cambios en `business/` y `profile/`, types en dominio offline |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] El chip "Agregar" y los chips de custom tag ya son interactivos (Chip MUI) — mantener
- [ ] Botón Guardar disabled con feedback offline: usar el patrón establecido del proyecto `title={isOffline ? MSG_OFFLINE.requiresConnection : undefined}` directamente en el botón (igual que `FeedbackForm`, `MenuPhotoUpload`, `InviteEditorDialog`). NO envolver en `<Tooltip>`/`<span>` — el atributo `title` nativo funciona sobre botones disabled y es el patrón consistente del resto de los gates offline
- [ ] `AvatarPicker` `ButtonBase` con `aria-disabled` cuando offline, no solo visual
- [ ] Touch targets >= 44x44 (los IconButtons del componente ya usan `minWidth/minHeight: 44`)
- [ ] Estados de error/offline comunicados (toast + tooltip), no solo color

### Checklist de copy

- [ ] Reusar `MSG_OFFLINE.requiresConnection` ("Requiere conexión", ya existe en `src/constants/messages/offline.ts`, verificado) — NO crear un string nuevo ni duplicarlo en `common.ts`
- [ ] Toast offline reusa `OFFLINE_ENQUEUED_MSG` ("Guardado offline — se sincronizará al reconectar") de `offlineInterceptor.ts`
- [ ] Voseo y terminología "comercios"/"etiquetas" consistentes
- [ ] Mensajes accionables, no "Error" genérico

---

## Success Criteria

1. Crear, editar y eliminar custom tags estando offline encola acciones tipadas (`custom_tag_create/update/delete`) que se replayan correctamente al reconectar, con toast "Guardado offline".
2. Un custom tag creado offline tiene un ID client-side estable, de modo que editarlo o eliminarlo offline en la misma sesión referencia el mismo doc y el replay no falla.
3. El botón Guardar de `EditDisplayNameDialog` y los avatares de `AvatarPicker` quedan deshabilitados con feedback ("Requiere conexión") cuando no hay conexión.
4. Las Firestore rules de `customTags` y `users` no cambian; se agrega un rules test allow+deny para `customTags` (cierra el checkbox pendiente en tests.md).
5. Cobertura >= 80% del código nuevo; branches global no baja de 81.86%; el `Record<OfflineActionType, OfflineHandler>` garantiza exhaustividad de los 3 handlers nuevos en compile-time.

---

## Validacion Funcional

**Analista**: Sofia (checklist funcional aplicado por prd-writer; el harness de este entorno no expone spawn de subagente, por lo que se ejecutó el protocolo de Sofia — incluyendo verificación con `gh`/`grep`/`find` antes de afirmar ausencia — de forma directa)
**Fecha**: 2026-06-10
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos cerrados en esta iteracion

- IMPORTANTE: "tooltip de botón disabled requería `<span>` wrapper" → corregido: el proyecto usa el atributo nativo `title={isOffline ? MSG_OFFLINE.requiresConnection : undefined}` directamente sobre el botón (verificado en `FeedbackForm`, `MenuPhotoUpload`, `InviteEditorDialog`). Se eliminó la indicación errónea de wrapper.
- IMPORTANTE: "string del tooltip a centralizar en `common.ts` si no existe" → corregido: `MSG_OFFLINE.requiresConnection` ya existe en `src/constants/messages/offline.ts` (verificado). Se reusa, no se duplica.
- IMPORTANTE: "consumidor que pasa `isOffline` a `AvatarPicker` sin nombrar" → corregido: el consumidor es `ProfileScreen.tsx`, que ya tiene `useConnectivity()`/`isOffline` en scope (verificado).
- IMPORTANTE: "ordering del replay create→update/delete del mismo tag offline no especificado" → resuelto en S1: FIFO garantiza el orden; delete de tag cuyo create falló es no-op tolerable; caso agregado a Tests.
- OBSERVACION: "`EVT_OFFLINE_ACTION_QUEUED` ya registrado en barrel; los 3 `action_type` nuevos no requieren registro adicional" → confirmado (verificado en `analyticsEvents/offline.ts` + barrel snapshot). El PRD ya lo trataba en S3.

### Observaciones abiertas para el implementador

- Verificar al armar el plan que `BusinessTags.tsx` (hoy 271 líneas) no supere 300 al agregar los wraps; si lo hace, extraer los handlers de custom-tag a un hook dedicado en `src/hooks/` (riesgo bajo).
- El rate limit server-side de `customTags` (10/business + 50/día, trigger existente) aplica al drenar una cola offline grande: el replay puede toparse con el límite y el doc encolado se borraría server-side. Es comportamiento esperado (defensa anti-spam), pero el toast de "sincronizado" no distingue ese caso — aceptable para este tech debt, mencionar en plan por si se quiere telemetría futura.
- Sin overlap con issues abiertos (#341-#349 son otros tech debts de dominios distintos; el dead code `inviteListEditor`/`removeListEditor` quedó explícitamente fuera de scope).


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** El trigger customTags hace snap.ref.delete() al exceder rate limit: definir comportamiento esperado en replay (toast dice 'guardado' pero el chip desaparece). Confirmar en rules test que delete de doc inexistente resuelve limpio. Path real: src/context/ (singular).
