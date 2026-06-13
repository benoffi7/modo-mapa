# Specs: Offline support para custom tags y profile mutations

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #344

---

## Modelo de datos

No se introducen colecciones nuevas. No se modifican campos. El cambio es de **mecanismo de escritura** (de `addDoc` con ID auto-generado a `setDoc` con ID client-side opcional) y de **encolado offline tipado**.

### Colección afectada: `customTags` (sin cambios de schema)

```typescript
// src/types/business.ts — SIN CAMBIOS
interface CustomTag {
  id: string;
  userId: string;
  businessId: string;
  label: string;       // 1-30
  createdAt: Date;
}
```

El doc ID pasa de auto-generado por Firestore (`addDoc`) a uno generado client-side (`generateCustomTagId()` → `doc(collection(db, COLLECTIONS.CUSTOM_TAGS)).id`). Firestore NO valida el doc ID en las rules; el ID arbitrario es seguro (ver Rules impact). El campo `id` del tipo `CustomTag` ya se hidrata desde el doc snapshot (`customTagConverter`), no se persiste como field.

### Nuevos tipos en `src/types/offline.ts`

```typescript
// 3 nuevas variantes de la union OfflineActionType
| 'custom_tag_create'
| 'custom_tag_update'
| 'custom_tag_delete'

// Payloads (agregados a la union OfflineActionPayload)
export interface CustomTagCreatePayload {
  label: string;
}

export interface CustomTagUpdatePayload {
  label: string;
}

export interface CustomTagDeletePayload {
  _type: 'custom_tag_delete';
}
```

**Decisión sobre dónde vive el `tagId`** (alineado con cómo `list_create` usa `listId`): el `tagId` client-side se transporta en el campo genérico existente `OfflineAction.referenceId` para los **tres** tipos (`custom_tag_create/update/delete`). No se reutiliza `listId` (es de dominio listas) ni se agrega un campo nuevo a `OfflineAction`. Esto mantiene `CustomTagCreatePayload` minimal (solo `label`) y deja que create/update/delete compartan la misma referencia de doc. `businessId` sigue viajando en `OfflineAction.businessId` (requerido por el shape de `enqueue`). Para `custom_tag_update`/`delete`, `businessId` no es estrictamente necesario para el replay pero se conserva por backward-compat del meta (se pasa el `businessId` del scope).

### Índices

Ninguno nuevo.

## Firestore Rules

