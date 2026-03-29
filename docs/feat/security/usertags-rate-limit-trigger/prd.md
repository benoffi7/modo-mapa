# PRD: userTags sin trigger -- sin rate limit ni tracking

**Feature:** usertags-rate-limit-trigger
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #223
**Prioridad:** Alta

---

## Contexto

La coleccion `userTags` es una de las pocas colecciones user-facing que permite create/delete directamente desde el cliente pero no tiene un Cloud Function trigger asociado. Todas las demas colecciones con escritura de usuario (comments, commentLikes, favorites, priceLevels, customTags, feedback) ya tienen triggers con rate limiting, tracking de counters y logging de abuso. userTags es el gap restante.

## Problema

- Un bot puede crear miles de documentos `userTags` por dia sin ningun control server-side, manipulando los votos de tags a escala (6 tagIds predefinidos x 40 negocios = 240 combinaciones, repetibles si se borran y recrean).
- No hay tracking de escrituras ni contadores para `userTags`, lo que significa que `dailyMetrics` no refleja la actividad real de esta coleccion y el admin dashboard no tiene visibilidad sobre el volumen de uso.
- La coleccion tiene `keys().hasOnly()` en Firestore rules (campo whitelist), pero las rules no pueden implementar rate limiting -- solo los triggers server-side pueden hacerlo.

## Solucion

### S1. Crear trigger `onUserTagCreated`

Nuevo archivo `functions/src/triggers/userTags.ts` siguiendo el patron exacto de `favorites.ts` y `priceLevels.ts`:

1. Importar `checkRateLimit`, `incrementCounter`, `trackWrite`, `logAbuse` de los utils existentes.
2. En `onDocumentCreated('userTags/{docId}')`:
   - Extraer `userId` del documento creado.
   - Llamar a `checkRateLimit(db, { collection: 'userTags', limit: 100, windowType: 'daily' }, userId)`.
   - Si excede: eliminar el documento (`snap.ref.delete()`) y loggear abuso via `logAbuse`.
   - Si no excede: `incrementCounter(db, 'userTags', 1)` + `trackWrite(db, 'userTags')`.

### S2. Crear trigger `onUserTagDeleted`

En `onDocumentDeleted('userTags/{docId}')`:

1. `incrementCounter(db, 'userTags', -1)`.
2. `trackDelete(db, 'userTags')`.

### S3. Registrar en index.ts

Exportar ambos triggers desde `functions/src/index.ts` junto con los demas triggers.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| `functions/src/triggers/userTags.ts` (create + delete handlers) | P0 | S |
| Export en `functions/src/index.ts` | P0 | XS |
| Tests en `functions/src/__tests__/triggers/userTags.test.ts` | P0 | S |
| Actualizar `docs/reference/security.md` (tabla rate limits) | P1 | XS |
| Actualizar `docs/reference/features.md` (trigger count) | P1 | XS |

**Esfuerzo total estimado:** S (30-45 min)

---

## Out of Scope

