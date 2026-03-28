# PRD: users collection sin hasOnly() permite inyeccion de campos

**Feature:** users-hasonly-field-injection
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #208
**Prioridad:** Critica

---

## Contexto

El proyecto ya aplica `keys().hasOnly()` y `affectedKeys().hasOnly()` en todas las colecciones de Firestore excepto `users`. La coleccion `users` valida `displayName` (tipo, longitud) y `createdAt` en create, pero no restringe que campos puede contener el documento. Esto fue identificado como deuda tecnica pendiente en el backlog (field whitelist audit) y es la unica coleccion que queda sin esta proteccion tras 3 rondas de auditoria de seguridad.

## Problema

- Las reglas de `create` en `users/{userId}` validan `displayName` y `createdAt` pero no usan `keys().hasOnly()`, permitiendo que un usuario autenticado inyecte campos arbitrarios al crear su documento (ej: `isAdmin: true`, `followersCount: 999999`).
- Las reglas de `update` validan `displayName` pero no usan `affectedKeys().hasOnly()`, permitiendo que un usuario modifique campos que deberian ser server-only como `followersCount`, `followingCount`, o inyecte campos nuevos.
- Cloud Functions escriben `followersCount` y `followingCount` en docs de users (triggers de follows), y `onUserCreated` inicializa estos contadores en 0. Sin whitelist, un cliente puede manipular estos contadores directamente.

## Solucion

### S1. Agregar `keys().hasOnly()` a la regla de create

Restringir los campos permitidos en la creacion del documento de usuario a los que el frontend realmente escribe desde `AuthContext.setDisplayName`:

- `displayName` (string, 1-30 chars) -- ya validado
- `displayNameLower` (string) -- usado para busqueda por prefijo
- `avatarId` (string) -- avatar seleccionado por el usuario
- `createdAt` (timestamp) -- ya validado como `request.time`

La regla debe ser:
`request.resource.data.keys().hasOnly(['displayName', 'displayNameLower', 'avatarId', 'createdAt'])`

### S2. Agregar `affectedKeys().hasOnly()` a la regla de update

Restringir los campos que pueden cambiar en un update a los que el frontend realmente modifica:

- `displayName` -- via `AuthContext.setDisplayName`
- `displayNameLower` -- actualizado junto con displayName
- `avatarId` -- via `AuthContext.setAvatarId`

La regla debe ser:
`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'displayNameLower', 'avatarId'])`

Nota: `followersCount` y `followingCount` son escritos exclusivamente por Cloud Functions (que usan Admin SDK y bypasean rules), asi que no necesitan estar en la whitelist de update del cliente.

### S3. Agregar validacion de tipos para campos adicionales

- `displayNameLower` debe ser string
- `avatarId` debe ser string (si presente)
- Mantener las validaciones existentes de `displayName`

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar `keys().hasOnly()` a create en `users/{userId}` | Alta | S |
| Agregar `affectedKeys().hasOnly()` a update en `users/{userId}` | Alta | S |
| Validar tipos de `displayNameLower` y `avatarId` | Alta | S |
| Actualizar `docs/reference/security.md` con las reglas corregidas | Media | S |
| Tests de Firestore rules para users create/update | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Agregar validacion de longitud a `displayNameLower` (es derivado de displayName que ya tiene validacion de longitud)
- Agregar validacion de que `avatarId` sea un ID valido de avatar (la lista de avatares puede cambiar; la validacion se hace client-side en `AuthContext.setAvatarId` con `getAvatarById`)
- Migrar campos server-only (`followersCount`, `followingCount`) a una subcolleccion separada
- Auditar otras colecciones (ya tienen `hasOnly()` segun security.md)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `firestore.rules` | Rules | Create con campos validos pasa; create con campos extra falla; update con campos permitidos pasa; update con campos extra (followersCount, isAdmin) falla |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

Nota: dado que este cambio es exclusivamente en Firestore rules y no agrega codigo TypeScript nuevo, los tests relevantes son tests de reglas de Firestore. Si el proyecto ya tiene un test suite para rules (con `@firebase/rules-unit-testing`), agregar casos ahi. Si no, validar manualmente en emuladores y documentar los escenarios probados.

---

## Seguridad

Este es un fix de seguridad en si mismo. Items relevantes del checklist:

- [x] Firestore rules validan auth (`request.auth != null`) -- ya existente
- [x] Firestore rules validan ownership (`request.auth.uid == userId`) -- ya existente
- [ ] Firestore rules usan `keys().hasOnly()` en create -- **este es el fix**
- [ ] Firestore rules usan `affectedKeys().hasOnly()` en update -- **este es el fix**
- [ ] Validacion de tipos para todos los campos permitidos
- [x] Timestamps del servidor (`createdAt == request.time`) -- ya existente
- [x] Longitud de strings (displayName <= 30) -- ya existente

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Create user doc | write | Firestore persistent cache encola el write | N/A (transparente) |
| Update displayName | write | Firestore persistent cache encola el write | Optimistic UI en AuthContext |
| Update avatarId | write | Firestore persistent cache encola el write | Optimistic UI con rollback en AuthContext |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline? -- Si, via persistent cache
- [x] Writes: tienen queue offline o optimistic UI? -- Si, Firestore SDK encola writes offline
- [x] APIs externas: hay manejo de error de red? -- N/A (solo Firestore)
- [x] UI: hay indicador de estado offline en contextos relevantes? -- OfflineIndicator existente
- [x] Datos criticos: disponibles en cache para primera carga? -- Si

### Esfuerzo offline adicional: S

Este cambio no afecta el comportamiento offline. Las rules se evaluan server-side cuando el write se sincroniza; si un write offline incluye campos no permitidos, fallara al sincronizar (comportamiento correcto).

---

## Modularizacion

Este cambio no involucra codigo TypeScript nuevo. Es exclusivamente un cambio en `firestore.rules` y documentacion.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- N/A
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- N/A
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu -- N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout -- N/A
- [x] Cada prop de accion tiene un handler real especificado -- N/A

---

## Success Criteria

1. Un usuario autenticado NO puede crear un doc en `users/{uid}` con campos fuera de `['displayName', 'displayNameLower', 'avatarId', 'createdAt']`
2. Un usuario autenticado NO puede hacer update de campos fuera de `['displayName', 'displayNameLower', 'avatarId']` en su propio doc
3. El flujo existente de crear/editar displayName y seleccionar avatar sigue funcionando sin cambios
4. Cloud Functions que escriben `followersCount`/`followingCount` siguen funcionando (Admin SDK bypasea rules)
5. `docs/reference/security.md` refleja las reglas actualizadas de la coleccion `users`
