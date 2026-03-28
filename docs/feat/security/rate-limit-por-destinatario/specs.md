# Specs: Rate limit por destinatario en notificaciones

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No se crean colecciones ni tipos nuevos. Los cambios son exclusivamente de logica server-side en Cloud Functions.

### Tipos modificados

```typescript
// functions/src/utils/abuseLogger.ts — agregar 'recipient_flood' al union type
export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood';
  collection: string;
  detail: string;
}
```

El campo `detail` incluira informacion adicional:

- Para `recipient_flood`: `"Recipient {recipientId} exceeded 50 notifications/day. Actor: {actorId}, type: {notificationType}"`

### Indexes

No se requieren indices nuevos. La query de count por destinatario usara:

```
notifications WHERE userId == {recipientId} AND createdAt >= startOfDay()
```

El indice compuesto `(userId, createdAt)` ya existe para la query de listado de notificaciones del usuario.

## Firestore Rules

No se requieren cambios. Todas las operaciones son via Admin SDK en Cloud Functions:

- `createNotification` usa Admin SDK para escribir a `notifications`
- `logAbuse` usa Admin SDK para escribir a `abuseLogs`
- Las queries de count usan Admin SDK

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| countRecipientNotificationsToday (notifications.ts) | notifications | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| logAbuse (abuseLogger.ts) | abuseLogs | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |
| dedup query in follows.ts | notifications | Admin SDK (Cloud Functions) | Admin SDK bypasses rules | No |

### Field whitelist check

No se agregan campos nuevos a documentos existentes. Los campos `actorId` y `type` ya existen en `notifications`. El campo `recipient_flood` es un valor nuevo del campo `type` en `abuseLogs`, no un campo nuevo.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

### Modificacion: `createNotification` (functions/src/utils/notifications.ts)

**Cambio:** Agregar rate limit por destinatario antes de escribir la notificacion.

**Logica:**

1. Despues del check `shouldNotify`, verificar si el tipo es admin-to-user (exento del rate limit)
2. Si no es exento, contar notificaciones del `userId` (destinatario) con `createdAt >= startOfDay()`
3. Si `count >= 50`, no crear la notificacion. Loggear en `abuseLogs` con tipo `recipient_flood` y retornar
4. Si `count < 50`, continuar con la creacion normal

**Tipos exentos del rate limit por destinatario:**

- `feedback_response` (admin responde feedback)
- `photo_approved` (admin aprueba foto)
- `photo_rejected` (admin rechaza foto)
- `ranking` (sistema de rankings)

Estos son tipos generados por admin/sistema, no por otros usuarios. Un atacante no puede generar estos tipos.

**Constante:** `RECIPIENT_DAILY_LIMIT = 50`

### Modificacion: `onFollowCreated` (functions/src/triggers/follows.ts)

**Cambio:** Antes de llamar a `createNotification`, verificar si ya existe una notificacion `new_follower` del mismo actor al mismo destinatario en las ultimas 24h.

**Logica:**

1. Query: `notifications` where `userId == followedId` AND `actorId == followerId` AND `type == 'new_follower'` AND `createdAt >= startOfDay()`
2. Si `count > 0`, skip `createNotification` (el follow se procesa normalmente, solo se suprime la notificacion duplicada)
3. Si `count == 0`, llamar `createNotification` como antes

### Modificacion: `logAbuse` type union (functions/src/utils/abuseLogger.ts)

**Cambio:** Agregar `'recipient_flood'` al union type de `AbuseLogEntry['type']`.

**Severidad:** `'medium'` (en el `SEVERITY_MAP`).

## Componentes

No hay cambios de componentes frontend.

### Mutable prop audit

N/A -- no hay componentes modificados.

## Textos de usuario

No hay textos visibles al usuario. Las notificaciones suprimidas simplemente no se crean. El actor no recibe feedback de que el rate limit fue alcanzado.

## Hooks

No hay cambios de hooks frontend.

## Servicios

No hay cambios de servicios frontend.

## Integracion

Este feature modifica exclusivamente Cloud Functions. No hay cambios frontend.

- `functions/src/utils/notifications.ts` -- agregar rate limit check
- `functions/src/utils/abuseLogger.ts` -- agregar tipo `recipient_flood` al union
- `functions/src/triggers/follows.ts` -- agregar deduplicacion de notificacion

### Preventive checklist

- [x] **Service layer**: N/A -- no hay cambios frontend
- [x] **Duplicated constants**: El limite `RECIPIENT_DAILY_LIMIT = 50` se define en `notifications.ts` como constante local. No existe en otro lugar
- [x] **Context-first data**: N/A -- no hay cambios frontend
- [x] **Silent .catch**: No se agrega ningun `.catch`. Los errores en el count query propagaran al trigger caller
- [x] **Stale props**: N/A -- no hay componentes modificados

