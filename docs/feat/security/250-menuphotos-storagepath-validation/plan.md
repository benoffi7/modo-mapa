# Plan: menuPhotos storagePath sin validar -- proxy de archivos privados

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Validacion en rules y trigger

**Branch:** `fix/250-menuphotos-storagepath-validation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar validacion de `storagePath` en regla `create` de `menuPhotos`: regex `^menus/{auth.uid}/biz_NNN/[a-zA-Z0-9_-]+$`, longitud <= 200, `thumbnailPath == ''` |
| 2 | `functions/src/triggers/menuPhotos.ts` | Agregar constante `STORAGE_PATH_REGEX`. Antes del rate limit: validar formato de `storagePath`, coincidencia de userId y businessId entre path y documento. Si invalido: `snap.ref.update({ status: 'rejected', rejectionReason })` + `logAbuse`. Reemplazar `console.error` con `functions.logger.error` en catch de thumbnail |

### Fase 2: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `functions/src/triggers/__tests__/menuPhotos.test.ts` | Crear test file. Mockear `firebase-admin/storage`, `sharp`, `getDb`, `checkRateLimit`, `logAbuse`, `incrementCounter`, `trackWrite`. Tests: path valido genera thumbnail; path sin prefijo `menus/` es rejected; path traversal rejected; userId mismatch rejected; businessId mismatch rejected; path vacio rejected; rate limit exceeded no procesa |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `docs/reference/security.md` | Agregar entrada en seccion de Firestore rules sobre validacion de `storagePath` en menuPhotos |
| 5 | `docs/reference/firestore.md` | Actualizar descripcion de `menuPhotos` para mencionar validacion de formato de `storagePath` en rules |

---

## Orden de implementacion

1. `firestore.rules` -- regla create de menuPhotos (barrera primaria)
2. `functions/src/triggers/menuPhotos.ts` -- validacion en trigger (defensa en profundidad)
3. `functions/src/triggers/__tests__/menuPhotos.test.ts` -- tests del trigger
4. `docs/reference/security.md` -- documentar mitigacion
5. `docs/reference/firestore.md` -- documentar formato validado

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Excede 400? |
|---------|----------------|------------------------------|-------------|
| `firestore.rules` | 535 | ~542 | SI (ya lo excedia) -- no se agrava, se agregan 7 lineas |
| `functions/src/triggers/menuPhotos.ts` | 64 | ~95 | No |
| `functions/src/triggers/__tests__/menuPhotos.test.ts` | 0 (nuevo) | ~180 | No |

---

## Riesgos

1. **Regex incompatible con paths existentes**: Los paths existentes generados por `uploadMenuPhoto` siguen el formato `menus/{userId}/{businessId}/{docId}_original`. La regex `[a-zA-Z0-9_-]+$` cubre este patron. Mitigacion: verificar que los docIds auto-generados de Firestore solo contengan caracteres alfanumericos (lo hacen).

2. **Rules regex con concatenacion de UID**: Firestore rules soporta concatenacion de strings en `matches()`, pero la sintaxis es sensible. Mitigacion: testear con emulador antes de deploy.

3. **Fotos legacy sin userId en path**: Las fotos antiguas con path `menus/{businessId}/{fileName}` no se ven afectadas porque la validacion es solo en `create` (no en `read` ni `update`). Los reads siguen funcionando sin cambios.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`functions/src/triggers/__tests__/`)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (`console.error` -> `functions.logger.error`)
- [x] Ningun archivo resultante supera 400 lineas (excepto `firestore.rules` que ya las excedia)

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Agregar mitigacion de proxy de archivos privados via `storagePath` en menuPhotos |
| 2 | `docs/reference/firestore.md` | Actualizar reglas de menuPhotos: mencionar validacion de formato de `storagePath` |

---

## Criterios de done

- [x] Regex de validacion en Firestore rules para `storagePath` en menuPhotos create
- [x] Validacion de `storagePath` en trigger `onMenuPhotoCreated` con reject + abuse log
- [x] Verificacion de que `services/menuPhotos.ts` construye el path programaticamente (ya cumple)
- [x] Tests del trigger con >= 80% cobertura del codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Reference docs updated (security.md, firestore.md)
