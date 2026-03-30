# Plan: userSettings rules fix + listItems delete + color/icon validation

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Firestore rules -- userSettings + sharedLists

**Branch:** `fix/251-usersettings-rules`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | En regla `write` de `userSettings` (linea 312): agregar `'followedTags'`, `'followedTagsUpdatedAt'`, `'followedTagsLastSeenAt'` a `keys().hasOnly()` |
| 2 | `firestore.rules` | En misma regla: agregar validacion `followedTags is list && size() <= 20` (condicional con `!('followedTags' in ...)`) |
| 3 | `firestore.rules` | En misma regla: agregar validacion `followedTagsUpdatedAt is timestamp` (condicional) |
| 4 | `firestore.rules` | En misma regla: agregar validacion `followedTagsLastSeenAt is timestamp` (condicional) |
| 5 | `firestore.rules` | En misma regla: agregar validacion `notifyFollowers is bool` (condicional) |
| 6 | `firestore.rules` | En misma regla: agregar validacion `notifyRecommendations is bool` (condicional) |
| 7 | `firestore.rules` | En misma regla: agregar validacion `notificationDigest is string && size() <= 10` (condicional) |
| 8 | `firestore.rules` | En regla `create` de `sharedLists` (linea 349): agregar validacion `color is string && size() <= 20` (condicional) |
| 9 | `firestore.rules` | En regla `create` de `sharedLists`: agregar validacion `icon is string && size() <= 50` (condicional) |
| 10 | `firestore.rules` | En regla `update` de `sharedLists` (rama owner, linea 366): agregar mismas validaciones de `color` e `icon` |

### Fase 2: Cloud Function -- listItems rate limit enforcement

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/listItems.ts` | Dentro del bloque `if (exceeded)`: agregar `await snap.ref.delete()` antes de `logAbuse` |
| 2 | `functions/src/triggers/listItems.ts` | Actualizar detail del log a `'Exceeded 100 listItems/day — document deleted'` |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/triggers/listItems.test.ts` | Agregar mock de `snap.ref.delete` en la estructura de mocks existente (agregar `mockDelete` a `vi.hoisted`) |
| 2 | `functions/src/__tests__/triggers/listItems.test.ts` | Modificar test "logs abuse when rate limit exceeded": verificar que `mockDelete` fue llamado |
| 3 | `functions/src/__tests__/triggers/listItems.test.ts` | Verificar que el detail dice "document deleted" |
| 4 | `functions/src/__tests__/triggers/listItems.test.ts` | Agregar test: "does not delete document when rate limit not exceeded" -- verificar que `mockDelete` NO fue llamado |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Agregar que userSettings ahora valida tipos de notifyFollowers/notifyRecommendations/notificationDigest y whitelist completa de followedTags fields |
| 2 | `docs/reference/firestore.md` | Actualizar tabla de `userSettings` para incluir `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt` en campos; actualizar descripcion de rules de `sharedLists` para mencionar validacion de tipo en color/icon |
| 3 | `docs/reference/tests.md` | Actualizar inventario de `listItems.test.ts` en la tabla de triggers |

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas | Excede 400? |
|---------|----------------|-----------------|-------------|
| `firestore.rules` | 535 | ~550 | SI (ya excede, es un archivo de configuracion, no aplica descomposicion) |
| `functions/src/triggers/listItems.ts` | 40 | ~45 | NO |
| `functions/src/__tests__/triggers/listItems.test.ts` | 114 | ~140 | NO |

---

## Orden de implementacion

1. `firestore.rules` -- cambios en R1 (followedTags whitelist + tipo), R2 (notificaciones tipo), R3 (sharedLists color/icon) -- todos independientes, se aplican en un solo paso
2. `functions/src/triggers/listItems.ts` -- rate limit enforcement (independiente de rules)
3. `functions/src/__tests__/triggers/listItems.test.ts` -- tests del cambio en trigger
4. Documentacion de referencia

---

## Riesgos

1. **followedTags timestamp validation**: `useFollowedTags.ts` envia `followedTagsUpdatedAt: new Date()` (no `serverTimestamp()`). En Firestore rules, `is timestamp` valida tanto `Timestamp` de Firestore como `Date` de JavaScript convertida por el SDK. El `setDoc` con `merge: true` serializa `new Date()` como Timestamp. **Mitigacion**: verificar en emuladores que el write con `new Date()` pasa la validacion `is timestamp`.

2. **Backwards compatibility de userSettings existentes**: documentos existentes que ya tienen `followedTags` con datos validos no se ven afectados (la regla valida el documento completo en cada write via `keys().hasOnly()`). **Mitigacion**: la validacion es condicional (`!('field' in data) || ...`), asi que solo valida si el campo esta presente.

3. **listItems delete race condition**: entre el count query y el delete, otro trigger podria ejecutarse. El peor caso es que se elimina un documento que ya fue eliminado (operacion idempotente) o que un documento extra pasa el rate limit. **Mitigacion**: aceptable para un rate limit anti-spam; no es un control de acceso critico.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (rules en raiz, trigger en functions/src/triggers/)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] No se toca ningun archivo con deuda tecnica conocida
- [x] Ningun archivo resultante supera 400 lineas (excepto `firestore.rules` que ya excede y es configuracion)

---

## Criterios de done

- [ ] followedTags, followedTagsUpdatedAt, followedTagsLastSeenAt en whitelist de userSettings rules
- [ ] Validacion de tipo para notifyFollowers (bool), notifyRecommendations (bool), notificationDigest (string + longitud)
- [ ] Validacion de tipo y longitud para color e icon en sharedLists (create y update)
- [ ] listItems rate limit elimina documento excedido (no solo log)
- [ ] Tests actualizados para trigger de listItems
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Reference docs updated (security.md, firestore.md, tests.md)
