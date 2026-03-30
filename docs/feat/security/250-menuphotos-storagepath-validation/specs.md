# Specs: menuPhotos storagePath sin validar -- proxy de archivos privados

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No se agregan colecciones ni campos nuevos. El feature se limita a validar el campo `storagePath` existente en `menuPhotos`.

Tipo existente en `src/types/`:

```typescript
interface MenuPhoto {
  id: string;
  userId: string;
  businessId: string;
  storagePath: string;      // debe seguir: menus/{userId}/{businessId}/{docId}_original
  thumbnailPath: string;
  status: MenuPhotoStatus;  // 'pending' | 'approved' | 'rejected'
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  reportCount: number;
}
```

Formato esperado de `storagePath`: `menus/{userId}/{businessId}/{fileName}` donde:

- `{userId}` debe coincidir con `request.auth.uid` (en rules) y con `data.userId` (en trigger)
- `{businessId}` debe coincidir con `data.businessId` y tener formato `biz_NNN`
- `{fileName}` debe terminar en extension de imagen valida o ser el ID del documento + `_original`

---

## Firestore Rules

Modificar la regla `create` de `menuPhotos` para validar `storagePath`:

```javascript
match /menuPhotos/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['userId', 'businessId', 'storagePath', 'thumbnailPath', 'status', 'createdAt', 'reportCount'])
    && request.resource.data.userId == request.auth.uid
    && isValidBusinessId(request.resource.data.businessId)
    && request.resource.data.status == 'pending'
    && request.resource.data.createdAt == request.time
    && request.resource.data.reportCount == 0
    // NEW: storagePath validation
    && request.resource.data.storagePath is string
    && request.resource.data.storagePath.size() > 0
    && request.resource.data.storagePath.size() <= 200
    && request.resource.data.storagePath.matches('^menus/' + request.auth.uid + '/biz_[0-9]{1,6}/[a-zA-Z0-9_-]+$')
    // NEW: thumbnailPath must be empty string on create
    && request.resource.data.thumbnailPath == '';
  allow update: if false;
  allow delete: if false;
}
```

Notas sobre la regex:

- `^menus/` fija el prefijo, impidiendo path traversal.
- El segmento `request.auth.uid` se concatena directamente, garantizando ownership.
- `biz_[0-9]{1,6}` valida el businessId con el mismo formato que `isValidBusinessId`.
- `[a-zA-Z0-9_-]+$` permite el fileName sin extensiones peligrosas ni caracteres especiales.
- Longitud maxima 200 previene payloads excesivos.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| `uploadMenuPhoto` (services/menuPhotos.ts) | menuPhotos | Owner autenticado | `allow create: if auth.uid == userId` + nueva regex | NO -- el path se construye programaticamente y ya sigue el formato |
| `getApprovedMenuPhoto` (services/menuPhotos.ts) | menuPhotos | Cualquier autenticado | `allow read: if auth != null` | No |
| `getUserPendingPhotos` (services/menuPhotos.ts) | menuPhotos | Cualquier autenticado | `allow read: if auth != null` | No |

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| menuPhotos | storagePath (validacion, no campo nuevo) | SI | N/A (update: false) | NO |
| menuPhotos | thumbnailPath (validacion `== ''`) | SI | N/A (update: false) | NO |

---

## Cloud Functions

### Modificacion: `onMenuPhotoCreated` (`functions/src/triggers/menuPhotos.ts`)

Agregar validacion de `storagePath` antes de procesar. Si el path es invalido, marcar el documento como `rejected` y logear abuso.

```typescript
// Constante para el patron esperado
const STORAGE_PATH_REGEX = /^menus\/[a-zA-Z0-9]+\/biz_\d{1,6}\/[a-zA-Z0-9_-]+$/;

// Antes del rate limit check:
const storagePath = data.storagePath as string;

// Validar formato del path
if (!storagePath || !STORAGE_PATH_REGEX.test(storagePath)) {
  await snap.ref.update({ status: 'rejected', rejectionReason: 'invalid_storage_path' });
  await logAbuse(db, { userId, type: 'invalid_input', collection: 'menuPhotos', detail: `Invalid storagePath: ${storagePath}` });
  return;
}

// Validar que el userId en el path coincida con el userId del documento
const pathSegments = storagePath.split('/');
if (pathSegments[1] !== userId) {
  await snap.ref.update({ status: 'rejected', rejectionReason: 'storage_path_user_mismatch' });
  await logAbuse(db, { userId, type: 'invalid_input', collection: 'menuPhotos', detail: `storagePath userId mismatch: path=${pathSegments[1]}, doc=${userId}` });
  return;
}

// Validar que el businessId en el path coincida con el businessId del documento
const businessId = data.businessId as string;
if (pathSegments[2] !== businessId) {
  await snap.ref.update({ status: 'rejected', rejectionReason: 'storage_path_business_mismatch' });
  await logAbuse(db, { userId, type: 'invalid_input', collection: 'menuPhotos', detail: `storagePath businessId mismatch: path=${pathSegments[2]}, doc=${businessId}` });
  return;
}
```

---

## Componentes

No hay cambios en componentes. El feature es puramente server-side (rules + Cloud Function).

### Mutable prop audit

N/A -- no hay componentes editables involucrados.

---

## Textos de usuario

