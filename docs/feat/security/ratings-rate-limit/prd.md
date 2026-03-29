# PRD: Ratings trigger sin rate limit server-side

**Feature:** ratings-rate-limit
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #223
**Prioridad:** Alta

---

## Contexto

El proyecto tiene rate limiting server-side implementado en todos los triggers de colecciones user-writable (comments, commentLikes, customTags, favorites, priceLevels, feedback, follows, checkins, recommendations) excepto `ratings`. El trigger `onRatingWritten` en `functions/src/triggers/ratings.ts` ejecuta fan-out a followers, recalculacion de agregados, incremento de contadores y lookups de documentos de negocios, pero no valida limites de frecuencia.

## Problema

- Un bot puede crear/eliminar/re-crear ratings en loop sobre cientos de negocios, disparando invocaciones ilimitadas de Cloud Functions (fan-out, aggregates, counters, doc lookups) que impactan directamente en billing de Firebase.
- Sin rate limit, un atacante puede manipular ratings a escala, alterando los promedios y rankings de multiples negocios en minutos.
- `ratings` es la unica coleccion user-writable con trigger que no llama a `checkRateLimit()`, rompiendo la consistencia del modelo de seguridad server-side documentado en `security.md`.

## Solucion

### S1. Agregar `checkRateLimit` al path de create en `onRatingWritten`

Seguir el patron exacto de `onFavoriteCreated` en `functions/src/triggers/favorites.ts`: extraer `userId` del documento creado, llamar a `checkRateLimit` con limite de 30 ratings diarios, y si se excede, eliminar el documento y registrar en `abuseLogs` via `logAbuse`.

El limite de 30/dia es razonable: la app tiene ~40 negocios, y un usuario legitimo no calificaria mas de 30 en un solo dia.

### S2. Importar dependencias existentes

Agregar imports de `checkRateLimit` (de `../utils/rateLimiter`) y `logAbuse` (de `../utils/abuseLogger`) al trigger. Ambas utilidades ya estan testeadas y usadas en 9+ triggers.

### S3. Actualizar documentacion de seguridad

Agregar `ratings` a la tabla de rate limiting server-side en `docs/reference/security.md` con limite `30/dia por usuario`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar `checkRateLimit` + `logAbuse` en create path de `onRatingWritten` | Alta | S |
| Agregar tests para el nuevo path de rate limit | Alta | S |
| Actualizar tabla de rate limits en `security.md` | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Rate limiting en el path de update (cambio de score). Un usuario solo puede tener 1 rating por negocio (doc ID compuesto `{userId}__{businessId}`), asi que updates no son un vector de abuso por volumen.
- Rate limiting en el path de delete. Deletes no generan fan-out ni aggregates costosos mas alla de decrementar contadores.
- Rate limit precheck en UI (como el que existe para comments). Con ~40 negocios, es extremadamente improbable que un usuario legitimo alcance 30 ratings/dia.
- Refactorizar `onRatingWritten` de `onDocumentWritten` a `onDocumentCreated`/`onDocumentDeleted` separados.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/triggers/ratings.ts` | Trigger | Rate limit check en create, delete del doc cuando excede, logAbuse cuando excede, que el flow normal continua si no excede |
| `functions/src/__tests__/triggers/ratings.test.ts` | Test existente | Agregar 2-3 test cases para rate limit |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

Los tests existentes en `ratings.test.ts` ya cubren create/update/delete paths con 5 cases al 100% de cobertura. Se necesitan tests adicionales para:

1. Create con rate limit NO excedido: verificar que `checkRateLimit` se llama y el flow continua normalmente
2. Create con rate limit excedido: verificar que el doc se elimina, se llama a `logAbuse`, y se hace early return (sin counters, sin aggregates, sin fan-out)
3. Create sin userId: verificar que no se intenta rate limit (guard defensivo)

---

## Seguridad

- [x] Rate limiting server-side via `checkRateLimit()` (este es el fix)
- [x] `logAbuse` registra intentos excedidos para monitoreo en admin panel
- [x] Documento eliminado automaticamente si excede el limite (revert server-side)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `ratings` collection (create) | Bot crea ratings en loop, disparando fan-out + aggregates + counters | `checkRateLimit` 30/dia + delete + `logAbuse` |
| `ratings` collection (delete+create loop) | Bot elimina y re-crea para resetear y abusar | Rate limit cuenta creates totales del dia, no netos; cada create cuenta |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #222 userTags sin trigger | Similar: coleccion sin rate limit server-side | No afecta este fix, pero es el mismo patron de vulnerabilidad |
| #218 reorganizar components/menu/ | No afecta | Ningun impacto |

### Mitigacion incorporada

- Se cierra la ultima brecha de rate limiting en triggers de colecciones user-writable.
- Se actualiza `security.md` para reflejar cobertura completa.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Crear rating | write | Firestore persistent cache / offline queue | Optimistic UI existente (`pendingRating`) |

### Checklist offline

- [x] Reads de Firestore: no aplica (cambio solo en Cloud Functions)
- [x] Writes: el rate limit es server-side; si el usuario crea un rating offline, se encola y el trigger evalua al sincronizar
- [x] APIs externas: no hay
- [x] UI: no hay cambios de UI
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

Este cambio es exclusivamente en Cloud Functions (`functions/src/triggers/ratings.ts`). No hay cambios en frontend.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no aplica: solo Cloud Functions)
- [x] Componentes nuevos son reutilizables (no hay componentes nuevos)
- [x] No se agregan useState a AppShell o SideMenu
- [x] Props explicitas (no aplica)
- [x] Ningun componente nuevo importa directamente de `firebase/firestore` (no aplica)
- [x] Archivos nuevos van en carpeta correcta (no hay archivos nuevos)
- [x] Ningun archivo nuevo supera 400 lineas (no aplica)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Sin cambios en frontend |
| Estado global | = | Sin cambios en frontend |
| Firebase coupling | = | Usa utilidades existentes (`checkRateLimit`, `logAbuse`) |
| Organizacion por dominio | = | Cambio en archivo existente de triggers |

---

## Success Criteria

1. `onRatingWritten` llama a `checkRateLimit` en el path de create con limite 30/dia
2. Si el rate limit se excede, el documento se elimina y se registra en `abuseLogs`
3. Tests existentes siguen pasando + nuevos tests cubren el path de rate limit
4. La tabla de rate limits en `security.md` incluye `ratings | 30/dia por usuario`
5. Cobertura de `ratings.ts` se mantiene >= 80%
