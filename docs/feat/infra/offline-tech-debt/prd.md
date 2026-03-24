# PRD: Offline — Check-ins, shared lists, notifications sin soporte offline

**Feature:** offline-tech-debt
**Categoria:** infra
**Fecha:** 2026-03-24
**Issue:** #178
**Prioridad:** Alta

---

## Contexto

La auditoria offline (2026-03-24) identifico que varias features agregadas despues del sistema offline original no tienen soporte offline: check-ins, shared lists, notifications polling, y rankings.

## Problema

- Check-ins hacen writes directos a Firestore sin pasar por el offline queue — fallan silenciosamente offline
- Notification polling usa `getCountFromServer` que siempre hace network call y falla cada 60s offline
- Rankings usan `getCountFromServer` — fallan offline
- Shared lists (12+ operaciones) no tienen soporte offline ni feedback al usuario

## Solucion

### S1: Check-ins en offline queue

Agregar `checkin_create` y `checkin_delete` a `OfflineActionType` en `types/offline.ts`. Implementar execute handlers en `syncEngine.ts`. Usar `withOfflineSupport` en `useCheckIn`.

### S2: Guard de notification polling

En `NotificationsContext.tsx`, agregar check de conectividad antes de llamar a `getCountFromServer`. Si offline, skip el poll. Una linea: `if (!navigator.onLine) return;`

### S3: getCountOfflineSafe utility

Crear utility compartido que wrappee `getCountFromServer` con fallback a 0 cuando offline. Usar en `notifications.ts` y `rankings.ts`.

### S4: Deshabilitar UI network-dependent cuando offline

Para operaciones que requieren red (shared lists write, feedback con media, invite editor, report photo), deshabilitar botones o mostrar tooltip "Requiere conexion" cuando `isOffline`. Sweep en ~5 componentes.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Check-ins en offline queue | P0 | M |
| S2: Guard notification polling | P0 | S |
| S3: getCountOfflineSafe utility | P1 | S |
| S4: Deshabilitar UI offline | P1 | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Shared lists en offline queue (complejidad alta por operaciones bidireccionales)
- Background Sync registration en service worker
- Comment edit/delete en offline queue
- Custom tag CRUD en offline queue
- Map offline fallback para sesiones nuevas

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/offlineInterceptor.ts` | Unit | Nuevos action types checkin_create/delete |
| `src/services/syncEngine.ts` | Unit | Execute handlers para check-in actions |
| `src/utils/getCountOfflineSafe.ts` | Unit | Fallback cuando offline |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Check-in actions se encolan correctamente offline
- getCountOfflineSafe devuelve 0 cuando navigator.onLine es false

---

## Seguridad

- [x] Sin impacto en seguridad — cambios son de offline handling

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| Check-in create | write | Offline queue | Toast "Se sincronizara" |
| Check-in delete | write | Offline queue | Toast "Se sincronizara" |
| Notification count | read | Skip poll | Mostrar ultimo valor cached |
| Rankings count | read | Return 0 | Mostrar datos cached |
| Shared lists write | write | N/A (out of scope) | Botones deshabilitados |

### Esfuerzo offline adicional: M

---

## Modularizacion

### Checklist modularizacion

- [x] Logica en services/hooks — offline queue es service layer
- [x] getCountOfflineSafe es utility reutilizable
- [x] No se agregan useState a AppShell o SideMenu

---

## Success Criteria

1. Check-in create/delete se encolan offline y sincronizan al reconectar
2. Notification polling no genera errores cuando offline
3. Rankings no crashean cuando offline
4. Botones de shared lists/feedback media se deshabilitan con mensaje cuando offline
5. Todos los tests pasan