- Rate limiting client-side (UI precheck) para userTags -- no es necesario dado que los tags son toggles simples, no formularios donde el usuario pierde trabajo.
- Fan-out de userTags al activity feed de seguidores -- los tags no son una accion social relevante para notificar.
- Moderacion de contenido -- userTags usan `tagId` predefinido (no texto libre), no hay nada que moderar.
- Cambios a Firestore rules -- las rules de `userTags` ya tienen `keys().hasOnly()` y ownership validation.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/triggers/userTags.ts` | Trigger | Rate limit enforcement, counter increment, abuse logging, delete tracking |
| `functions/src/__tests__/triggers/userTags.test.ts` | Test file | Nuevo |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (rate limit exceeded vs. normal, userId presente vs. ausente)
- Side effects verificados (counter increments, abuse logging, document deletion on rate limit)

### Casos a cubrir

1. **onCreate -- happy path**: documento creado sin exceder rate limit -> incrementa counter + trackWrite.
2. **onCreate -- rate limit exceeded**: checkRateLimit retorna true -> documento eliminado + logAbuse llamado + NO incrementa counter.
3. **onCreate -- sin userId**: snap sin userId -> no llama a checkRateLimit, pero si incrementa counter.
4. **onCreate -- snap null**: event.data null -> return early.
5. **onDelete -- happy path**: decrementa counter + trackDelete.

### Mock strategy

- Firestore: mock `getDb()`, `snap.ref.delete()`, `snap.data()` (patron existente en `comments.test.ts`, `commentLikes.test.ts`).
- Utils: mock `checkRateLimit`, `incrementCounter`, `trackWrite`, `trackDelete`, `logAbuse`.
- Triggers: mock `onDocumentCreated`/`onDocumentDeleted` con `vi.mock('firebase-functions/v2/firestore')`.

---

## Seguridad

- [x] Firestore rules ya validan auth, ownership, `keys().hasOnly()` y `createdAt == request.time` para `userTags`
- [ ] Rate limit server-side via `checkRateLimit()` en Cloud Function trigger (este feature)
- [ ] Abuse logging via `logAbuse()` para excesos de rate limit (este feature)
- [ ] Tracking de escrituras en `config/counters` para visibilidad en admin dashboard (este feature)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `userTags` create | Bot crea cientos de tags/dia para manipular votos | Rate limit 100/dia + delete doc si excede + logAbuse |
| `userTags` create/delete cycle | Bot alterna create/delete para evadir rate limit por doc count | `checkRateLimit` cuenta creates totales del dia (no docs actuales), asi que el ciclo no evade el limite |
| `userTags` delete flood | Bot borra tags de otros usuarios | Firestore rules ya validan ownership (`resource.data.userId == request.auth.uid`) |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #222 ratings trigger sin rate limit | Similar gap (coleccion sin rate limit server-side) | No afecta este feature, pero es el mismo patron a aplicar |
| #218 reorganizar components/menu/ | Completado | menu/ ya redistribuido en domain folders |

### Mitigacion incorporada

- Se cierra el gap de rate limiting para `userTags`, alineando esta coleccion con las demas 7 colecciones que ya tienen triggers.
- Se agrega tracking de counters para que `dailyMetrics` incluya actividad de userTags.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Tag toggle (create/delete) | write | Firestore persistent cache encola la operacion; `withOfflineSupport` en el servicio existente | Optimistic UI existente en BusinessTags |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (persistent cache en prod)
- [x] Writes: Firestore persistent cache encola escrituras offline
- [x] APIs externas: no hay APIs externas involucradas
- [x] UI: indicador de estado offline existente via `OfflineIndicator`
- [x] Datos criticos: tags cacheados como parte de `useBusinessData`

### Esfuerzo offline adicional: Ninguno

Este feature es exclusivamente server-side (Cloud Functions). No cambia nada en el flujo offline del cliente.

---

## Modularizacion y % monolitico

Este feature es 100% backend (Cloud Functions). No agrega ni modifica componentes frontend, hooks ni servicios.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no aplica -- solo Cloud Functions)
- [x] Componentes nuevos son reutilizables (no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (`functions/src/triggers/`)
- [x] Ningun archivo nuevo supera 400 lineas (estimado ~50 lineas)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Sin cambios frontend |
| Estado global | = | Sin cambios frontend |
| Firebase coupling | = | Trigger usa utils existentes del backend |
| Organizacion por dominio | = | Archivo en `functions/src/triggers/` (ubicacion correcta) |

---

## Success Criteria

1. Un bot que intente crear mas de 100 userTags por dia ve sus documentos eliminados automaticamente a partir del documento 101.
2. El abuso se registra en `abuseLogs` y es visible en el panel admin de alertas.
3. Los counters de `userTags` se reflejan en `config/counters` y en `dailyMetrics`.
4. Los tests cubren >= 80% del codigo nuevo con los 5 casos listados.
5. La tabla de rate limits en `docs/reference/security.md` incluye `userTags | 100/dia por usuario`.
