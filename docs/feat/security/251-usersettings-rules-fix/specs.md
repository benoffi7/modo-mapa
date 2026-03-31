# Specs: userSettings rules fix + listItems delete + color/icon validation

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No se agregan colecciones nuevas. Se modifican validaciones en reglas existentes.

### Campos agregados a whitelist de `userSettings`

```typescript
// Campos existentes en src/types/user.ts (ya definidos en #205)
interface UserSettings {
  // ... campos existentes ...
  followedTags?: string[];          // array de tag IDs seguidos
  followedTagsUpdatedAt?: Date;     // timestamp de ultima actualizacion
  followedTagsLastSeenAt?: Date;    // timestamp de ultima visualizacion
}
```

No se modifican tipos TypeScript -- ya estan definidos en `src/types/user.ts`.

---

## Firestore Rules

### R1: userSettings -- agregar followedTags fields a whitelist

Regla actual (linea 312 de `firestore.rules`):

```javascript
// ANTES
&& request.resource.data.keys().hasOnly(['profilePublic', 'notificationsEnabled', 'notifyLikes', 'notifyPhotos', 'notifyRankings', 'notifyFeedback', 'notifyReplies', 'notifyFollowers', 'notifyRecommendations', 'notificationDigest', 'analyticsEnabled', 'locality', 'localityLat', 'localityLng', 'updatedAt'])
```

```javascript
// DESPUES
&& request.resource.data.keys().hasOnly(['profilePublic', 'notificationsEnabled', 'notifyLikes', 'notifyPhotos', 'notifyRankings', 'notifyFeedback', 'notifyReplies', 'notifyFollowers', 'notifyRecommendations', 'notificationDigest', 'analyticsEnabled', 'locality', 'localityLat', 'localityLng', 'followedTags', 'followedTagsUpdatedAt', 'followedTagsLastSeenAt', 'updatedAt'])
```

Validaciones de tipo para los nuevos campos:

```javascript
&& (!('followedTags' in request.resource.data) || (request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20))
&& (!('followedTagsUpdatedAt' in request.resource.data) || request.resource.data.followedTagsUpdatedAt is timestamp)
&& (!('followedTagsLastSeenAt' in request.resource.data) || request.resource.data.followedTagsLastSeenAt is timestamp)
```

Nota: `followedTags.size() <= 20` coincide con `MAX_FOLLOWED_TAGS` en `src/constants/interests.ts`.

### R2: userSettings -- validacion de tipo en campos de notificaciones

Campos que ya estan en la whitelist pero no tienen validacion de tipo:

```javascript
// Agregar validaciones:
&& (!('notifyFollowers' in request.resource.data) || request.resource.data.notifyFollowers is bool)
&& (!('notifyRecommendations' in request.resource.data) || request.resource.data.notifyRecommendations is bool)
&& (!('notificationDigest' in request.resource.data) || (request.resource.data.notificationDigest is string && request.resource.data.notificationDigest.size() <= 10))
```

Nota: `notificationDigest` acepta `'realtime' | 'daily' | 'weekly'` (max 8 chars). Limite de 10 da margen.

### R3: sharedLists -- validacion de color e icon

En la regla de `create` de `sharedLists`, agregar:

```javascript
&& (!('color' in request.resource.data) || (request.resource.data.color is string && request.resource.data.color.size() <= 20))
&& (!('icon' in request.resource.data) || (request.resource.data.icon is string && request.resource.data.icon.size() <= 50))
```

En la regla de `update` (rama owner), agregar las mismas validaciones:

```javascript
&& (!('color' in request.resource.data) || (request.resource.data.color is string && request.resource.data.color.size() <= 20))
&& (!('icon' in request.resource.data) || (request.resource.data.icon is string && request.resource.data.icon.size() <= 50))
```

### Rules impact analysis

