# PRD: Security: agregar affectedKeys() a ratings, customTags y priceLevels update rules

**Feature:** 241-affectedkeys-update-rules
**Categoria:** security
**Fecha:** 2026-03-29
**Issue:** #241
**Prioridad:** Alta (critico)

---

## Contexto

Las Firestore rules del proyecto validan `keys().hasOnly()` en todas las operaciones de `create` y `affectedKeys().hasOnly()` en updates de `comments` y `notifications`. Sin embargo, tres colecciones — `ratings`, `customTags` y `priceLevels` — tienen reglas de update que solo validan immutabilidad de `userId` pero no restringen que campos puede modificar el cliente. Esto fue detectado durante una auditoria de seguridad post-v2.32.0.

## Problema

- **ratings** (firestore.rules): la regla de update no tiene `affectedKeys().hasOnly()`. Un atacante puede cambiar `businessId` para re-apuntar su rating a otro comercio, corrompiendo promedios de calificacion.
- **customTags** (firestore.rules): mismo problema. Permite re-asignar tags a otro comercio, bypaseando rate limits per-business que el trigger valida.
- **priceLevels** (firestore.rules): mismo problema, y ademas falta la validacion de immutabilidad de `businessId`. Un atacante puede mover su voto de nivel de gasto a otro comercio.

## Solucion

### S1. Agregar `affectedKeys().hasOnly()` a ratings update

Restringir los campos modificables en la regla de update de `ratings` a solo los que el cliente legitimamente actualiza: `score`, `updatedAt`, y `criteria`. El patron ya existe en `comments` update rule (`affectedKeys().hasOnly(['text','updatedAt'])`).

### S2. Agregar `affectedKeys().hasOnly()` a customTags update

Restringir los campos modificables en la regla de update de `customTags`. Actualmente solo se valida immutabilidad de `userId`. Agregar la restriccion de campos permitidos y la immutabilidad de `businessId`.

### S3. Agregar `affectedKeys().hasOnly()` a priceLevels update

Restringir los campos modificables en la regla de update de `priceLevels` a `level` y `updatedAt`. Agregar la immutabilidad de `businessId` que actualmente falta.

### Consideraciones de seguridad

Este es un fix critico porque permite data corruption en produccion. La explotacion es trivial: un usuario autenticado puede usar la consola de Firebase o un script para enviar un `updateDoc` con `businessId` diferente, moviendo su rating/tag/priceLevel a cualquier otro comercio.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar `affectedKeys().hasOnly(['score','updatedAt','criteria'])` a ratings update | Must | S |
| Agregar `affectedKeys().hasOnly()` + `businessId` immutability a customTags update | Must | S |
| Agregar `affectedKeys().hasOnly(['level','updatedAt'])` + `businessId` immutability a priceLevels update | Must | S |
| Verificar que el deploy de rules pasa en emuladores | Must | S |
| Test manual: intentar cambiar businessId via consola y verificar rechazo | Should | S |

**Esfuerzo total estimado:** S (30 min)

---

## Out of Scope

- Auditar otras colecciones que ya tienen `affectedKeys()` (comments, notifications) — ya estan correctas
- Agregar tests automatizados de Firestore rules (no hay framework de rules testing configurado actualmente)
- Cambios a Cloud Functions triggers o rate limiters
- Cambios a servicios frontend (los servicios ya envian solo los campos correctos)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `firestore.rules` | Manual / Emulator | Verificar que update de ratings con businessId diferente es rechazado |
| `firestore.rules` | Manual / Emulator | Verificar que update de customTags con businessId diferente es rechazado |
| `firestore.rules` | Manual / Emulator | Verificar que update de priceLevels con businessId diferente es rechazado |
| `firestore.rules` | Manual / Emulator | Verificar que updates legitimos (score, level, criteria, updatedAt) siguen funcionando |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [ ] Verificar que `affectedKeys().hasOnly()` cubre exactamente los campos que cada servicio frontend envia en updates
- [ ] Verificar immutabilidad de `businessId` en las tres colecciones
- [ ] Verificar immutabilidad de `userId` (ya existente en ratings y customTags, agregar si falta en priceLevels)
- [ ] Deploy de rules a produccion lo antes posible (vulnerabilidad activa)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| ratings update rule | Re-targeting de businessId para corromper promedios | `affectedKeys().hasOnly()` + `businessId` immutability |
| customTags update rule | Re-asignar tags a otro comercio, bypass rate limit per-business | `affectedKeys().hasOnly()` + `businessId` immutability |
| priceLevels update rule | Mover voto de precio a otro comercio | `affectedKeys().hasOnly()` + `businessId` immutability |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #237 Firestore rules field whitelist audit | Relacionado | #237 audito `hasOnly()` en creates; este issue cubre `affectedKeys()` en updates que #237 no cubrio |
| #242 Rate limits + field validation | Complementario | #242 cubre otros gaps de seguridad; este es mas critico y debe deployarse primero |

### Mitigacion incorporada

- Se cierra la brecha de data integrity en las tres colecciones afectadas
- Se alinean todas las colecciones con el patron de `affectedKeys().hasOnly()` ya establecido en comments y notifications

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Rating update | write | Firestore persistent cache (cola offline) | Optimistic UI con pendingRating |
| CustomTag update | write | Firestore persistent cache | N/A (no hay update de customTags desde UI) |
| PriceLevel update | write | Firestore persistent cache | Optimistic UI con pendingLevel |

### Checklist offline

- [x] Reads de Firestore: no aplica (solo cambio en rules de write)
- [x] Writes: las reglas de Firestore se evaluan al sincronizar; writes offline quedan en cola y se validan al reconectar
- [x] APIs externas: no aplica
- [x] UI: no hay cambios de UI
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature modifica exclusivamente `firestore.rules`. No hay cambios en el frontend ni en Cloud Functions.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (N/A - solo Firestore rules)
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
| Acoplamiento de componentes | = | Solo cambios en Firestore rules |
| Estado global | = | Sin cambios |
| Firebase coupling | = | Sin cambios en frontend |
| Organizacion por dominio | = | N/A |

---

## Success Criteria

1. La regla de update de `ratings` rechaza cambios a `businessId`, `userId`, `createdAt` y cualquier campo no permitido
2. La regla de update de `customTags` rechaza cambios a `businessId` y campos no permitidos
3. La regla de update de `priceLevels` rechaza cambios a `businessId`, `userId`, `createdAt` y campos no permitidos
4. Las operaciones legitimas de update desde la app (cambiar score, level, criteria) siguen funcionando correctamente
5. Las rules se deployean exitosamente en emuladores y produccion