Sin cambios en `firestore.rules`. Las rules de `customTags` (L251-270) ya cubren el caso: el cambio `addDoc` → `setDoc` con ID client-side no agrega campos ni altera el whitelist. Solo se agrega un **rules test** (no se modifican rules).

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|---------------------|------------|-------------|--------------------|---------|
| `createCustomTag(userId, businessId, label, tagId?)` → `setDoc(doc(..., tagId))` | customTags | Owner (`userId == auth.uid`) | `allow create: keys().hasOnly([...]) && userId == auth.uid && isValidBusinessId && label 1-30 && createdAt == request.time` (L253-260) | No |
| `updateCustomTag(tagId, label)` → `updateDoc` | customTags | Owner del doc | `allow update: resource.data.userId == auth.uid && affectedKeys().hasOnly(['label']) && label 1-30` (L261-267) | No |
| `deleteCustomTag(tagId)` → `deleteDoc` | customTags | Owner del doc | `allow delete: resource.data.userId == auth.uid` (L268-269) | No |
| `updateUserDisplayName(uid, name)` (existente, ahora gateado en UI) | users | Owner | `allow update` con `affectedKeys().hasOnly(['displayName','displayNameLower','avatarId'])` (#322 R12) | No |
| `updateUserAvatar(uid, id)` (existente, ahora gateado en UI) | users | Owner | idem | No |

**Vector evaluado — overwrite via `setDoc` con ID arbitrario:** un atacante que adivine el docId de otro usuario e intente `setDoc` no puede, porque el create rule exige `userId == request.auth.uid` (no puede escribir un doc con `userId` ajeno) y el update/delete exige `resource.data.userId == request.auth.uid` (ownership del doc existente). El ID arbitrario NO abre vector — los campos son lo validado.

### Field whitelist check

No se agregan ni modifican campos. El `setDoc` envía **exactamente** los mismos 4 campos que el `addDoc` actual (`userId`, `businessId`, `label`, `createdAt`), que ya están en `hasOnly(['userId','businessId','label','createdAt'])`.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change? |
|-----------|-------------------|----------------------|--------------------------------------|--------------|
| customTags | (ninguno — `setDoc` reusa los 4 campos del `addDoc` actual) | SI (sin cambios) | N/A | No |

**Guardrail de implementación:** `createCustomTag` con `tagId` debe enviar el `label` ya con `trim()` aplicado y ≤ 30 (la validación actual del service ya lanza si no cumple — conservarla). `setDoc` no debe filtrar campos extra (no agregar `tagId` como field del doc; el `tagId` es solo el doc ID).

## Cloud Functions

Ninguna nueva. El trigger `functions/src/triggers/customTags.ts` (`onCustomTagCreated` / `onCustomTagDeleted`) ya existe con rate limit (10/business + 50/día) + moderación. **No se toca.**

### Comportamiento del rate limit en replay de cola offline (tech debt aceptado — observación de Sofia)

`onCustomTagCreated` ejecuta `await snap.ref.delete()` cuando se excede 10/business, 50/día, o el label es flaggeado por moderación. En el flujo offline esto produce un escenario silencioso:

1. Usuario crea N custom tags offline → cada uno muestra toast `OFFLINE_ENQUEUED_MSG` ("Guardado offline — se sincronizará al reconectar") y aparece el chip (refetch local optimista no aplica acá; el chip aparece tras `onTagsChange()` al reconectar).
2. Al reconectar, `syncEngine` drena la cola FIFO. Cada `custom_tag_create` hace `setDoc` exitoso (la rule pasa) → `syncEngine` lo marca `synced` y lo remueve de la cola.
3. **Pero** el trigger server-side, al exceder el límite, borra el doc recién creado (`snap.ref.delete()`). El cliente ya consideró la acción "sincronizada".

**Decisión de producto (alineada con Sofia): tech debt aceptado, sin enforcement adicional en este issue.**

- El `setDoc` desde el cliente **resuelve OK** (la rule permite el create; el límite NO está en rules sino en el trigger post-write). Por lo tanto `syncEngine.executeAction` NO falla → no reintenta → no llega a `OFFLINE_MAX_RETRIES`. Correcto: el cliente no debe reintentar un write que Firestore aceptó.
- La pérdida del tag (borrado server-side por el trigger) es el **comportamiento esperado anti-spam**. Un replay de cola grande que excede el límite pierde los tags por encima del cap — igual que ocurriría online creando rápido. El toast "Guardado offline" no distingue este caso (no tiene visibilidad del trigger server-side).
- **Mismo comportamiento en multi-device**: el mismo comercio editado en 2 devices offline genera 2 `custom_tag_create` con `tagId` distintos (cada device genera su propio ID); al drenar ambas colas, el segundo que cruce el cap de 10/business será borrado por el trigger. Esperado.
- **No se mitiga en este issue** (fuera de scope explícito: no se tocan rules ni el trigger). Se documenta como tech debt conocido.

**Telemetría futura (NO en este issue):** para cerrar el gap de feedback, una mejora futura sería que `onCustomTagCreated` escriba un doc de notificación / abuseLog ya existente (lo hace: `logAbuse` con `type: 'rate_limit'`) y que el cliente lo lea para mostrar un toast diferenciado ("Algunas etiquetas no se guardaron: límite alcanzado"). Queda registrado como followup, NO se implementa acá.

## Seed Data

No aplica. No se crean colecciones nuevas ni campos requeridos nuevos. `customTags` ya existe en los seeds actuales; el cambio de `addDoc` → `setDoc` no altera el shape sembrado.

## Componentes

### `BusinessTags.tsx` (modificado)

Componente ya existente (271 líneas). Ya consume `useConnectivity()` (`isOffline`), `useToast()`, `useBusinessScope()` (`businessId`, `businessName`), `useAuth()` (`user`). Ya importa `withOfflineSupport`. Solo se modifican `handleSaveCustomTag` y `handleDelete` para wrappear con `withOfflineSupport`, y se genera el `tagId` client-side antes de encolar.

- **Props:** sin cambios (`seedTags`, `userTags`, `customTags`, `isLoading`, `onTagsChange`).
- **Comportamiento nuevo:**
  - `handleSaveCustomTag` (create): genera `tagId = generateCustomTagId()` antes de wrappear; `withOfflineSupport(isOffline, 'custom_tag_create', { userId, businessId, businessName, referenceId: tagId }, { label }, () => createCustomTag(user.uid, businessId, label, tagId), toast)`.
  - `handleSaveCustomTag` (update): `withOfflineSupport(isOffline, 'custom_tag_update', { userId, businessId, businessName, referenceId: editingTag.id }, { label }, () => updateCustomTag(editingTag.id, label), toast)`.
  - `handleDelete`: `withOfflineSupport(isOffline, 'custom_tag_delete', { userId, businessId, businessName, referenceId: menuTag.id }, { _type: 'custom_tag_delete' }, () => deleteCustomTag(menuTag.id), toast)`.
  - Custom tags NO se deshabilitan offline (son no-destructivos y replayables) — se encolan con toast.
  - Cada handler envuelve la llamada en `try/catch` con `logger.error` (alinear con `handleToggleTag` L84-105).
- **Tamaño:** los wraps agregan ~8-12 líneas netas. El componente pasaría de 271 a ~283. Bajo el warn de 300 — **no requiere extracción a hook** (verificado en file-size estimation). Si en implementación supera 300, extraer los 3 custom-tag handlers a `src/hooks/useCustomTagActions.ts` (riesgo bajo).

### `EditDisplayNameDialog.tsx` (modificado)

- **Props:** sin cambios (`open`, `onClose`).
- **Comportamiento nuevo:** importar `useConnectivity` (es un dialog de feature, no de layout — aceptable per modularización). Agregar `|| isOffline` al `disabled` del botón Guardar y `title={isOffline ? MSG_OFFLINE.requiresConnection : undefined}` directamente sobre el `<Button>` (atributo nativo, sin wrapper `<Tooltip>`/`<span>` — patrón consistente con `FeedbackForm`, `MenuPhotoUpload`, `InviteEditorDialog`, confirmado por Sofia).
- `handleSave` retorna early si `isOffline` (defense-in-depth además del `disabled`).

### `AvatarPicker.tsx` (modificado)

- **Props nuevas:** `isOffline: boolean` (props-driven puro — NO importa `useConnectivity`, lo recibe de `ProfileScreen`).
- **Comportamiento nuevo:** cada `<ButtonBase>` de avatar recibe `disabled={isOffline}` + `aria-disabled={isOffline}` (no solo visual). `onSelect`/`onClose` no se disparan offline (el `ButtonBase` disabled no emite `onClick`).
- MUI `ButtonBase` con `disabled` ya aplica opacidad/cursor; agregar `aria-disabled` explícito por a11y.

### `ProfileScreen.tsx` (modificado — wiring)

- Ya tiene `useConnectivity()` / `isOffline` en scope (L57, verificado). Pasar `isOffline={isOffline}` a `<AvatarPicker>` (L133-138). Handler real ya existente: `onSelect={(a) => setAvatarId(a.id)}` — no se toca.

### `AuthContext.tsx` (modificado — guard defense-in-depth)

- `setDisplayName` (L126-132) y `setAvatarId` (L134-145): agregar guard early-return si `navigator.onLine === false` (defense-in-depth a nivel context, NO encola — decisión S2 opción a). Esto cubre el caso de un caller que invoque la acción sin pasar por la UI gateada. NO se importa `useConnectivity` (es un hook de React, no usable dentro de los callbacks del context que ya existen); se lee `navigator.onLine` directamente, mismo criterio que `gateServiceWrite`/`getCountOfflineSafe`. El guard es silencioso (no toast) porque la UI ya comunica vía `disabled`+tooltip.

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| BusinessTags | customTags | label (create/update/delete) | No — usa `dialogValue` local + `onTagsChange()` refetch (patrón existente, sin cambio) | `onTagsChange()` |
| AvatarPicker | selectedId, isOffline | ninguno (es selector, no editor de la prop) | No | `onSelect(avatar)` |
| EditDisplayNameDialog | (lee `displayName` de `useAuth`) | nameValue | Ya usa `useState(displayName)` local | `setDisplayName` (via context) |

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| `OFFLINE_ENQUEUED_MSG` = "Guardado offline — se sincronizará al reconectar" | toast en `BusinessTags` (create/update/delete offline) | Reusado de `offlineInterceptor.ts`, NO se crea nuevo. Tilde en "sincronizará". |
| `MSG_OFFLINE.requiresConnection` = "Requiere conexión" | atributo `title` del botón Guardar en `EditDisplayNameDialog` | Reusado de `src/constants/messages/offline.ts`, NO se duplica. Tilde en "conexión". |

No se crean textos nuevos.

## Hooks

Ninguno nuevo (a menos que `BusinessTags.tsx` supere 300 líneas en implementación — ver Componentes). `useConnectivity` (de `src/context/ConnectivityContext.tsx`) se reusa.

## Servicios

### `src/services/tags.ts` (modificado)

```typescript
/** Generate a Firestore-compatible custom tag ID client-side (no network). Mirror of generateListId(). */
export function generateCustomTagId(): string {
  return doc(collection(db, COLLECTIONS.CUSTOM_TAGS)).id;
}

export async function createCustomTag(
  userId: string,
  businessId: string,
  label: string,
  tagId?: string,          // NEW: opcional, ID client-side (offline-first)
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_CUSTOM_TAG_LENGTH) {
    throw new Error('Custom tag label must be 1-30 characters');
  }
  const docData = { userId, businessId, label: trimmed, createdAt: serverTimestamp() };
  if (tagId) {
    await setDoc(doc(db, COLLECTIONS.CUSTOM_TAGS, tagId), docData);  // client-side ID
  } else {
    await addDoc(collection(db, COLLECTIONS.CUSTOM_TAGS), docData);  // fallback online
  }
  trackEvent('custom_tag_create', { business_id: businessId });
}
```

- **Nota de hardening:** el `addDoc` actual envía `label` SIN trim (bug menor: L62-67 usa `label` crudo aunque valida `trimmed`). La migración corrige esto enviando `label: trimmed` en ambos paths (cierra el checkbox de seguridad del PRD "`setDoc` no debe enviar `label` sin trim").
- `updateCustomTag(tagId, label)` y `deleteCustomTag(tagId)`: sin cambios de firma (ya aceptan `tagId`).
- `setDoc` ya está importado en `tags.ts`. No requiere import nuevo.

### `src/services/registerOfflineHandlers.ts` (modificado)

Agregar 3 entradas al `Record<OfflineActionType, OfflineHandler>` (la exhaustividad compile-time del `Record` fuerza su presencia; agregar el tipo a la union sin handler rompe el build):

```typescript
custom_tag_create: async ({ userId, businessId, referenceId, payload }: OfflineAction) => {
  const { label } = payload as CustomTagCreatePayload;
  const { createCustomTag } = await import('./tags');
  await createCustomTag(userId, businessId, label, referenceId);  // referenceId = tagId client-side
},
custom_tag_update: async ({ referenceId, payload }: OfflineAction) => {
  const { label } = payload as CustomTagUpdatePayload;
  const { updateCustomTag } = await import('./tags');
  if (!referenceId) throw new Error('custom_tag_update requires referenceId (tagId)');
  await updateCustomTag(referenceId, label);
},
custom_tag_delete: async ({ referenceId }: OfflineAction) => {
  const { deleteCustomTag } = await import('./tags');
  if (!referenceId) throw new Error('custom_tag_delete requires referenceId (tagId)');
  await deleteCustomTag(referenceId);
},
```

Agregar los imports de tipo `CustomTagCreatePayload`, `CustomTagUpdatePayload` (el delete no necesita payload tipado, usa solo `referenceId`).

## Integracion

- `BusinessTags` → ya cableado a `withOfflineSupport` + `useConnectivity` + `useToast`; solo se extienden 2 handlers.
- `ProfileScreen` → pasa `isOffline` a `AvatarPicker` (1 prop nueva).
- `EditDisplayNameDialog` → importa `useConnectivity`.
- `AuthContext` → guard `navigator.onLine` en 2 callbacks.
- `registerOfflineHandlers` → 3 handlers nuevos en el Record.
- `types/offline.ts` → 3 variantes + 3 payloads (en el archivo de dominio, NO en barrel).

### Preventive checklist

- [x] **Service layer**: `BusinessTags` NO importa `firebase/firestore`; los writes pasan por `services/tags.ts`. `AuthContext` guard usa `navigator.onLine` (no Firebase). OK.
- [x] **Duplicated constants**: `OFFLINE_ENQUEUED_MSG` y `MSG_OFFLINE.requiresConnection` se reusan, no se duplican. Action type strings van en la union de `types/offline.ts` (no magic strings). OK.
- [x] **Context-first data**: `isOffline` viene de `useConnectivity`; `user`/`displayName`/`avatarId` de `useAuth`. Sin `getDoc` extra. OK.
- [x] **Silent .catch**: handlers usan `logger.error`. No `.catch(() => {})`. OK.
- [x] **Stale props**: BusinessTags usa `onTagsChange()` refetch (fuente de verdad en parent); AvatarPicker/EditDisplayNameDialog ya manejan local state. OK.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/__tests__/tags.test.ts` (existente, extender) | `generateCustomTagId()` devuelve ID no vacío; `createCustomTag` con `tagId` usa `setDoc(doc(..., tagId))`; sin `tagId` usa `addDoc`; ambos paths envían `label` con trim; validación 1-30 sigue lanzando | Service |
| `src/services/__tests__/registerOfflineHandlers.test.ts` (existente, extender) | los 3 `custom_tag_*` invocan el service correcto con payload deserializado; `custom_tag_update`/`delete` lanzan si falta `referenceId`; `custom_tag_create` pasa `referenceId` como `tagId` a `createCustomTag` | Registry |
| `src/services/__tests__/offlineInterceptor.test.ts` (existente, extender) | `withOfflineSupport` encola `custom_tag_*` con `referenceId` (tagId) en meta y dispara `EVT_OFFLINE_ACTION_QUEUED` con `action_type` correcto | Service |
| `src/components/business/__tests__/BusinessTags.test.tsx` (nuevo o extender) | create/update/delete online ejecutan el service; offline encolan + toast `OFFLINE_ENQUEUED_MSG`; el `tagId` generado en create es el que se encola (estable entre create y delete offline) | Componente |
| `src/services/__tests__/syncEngine.test.ts` (existente, extender) | crear+editar mismo tag offline (mismo `referenceId`) → al drenar FIFO, ambos `executeAction` aplican en orden y el `updateCustomTag` recibe el `tagId` del create; **delete de tag cuyo create falló permanentemente: `deleteCustomTag` de doc inexistente resuelve limpio (Firestore `deleteDoc` no lanza) → `executeAction` NO falla → NO reintenta → NO llega a `OFFLINE_MAX_RETRIES`** (observación de Sofia) | Replay ordering |
| `src/components/profile/__tests__/EditDisplayNameDialog.test.tsx` (nuevo) | botón Guardar `disabled` cuando `isOffline`; atributo `title` == "Requiere conexión" cuando offline, `undefined` cuando online; `handleSave` no llama `setDisplayName` offline | Componente |
| `src/components/profile/__tests__/AvatarPicker.test.tsx` (nuevo) | `ButtonBase` con `disabled`+`aria-disabled` cuando `isOffline=true`; `onSelect` NO se dispara offline; se dispara online | Componente |
| `src/context/AuthContext.test.tsx` (existente, extender) | `setDisplayName`/`setAvatarId` no llaman al service cuando `navigator.onLine === false` (guard defense-in-depth) | Context |
| `tests/rules/customTags.rules.test.ts` (nuevo) | ALLOW create con ID client-side + label válido + owner; DENY label > 30; DENY campo extra (fuera del whitelist); DENY update fuera de `label`; DENY delete de otro owner; **delete de doc inexistente resuelve sin error (rule permite, no hay `resource.data` → la rule `resource.data.userId == auth.uid` evalúa sobre doc ausente: confirmar comportamiento esperado)** (observación de Sofia) | Rules |

**Mock strategy:**

- Firestore: mock SDK (`setDoc`, `addDoc`, `deleteDoc`, `updateDoc`, `doc`, `collection`) en service tests.
- Analytics: mock `trackEvent`.
- Offline queue: en `BusinessTags.test.tsx`, mock `enqueue`/`offlineQueue` y verificar el payload encolado. Para online path, mock `services/tags`.
- `useConnectivity`/`useAuth`/`useToast`/`useBusinessScope`: mock de los contextos (patrón existente de tests de componentes).
- Rules: `@firebase/rules-unit-testing` v5 contra emulador, siguiendo `tests/rules/users.rules.test.ts`.

**Nota sobre el rules test de delete de doc inexistente:** confirmar que `deleteDoc` de un doc que no existe (1) en el emulador resuelve sin lanzar — esto valida el caso "delete de un create que falló permanentemente" del flujo offline (S1). Si la rule evalúa `resource.data.userId` sobre un doc ausente y deniega, el test debe documentar que en producción el `deleteDoc` del replay resolvería igualmente sin error en el cliente (Firestore SDK no lanza en delete-not-found). El objetivo es: el replay NO debe quedar reintentando hasta `OFFLINE_MAX_RETRIES`.

## Analytics

- Reusa `EVT_OFFLINE_ACTION_QUEUED` (disparado dentro de `withOfflineSupport` con `action_type` = `custom_tag_create/update/delete`). NO se crea evento nuevo.
- `trackEvent('custom_tag_create', { business_id })` ya existe en el service (se conserva; se dispara en el replay/online del create).
- Verificar que `custom_tag_create/update/delete` aparezcan como `action_type` válidos en el reporte de tipos encolados (sin registro adicional — `action_type` es un parámetro libre, no enum registrado).

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Tags del comercio (read) | Persistencia offline Firestore + readCache 3-tier (existente) | 5 min (memory) / LRU 20 (IndexedDB) | IndexedDB `modo-mapa-read-cache` |
| Custom tag writes (create/update/delete) | Cola tipada `withOfflineSupport` → IndexedDB | hasta reconexión + `OFFLINE_MAX_RETRIES` | IndexedDB `offlineQueue` |
| Profile writes (displayName/avatar) | NO se cachea — gate UI (no se encola) | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Crear custom tag | Encolar `custom_tag_create` con `referenceId` = tagId client-side | FIFO: el create se replaya antes que cualquier update/delete del mismo `tagId` (ambos comparten el ID); el doc existe cuando llega el update/delete. **Rate limit server-side puede borrar el doc tras el create (tech debt aceptado, ver Cloud Functions).** |
| Editar custom tag | Encolar `custom_tag_update` (referenceId = tagId) | El `updateCustomTag` apunta al mismo doc creado por el create previo (FIFO garantiza orden). |
| Eliminar custom tag | Encolar `custom_tag_delete` (referenceId = tagId) | Si el create del mismo tag falló permanentemente (no-op tolerable): `deleteDoc` de doc inexistente resuelve limpio → no reintenta. |
| Cambiar displayName | Bloqueado offline (gate UI, NO se encola) | N/A — botón disabled |
| Cambiar avatar | Bloqueado offline (gate UI, NO se encola) | N/A — ButtonBase disabled |

**Ordering del replay (create → update/delete del mismo tag):** `syncEngine.getPending()` ordena FIFO por `createdAt`. Un `custom_tag_create` encolado antes de un `custom_tag_update`/`custom_tag_delete` del mismo `referenceId` se replaya primero. A diferencia de `comment_edit`/`comment_delete` (#340 W6, que SÍ necesita guard de "edit no confirmado"), aquí NO se necesita guard porque create y update/delete comparten el `tagId` client-side y FIFO garantiza la secuencia. El doc ya existe cuando llega el update/delete.

### Fallback UI

- Custom tags: toast `OFFLINE_ENQUEUED_MSG` (no se bloquea; el chip aparece tras refetch al reconectar).
- Profile: botón Guardar / avatares deshabilitados + tooltip "Requiere conexión".
- Reads: `StaleBanner` existente (sin cambios).

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| BusinessTags | Chip "Agregar" / chips custom (existentes) | (Chip MUI interactivo, sin cambio) | ya ≥ 44 (IconButtons) | toast offline |
| AvatarPicker | ButtonBase de avatar | `avatar.label` (existente) + `aria-disabled` cuando offline | width 100% grid cell (≥ 44) | disabled visual + aria |
| EditDisplayNameDialog | Botón Guardar | (texto "Guardar") + `title` offline | botón MUI estándar | disabled + title nativo |

### Reglas aplicadas

- `AvatarPicker` ButtonBase: `disabled` + `aria-disabled` (no solo visual) cuando offline.
- Botón Guardar disabled con `title={isOffline ? MSG_OFFLINE.requiresConnection : undefined}` nativo (NO `<Tooltip>`/`<span>` wrapper — patrón del proyecto).
- Custom tags NO se deshabilitan (encolables) — feedback vía toast.
- Touch targets: los IconButtons ya usan `minWidth/minHeight: 44`. Sin nuevos elementos < 44.

## Textos y copy

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| "Guardado offline — se sincronizará al reconectar" (`OFFLINE_ENQUEUED_MSG`) | toast custom tags | reusado, tilde en "sincronizará" |
| "Requiere conexión" (`MSG_OFFLINE.requiresConnection`) | title botón Guardar | reusado, tilde en "conexión" |

### Reglas de copy

- No se crean textos nuevos. Ambos strings se reusan de constantes existentes (cumple "strings reutilizables en `src/constants/messages/`").
- Terminología: "etiquetas"/"comercios" en cualquier copy auxiliar.

---

## Decisiones tecnicas

1. **`tagId` en `referenceId` (no en payload ni campo nuevo):** se reusa el campo genérico `OfflineAction.referenceId` (ya existente para `recommendation_read`) para los 3 tipos custom tag. Alternativa rechazada: agregar `tagId` al payload de cada uno — más verboso y desalineado con cómo `list_*` usa el campo dedicado `listId`. Se prefiere `referenceId` (genérico) sobre agregar un campo `tagId` a `OfflineAction` para no inflar el shape global por un solo dominio.

2. **Profile mutations: gate UI, sin OfflineActionType (opción a):** el issue pide explícitamente deshabilitar + tooltip. `users` no tiene handler de replay y las mutaciones de perfil tocan campos con validación bidireccional (`displayNameLower`). Encolarlas (opción b) agregaría 2 action types + handlers + riesgo de conflicto con `displayNameLower` server-side por marginal beneficio. Rechazada.

3. **Guard `navigator.onLine` en AuthContext (defense-in-depth):** además del gate UI, los callbacks `setDisplayName`/`setAvatarId` retornan early si offline. Cubre callers que no pasen por la UI gateada. Se lee `navigator.onLine` directo (no `useConnectivity`, que es un hook React no usable dentro de callbacks ya definidos), mismo criterio que `gateServiceWrite`.

4. **Corrección del trim en `createCustomTag`:** la migración aprovecha para enviar `label: trimmed` (hoy el `addDoc` manda `label` crudo). Cierra checkbox de seguridad del PRD sin scope creep.

5. **Rate limit server-side en replay = tech debt aceptado:** ver sección Cloud Functions. No se mitiga (fuera de scope: no se tocan rules/trigger).

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. Las rules de `customTags` (L251-270) y `users` (#322 R12) ya cubren todos los invariantes. Solo se agrega un rules test (`tests/rules/customTags.rules.test.ts`).

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| customTags | 10/business + 50/día por usuario | `checkRateLimit` en `onCustomTagCreated` (trigger existente, sin cambio); `snap.ref.delete()` on exceed (enforcement real, no log-only) |
| users (profile) | N/A (gate UI, no nueva superficie de escritura) | — |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Overwrite de doc ajeno via `setDoc` con ID arbitrario | create rule exige `userId == auth.uid`; update/delete exige `resource.data.userId == auth.uid` | `firestore.rules` L253-269 |
| Replay de cola corrupta apuntando a doc ajeno | update/delete validan ownership server-side; el replay NO bypasea rules | `firestore.rules` L261-269 |
| Spam de tags offline (encolar N → drenar) | rate limit server-side 10/business + 50/día con delete on exceed (existente) | `functions/src/triggers/customTags.ts` |
| Field injection via `setDoc` | `hasOnly(['userId','businessId','label','createdAt'])` + `label` trim ≤ 30 en service | `firestore.rules` L254 + `services/tags.ts` |
| Profile write offline sin awareness | gate UI (disabled + tooltip) + guard `navigator.onLine` en context | `EditDisplayNameDialog`, `AvatarPicker`, `AuthContext` |

---

## Deuda tecnica: mitigacion incorporada

`gh issue list --label security --state open` → `[]` (sin issues abiertos).
`gh issue list --label "tech debt" --state open` → `[]` (sin issues abiertos).

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| (interno, no trackeado) `createCustomTag` enviaba `label` sin trim | enviar `label: trimmed` en ambos paths | Fase 1, paso 2 |
| Inventario tests.md: `customTags` rules test pendiente | agregar `tests/rules/customTags.rules.test.ts` (allow+deny) | Fase 4 |
| Hueco offline de custom tags (audit /health-check) | encolar tipado vía `withOfflineSupport` | Fases 1-3 |

No se agrava deuda existente. Dead code `inviteListEditor`/`removeListEditor` queda explícitamente fuera de scope (issue separado).

---

## Validacion Tecnica

**Arquitecto**: Diego
**Fecha**: 2026-06-10
**Estado**: VALIDADO

**Hallazgos**: Sin hallazgos. Listo para generar el plan.

### Verificaciones realizadas (Ciclo 1)

- Data model coherente con el codebase: las 3 variantes `custom_tag_*` y sus payloads siguen el patron `_type`-marker establecido (`RatingDeletePayload`, `ListDeletePayload`); `CustomTagCreatePayload { label }` minimal, `tagId` en el campo generico existente `OfflineAction.referenceId` (verificado en `types/offline.ts` L44). Sin inflar el shape global.
- `generateCustomTagId()` es espejo exacto de `generateListId()` (verificado en `sharedLists.ts` L30-32); `createCustomTag(tagId?)` replica el branch `setDoc(doc(...,id))` vs `addDoc(...)` de `createList(listId?)` (verificado).
- `withOfflineSupport` ya soporta `referenceId` en `actionMeta` y lo propaga a `enqueue` (verificado en `offlineInterceptor.ts` L8-46). El wrap propuesto no requiere cambios en el interceptor.
- Exhaustividad compile-time: `Record<OfflineActionType, OfflineHandler>` en `registerOfflineHandlers.ts` L36 fuerza los 3 handlers nuevos (verificado).
- Edge cases cubiertos: replay FIFO create→update/delete del mismo `tagId`; comportamiento del `snap.ref.delete()` del trigger en replay (incl. multi-device); delete de tag cuyo create fallo = no-op tolerable. Todos con el escenario explicito que pidio Sofia.
- Rules sin cambio (correctamente justificado); el ID client-side NO abre vector (el whitelist + ownership server-side bloquean overwrite). Rules test allow+deny agregado con caso de delete de doc inexistente.
- Path real `src/context/` (singular) verificado y usado consistentemente en specs.
- Modularizacion neutral: ningun componente importa `firebase/firestore`; writes en `services/tags.ts`; `AvatarPicker` sigue props-driven puro.