| Query (service/hook) | Collection | Auth context | Rule que permite | Cambio necesario? |
|---------------------|------------|-------------|-----------------|-------------------|
| `updateUserSettings(uid, { followedTags, followedTagsUpdatedAt })` | userSettings | Owner | `allow write: if auth.uid == userId` | SI -- agregar campos a `keys().hasOnly()` |
| `updateUserSettings(uid, { notifyFollowers: true })` | userSettings | Owner | `allow write: if auth.uid == userId` | SI -- agregar validacion `is bool` |
| `updateUserSettings(uid, { notificationDigest: 'daily' })` | userSettings | Owner | `allow write: if auth.uid == userId` | SI -- agregar validacion `is string` |
| `createList({ color, icon })` | sharedLists | Owner | `allow create: if auth.uid == ownerId` | SI -- agregar validacion tipo+longitud |
| `updateList({ color, icon })` | sharedLists | Owner | `allow update: if isListOwner()` | SI -- agregar validacion tipo+longitud |

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|----------------------|----------------------|--------------------------------------|-------------------|
| userSettings | followedTags | NO | N/A (usa `write` unificado) | SI -- agregar a `keys().hasOnly()` |
| userSettings | followedTagsUpdatedAt | NO | N/A | SI -- agregar a `keys().hasOnly()` |
| userSettings | followedTagsLastSeenAt | NO | N/A | SI -- agregar a `keys().hasOnly()` |
| sharedLists | color | SI (ya esta) | SI (ya esta) | NO para whitelist, SI para tipo+longitud |
| sharedLists | icon | SI (ya esta) | SI (ya esta) | NO para whitelist, SI para tipo+longitud |

Nota: `userSettings` usa una regla `write` unificada (no separa create/update con `affectedKeys`). Los 3 campos faltantes van en el mismo `keys().hasOnly()`.

---

## Cloud Functions

### F1: onListItemCreated -- rate limit enforcement

Archivo: `functions/src/triggers/listItems.ts`

Cambio: cuando `exceeded == true`, ademas de loguear abuso, eliminar el documento recien creado.

```typescript
if (exceeded) {
  // Delete the offending document FIRST
  await snap.ref.delete();
  await logAbuse(db, {
    userId: addedBy,
    type: 'rate_limit',
    collection: 'listItems',
    detail: 'Exceeded 100 listItems/day — document deleted',
  });
}
```

El `snap.ref` ya esta disponible desde `event.data` (es un `QueryDocumentSnapshot`). El delete usa admin SDK, por lo que no necesita rules.

---

## Componentes

No hay componentes nuevos ni modificados. Todos los cambios son en `firestore.rules` y Cloud Functions.

---

## Textos de usuario

No hay textos nuevos visibles al usuario. Los cambios son transparentes (rules y triggers server-side).

---

## Hooks

No hay hooks nuevos ni modificados.

---

## Servicios

No hay servicios nuevos ni modificados. El servicio `updateUserSettings` en `src/services/userSettings.ts` ya envia `followedTags`, `followedTagsUpdatedAt` y `followedTagsLastSeenAt` correctamente. El problema es que las rules los rechazan.

---

## Integracion

### Impacto en codigo existente

