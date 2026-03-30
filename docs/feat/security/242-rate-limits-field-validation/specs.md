# Specs: Rate Limits + Field Validation

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se crean colecciones ni campos nuevos. Los cambios son:

1. **`onMenuPhotoCreated`** trigger: se agrega `checkRateLimit()` antes del procesamiento de thumbnail. Si excede, loggea abuso y sale sin procesar.
2. **`sharedLists` update rule**: se agrega validacion de longitud para `name` (1-50) y `description` (0-200).
3. **`onListItemCreated`** trigger (nuevo): rate limit 100/dia por usuario. No bloquea la escritura (ya fue aceptada por rules), solo loggea abuso.

### Tipos existentes referenciados

```typescript
// functions/src/utils/rateLimiter.ts
interface RateLimitConfig {
  collection: string;
  limit: number;
  windowType: 'daily' | 'per_entity';
}

// functions/src/utils/abuseLogger.ts
interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood' | 'anon_flood' | 'ip_rate_limit';
  collection?: string;
  detail: string;
  severity?: 'low' | 'medium' | 'high';
}
```

No se agregan tipos nuevos.

## Firestore Rules

Modificacion en la regla de update de `sharedLists` para validar longitud de `name` y `description`:

```rules
allow update: if request.auth != null
  && request.resource.data.ownerId == resource.data.ownerId
  && (
    (isListOwner()
      && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['name', 'description', 'isPublic', 'itemCount', 'updatedAt', 'color', 'icon'])
      && request.resource.data.name is string
      && request.resource.data.name.size() > 0
      && request.resource.data.name.size() <= 50
      && request.resource.data.description is string
      && request.resource.data.description.size() <= 200)
    || (isListEditor()
        && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['itemCount', 'updatedAt']))
  );
```

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `updateList()` en `src/services/sharedLists.ts` | sharedLists | Owner autenticado | `allow update: if isListOwner()` | SI -- agregar validacion de longitud |
| `addBusinessToList()` en `src/services/sharedLists.ts` | listItems | Owner/editor autenticado | `allow create: if isItemListOwnerOrEditor()` | No |

La regla de update existente para `sharedLists` no valida longitud de `name` ni `description`. El cambio agrega estas validaciones sin afectar el `affectedKeys()` existente.

### Field whitelist check

No se agregan campos nuevos. La validacion de longitud se aplica a campos ya existentes en el whitelist.

| Collection | Campo | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|-------|----------------------|--------------------------------------|-------------------|
| sharedLists | name | SI (ya tiene size <= 50) | SI (en affectedKeys) -- falta validacion de longitud | SI -- agregar `name.size() > 0 && name.size() <= 50` en update |
| sharedLists | description | SI (ya tiene size <= 200) | SI (en affectedKeys) -- falta validacion de longitud | SI -- agregar `description.size() <= 200` en update |

## Cloud Functions

### S1. Modificar `onMenuPhotoCreated` -- agregar rate limit

**Archivo:** `functions/src/triggers/menuPhotos.ts`
**Trigger path:** `menuPhotos/{photoId}`

Logica:

1. Extraer `userId` de `data.userId`
2. Llamar `checkRateLimit(db, { collection: 'menuPhotos', limit: 10, windowType: 'daily' }, userId)`
3. Si excede: `logAbuse(db, { userId, type: 'rate_limit', collection: 'menuPhotos', detail: 'Exceeded 10 menuPhotos/day' })` y retornar sin procesar thumbnail ni incrementar counters
4. Si no excede: continuar con el flujo existente (thumbnail + counters)

Patron: identico a `onCommentCreated` y `onFavoriteCreated`.

Diferencia clave vs comments/favorites: **no se elimina el doc**. El doc `menuPhotos` tiene `allow delete: if false` en rules y la foto ya fue subida a Storage. Solo se loggea el abuso y se omite el procesamiento del thumbnail. La foto queda en status `pending` sin thumbnail, lo cual es un estado degradado pero no peligroso (el admin puede revisarla/eliminarla).

