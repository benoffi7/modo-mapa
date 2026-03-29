# Plan: users collection hasOnly() field injection fix

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Fix de Firestore rules

**Branch:** `fix/users-hasonly-field-injection`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | En la regla `allow create` de `match /users/{userId}` (linea 21-25): agregar `request.resource.data.keys().hasOnly(['displayName', 'displayNameLower', 'avatarId', 'createdAt'])` como primera condicion despues de ownership. Agregar validacion de tipo: `request.resource.data.displayNameLower is string` y `(!('avatarId' in request.resource.data) \|\| request.resource.data.avatarId is string)`. |
| 2 | `firestore.rules` | En la regla `allow update` de `match /users/{userId}` (linea 26-29): agregar `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'displayNameLower', 'avatarId'])` como primera condicion despues de ownership. Agregar validacion de tipo: `(!('displayNameLower' in request.resource.data) \|\| request.resource.data.displayNameLower is string)` y `(!('avatarId' in request.resource.data) \|\| request.resource.data.avatarId is string)`. |

### Fase 2: Actualizacion de documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `docs/reference/security.md` | Agregar o actualizar la seccion de la coleccion `users` para reflejar las nuevas reglas con `keys().hasOnly()` y `affectedKeys().hasOnly()`. Documentar que `followersCount`/`followingCount` son server-only (Admin SDK). |
| 4 | `docs/reference/firestore.md` | Actualizar la fila de `users` en la tabla de colecciones: cambiar "R/W owner; admin read" a "R auth; create owner (`keys().hasOnly`); update owner (`affectedKeys().hasOnly`); admin read". |

### Fase 3: Validacion manual

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | N/A | Ejecutar `npm run dev:full` (emuladores). Crear cuenta nueva, verificar que setDisplayName funciona. |
| 6 | N/A | Editar displayName desde perfil, verificar que update funciona. |
| 7 | N/A | Cambiar avatar desde perfil, verificar que update funciona. |
| 8 | N/A | Desde consola de emulador, intentar create con campo `isAdmin: true` -- debe fallar. |
| 9 | N/A | Desde consola de emulador, intentar update con `followersCount: 999` -- debe fallar. |
| 10 | N/A | Seguir a un usuario, verificar que Cloud Functions actualizan counters correctamente. |

---

## Orden de implementacion

1. `firestore.rules` -- regla de create (paso 1)
2. `firestore.rules` -- regla de update (paso 2)
3. `docs/reference/security.md` -- documentacion de reglas (paso 3)
4. `docs/reference/firestore.md` -- tabla de colecciones (paso 4)
5. Validacion manual en emuladores (pasos 5-10)
6. Commit y lint

Los pasos 1-2 son el core del fix y deben ir juntos en un commit. Los pasos 3-4 pueden ir en el mismo commit o en uno separado de docs.

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Excede 400? |
|---------|----------------|------------------------------|-------------|
| `firestore.rules` | 508 | ~518 | SI (ya estaba sobre 400 antes de este cambio; no se agrega complejidad significativa, solo ~10 lineas) |

Nota: `firestore.rules` ya excede 400 lineas antes de este cambio. Dado que es un archivo de configuracion declarativo (no codigo imperativo) y cada `match` block es independiente, la descomposicion no aplica en el sentido tradicional. Si el archivo sigue creciendo, considerar documentar las reglas por coleccion en comentarios de seccion.

## Riesgos

1. **Writes offline pendientes con campos invalidos**: Si un usuario tiene un write encolado offline que incluye campos fuera de la whitelist (ej: por un bug previo en el cliente), ese write fallara al sincronizar despues del deploy. **Mitigacion**: El cliente actual solo escribe los campos de la whitelist (verificado en `AuthContext.tsx` lineas 128-134 y 146), asi que no deberia haber writes pendientes con campos invalidos.

2. **Cloud Functions fallback con `set(..., { merge: true })`**: En `functions/src/triggers/follows.ts` lineas 63-65, si el `update` falla, el trigger hace `set({ followingCount: increment(1) }, { merge: true })`. Esto usa Admin SDK asi que bypasea rules. **Mitigacion**: Verificado que Admin SDK siempre bypasea rules. No hay riesgo.

3. **Campo `displayNameLower` ausente en create**: El `setDoc` actual en AuthContext incluye `displayNameLower` en el create (linea 132). Si algun otro flujo futuro crea un user doc sin `displayNameLower`, la regla lo permitiria (es parte de la whitelist) pero el trigger `onUserCreated` lo agrega de todas formas. **Mitigacion**: Bajo riesgo, el trigger es una safety net.

## Criterios de done

- [x] `keys().hasOnly()` en regla de create de `users/{userId}`
- [x] `affectedKeys().hasOnly()` en regla de update de `users/{userId}`
- [x] Validacion de tipos para `displayNameLower` y `avatarId`
- [x] Flujo de crear cuenta funciona en emuladores
- [x] Flujo de editar displayName funciona en emuladores
- [x] Flujo de cambiar avatar funciona en emuladores
- [x] Create con campos extra es rechazado
- [x] Update con campos extra es rechazado
- [x] Cloud Functions siguen actualizando counters
- [x] `docs/reference/security.md` actualizado
- [x] `docs/reference/firestore.md` actualizado
- [x] No lint errors
- [x] Build succeeds
