# Specs: Rate limit docs — campo userId para cleanup en account deletion

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

### Coleccion `_rateLimits` (existente)

Estructura actual de docs escritos por `checkCallableRateLimit`:

```typescript
// Doc ID: editors_invite_{uid}, editors_remove_{uid}
{ count: number; resetAt: number }
```

Estructura objetivo (post-fix):

```typescript
// Doc ID: editors_invite_{uid}, editors_remove_{uid}
{ count: number; resetAt: number; userId: string }
```

Estructura actual de docs escritos inline por `backups.ts` y `perfMetrics.ts`:

```typescript
// backups.ts — Doc ID: backup_{uid}
{ count: number; resetAt: number }  // <-- falta userId

// perfMetrics.ts — Doc ID: perf_{uid}
{ count: number; resetAt: number }  // <-- falta userId
```

Estructura actual de docs escritos inline por `deleteUserAccount.ts` y `cleanAnonymousData.ts`:

```typescript
// Doc ID: delete_{uid}, clean_{uid}
{ lastAttempt: Timestamp; userId: string }  // <-- YA tiene userId
```

### Cambios requeridos

| Callable | Doc ID pattern | Tiene `userId`? | Accion |
|----------|---------------|----------------|--------|
| `inviteListEditor` | `editors_invite_{uid}` | NO | Pasar `userId` a `checkCallableRateLimit` |
| `removeListEditor` | `editors_remove_{uid}` | NO | Pasar `userId` a `checkCallableRateLimit` |
| `createBackup` | `backup_{uid}` | NO | Agregar `userId` al `set()` inline |
| `writePerfMetrics` | `perf_{uid}` | NO | Agregar `userId` al `set()` y `update()` inline |
| `deleteUserAccount` | `delete_{uid}` | SI | Sin cambios |
| `cleanAnonymousData` | `clean_{uid}` | SI | Sin cambios |

---

## Firestore Rules

Sin cambios. La coleccion `_rateLimits` solo es accesible via Admin SDK (Cloud Functions):

```
match /_rateLimits/{docId} {
  allow read, write: if false;
}
```

### Rules impact analysis

| Query (service file) | Coleccion | Auth context | Rule que lo permite | Cambio necesario? |
|---------------------|-----------|-------------|-------------------|-------------------|
| `deleteAllUserData` → `where('userId', '==', uid)` | `_rateLimits` | Admin SDK (Cloud Function) | Admin SDK bypasses rules | No |
| `checkCallableRateLimit` → `doc(key).set/update` | `_rateLimits` | Admin SDK (Cloud Function) | Admin SDK bypasses rules | No |
| `backups.checkRateLimit` → `doc(key).set/update` | `_rateLimits` | Admin SDK (Cloud Function) | Admin SDK bypasses rules | No |
| `perfMetrics` → `doc(key).set/update` | `_rateLimits` | Admin SDK (Cloud Function) | Admin SDK bypasses rules | No |

### Field whitelist check

No aplica. `_rateLimits` tiene `allow read, write: if false` — toda escritura es via Admin SDK que bypasses rules. No hay `hasOnly()` que actualizar.

---

## Cloud Functions

### Cambio 1: `checkCallableRateLimit` — nuevo parametro `userId`

**Archivo:** `functions/src/utils/callableRateLimit.ts`

Firma actual:

```typescript
export async function checkCallableRateLimit(
  db: Firestore, key: string, limit: number
): Promise<void>
```

Firma nueva:

```typescript
export async function checkCallableRateLimit(
  db: Firestore, key: string, limit: number, userId: string
): Promise<void>
```

Cambios en la transaccion:
- `tx.set(docRef, { count: 1, resetAt, userId })` — en creacion inicial
- `tx.set(docRef, { count: 1, resetAt, userId })` — en reset de ventana expirada
- `tx.update(docRef, { count: data.count + 1 })` — sin cambio (userId ya esta en el doc)

### Cambio 2: `backups.ts` — agregar `userId` al rate limit inline

**Archivo:** `functions/src/admin/backups.ts`

En la funcion `checkRateLimit` interna:
- `tx.set(docRef, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS, userId: uid })` — en creacion/reset
- Sin cambio en `tx.update` (solo incrementa count)

Requiere que `checkRateLimit` reciba `uid` como parametro adicional.

### Cambio 3: `perfMetrics.ts` — agregar `userId` al rate limit inline

**Archivo:** `functions/src/admin/perfMetrics.ts`

En el bloque de rate limit inline:
- `tx.set(rateLimitRef, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS, userId: uid })` — en creacion/reset
- Sin cambio en `tx.update` (solo incrementa count)

---

## Componentes

N/A — este feature es exclusivamente backend (Cloud Functions).

---

## Textos de usuario

N/A — no hay cambios de UI ni textos visibles.

---

## Hooks

N/A — no hay cambios frontend.

---

## Servicios

N/A — no hay cambios frontend.

---

## Integracion

### Archivos que necesitan modificacion

| Archivo | Cambio |
|---------|--------|
| `functions/src/utils/callableRateLimit.ts` | Agregar parametro `userId`, incluirlo en `set()` |
| `functions/src/callable/inviteListEditor.ts` | Pasar `request.auth.uid` como 4to argumento |
| `functions/src/callable/removeListEditor.ts` | Pasar `request.auth.uid` como 4to argumento |
| `functions/src/admin/backups.ts` | Agregar `userId` a `checkRateLimit` interno + `set()` |
| `functions/src/admin/perfMetrics.ts` | Agregar `userId` al `set()` inline del rate limit |

