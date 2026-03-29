# Specs: Storage de menu photos sin scope de owner

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios al modelo de datos de Firestore. La coleccion `menuPhotos` mantiene la misma estructura. El campo `storagePath` cambiara de valor para nuevos documentos (de `menus/{businessId}/{docId}_original` a `menus/{userId}/{businessId}/{docId}_original`), pero no cambia el tipo ni la estructura del campo.

### Tipos existentes (sin cambios)

```typescript
// src/types/index.ts (ya existente)
interface MenuPhoto {
  id: string;
  userId: string;
  businessId: string;
  storagePath: string;
  thumbnailPath: string;
  status: MenuPhotoStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  reportCount: number;
}
```

## Firestore Rules

Sin cambios. Las Firestore rules para `menuPhotos` ya validan ownership (`request.resource.data.userId == request.auth.uid`) y usan `keys().hasOnly()`. El campo `storagePath` es un string libre sin validacion de formato en las rules.

### Rules impact analysis

No hay queries nuevas. Todas las queries existentes siguen funcionando con las rules actuales.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `uploadMenuPhoto` setDoc | menuPhotos | Owner | `allow create: if auth.uid == userId` | No |
| `getApprovedMenuPhoto` | menuPhotos | Any authenticated | `allow read: if auth != null` | No |
| `getUserPendingPhotos` | menuPhotos | Any authenticated | `allow read: if auth != null` | No |

### Field whitelist check

No se agregan campos nuevos. El campo `storagePath` ya esta en la whitelist de create:

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| menuPhotos | storagePath (valor cambia, no campo nuevo) | YES | N/A (update: false) | No |

## Cloud Functions

### Trigger modificado: `onMenuPhotoCreated`

**Archivo:** `functions/src/triggers/menuPhotos.ts`

**Cambio:** La construccion de `thumbPath` debe incluir `userId` del documento:

- Antes: `` `menus/${data.businessId}/${photoId}_thumb.jpg` ``
- Despues: `` `menus/${data.userId}/${data.businessId}/${photoId}_thumb.jpg` ``

La lectura del archivo original ya usa `data.storagePath` (linea 19), por lo que no necesita cambios. Solo la construccion del `thumbPath` para el thumbnail necesita actualizarse.

### Admin callable: sin cambios

**Archivo:** `functions/src/admin/menuPhotos.ts`

La funcion `deleteMenuPhoto` (linea 129) ya lee `data.storagePath` y `data.thumbnailPath` del documento de Firestore. No reconstruye paths manualmente. No necesita cambios.

### Scheduled: sin cambios

**Archivo:** `functions/src/scheduled/cleanupPhotos.ts`

Lee `data.storagePath` y `data.thumbnailPath` del documento. No reconstruye paths. No necesita cambios.

### Delete user data: sin cambios

**Archivo:** `functions/src/utils/deleteUserData.ts`

Lee `data.storagePath` y `data.thumbnailPath` del documento (lineas 66-67). No reconstruye paths. No necesita cambios.

## Componentes

Sin componentes nuevos ni modificados. Este cambio es puramente backend (storage rules + path strings en services/triggers).

### Mutable prop audit

N/A -- no hay componentes editables involucrados.

## Textos de usuario

N/A -- no hay textos nuevos visibles al usuario.

## Hooks

Sin hooks nuevos ni modificados.

## Servicios

### Servicio modificado: `uploadMenuPhoto`

**Archivo:** `src/services/menuPhotos.ts`

**Cambio:** La construccion de `storagePath` debe incluir `userId`:

- Antes: `` `menus/${businessId}/${docRef.id}_original` `` (linea 51)
- Despues: `` `menus/${userId}/${businessId}/${docRef.id}_original` ``

El `userId` ya esta disponible como parametro de la funcion.

## Integracion

### Storage rules (`storage.rules`)

Reemplazar la rule existente para `menus/{businessId}/{fileName}` con dos reglas:

1. **Nuevo path con ownership:** `menus/{userId}/{businessId}/{fileName}` -- valida `request.auth.uid == userId`
2. **Legacy path read-only:** `menus/{businessId}/{fileName}` -- solo lectura, bloquea creates/deletes