### S3. Crear trigger `onListItemCreated`

**Archivo nuevo:** `functions/src/triggers/listItems.ts`
**Trigger path:** `listItems/{itemId}`

Logica:

1. Extraer `addedBy` de `data.addedBy` (puede no existir en items legacy)
2. Si no hay `addedBy`, retornar sin rate limit
3. Llamar `checkRateLimit(db, { collection: 'listItems', limit: 100, windowType: 'daily' }, addedBy)`
4. Si excede: `logAbuse(db, { userId: addedBy, type: 'rate_limit', collection: 'listItems', detail: 'Exceeded 100 listItems/day' })`
5. No eliminar el doc (la escritura ya fue aceptada por rules; solo se loggea para deteccion)
6. Incrementar counters: `incrementCounter(db, 'listItems', 1)` + `trackWrite(db, 'listItems')`

Nota: `listItems` no tiene un campo `userId` sino `addedBy` (opcional). El `checkRateLimit` consulta por `userId` en la coleccion, pero los docs de `listItems` tienen `addedBy`. Para que funcione correctamente, se usa `addedBy` como el campo a buscar. Sin embargo, `checkRateLimit` busca `where('userId', '==', userId)` internamente, y los docs de `listItems` no tienen campo `userId`. La solucion es simple: el rate limit se basa en contar los docs de `listItems` donde `addedBy == userId` creados hoy. Dado que `checkRateLimit` hace `ref.where('userId', '==', userId)`, pero `listItems` usa `addedBy`, hay dos opciones:

- **Opcion A:** Usar una query directa en el trigger en vez de `checkRateLimit`.
- **Opcion B:** Pasar un cuarto parametro al `checkRateLimit` para customizar el campo.

Se elige **Opcion A** (query directa) por simplicidad y porque no queremos modificar la interfaz de `checkRateLimit` usada por 8+ triggers. La query sera:

```typescript
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);
const snapshot = await db.collection('listItems')
  .where('addedBy', '==', userId)
  .where('createdAt', '>=', startOfDay)
  .count().get();
const exceeded = snapshot.data().count > 100;
```

**Indice necesario:** `listItems` ya tiene indice compuesto para `addedBy` + `createdAt` (ascending). Verificar con `firebase firestore:indexes`.

## Componentes

No hay cambios en componentes frontend.

### Mutable prop audit

N/A -- no hay componentes editables afectados.

## Textos de usuario

N/A -- no hay textos user-facing nuevos. Los cambios son server-side (triggers y rules).

## Hooks

N/A -- no hay cambios en hooks.

## Servicios

N/A -- no hay cambios en servicios frontend.

## Integracion

### Registro del nuevo trigger en `functions/src/index.ts`

Agregar export del nuevo trigger `onListItemCreated` en la seccion de Triggers.

### Preventive checklist

- [x] **Service layer**: No hay componentes que importen `firebase/firestore` para writes
- [x] **Duplicated constants**: No se duplican constantes
- [x] **Context-first data**: N/A (solo backend)
- [x] **Silent .catch**: N/A
- [x] **Stale props**: N/A

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | Rate limit check antes de thumbnail; skip procesamiento si excedido; logAbuse llamado; counters NO incrementados si excedido | Unit |
| `functions/src/__tests__/triggers/listItems.test.ts` (nuevo) | Rate limit check en create; logAbuse si excedido; counters incrementados siempre; skip rate limit si no hay addedBy | Unit |

### Casos a cubrir -- menuPhotos

- [ ] Cuando rate limit NO excedido: genera thumbnail + incrementa counters (flujo existente)
- [ ] Cuando rate limit excedido: NO genera thumbnail, NO incrementa counters, loggea abuso
- [ ] Cuando no hay snapshot data: retorna sin hacer nada (ya cubierto)
- [ ] Cuando thumbnail falla pero rate limit ok: incrementa counters (ya cubierto)

