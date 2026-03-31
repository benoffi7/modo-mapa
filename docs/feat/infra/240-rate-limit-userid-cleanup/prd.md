# PRD: Rate limit docs faltan campo userId para cleanup en account deletion

**Feature:** 240-rate-limit-userid-cleanup
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #240
**Prioridad:** Alta

---

## Contexto

El sistema de rate limiting para Cloud Functions callables (`checkCallableRateLimit`) escribe docs en `_rateLimits` con solo `{ count, resetAt }`. El cleanup de eliminacion de cuenta (`deleteAllUserData`) busca docs con `where('userId', '==', uid)` en esa coleccion, pero al no existir el campo `userId`, esos docs nunca se limpian. Esto fue detectado durante la auditoria de v2.32.0 y esta documentado en el backlog de producto como deuda tecnica pendiente.

## Problema

- Los docs de rate limit de callables (`editors_invite_{uid}`, `editors_remove_{uid}`, `backup_{uid}`, `delete_{uid}`, `clean_{uid}`, `perf_{uid}`) se crean sin campo `userId`, por lo que `deleteAllUserData` no puede encontrarlos via query `where('userId', '==', uid)`.
- Post-eliminacion de cuenta, quedan docs huerfanos en `_rateLimits` con el UID del usuario en el doc ID (`editors_invite_{uid}`), lo que representa un concern de privacidad/GDPR: el UID sigue siendo trazable.
- El registro `USER_OWNED_COLLECTIONS` ya incluye `_rateLimits` con `type: 'query', field: 'userId'`, pero el contrato no se cumple porque los docs no tienen ese campo.

## Solucion

### S1. Agregar campo `userId` a `checkCallableRateLimit`

Modificar `checkCallableRateLimit` en `functions/src/utils/callableRateLimit.ts` para que reciba el `userId` como parametro y lo incluya en el `set()` tanto en la creacion inicial como en el reset de ventana.

Referencia de patron existente: el rate limiter de triggers (`checkRateLimit` en `functions/src/utils/rateLimiter.ts`) ya incluye el `userId` en los docs que escribe. Se alinea con ese patron.

### S2. Actualizar callers para pasar `userId`

Todos los callables que usan `checkCallableRateLimit` deben pasar el `userId` extraido de `context.auth.uid`. Los callables afectados son:

- `inviteListEditor` (clave: `editors_invite_{uid}`)
- `removeListEditor` (clave: `editors_remove_{uid}`)
- `deleteUserAccount` (clave: `delete_{uid}`)
- `cleanAnonymousData` (clave: `clean_{uid}`)
- `writePerfMetrics` (clave: `perf_{uid}`)
- `createBackup` (clave: `backup_{uid}`)

### S3. Verificar cleanup en `deleteAllUserData`

Confirmar que `deleteAllUserData` ya maneja correctamente la limpieza via la entrada existente en `USER_OWNED_COLLECTIONS` (`{ collection: '_rateLimits', type: 'query', field: 'userId' }`). No deberia requerir cambios en `deleteUserData.ts` ni en `userOwnedCollections.ts`, ya que el registro ya esta configurado correctamente -- el problema era solo que los docs no tenian el campo.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar parametro `userId` a `checkCallableRateLimit` e incluirlo en `set()` | Must | S |
| Actualizar 6 callables para pasar `userId` | Must | S |
| Actualizar tests de `checkCallableRateLimit` (verificar que `userId` se incluye en set) | Must | S |
| Actualizar tests de callables afectados (nuevo parametro) | Must | S |
| Verificar que `deleteAllUserData` limpia docs con `userId` (test manual o unitario) | Should | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Migracion retroactiva de docs existentes en `_rateLimits` que no tienen `userId` (son efimeros con ventana diaria, se limpian solos al expirar o se pueden borrar con un script one-off)
- Cambios a `deleteUserData.ts` o `userOwnedCollections.ts` (ya estan correctamente configurados)
- Cambios al rate limiter de triggers (`rateLimiter.ts`) que ya incluye `userId`
- Ofuscacion o hashing de UIDs en doc IDs de `_rateLimits`

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/__tests__/utils/callableRateLimit.test.ts` | Unit | Verificar que `set()` incluye `userId` en creacion y reset. Verificar que `update()` no sobreescribe `userId`. |
| `functions/src/__tests__/callable/inviteListEditor.test.ts` | Unit | Verificar que se pasa `userId` a `checkCallableRateLimit` |
| `functions/src/__tests__/callable/removeListEditor.test.ts` | Unit | Verificar que se pasa `userId` a `checkCallableRateLimit` |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (campo `userId` presente en todos los docs escritos a `_rateLimits`)

---

## Seguridad

- [x] `_rateLimits` ya tiene Firestore rules que solo permiten read/write desde Cloud Functions (no accesible desde clientes)
- [ ] Verificar que el campo `userId` se escribe con el valor correcto de `context.auth.uid` (no un valor enviado por el cliente)
- [ ] Confirmar que post-fix, `deleteAllUserData` efectivamente elimina todos los docs de `_rateLimits` del usuario

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `_rateLimits` docs con UID en doc ID | Trazabilidad de usuario post-eliminacion | El fix agrega `userId` field para que el cleanup los encuentre y elimine. Doc IDs con UID se eliminan junto con los docs. |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Backlog: "Rate limit docs falta campo userId" | Es este issue | Fix directo |
| #192 Eliminacion de cuenta | Afecta | Este fix completa el cleanup de la coleccion `_rateLimits` que #192 no cubria correctamente |

### Mitigacion incorporada

- Se cierra la brecha de cleanup en `_rateLimits` para eliminacion de cuenta, completando el contrato del registry `USER_OWNED_COLLECTIONS`
- Se elimina el concern de trazabilidad GDPR post-borrado: los docs con UID en el ID se eliminan correctamente

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `checkCallableRateLimit` write | write (server-side) | N/A - ejecuta en Cloud Functions | N/A |
| `deleteAllUserData` cleanup | write (server-side) | N/A - ejecuta en Cloud Functions | N/A |

### Checklist offline

- [x] Reads de Firestore: N/A (server-side only)
- [x] Writes: N/A (server-side only)
- [x] APIs externas: N/A
- [x] UI: N/A (no hay cambios de UI)
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature modifica exclusivamente archivos en `functions/src/` (Cloud Functions). No hay cambios en el frontend.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (N/A - solo backend)
- [x] Componentes nuevos son reutilizables (N/A - no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (no hay archivos nuevos)
- [x] Si el feature necesita estado global: N/A
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo cambios backend, no afecta frontend |
| Estado global | = | Sin cambios |
| Firebase coupling | = | Sin cambios en frontend |
| Organizacion por dominio | = | Archivos ya estan en su carpeta correcta |

---

## Success Criteria

1. `checkCallableRateLimit` escribe `userId` en todos los docs de `_rateLimits` (creacion y reset)
2. Los 6 callables que usan `checkCallableRateLimit` pasan el `userId` correcto
3. `deleteAllUserData` elimina exitosamente los docs de `_rateLimits` de un usuario (verificable con test)
4. Tests existentes de `callableRateLimit.test.ts` actualizados y pasando, verificando la presencia de `userId`
5. No hay regresion en los tests de `inviteListEditor` y `removeListEditor`