- `useFollowedTags.ts` -- actualmente las llamadas a `updateUserSettings` con `followedTags` fallan en produccion porque las rules rechazan los campos. Despues de este fix, funcionaran sin cambios en el hook.
- `useUserSettings.ts` -- las llamadas con `notifyFollowers`, `notifyRecommendations`, `notificationDigest` ya funcionan pero sin validacion de tipo server-side. Despues del fix, tipos incorrectos seran rechazados.
- `ListDetailScreen.tsx` -- escribe `color` e `icon` via `updateSharedList`. Los valores validos (hex de `LIST_COLORS`, IDs de `LIST_ICON_OPTIONS`) ya cumplen las restricciones de longitud.

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes
- [x] **Duplicated constants**: No hay constantes duplicadas
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No aplica (no se agregan catches)
- [x] **Stale props**: No aplica (no hay cambios en componentes)

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/triggers/listItems.test.ts` | Rate limit enforcement: doc eliminado cuando excede 100/dia; detail actualizado | Trigger |

### Casos a cubrir

**listItems trigger** (modificar test existente):

- [x] Ya cubierto: skip si no hay snapshot
- [x] Ya cubierto: incrementa counters sin rate limit check cuando addedBy falta
- [x] Ya cubierto: no loguea abuso cuando no excede rate limit
- [ ] **Modificar**: cuando excede rate limit, verificar que `snap.ref.delete()` es llamado ADEMAS de `logAbuse`
- [ ] **Modificar**: verificar que el detail del log dice "document deleted"

**Firestore rules** (no hay test framework configurado para rules en este proyecto; la validacion se hace via emuladores en dev):

- userSettings write con followedTags: aceptado
- userSettings write con followedTags de longitud > 20: rechazado
- userSettings write con notifyFollowers tipo string: rechazado
- userSettings write con notificationDigest tipo number: rechazado
- sharedLists create con color tipo objeto: rechazado
- sharedLists create con icon longitud > 50: rechazado

### Mock strategy

- Firestore: mock existente en `listItems.test.ts` con `snap.ref.delete`
- No se necesitan mocks nuevos para rules (validacion en emuladores)

### Criterio de aceptacion

- Cobertura >= 80% del codigo modificado en `listItems.ts`
- Test verifica que `snap.ref.delete()` es llamado cuando rate limit es excedido

---

## Analytics

No se agregan eventos de analytics nuevos.

---

## Offline

No hay cambios en la estrategia offline. Los mecanismos existentes siguen funcionando:

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| followedTags | Firestore persistent cache | N/A | IndexedDB (Firestore) |
| sharedLists | Firestore persistent cache | N/A | IndexedDB (Firestore) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| updateUserSettings (followedTags) | withOfflineSupport + Firestore offline writes | Last-write-wins (Firestore default) |
| createListItem | Firestore offline writes | Server-side rate limit (trigger) |

### Fallback UI

No hay cambios en fallback UI.

---

## Decisiones tecnicas

1. **userSettings usa regla `write` unificada** (no `create`+`update` separadas). Los 3 campos de followedTags se agregan a la unica regla `write` existente, con validacion condicional (`!('field' in data) || ...`) para campos opcionales.

2. **followedTags validacion como `is list`** en vez de validar cada elemento del array. Firestore rules no tiene una forma eficiente de iterar arrays para validar tipos de elementos individuales. La validacion de contenido (IDs de tags validos) se hace client-side en `useFollowedTags.ts` con `VALID_TAG_IDS`.

3. **notificationDigest validacion como `is string` + longitud** en vez de enum. Firestore rules no soporta `in ['realtime', 'daily', 'weekly']` para campos opcionales de forma limpia. La longitud maxima de 10 previene abuso sin restringir valores futuros.

4. **listItems rate limit: delete antes de logAbuse**. El delete es la accion critica; el log es secundario. Si el log falla, el documento igualmente fue eliminado.

5. **sharedLists color/icon: longitud maxima generosa**. `color` <= 20 (hex colors son 7 chars, nombres de color cortos). `icon` <= 50 (IDs de icono MUI son ~15-25 chars). Margenes amplios para evitar rechazos falsos.

---

## Hardening de seguridad

### Firestore rules requeridas

Ver secciones R1, R2 y R3 arriba para el codigo exacto.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| listItems | 100/dia por usuario | `onListItemCreated` trigger: count query + delete si excede (upgrade de log-only a enforcement) |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Escritura de followedTags con campos no autorizados en userSettings | `keys().hasOnly()` ahora incluye los 3 campos | `firestore.rules` |
| Inyeccion de tipo arbitrario en notifyFollowers (ej: objeto con payload) | Validacion `is bool` en rules | `firestore.rules` |
| Inyeccion de tipo arbitrario en notifyRecommendations | Validacion `is bool` en rules | `firestore.rules` |
| Inyeccion de tipo arbitrario en notificationDigest (ej: array) | Validacion `is string` + longitud en rules | `firestore.rules` |
| Spam ilimitado de listItems (rate limit no enforcea) | Delete del doc excedido en trigger | `functions/src/triggers/listItems.ts` |
| Inyeccion de HTML/objetos en color de sharedLists | Validacion `is string` + longitud maxima 20 | `firestore.rules` |
| Inyeccion de datos arbitrarios en icon de sharedLists | Validacion `is string` + longitud maxima 50 | `firestore.rules` |
| followedTags array gigante (DoS de storage) | Validacion `size() <= 20` en rules | `firestore.rules` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security o tech debt relevantes a estos archivos.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #205 Seguir Tags | Feature roto en produccion por fields faltantes en rules | Fase 1, paso 1 |
