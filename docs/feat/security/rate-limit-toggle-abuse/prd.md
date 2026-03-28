# PRD: Rate limit en favorites, userTags, customTags, priceLevels, commentLikes

**Feature:** rate-limit-toggle-abuse
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #216
**Prioridad:** Media

---

## Contexto

El proyecto ya tiene rate limiting server-side en 6 colecciones (comments 20/dia, check-ins 10/dia, follows 50/dia, feedback 5/dia, recommendations 20/dia, commentLikes 50/dia) y customTags tiene rate limit per-entity (10/business). Sin embargo, favorites, userTags y priceLevels no tienen rate limits en sus triggers de Cloud Functions, lo que permite ciclos rapidos de create/delete que disparan invocaciones excesivas de Cloud Functions.

## Problema

- **Favorites**: los triggers `onFavoriteCreated`/`onFavoriteDeleted` ejecutan counter updates, aggregate writes y fan-out a followers en cada invocacion. Un bot puede hacer toggle rapido para generar miles de invocaciones/hora, especialmente costoso por el fan-out.
- **userTags**: no tiene triggers de Cloud Functions. Firestore rules permiten create/delete sin limite. Ciclos rapidos de create/delete generan writes excesivos a Firestore directamente (billing de read/write ops).
- **priceLevels**: los triggers `onPriceLevelCreated`/`onPriceLevelUpdated` ejecutan counter y trackWrite sin rate limit. Ademas, priceLevels permite update (no solo create/delete), lo que agrega otra superficie de abuso.
- **customTags**: tiene rate limit per-entity (10/business) pero no daily. Un usuario puede crear 10 tags en cada uno de los 40 comercios = 400 tags/dia, cada uno triggeando moderacion + counters.
- La deduplicacion por doc ID compuesto (`userId__businessId`) da proteccion natural contra duplicados simultaneos, pero no previene el ciclo create-delete-create repetido.

## Solucion

### S1. Agregar rate limit daily a favorites

Agregar `checkRateLimit` al trigger `onFavoriteCreated` con limite daily. Patron identico a comments: si excede, delete doc + logAbuse. Limite sugerido: **100/dia** (generoso dado que hay ~40 comercios, pero previene abuse por toggle loops).

### S2. Crear triggers para userTags con rate limit

Crear `onUserTagCreated` y `onUserTagDeleted` en `functions/src/triggers/userTags.ts`. El trigger de create debe incluir `checkRateLimit` con limite daily. Limite sugerido: **100/dia**. Los triggers tambien deben incluir `incrementCounter` y `trackWrite`/`trackDelete` siguiendo el patron existente.

### S3. Agregar rate limit daily a priceLevels

Agregar `checkRateLimit` al trigger `onPriceLevelCreated` con limite daily. Limite sugerido: **50/dia** (un usuario realista no cambia el nivel de gasto de 50 comercios en un dia).

### S4. Agregar rate limit daily a customTags (complementario al per-entity)

Agregar un segundo `checkRateLimit` con `windowType: 'daily'` al trigger `onCustomTagCreated`, ademas del existente per-entity. Limite sugerido: **50/dia**.

### S5. Verificar commentLikes (ya protegido)

commentLikes ya tiene rate limit de 50/dia. Solo verificar que `logAbuse` se llama cuando se excede (actualmente no lo hace -- agregar).

### Consideraciones de seguridad