### Referencia de security docs

Actualizar `docs/reference/security.md` seccion "Storage rules" para reflejar el nuevo esquema.

Actualizar `docs/reference/firestore.md` seccion "Cloud Storage -- Fotos de menu" para reflejar el nuevo path.

### Preventive checklist

- [x] **Service layer**: `menuPhotos.ts` importa de `firebase/storage` para uploads -- esto es correcto, Storage uploads van por SDK directo.
- [x] **Duplicated constants**: No hay arrays/objetos duplicados.
- [x] **Context-first data**: No aplica.
- [x] **Silent .catch**: No hay `.catch(() => {})` nuevo.
- [x] **Stale props**: No aplica.

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/menuPhotos.test.ts` | Que `storagePath` incluya `userId` en el path generado | Service (update existing) |
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | Que `thumbPath` incluya `userId` del doc data | Trigger (update existing) |

### Cambios en tests existentes

**`src/services/menuPhotos.test.ts`:**

- Test "uploads photo and creates Firestore doc on success" (linea 113): verificar que `storagePath` en el `setDoc` call incluya `userId`. Agregar assertion:

```typescript
expect(mockSetDoc).toHaveBeenCalledWith(
  mockDocRef,
  expect.objectContaining({
    storagePath: 'menus/user1/biz1/photo-doc-1_original',
  }),
);
```

**`functions/src/__tests__/triggers/menuPhotos.test.ts`:**

- Test "generates thumbnail and updates doc" (linea 82): actualizar `storagePath` en mock data para incluir `userId` y actualizar expected `thumbnailPath`.
- Test "constructs correct thumbnail path" (linea 135): actualizar mock data y expected path.
- Todos los tests que usan `storagePath: 'menus/biz1/...'` deben actualizarse a `storagePath: 'menus/user1/biz1/...'` y agregar `userId: 'user1'` al mock data.

### Mock strategy

Sin cambios al mock strategy existente. Los tests ya mockean Firebase Storage y Firestore.

### Criterio de aceptacion

- Cobertura >= 80% del codigo modificado
- Tests verifican que el path nuevo incluye userId
- Tests existentes actualizados para reflejar el nuevo path format

## Analytics

Sin eventos nuevos.

---

## Offline

Sin cambios al comportamiento offline. El upload de fotos ya no soporta modo offline.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| `storagePath` en MenuPhoto doc | Firestore persistent cache | Indefinido (cache de Firestore) | IndexedDB |
| Imagen descargada | Browser/SW cache | Indefinido | Browser cache |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Upload menu photo | No soportado offline | N/A |

### Fallback UI

Sin cambios. `MenuPhotoUpload` ya maneja errores de red.

---

## Decisiones tecnicas

### Path format: `menus/{userId}/{businessId}/{fileName}`

**Decision:** Incluir `userId` como primer segmento despues de `menus/`.

**Razon:** Alinea con el patron ya implementado en `feedback-media/{userId}/{feedbackId}/{fileName}`. Permite validar ownership con `request.auth.uid == userId` en Storage rules.

**Alternativa descartada:** Validar ownership via metadata custom en el archivo. Firebase Storage rules no permiten leer metadata de otros archivos ni cruzar con Firestore, por lo que el path es la unica forma de validar ownership.

### Migracion: no migrar archivos existentes

**Decision:** Opcion A del PRD -- las fotos existentes quedan en el path viejo, accesibles via `storagePath` del doc de Firestore.

**Razon:** El `storagePath` guardado en cada documento de Firestore es la fuente de verdad para leer la foto. No importa donde este almacenada fisicamente. Las fotos existentes ya fueron revisadas por el admin. La regla legacy read-only garantiza que nadie pueda subir fotos nuevas al path viejo.

### Legacy rule: read-only

**Decision:** Mantener una regla explicita para el path viejo que permita lectura y bloquee todo lo demas.

**Razon:** Sin esta regla, las fotos existentes en `menus/{businessId}/{fileName}` serian inaccesibles (Firebase Storage deniega por defecto). Con la regla, las fotos existentes siguen cargando normalmente en la UI.
