# Plan: Rate limit docs — campo userId para cleanup en account deletion

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Agregar `userId` a `checkCallableRateLimit` y callers

**Branch:** `fix/240-rate-limit-userid`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/callableRateLimit.ts` | Agregar parametro `userId: string` a la firma. Incluir `userId` en los dos `tx.set()` (creacion inicial y reset de ventana expirada). No tocar `tx.update()`. |
| 2 | `functions/src/callable/inviteListEditor.ts` | Agregar `request.auth.uid` como 4to argumento en la llamada a `checkCallableRateLimit` (linea 25). |
| 3 | `functions/src/callable/removeListEditor.ts` | Agregar `request.auth.uid` como 4to argumento en la llamada a `checkCallableRateLimit` (linea 23). |
| 4 | `functions/src/admin/backups.ts` | En funcion `checkRateLimit` interna: agregar parametro `uid: string`. En `tx.set()` (linea 85), agregar `userId: uid` al objeto. Actualizar la llamada a `checkRateLimit` en `createBackup` para pasar `uid`. |
| 5 | `functions/src/admin/perfMetrics.ts` | En el `tx.set()` inline del rate limit (linea ~52), agregar `userId: uid` al objeto. |

### Fase 2: Actualizar tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/__tests__/utils/callableRateLimit.test.ts` | Actualizar las 4 llamadas a `checkCallableRateLimit` para pasar `userId` como 4to arg (e.g., `'test_user'`). Actualizar asserts de `mockSet`: verificar que el objeto incluye `userId`. Caso "creates new doc": expect `{ count: 1, resetAt: any, userId: 'test_user' }`. Caso "resets counter": expect `{ count: 1, resetAt: any, userId: 'test_user' }`. Caso "increments": verificar que `mockUpdate` recibe `{ count: 4 }` (sin `userId`). |
| 2 | `functions/src/__tests__/callable/inviteListEditor.test.ts` | Actualizar el assert del test "calls checkCallableRateLimit with correct key and limit" (linea 109): agregar `'u1'` como 4to argumento esperado. |
| 3 | `functions/src/__tests__/callable/removeListEditor.test.ts` | Actualizar el assert del test "calls checkCallableRateLimit with correct key and limit" (linea 67): agregar `'u1'` como 4to argumento esperado. |

### Fase 3: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Actualizar la fila de `_rateLimits` en la tabla de colecciones: agregar `userId` a la lista de campos. Cambiar de `count, resetAt` a `count, resetAt, userId`. |
| 2 | `docs/reference/patterns.md` | Actualizar la fila de "Rate limiting (3 capas)" para mencionar que `checkCallableRateLimit` ahora incluye `userId` para cleanup en account deletion. |

---

## Orden de implementacion

1. `functions/src/utils/callableRateLimit.ts` — funcion central, debe cambiar primero
2. `functions/src/callable/inviteListEditor.ts` — caller, actualizar firma
3. `functions/src/callable/removeListEditor.ts` — caller, actualizar firma
4. `functions/src/admin/backups.ts` — rate limit inline, agregar userId
5. `functions/src/admin/perfMetrics.ts` — rate limit inline, agregar userId
6. `functions/src/__tests__/utils/callableRateLimit.test.ts` — tests de la funcion central
7. `functions/src/__tests__/callable/inviteListEditor.test.ts` — tests del caller
8. `functions/src/__tests__/callable/removeListEditor.test.ts` — tests del caller
9. `docs/reference/firestore.md` — documentacion del modelo de datos
10. `docs/reference/patterns.md` — documentacion de patrones

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Excede 400? |
|---------|----------------|------------------------------|-------------|
| `functions/src/utils/callableRateLimit.ts` | 38 | 40 | No |
| `functions/src/callable/inviteListEditor.ts` | 62 | 62 | No |
| `functions/src/callable/removeListEditor.ts` | 40 | 40 | No |
| `functions/src/admin/backups.ts` | ~200 | ~202 | No |
| `functions/src/admin/perfMetrics.ts` | ~70 | ~70 | No |
| `functions/src/__tests__/utils/callableRateLimit.test.ts` | 71 | 73 | No |
| `functions/src/__tests__/callable/inviteListEditor.test.ts` | 119 | 119 | No |
| `functions/src/__tests__/callable/removeListEditor.test.ts` | 78 | 78 | No |

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|-----------|
| Docs existentes sin `userId` no se limpian en account deletion | Baja | Los docs tienen ventana diaria/minuto, se auto-expiran. En menos de 24h post-deploy todos los docs activos tendran `userId`. No requiere migracion. |
| Tests de otros callables que mockean `checkCallableRateLimit` fallan por nueva firma | Baja | Solo `inviteListEditor.test.ts` y `removeListEditor.test.ts` lo mockean, y ambos se actualizan en Fase 2. El mock usa spread args (`...args`) asi que no falla por parametro extra. |
| Backups rate limiter tiene estructura diferente (ventana 1min vs diaria) | Ninguna | Se modifica el inline, no se migra a `checkCallableRateLimit`. Misma semantica, solo se agrega campo. |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (N/A - solo backend)
- [x] Archivos nuevos en carpeta de dominio correcta (no hay archivos nuevos)
- [x] Logica de negocio en hooks/services, no en componentes (N/A - solo backend)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (no hay deuda tecnica conocida en estos archivos)
- [x] Ningun archivo resultante supera 400 lineas

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Actualizar campos de `_rateLimits`: agregar `userId` |
| 2 | `docs/reference/patterns.md` | Actualizar descripcion de rate limiting callable para mencionar `userId` |

---

## Criterios de done

- [x] `checkCallableRateLimit` escribe `userId` en `set()` (creacion y reset)
- [x] `inviteListEditor` y `removeListEditor` pasan `userId` al rate limiter
- [x] `backups.ts` agrega `userId` al rate limit inline
- [x] `perfMetrics.ts` agrega `userId` al rate limit inline
- [x] Tests actualizados y pasando, verificando presencia de `userId`
- [x] No hay regresion en tests existentes
- [x] `deleteAllUserData` puede encontrar y eliminar docs de `_rateLimits` (verificable via test existente del registry + campo `userId` presente)
- [x] No lint errors
- [x] Build succeeds
- [x] Reference docs updated (firestore.md, patterns.md)
