# Plan: Storage de menu photos sin scope de owner

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Storage rules + legacy path

**Branch:** `fix/storage-menu-photos-owner-scope`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `storage.rules` | Reemplazar la regla `match /menus/{businessId}/{fileName}` con dos reglas: (a) nueva `match /menus/{userId}/{businessId}/{fileName}` con ownership validation y (b) legacy `match /menus/{businessId}/{fileName}` como read-only |

Regla nueva:

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

Regla legacy:

```
// Legacy path -- read-only for existing photos
match /menus/{businessId}/{fileName} {
  allow read: if request.auth != null;
  allow create: if false;
  allow delete: if false;
}
```

### Fase 2: Actualizar paths en servicio frontend

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2 | `src/services/menuPhotos.ts` | Linea 51: cambiar `storagePath` de `` `menus/${businessId}/${docRef.id}_original` `` a `` `menus/${userId}/${businessId}/${docRef.id}_original` `` |

### Fase 3: Actualizar path de thumbnail en Cloud Function

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `functions/src/triggers/menuPhotos.ts` | Linea 27: cambiar `thumbPath` de `` `menus/${data.businessId}/${photoId}_thumb.jpg` `` a `` `menus/${data.userId}/${data.businessId}/${photoId}_thumb.jpg` `` |

### Fase 4: Actualizar tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4a | `src/services/menuPhotos.test.ts` | En test "uploads photo and creates Firestore doc on success": agregar assertion que verifica `storagePath: 'menus/user1/biz1/photo-doc-1_original'` en el `setDoc` call |
| 4b | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Test "generates thumbnail and updates doc": cambiar mock data a `storagePath: 'menus/user1/biz1/photo123.jpg'`, agregar `userId: 'user1'` al mock data, actualizar expected `thumbnailPath` a `'menus/user1/biz1/photo123_thumb.jpg'` |
| 4c | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Test "increments counters": agregar `userId: 'user1'` al mock data |
| 4d | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Test "still increments counters when thumbnail generation fails": agregar `userId: 'user1'` al mock data |
| 4e | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Test "constructs correct thumbnail path": cambiar mock data a incluir `userId: 'userX'`, actualizar expected `thumbnailPath` a `'menus/userX/bizABC/myPhotoId_thumb.jpg'` |

### Fase 5: Actualizar documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5a | `docs/reference/security.md` | Seccion "Storage rules": actualizar el bloque de `menus/` para mostrar el nuevo path con `{userId}` y la regla legacy. Agregar nota sobre compatibilidad con fotos existentes. |
| 5b | `docs/reference/firestore.md` | Seccion "Cloud Storage -- Fotos de menu": actualizar la estructura de paths para incluir `{userId}`. |

---

## Orden de implementacion

1. `storage.rules` -- las reglas se despliegan con el deploy y no rompen nada existente (legacy rule mantiene lectura)
2. `src/services/menuPhotos.ts` -- el frontend empieza a subir al nuevo path
3. `functions/src/triggers/menuPhotos.ts` -- la Cloud Function genera thumbnails en el nuevo path
4. Tests (4a-4e) -- verifican los cambios
5. Documentacion (5a-5b) -- reflejan el nuevo esquema

Los pasos 2 y 3 deben desplegarse juntos. Si el frontend sube al nuevo path pero la Cloud Function genera el thumbnail en el path viejo, el thumbnail quedaria desalineado.

---

## Estimacion de archivos

| Archivo | Lineas actuales | Cambio estimado | Lineas resultantes | Accion |
|---------|----------------|----------------|-------------------|--------|
| `storage.rules` | 24 | +10 (nueva rule + legacy) | ~34 | OK |
| `src/services/menuPhotos.ts` | 126 | +0 (cambio inline) | ~126 | OK |
| `functions/src/triggers/menuPhotos.ts` | 43 | +0 (cambio inline) | ~43 | OK |
| `src/services/menuPhotos.test.ts` | 244 | +5 (assertion extra) | ~249 | OK |
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | 151 | +5 (userId en mocks) | ~156 | OK |

---

## Riesgos

1. **Fotos existentes inaccesibles si se borra la legacy rule:** Mitigacion: la legacy rule es explicita y tiene un comentario claro indicando su proposito. El PR review debe verificar que se mantenga.

2. **Deploy parcial (frontend sin Cloud Function):** Si se despliega el frontend antes que la Cloud Function, las fotos nuevas se suben al nuevo path pero la Cloud Function genera thumbnails en el path viejo. Mitigacion: desplegar frontend y functions juntos (el deploy CI ya hace ambos).

3. **Tests de admin menuPhotos hardcodean paths viejos:** Los tests en `functions/src/__tests__/admin/menuPhotos.test.ts` usan `storagePath: 'menus/biz1/photo.jpg'` en mock data. Estos NO necesitan cambio porque la funcion admin lee el `storagePath` del documento -- el test verifica que la funcion use el path del doc, no que construya el path. Sin embargo, vale la pena verificar que los assertions de `mockFile` calls sigan pasando.

---

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] Storage rules validan `request.auth.uid == userId` en nuevo path
- [ ] Legacy path es read-only (create/delete: false)
- [ ] `storagePath` en `menuPhotos.ts` incluye `userId`
- [ ] `thumbPath` en trigger incluye `userId`
- [ ] Admin functions verificadas (usan `storagePath` del doc, sin cambios)
- [ ] Tests pass con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] `docs/reference/security.md` actualizado
- [ ] `docs/reference/firestore.md` actualizado