N/A -- no hay textos visibles al usuario. Los valores `rejectionReason` (`invalid_storage_path`, `storage_path_user_mismatch`, `storage_path_business_mismatch`) son internos del trigger y no se muestran al usuario.

---

## Hooks

No hay cambios en hooks.

---

## Servicios

### Verificacion: `services/menuPhotos.ts`

El servicio ya construye `storagePath` programaticamente en linea 52:

```typescript
const storagePath = `menus/${userId}/${businessId}/${docRef.id}_original`;
```

Este formato cumple con la regex de las rules y la validacion del trigger. No se necesitan cambios. El path no es input del usuario en ningun punto.

---

## Integracion

No se modifican componentes ni hooks existentes. Los cambios son:

1. `firestore.rules` -- regla `create` de `menuPhotos`
2. `functions/src/triggers/menuPhotos.ts` -- validacion antes de procesar

### Preventive checklist

- [x] **Service layer**: El servicio `menuPhotos.ts` no tiene imports directos de `firebase/firestore` para writes indebidos
- [x] **Duplicated constants**: La regex de validacion se define una sola vez en el trigger
- [x] **Context-first data**: N/A -- no hay componentes
- [x] **Silent .catch**: El catch existente en el trigger usa `console.error` -- se mejorara (ver deuda tecnica)
- [x] **Stale props**: N/A -- no hay componentes

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/triggers/__tests__/menuPhotos.test.ts` | Validacion de storagePath: formato correcto pasa, paths maliciosos se rechazan, userId mismatch, businessId mismatch, rate limit, thumbnail generation | Trigger |

### Casos a cubrir

- Path valido (`menus/{userId}/biz_001/{docId}_original`) -- pasa a thumbnail generation
- Path sin prefijo `menus/` -- rejected + abuse log
- Path con traversal (`../feedback-media/secret.jpg`) -- rejected
- Path con userId diferente al del documento -- rejected + abuse log
- Path con businessId diferente al del documento -- rejected + abuse log
- Path vacio o undefined -- rejected
- Path excesivamente largo -- rejected por regex (no matchea)
- Rate limit exceeded -- no procesa (comportamiento existente)

### Mock strategy

- Mock `firebase-admin/storage` para `getStorage().bucket().file().download()`
- Mock `sharp` para thumbnail generation
- Mock `getDb()` para Firestore admin
- Mock `checkRateLimit` y `logAbuse`
- Mock `incrementCounter` y `trackWrite`

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo en el trigger
- Todos los paths condicionales de validacion cubiertos
- Side effects verificados (doc update a `rejected`, `logAbuse` llamado)

---

## Analytics

No se agregan eventos de analytics nuevos. Los abusos se registran via `logAbuse` existente.

---

## Offline

### Cache strategy

N/A -- no hay datos cacheados afectados.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Upload de foto | Requiere conexion (Storage upload) | N/A |

### Fallback UI

N/A -- no hay cambios de UI.

---

## Decisiones tecnicas

1. **Regex en rules vs funcion helper**: Se usa regex inline en la regla porque Firestore rules no soporta funciones que reciban strings y devuelvan matches complejos. La concatenacion de `request.auth.uid` directamente en la regex garantiza que el userId no puede ser falsificado.

2. **Doble validacion (rules + trigger)**: Defensa en profundidad. Las rules son la primera barrera (previenen la escritura), pero si un path invalido llega al trigger (por ejemplo, si la regex de rules tiene un bug), el trigger lo detecta y marca como `rejected`.

3. **Marcar como `rejected` vs borrar**: El trigger marca como `rejected` en vez de borrar porque las rules tienen `allow delete: if false`. Esto deja un registro auditable del intento de abuso.

4. **Regex sin extension en rules**: El `storagePath` generado por el servicio es `{docId}_original` (sin extension de archivo). La regex en rules permite `[a-zA-Z0-9_-]+` que cubre este formato. No se valida extension porque el archivo real en Storage ya esta validado por `storage.rules` (solo `image/*`).

---

## Hardening de seguridad

### Firestore rules requeridas

```javascript
// En match /menuPhotos/{docId}:
// Agregar a la regla create:
&& request.resource.data.storagePath is string
&& request.resource.data.storagePath.size() > 0
&& request.resource.data.storagePath.size() <= 200
&& request.resource.data.storagePath.matches('^menus/' + request.auth.uid + '/biz_[0-9]{1,6}/[a-zA-Z0-9_-]+$')
&& request.resource.data.thumbnailPath == ''
```

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| menuPhotos | 10/dia | `checkRateLimit` existente en `onMenuPhotoCreated` (sin cambios) |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Proxy de archivos privados via storagePath arbitrario | Regex en rules impide paths fuera de `menus/{uid}/` | `firestore.rules` |
| Path traversal (`../feedback-media/`) | Regex con `^menus/` y sin `.` en charset impide traversal | `firestore.rules` |
| userId spoofing en storagePath | `request.auth.uid` concatenado en regex de rules | `firestore.rules` |
| Bypass de rules (edge case) | Validacion redundante en trigger con reject + abuse log | `functions/src/triggers/menuPhotos.ts` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| `console.error` en trigger menuPhotos | Reemplazar con logging estructurado (ya usa admin SDK) | Fase 1, paso 2 |
| menuPhotos trigger sin tests | Se agregan tests completos | Fase 2 |
