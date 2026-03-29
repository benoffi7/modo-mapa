# PRD: Storage de menu photos sin scope de owner

**Feature:** storage-menu-photos-owner-scope
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #214
**Prioridad:** Alta

---

## Contexto

La storage rule para `menus/{businessId}/{fileName}` permite que cualquier usuario autenticado suba archivos a paths de cualquier negocio. Esta vulnerabilidad fue identificada originalmente en la auditoria #176 (storage-rules-hardening) donde se corrigio para feedback-media pero quedo pendiente para menu photos. El path actual no incluye `userId`, por lo que no hay forma de validar ownership en las reglas de Storage.

## Problema

- Cualquier usuario autenticado puede subir imagenes a `menus/{businessId}/{fileName}` para cualquier `businessId`, sin restriccion de ownership en las Storage rules
- Un atacante podria subir imagenes arbitrarias (potencialmente ofensivas) a paths de negocios ajenos sin que exista un doc correspondiente en Firestore
- El abuso de Storage genera costos de billing innecesarios, ya que no hay limite por usuario en las rules (el limite de 3 fotos pendientes solo se valida client-side en `menuPhotos.ts`)

## Solucion

### S1: Cambiar path de Storage para incluir userId

Cambiar el path de `menus/{businessId}/{fileName}` a `menus/{userId}/{businessId}/{fileName}`. Esto permite validar `request.auth.uid == userId` en las rules de create, alineandose con el patron ya implementado en `feedback-media/{userId}/{feedbackId}/{fileName}`.

**Archivos afectados:**

- `storage.rules` -- agregar `userId` al path y validar ownership
- `src/services/menuPhotos.ts` -- actualizar `storagePath` en `uploadMenuPhoto`
- `functions/src/triggers/menuPhotos.ts` -- actualizar `thumbPath` para usar nuevo path

### S2: Actualizar Storage rules

```
match /menus/{userId}/{businessId}/{fileName} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 5 * 1024 * 1024
    && request.resource.contentType.matches('image/(jpeg|png|webp)');
  allow delete: if false;
}
```

### S3: Actualizar referencias al path en codigo

- **Frontend** (`src/services/menuPhotos.ts`): cambiar `storagePath` de `` `menus/${businessId}/${docRef.id}_original` `` a `` `menus/${userId}/${businessId}/${docRef.id}_original` ``
- **Cloud Function** (`functions/src/triggers/menuPhotos.ts`): cambiar `thumbPath` de `` `menus/${data.businessId}/${photoId}_thumb.jpg` `` a `` `menus/${data.userId}/${data.businessId}/${photoId}_thumb.jpg` ``
- **Admin functions**: verificar que cualquier referencia a paths de menu photos en admin callables (approve/reject/cleanup) use el `storagePath` guardado en el doc de Firestore (no reconstruya el path manualmente)

### S4: Migracion de archivos existentes

Las fotos existentes en el path viejo (`menus/{businessId}/...`) seguiran siendo legibles porque la rule de read no tiene scope de `userId`. Sin embargo, conviene planear una migracion lazy o script:

- **Opcion A (recomendada)**: no migrar. Las fotos existentes quedan accesibles via el `storagePath` guardado en su doc de Firestore. Las nuevas fotos usan el path nuevo.
- **Opcion B**: script one-time que lee todos los docs de `menuPhotos`, copia archivos al nuevo path, actualiza `storagePath` y `thumbnailPath` en el doc, y borra los originales.

La opcion A es suficiente porque el `storagePath` en cada doc de Firestore es la fuente de verdad para leer la foto, y las fotos existentes ya fueron validadas por el admin.

**Nota de seguridad**: mantener las rules del path viejo como read-only para que las fotos existentes sigan accesibles:

```
// Legacy path — read-only for existing photos
match /menus/{businessId}/{fileName} {
  allow read: if request.auth != null;
  allow create: if false;
  allow delete: if false;
}
```

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Actualizar `storage.rules` con nuevo path + ownership | P0 | S |
| Actualizar `storagePath` en `src/services/menuPhotos.ts` | P0 | S |
| Actualizar `thumbPath` en `functions/src/triggers/menuPhotos.ts` | P0 | S |
| Agregar rule legacy read-only para path viejo | P0 | S |
| Verificar admin functions usan `storagePath` del doc | P1 | S |
| Actualizar `docs/reference/security.md` con nuevo path | P1 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Migracion de archivos existentes al nuevo path (las fotos existentes siguen accesibles via `storagePath` en Firestore)
- Rate limiting en Storage rules (Firebase Storage rules no soportan rate limiting nativo; el limite de 3 fotos pendientes se mantiene client-side + podria agregarse server-side en un futuro)
- Validacion de contenido de imagen (moderacion de imagenes ofensivas es un feature separado)
- Cambios al flujo de UI de upload de menu photos

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/menuPhotos.ts` | Service | Que `storagePath` incluya `userId` en el path generado |
| `functions/src/triggers/menuPhotos.ts` | Trigger | Que `thumbPath` incluya `userId` del doc data |
| `storage.rules` | Rules | Ownership validation (no hay framework de test para storage rules en el proyecto, verificar manualmente o con emuladores) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [x] Storage rule actual no valida ownership -- este PRD lo corrige
- [ ] Validar que `request.auth.uid == userId` en create rule del nuevo path
- [ ] Confirmar que delete sigue siendo `false` (solo admin SDK)
- [ ] Verificar que la rule legacy bloquea nuevos creates al path viejo
- [ ] Confirmar que admin functions leen `storagePath` del doc (no reconstruyen el path)
- [ ] Actualizar `docs/reference/security.md` seccion Storage rules

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Upload menu photo | write | No soportado offline (requiere Storage upload) | El componente `MenuPhotoUpload` ya maneja errores de red |
| Read approved photo | read | URL de Storage cacheada por browser/SW | Imagen placeholder si falla la carga |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (el doc de `menuPhotos` se cachea)
- [ ] Writes: el upload a Storage no tiene queue offline (y no es necesario para este fix)
- [x] APIs externas: hay manejo de error de red en `MenuPhotoUpload`
- [x] UI: hay indicador de estado offline en contextos relevantes
- [x] Datos criticos: la URL de la foto aprobada se cachea en el business data cache

### Esfuerzo offline adicional: S (ninguno, no cambia comportamiento offline)

---

## Modularizacion

Este cambio no introduce componentes ni hooks nuevos. Solo modifica strings de path en archivos existentes.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout (N/A)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado

---

## Success Criteria

1. Las Storage rules validan `request.auth.uid == userId` en el path de menu photos
2. Un usuario no puede subir archivos a paths de otros usuarios (verificable en emuladores)
3. Las fotos existentes siguen siendo accesibles via su `storagePath` guardado en Firestore
4. El thumbnail se genera correctamente en el nuevo path
5. `docs/reference/security.md` refleja el nuevo esquema de Storage paths
