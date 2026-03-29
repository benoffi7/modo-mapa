# PRD: Rate limit por destinatario en notificaciones

**Feature:** rate-limit-por-destinatario
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #217
**Prioridad:** Media

---

## Contexto

El sistema actual tiene rate limits por actor (50 follows/dia, 20 recommendations/dia) pero no limita cuantas notificaciones puede recibir un mismo destinatario. La funcion `createNotification` en `functions/src/utils/notifications.ts` escribe directamente a la coleccion `notifications` sin verificar el volumen de notificaciones que el destinatario ya recibio ese dia. Esto deja abierto un vector de harassment donde multiples cuentas anonimas coordinadas pueden floodear a un usuario especifico.

## Problema

- Un atacante con N cuentas anonimas puede enviar N follows + N recomendaciones a un mismo usuario, generando hasta 70*N notificaciones/dia (50 follows + 20 recs por cuenta)
- No existe deduplicacion para follow/unfollow repetidos del mismo actor: un usuario puede hacer follow, unfollow, follow y generar multiples notificaciones `new_follower`
- El impacto es degradacion de UX (bandeja de notificaciones inutil) y un vector de harassment directo contra usuarios especificos

## Solucion

### S1. Rate limit por destinatario en `createNotification`

Agregar un check de volumen diario por destinatario dentro de `createNotification`. Antes de escribir la notificacion, contar cuantas notificaciones tiene el `userId` destinatario con `createdAt >= startOfDay()`. Si supera el limite (50/dia), no crear la notificacion y loggear el evento en `abuseLogs`.

El limite de 50 notificaciones/dia por destinatario es suficiente para uso normal (un usuario popular podria recibir ~20-30 notificaciones organicas) pero bloquea flooding coordinado.

### S2. Deduplicacion de follow/unfollow del mismo actor

En `onFollowCreated`, antes de crear la notificacion `new_follower`, verificar si ya existe una notificacion reciente (ultimas 24h) del mismo `actorId` hacia el mismo `userId` con tipo `new_follower`. Si existe, no crear duplicada.

Implementar con un query simple: `notifications` where `userId == followedId` and `actorId == followerId` and `type == 'new_follower'` and `createdAt >= startOfDay()`. Si `count > 0`, skip la notificacion.

### S3. Logging de abuse

Cuando el rate limit por destinatario se alcanza, loggear en `abuseLogs` con tipo `recipient_flood` incluyendo el `actorId` que intento crear la notificacion y el `recipientId` que esta siendo floodeado. Esto permite al admin detectar patrones de harassment coordinado en el panel de Abuse Alerts.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Rate limit por destinatario en `createNotification` | Alta | S |
| Deduplicacion follow/unfollow en `onFollowCreated` | Alta | S |
| Logging en `abuseLogs` cuando se alcanza el limite | Media | S |
| Tests para `createNotification` con rate limit | Alta | S |
| Tests para deduplicacion en follows trigger | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Rate limit por destinatario en notificaciones admin (feedback_response, photo_approved/rejected) -- estas son low-volume y confiables
- Bloqueo de usuarios (block list) -- feature separada, mas compleja
- UI para que el usuario vea que notificaciones fueron suprimidas -- no necesario, el flooding simplemente se detiene
- Notificaciones push (web push notifications) -- no existen actualmente en el proyecto

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/notifications.ts` | Utility | Rate limit por destinatario: permite hasta 50, bloquea la 51. Logging de abuse cuando se excede. No aplica rate limit a tipos admin (feedback_response). |
| `functions/src/triggers/follows.ts` | Trigger | Deduplicacion: no crea notificacion si ya existe una `new_follower` del mismo actor en las ultimas 24h. Si crea notificacion cuando no hay duplicada. |
| `functions/src/__tests__/utils/notifications.test.ts` | Test existente | Agregar casos para rate limit por destinatario |
| `functions/src/__tests__/triggers/follows.test.ts` | Test existente | Agregar casos para deduplicacion |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (abuseLogs write cuando se excede el limite)

---

## Seguridad

- [x] Rate limiting existente por actor (follows 50/dia, recommendations 20/dia) se mantiene intacto
- [ ] Agregar rate limit por destinatario (50 notificaciones/dia por recipient)
- [ ] Deduplicar notificaciones de follow/unfollow del mismo actor
- [ ] Loggear en `abuseLogs` cuando se alcanza el limite por destinatario
- [ ] Verificar que el rate limit no bloquee notificaciones admin-to-user (feedback_response, photo_approved, ranking)
- [ ] No exponer al actor que el rate limit fue alcanzado (la operacion de follow/recommendation sigue funcionando, solo se suprime la notificacion)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Rate limit check (count query) | read | N/A (server-side en Cloud Functions) | N/A |
| Notificacion create | write | N/A (server-side en Cloud Functions) | N/A |
| Abuse log create | write | N/A (server-side en Cloud Functions) | N/A |

### Checklist offline

- [x] Reads de Firestore: N/A -- toda la logica es server-side en Cloud Functions
- [x] Writes: N/A -- toda la logica es server-side en Cloud Functions
- [x] APIs externas: no hay
- [x] UI: no hay cambios de UI en este feature
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: S (ninguno, todo es server-side)

---

## Modularizacion

Este feature modifica exclusivamente Cloud Functions (server-side). No hay cambios de UI ni componentes frontend.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- N/A, es server-side
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- N/A, no hay componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu -- N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout -- N/A
- [x] Cada prop de accion tiene un handler real especificado -- N/A

---

## Success Criteria

1. Un usuario no puede recibir mas de 50 notificaciones por dia, independientemente de cuantos actores distintos interactuen con el
2. Un follow/unfollow/follow del mismo actor hacia el mismo destinatario genera como maximo 1 notificacion por dia
3. Las notificaciones admin-to-user (feedback_response, photo_approved/rejected, ranking) no son afectadas por el rate limit por destinatario
4. Los eventos de rate limit excedido quedan registrados en `abuseLogs` con suficiente informacion para detectar harassment coordinado
5. Los tests existentes de `notifications.ts` y `follows.ts` siguen pasando, y los nuevos cubren >= 80% del codigo agregado