- Todos los rate limits son server-side (Cloud Functions triggers), no bypasseables por el cliente.
- Los documentos que exceden el limite se eliminan automaticamente (`snap.ref.delete()`).
- Cada exceso se registra en `abuseLogs` via `logAbuse` para deteccion de patrones.
- Los limites son generosos para no afectar uso legitimo pero suficientes para prevenir abuse por billing.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Rate limit daily en `onFavoriteCreated` | Alta | S |
| S2. Crear triggers `userTags.ts` con rate limit + counters | Alta | S |
| S3. Rate limit daily en `onPriceLevelCreated` | Alta | S |
| S4. Rate limit daily adicional en `onCustomTagCreated` | Media | S |
| S5. Agregar `logAbuse` a commentLikes cuando excede | Baja | S |
| Tests para todos los triggers modificados/nuevos | Alta | M |
| Actualizar `security.md` tabla de rate limits | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Rate limiting client-side / UI precheck para estas colecciones (ya existe para comments; podria agregarse despues)
- Throttle de deletes (solo se limita creates; deletes no crean documentos nuevos)
- IP-based rate limiting (no disponible en triggers de Firestore)
- Cambios a Firestore rules (las rules actuales son correctas; la proteccion es en triggers)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/triggers/favorites.ts` | Trigger | Rate limit check en create, delete del doc si excede, logAbuse call, flujo normal sin cambios |
| `functions/src/triggers/userTags.ts` (nuevo) | Trigger | Rate limit check en create, counter increment/decrement, logAbuse en exceso |
| `functions/src/triggers/priceLevels.ts` | Trigger | Rate limit check en create, delete del doc si excede, logAbuse call |
| `functions/src/triggers/customTags.ts` | Trigger | Rate limit daily adicional (ya tiene tests para per-entity rate limit) |
| `functions/src/triggers/commentLikes.ts` | Trigger | logAbuse call cuando excede (ya tiene tests de rate limit) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

- [x] Rate limits existentes en comments, check-ins, follows, feedback, recommendations ya funcionan correctamente
- [ ] Agregar rate limit server-side a favorites (100/dia)
- [ ] Agregar rate limit server-side a userTags (100/dia) via nuevo trigger
- [ ] Agregar rate limit server-side a priceLevels (50/dia)
- [ ] Agregar rate limit daily a customTags (50/dia, complementa el per-entity existente)
- [ ] Agregar logAbuse a commentLikes cuando se excede el limite
- [ ] Verificar que `snap.ref.delete()` se ejecuta para docs que exceden limite
- [ ] Verificar que abuseLogs captura todos los excesos para monitoreo admin

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Toggle favorite | write | Ya usa `withOfflineSupport` | Encolado offline, sync al reconectar |
| Create/delete userTag | write | Ya usa Firestore persistent cache | Write encolado por Firestore SDK |
| Set priceLevel | write | Ya usa Firestore persistent cache | Write encolado por Firestore SDK |
| Create customTag | write | Ya usa Firestore persistent cache | Write encolado por Firestore SDK |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline
- [x] Writes: tienen queue offline (Firestore persistent cache + withOfflineSupport para favorites)
- [x] APIs externas: N/A (solo Cloud Functions triggers)
- [x] UI: no se requiere cambio (rate limits son transparentes al usuario)
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: S

Nota: cuando un doc se crea offline y se sincroniza, el trigger se ejecutara al llegar a Firestore. Si excede el rate limit, el trigger eliminara el doc. El usuario vera el item desaparecer. Este es el comportamiento esperado y consistente con los rate limits existentes.

---

## Modularizacion

Los cambios son exclusivamente en Cloud Functions triggers. No hay cambios en UI ni en componentes frontend.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- N/A, solo backend
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- N/A
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu -- N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout -- N/A
- [x] Cada prop de accion tiene un handler real especificado -- N/A

---

## Success Criteria

1. Favorites trigger rechaza y elimina documentos cuando el usuario excede 100 creates/dia, con logAbuse
2. userTags tiene triggers nuevos con rate limit de 100/dia, counters y logAbuse
3. priceLevels trigger rechaza creates que excedan 50/dia, con logAbuse
4. customTags trigger tiene rate limit daily de 50/dia ademas del per-entity existente
5. commentLikes trigger registra logAbuse cuando se excede el limite de 50/dia
6. Tabla de rate limits en `security.md` actualizada con las 5 colecciones nuevas/modificadas
7. Tests con >= 80% cobertura para todos los triggers modificados y nuevos