### Casos a cubrir -- listItems

- [ ] Cuando rate limit NO excedido: incrementa counters
- [ ] Cuando rate limit excedido: incrementa counters + loggea abuso
- [ ] Cuando no hay snapshot data: retorna sin hacer nada
- [ ] Cuando `addedBy` no existe: incrementa counters sin check de rate limit

### Mock strategy

- `checkRateLimit`: mock que retorna `true` (excedido) o `false` (ok)
- `logAbuse`: mock para verificar llamadas
- `incrementCounter` / `trackWrite`: mocks existentes
- `sharp` / `getStorage`: mocks existentes (menuPhotos)
- Para listItems: query directa mockeada via `db.collection().where().where().count().get()`

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos (rate limit si/no, addedBy si/no)

## Analytics

N/A -- no se agregan eventos de analytics nuevos. Los abuse logs sirven como tracking server-side.

---

## Offline

### Cache strategy

N/A -- no hay cambios en cache. Los triggers se ejecutan server-side.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| menuPhoto create | Firestore persistent cache | Rate limit se evalua al sincronizar; si excedido, thumbnail no se genera |
| sharedList update | Firestore persistent cache | Rule rechaza la escritura al sincronizar si name > 50 o description > 200 |
| listItem create | Firestore persistent cache | Rate limit se evalua al sincronizar; si excedido, solo se loggea |

### Fallback UI

N/A -- no hay cambios de UI.

---

## Decisiones tecnicas

1. **menuPhotos: no eliminar doc si rate limit excedido.** A diferencia de otros triggers (comments, favorites) que eliminan el doc, `menuPhotos` tiene `allow delete: if false` en rules. Ademas, la foto ya fue subida a Storage. La estrategia es omitir el procesamiento del thumbnail y loggear abuso. El admin puede revisar y eliminar via admin SDK.

2. **listItems: log-only rate limit.** La escritura ya fue aceptada por rules. Eliminar el doc requeriria un `get()` al parent `sharedList` para decrementar `itemCount`, lo cual agrega complejidad. La estrategia es loggear para deteccion y dejar que el admin actue si hay abuso sistematico.

3. **listItems: query directa en vez de `checkRateLimit()`.** El campo en `listItems` es `addedBy`, no `userId`. Modificar `checkRateLimit` para aceptar un campo custom afectaria 8+ triggers existentes. Una query directa en el trigger es mas simple y aislada.

4. **sharedLists update: validacion en ambas ramas (owner/editor).** Solo la rama de owner puede modificar `name`/`description`, por lo que la validacion de longitud se agrega solo en esa rama. La rama de editor solo permite `itemCount` + `updatedAt`.

---

## Hardening de seguridad

### Firestore rules requeridas

Mostrado arriba en la seccion "Firestore Rules". Resumen:

```rules
// En la rama de owner update de sharedLists, agregar despues del affectedKeys():
&& request.resource.data.name is string
&& request.resource.data.name.size() > 0
&& request.resource.data.name.size() <= 50
&& request.resource.data.description is string
&& request.resource.data.description.size() <= 200
```

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| menuPhotos | 10/dia | `checkRateLimit` en `onMenuPhotoCreated` |
| listItems | 100/dia | Query directa en `onListItemCreated` |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Billing amplification via uploads concurrentes de fotos | Rate limit 10/dia, skip thumbnail si excedido | `functions/src/triggers/menuPhotos.ts` |
| Payload injection en name/description de listas publicas | Validacion de longitud en rules (50/200 chars) | `firestore.rules` |
| Write amplification en loop de listItems | Rate limit 100/dia + logAbuse | `functions/src/triggers/listItems.ts` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt actualmente.

El archivo `functions/src/triggers/menuPhotos.ts` usa `console.error` directamente (linea 36). Este es un patron de Cloud Functions (no el frontend), donde `console.error` mapea a Cloud Logging severity ERROR, asi que es aceptable.