### Archivos que NO necesitan cambios (verificado)

| Archivo | Razon |
|---------|-------|
| `functions/src/callable/deleteUserAccount.ts` | Ya escribe `userId` en el `set()` (linea 35) |
| `functions/src/callable/cleanAnonymousData.ts` | Ya escribe `userId` en el `set()` (linea 41) |
| `functions/src/utils/deleteUserData.ts` | Ya usa `USER_OWNED_COLLECTIONS` que incluye `_rateLimits` con `field: 'userId'` |
| `functions/src/shared/userOwnedCollections.ts` | Ya tiene entrada correcta para `_rateLimits` |

### Preventive checklist

- [x] **Service layer**: N/A — solo backend
- [x] **Duplicated constants**: N/A
- [x] **Context-first data**: N/A
- [x] **Silent .catch**: N/A — no hay `.catch` nuevos
- [x] **Stale props**: N/A — no hay componentes

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/utils/callableRateLimit.test.ts` | Verificar que `set()` incluye `userId` en creacion y reset. Verificar que `update()` NO sobreescribe `userId`. Verificar firma con 4 parametros. | Unit |
| `functions/src/__tests__/callable/inviteListEditor.test.ts` | Verificar que `checkCallableRateLimit` se llama con 4 args incluyendo `userId` | Unit |
| `functions/src/__tests__/callable/removeListEditor.test.ts` | Verificar que `checkCallableRateLimit` se llama con 4 args incluyendo `userId` | Unit |

### Casos a cubrir

- [x] `checkCallableRateLimit`: `set()` en primera llamada incluye `userId`
- [x] `checkCallableRateLimit`: `set()` en reset de ventana expirada incluye `userId`
- [x] `checkCallableRateLimit`: `update()` en incremento NO toca `userId`
- [x] `inviteListEditor`: pasa `request.auth.uid` como 4to argumento
- [x] `removeListEditor`: pasa `request.auth.uid` como 4to argumento

### Mock strategy

- Firestore: mock `runTransaction` con `tx.set`/`tx.update`/`tx.get` (patron existente en `callableRateLimit.test.ts`)
- `checkCallableRateLimit` en tests de callables: mock completo del modulo (patron existente)

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Tests existentes actualizados para nueva firma
- Todos los paths de `set()` verifican presencia de `userId`

---

## Analytics

N/A — no hay nuevos eventos de analytics.

---

## Offline

N/A — todo el codigo modificado ejecuta en Cloud Functions (server-side).

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

N/A — no hay cambios de UI.

---

## Decisiones tecnicas

### DT1: Agregar `userId` como parametro vs extraerlo del `key`

**Decision:** Agregar como parametro explicito.

**Razon:** El `key` tiene formato `{action}_{uid}`, pero parsear el UID del string es fragil y asume un formato que podria cambiar. Pasar `userId` como parametro es explicito, type-safe, y consistente con el patron de `rateLimiter.ts` (triggers).

### DT2: No migrar backups/perfMetrics a `checkCallableRateLimit`

**Decision:** Solo agregar `userId` al rate limit inline de `backups.ts` y `perfMetrics.ts`, sin refactorizar para usar `checkCallableRateLimit`.

**Razon:** `backups.ts` usa ventana de 1 minuto (no diaria) y `perfMetrics.ts` tiene logica inline integrada en la transaccion de escritura. Migrarlos a `checkCallableRateLimit` cambiaria la semantica del rate limiting. El scope de este issue es agregar `userId` para cleanup, no refactorizar rate limiters.

### DT3: No migrar docs existentes

**Decision:** No se crea script de migracion para docs existentes sin `userId`.

**Razon:** Los docs de `checkCallableRateLimit` tienen ventana diaria y se auto-limpian al expirar. Los de `backups` tienen ventana de 1 minuto. En menos de 24 horas post-deploy, todos los docs activos tendran `userId`. Docs huerfanos pre-fix son efimeros.

---

## Hardening de seguridad

### Firestore rules requeridas

Sin cambios. `_rateLimits` ya tiene la regla mas restrictiva posible:

```
match /_rateLimits/{docId} {
  allow read, write: if false;
}
```

Solo Admin SDK (Cloud Functions) puede leer/escribir.

### Rate limiting

N/A — no se agregan colecciones nuevas. Se mejora la limpieza de la coleccion existente `_rateLimits`.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Trazabilidad de UID post-eliminacion de cuenta | `userId` field permite que `deleteAllUserData` encuentre y elimine los docs via query. Doc IDs con UID se eliminan junto con los docs. | `functions/src/utils/callableRateLimit.ts`, `functions/src/admin/backups.ts`, `functions/src/admin/perfMetrics.ts` |
| Docs huerfanos acumulandose | Ventana diaria/minuto auto-expira docs. El fix solo mejora la limpieza proactiva en account deletion. | `functions/src/utils/deleteUserData.ts` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt en GitHub actualmente.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #240 (este issue) | Rate limit docs sin `userId` impiden cleanup en account deletion | Fase 1 completa |
| Backlog: auditoria v2.32.0 | Cierra la brecha de `userId` detectada en la auditoria | Fase 1 completa |