## Tests

### Archivos a testear

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `functions/src/__tests__/utils/notifications.test.ts` | Rate limit por destinatario: permite hasta 50, bloquea la 51. No aplica rate limit a tipos admin (feedback_response, photo_approved, photo_rejected, ranking). Loggea abuse cuando se excede | Unit (agregar casos) |
| `functions/src/__tests__/triggers/follows.test.ts` | Deduplicacion: no crea notificacion si ya existe `new_follower` del mismo actor en 24h. Si crea cuando no hay duplicada | Unit (agregar casos) |

### Casos a cubrir -- notifications.test.ts

- Permite notificacion cuando count < 50 (destinatario no floodeado)
- Bloquea notificacion cuando count >= 50 (destinatario floodeado)
- No aplica rate limit a `feedback_response` (admin type)
- No aplica rate limit a `photo_approved` (admin type)
- No aplica rate limit a `photo_rejected` (admin type)
- No aplica rate limit a `ranking` (system type)
- Loggea abuse con tipo `recipient_flood` cuando se bloquea
- El log incluye actorId, recipientId y tipo de notificacion en detail

### Casos a cubrir -- follows.test.ts

- No crea notificacion `new_follower` si ya existe una del mismo actor en las ultimas 24h
- Si crea notificacion `new_follower` cuando no hay duplicada
- El follow se procesa normalmente (counters, etc.) incluso cuando la notificacion se deduplica

### Mock strategy

- `notifications.ts`: mock del `db.collection('notifications')` con `.where().where().count().get()` para simular counts
- `abuseLogger.ts`: ya esta mockeado en los tests existentes
- `follows.ts`: agregar mock de count query para deduplicacion al mock de db existente

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo
- Todos los paths condicionales cubiertos (rate limit on/off, admin types exempt, dedup on/off)
- Side effects verificados (abuseLogs write cuando se excede)

## Analytics

No se agregan eventos de analytics frontend. El logging se hace via `abuseLogs` en Firestore, visible en el panel admin de Abuse Alerts.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

Toda la logica es server-side en Cloud Functions. No hay impacto offline.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

N/A -- no hay cambios de UI.

---

## Decisiones tecnicas

### 1. Rate limit en `createNotification` vs. en cada trigger individual

**Decision:** Rate limit centralizado en `createNotification`.

**Razon:** Todos los triggers que crean notificaciones pasan por `createNotification`. Centralizar el check garantiza cobertura completa sin modificar cada trigger. Si manana se agrega un nuevo tipo de notificacion, automaticamente estara protegido.

**Alternativa rechazada:** Agregar checks individuales en cada trigger (`follows.ts`, `commentLikes.ts`, `comments.ts`, `recommendations.ts`). Esto seria mas fragil y facil de olvidar al agregar nuevos triggers.

### 2. Tipos exentos del rate limit

**Decision:** Exentar `feedback_response`, `photo_approved`, `photo_rejected`, `ranking`.

**Razon:** Estos tipos son generados por admin o sistema. Un atacante no puede provocar su generacion. Si el rate limit bloqueara estos tipos, un flooding coordinado podria causar que el usuario no reciba respuestas de admin a su feedback o aprobaciones de sus fotos.

### 3. Deduplicacion solo en follows (no en otros tipos)

**Decision:** Solo deduplicar notificaciones `new_follower` por actor/destinatario/dia.

**Razon:** Es el unico tipo vulnerable al toggle abuse (follow/unfollow/follow). Los otros tipos (like, comment_reply) no tienen toggle semantico -- un like se crea una vez, no se puede "unlike y re-like" para generar notificaciones (el like ya tiene dedup por doc ID compuesto). Las recomendaciones tienen rate limit por actor (20/dia) que es suficiente.

### 4. Severidad `medium` para `recipient_flood`

**Decision:** `recipient_flood` tiene severidad `medium` en el `SEVERITY_MAP`.

**Razon:** Un solo evento de rate limit excedido no es necesariamente harassment (podria ser un usuario popular organicamente). Pero la existencia del log permite al admin detectar patrones. `low` seria demasiado facil de ignorar; `high` generaria falsos positivos.

### 5. No notificar al actor que el rate limit fue alcanzado

**Decision:** La operacion de follow/recommendation/like sigue funcionando normalmente. Solo se suprime la notificacion.

**Razon:** Si el atacante sabe que el rate limit fue alcanzado, sabe que el flooding fue efectivo y podria cambiar de estrategia. Mantener la operacion transparente ("stealth suppression") es la practica estandar anti-abuse.
