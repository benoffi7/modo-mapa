# PRD: Security — Storage Rules, App Check, User Enumeration

**Feature:** storage-rules-hardening
**Categoria:** security
**Fecha:** 2026-03-24
**Issue:** #176
**Prioridad:** Alta

---

## Contexto

Una auditoria de seguridad completa del proyecto (2026-03-24) identifico vulnerabilidades en Storage rules, Firestore rules de privacidad, App Check enforcement, y user enumeration. Los hallazgos van desde criticos (cualquier usuario puede borrar media de otros) hasta medios (race conditions, regex limitante).

## Problema

- Storage rules permiten que cualquier usuario autenticado borre feedback media de otros y sobreescriba fotos de menu de otros
- App Check esta globalmente deshabilitado en Cloud Functions, permitiendo llamadas directas desde cualquier HTTP client
- `inviteListEditor` expone si un email existe en Firebase Auth (user enumeration)
- `userSettings` es legible por cualquier usuario autenticado, exponiendo ubicacion incluso con perfil privado
- `listItems` son legibles globalmente sin validar privacidad de la lista padre
- `businessId` regex limita a 999 comercios maximo

## Solucion

### S1: Storage Rules — Ownership enforcement

Reestructurar paths de Storage para incluir userId y validar ownership en rules:

- **Menu photos**: cambiar path de `menus/{businessId}/{fileName}` a `menus/{businessId}/{userId}/{fileName}`. Validar `request.auth.uid == userId` en create. Delete solo via admin SDK (Cloud Functions)
- **Feedback media**: cambiar path de `feedback-media/{feedbackId}/{fileName}` a `feedback-media/{userId}/{feedbackId}/{fileName}`. Validar ownership en create y delete
- Actualizar servicios frontend (`menuPhotos.ts`, `feedback.ts`) y Cloud Functions que referencian estos paths
- Migrar archivos existentes en Storage (script one-time o lazy migration)

### S2: App Check — Enforcement condicional

- Cambiar `ENFORCE_APP_CHECK` de `false` hardcoded a `!IS_EMULATOR` en `functions/src/helpers/env.ts`
- Verificar que el frontend ya inicializa App Check con reCAPTCHA Enterprise en produccion (segun `security.md`, ya esta configurado)
- Si staging comparte el mismo proyecto Firebase, agregar env var `STAGING` para skip condicional, o configurar reCAPTCHA para staging tambien
- Como minimo, enforcer App Check en callables admin (`backups`, `claims`, `menuPhotos` admin functions)

### S3: User enumeration fix

- En `inviteListEditor` callable (`functions/src/callable/inviteListEditor.ts`), cambiar el error de `'Usuario no encontrado con ese email'` a un mensaje generico como `'No se pudo enviar la invitacion'` independientemente de si el email existe o no
- Revisar otros callables para patrones similares de info leakage

### S4: Firestore Rules — Privacy hardening

- **userSettings** (`firestore.rules:284`): cambiar `allow read: if request.auth != null` a `allow read: if request.auth.uid == userId || resource.data.profilePublic == true || isAdmin()`
- **listItems** (`firestore.rules:365`): agregar validacion de privacidad de la lista padre via `get()` call, o denormalizar `isPublic`/`ownerId` en listItems para check en rules
- **Feedback mediaUrl** (`firestore.rules:173-174`): validar que `mediaUrl` matchee patron `^gs://` o el prefijo esperado de Storage

### S5: Fixes menores

- **reportMenuPhoto race condition** (`functions/src/admin/menuPhotos.ts:170-177`): wrappear check+write en transaction
- **businessId regex** (`firestore.rules:12-14`): cambiar `^biz_[0-9]{3}$` a `^biz_[0-9]{1,6}$`
- **Admin email hardcoded** (`AdminGuard.tsx:10`): mover a `VITE_ADMIN_EMAIL` env var (ya existe en `.env.example`)
- **functions/.env warning**: agregar comentario en el archivo advirtiendo que esta committed

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Storage rules ownership (paths + rules + servicios) | P0 | M |
| S2: App Check enforcement | P0 | S |
| S3: User enumeration fix | P1 | S |
| S4: Firestore rules privacy (userSettings + listItems) | P1 | M |
| S5a: reportMenuPhoto transaction | P2 | S |
| S5b: businessId regex | P2 | S |
| S5c: Admin email a env var | P2 | S |
| S5d: functions/.env warning | P2 | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Separar proyectos Firebase para staging y produccion (cambio de infraestructura mayor)
- Implementar Cloud Function proxy para todas las lecturas de userSettings (over-engineering)
- Migrar Storage a signed URLs (no necesario con las rules corregidas)
- Audit de dependencias npm (cubierto por `npm audit`, actualmente 0 vulnerabilities)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `storage.rules` | Rules test | Ownership validation en create/delete para ambos paths |
| `firestore.rules` | Rules test | userSettings read por owner vs otros, listItems read con lista privada |
| `functions/src/callable/inviteListEditor.ts` | Unit | Error generico cuando email no existe |
| `functions/src/admin/menuPhotos.ts` | Unit | Transaction en reportMenuPhoto, no duplicate reports |
| `src/services/menuPhotos.ts` | Unit | Nuevo path con userId en upload |
| `src/services/feedback.ts` | Unit | Nuevo path con userId en upload |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para ownership en Storage rules
- Tests de privacy en Firestore rules (read por non-owner, perfil privado vs publico)
- Tests de error handling generico en inviteListEditor

---

## Seguridad

- [x] Storage rules: ownership validation en create y delete
- [x] App Check: enforcement en produccion
- [x] Firestore rules: privacy de userSettings y listItems
- [x] User enumeration: mensajes de error genericos
- [x] Input validation: mediaUrl pattern matching
- [x] Race condition: transaction en reportMenuPhoto
- [x] Scalability: businessId regex ampliado

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| Menu photo upload | write | N/A (requiere red) | Deshabilitar boton offline (ya existente) |
| Feedback media upload | write | N/A (requiere red) | Deshabilitar submit con media offline |
| List editor invite | write | N/A (requiere red) | Deshabilitar invite offline |

### Checklist offline

- [x] Reads de Firestore: sin cambio, usan persistencia offline existente
- [x] Writes: sin cambio en queue offline (uploads inherentemente requieren red)
- [x] APIs externas: N/A
- [x] UI: sin cambio necesario
- [x] Datos criticos: sin cambio

### Esfuerzo offline adicional: S (ninguno, solo verificar que botones se deshabilitan offline)

---

## Modularizacion

### Checklist modularizacion

- [x] Logica de negocio en hooks/services: cambios son en services (paths) y rules (validacion)
- [x] Componentes nuevos son reutilizables: no se crean componentes nuevos
- [x] No se agregan useState a AppShell o SideMenu
- [x] Props explicitas: sin cambio en interfaces de componentes

---

## Success Criteria

1. Ningun usuario puede borrar o sobreescribir media de otro usuario en Storage
2. App Check esta enforced en produccion para al menos callables admin
3. `inviteListEditor` no expone existencia de emails
4. `userSettings` solo es legible por el owner o si el perfil es publico
5. `listItems` no son legibles si la lista padre es privada y el lector no es owner/editor
6. `businessId` soporta hasta 999999 comercios
7. Todos los tests de rules pasan con los nuevos constraints
