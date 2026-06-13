# PRD: fetchUserLikes fan-out → query-by-businessId (cerrar guard #302 R3)

**Feature:** 343-fetchuserlikes-fanout-businessid
**Categoria:** infra
**Fecha:** 2026-06-09
**Issue:** #343
**Prioridad:** Alta (HIGH segun /health-check)

---

## Contexto

`fetchBusinessData` (`src/services/businessData.ts`) carga las 7 queries del business view en un `Promise.all`, pero los likes del usuario sobre los comentarios se resuelven **despues** del `Promise.all` via `fetchUserLikes(uid, commentIds)`, que mapea cada `commentId` a `${uid}__${cId}` y hace batches de `where(documentId(), 'in', batch)` (30/batch). El guard `#302 R3` (`docs/reference/guards/302-performance.md`) exige exactamente lo contrario: una sola query directa filtrada por `(userId, businessId)` dentro del `Promise.all`. El patron actual viola el guard porque el schema no lo permite: `likeComment` escribe solo `{userId, commentId, createdAt}` (sin `businessId`) y el unico indice de `commentLikes` es `(userId, createdAt)`.

## Problema

- **Waterfall de RTT:** `fetchUserLikes` corre serialmente despues del `Promise.all` principal, sumando 150-300ms en 3G por cada apertura de comercio (el costo crece con la cantidad de comentarios: `ceil(N/30)` reads extra).
- **Viola guard #302 R3:** el guard esta `Active desde v2.36.0` y documenta el fix exacto requerido (campo `businessId` en el doc + indice compuesto + firma `likeComment(userId, commentId, businessId)` + query directa en el `Promise.all`). Hoy el codigo esta en estado prohibido y solo no rompe CI porque el fix nunca se aplico.
- **Imposible de optimizar sin cambio de schema:** los docs `commentLikes` existentes no tienen `businessId`, asi que una query `where('businessId','==',bId)` devolveria vacio para todo el historial. Requiere agregar el campo al write, crear el indice compuesto, y backfillear los docs existentes — los tres en conjunto, o la query nueva devuelve datos incompletos.

## Solucion

### S1 — Schema: agregar `businessId` al write de `commentLikes`

- Extender `likeComment(userId, commentId)` → `likeComment(userId, commentId, businessId)` en `src/services/comments.ts`. El doc pasa a escribir `{userId, commentId, businessId, createdAt}`.
- `businessId` ya esta disponible en todos los call sites: `useCommentListBase.ts` ya pasa `businessId`/`businessName` a `withOfflineSupport` (lineas 116-120). El handler offline `comment_like` en `registerOfflineHandlers.ts` recibe `businessId` en el `OfflineAction` (campo top-level requerido), por lo que el payload no necesita cambiar — el handler debe pasar `action.businessId` a `likeComment`.
- Actualizar `firestore.rules` `match /commentLikes/{docId}`: agregar `businessId` al `keys().hasOnly([...])` y validar con `isValidBusinessId(request.resource.data.businessId)` (helper ya usado en `userTags`/`favorites`). El comentario obsoleto en las rules (lineas 172-175) que justifica la imposibilidad de `resource.data` checks debe reemplazarse, ya que la nueva query SI filtra por field.
- Actualizar `CommentLike` type (`src/types/business.ts`) con `businessId: string` y el `commentLikeConverter` (`src/config/converters/businessConverters.ts`) `toFirestore`/`fromFirestore`.

Patrones aplicables: `Doc ID compuesto` (patterns.md — `commentLikes` sigue usando `{userId}__{commentId}`), `Firestore rules field whitelist` (patterns.md — todo campo nuevo en el write debe estar en `hasOnly()`), `withConverter<T>()`.

### S2 — Indice compuesto + query directa (cerrar el waterfall)

- Agregar a `firestore.indexes.json`: `commentLikes(userId ASC, businessId ASC)`.
- En `fetchBusinessData`, agregar la query de likes como octavo elemento del `Promise.all`: `where('userId','==',uid)` + `where('businessId','==',bId)`, envuelta en `measuredGetDocs('businessData_userLikes', ...)`. El resultado se mapea a `Set<commentId>` directamente desde `d.data().commentId` (ya no se parsea el doc id). Esto colapsa `ceil(N/30)+1` operaciones en 1.
- Eliminar `fetchUserLikes` y su llamada post-`Promise.all` en `fetchBusinessData` y en `fetchSingleCollection` (case `comments`). El `fetchSingleCollection('comments')` debe tambien resolver los likes via la misma query directa.
- Conservar la clave de perf `businessData_userLikes`. Nota: hoy la clave existe en `businessData.ts` pero NO esta en `QUERY_LABELS` de `perfHelpers.ts` (aparece sin label en el dashboard). Aprovechar este feature para agregarla a `QUERY_LABELS` (alineado con #347, que detecta queries sin instrumentar/labelear).

**Edge — cache de `userCommentLikes`:** `readCache.ts` serializa `userCommentLikes` como `string[]` (set de commentIds) y `useBusinessData` lo mergea en refetches parciales (`merged.userCommentLikes = prev.userCommentLikes` cuando `patched.has('comments')`). La forma de este dato **no cambia** con este feature (sigue siendo un `Set<commentId>` derivado de la query) — el cambio es solo *como se obtiene* (query directa vs fan-out). No requiere invalidar cache ni migrar entries cacheadas. Verificar en specs que el shape del `Set` resultante es identico al actual para no romper el merge de `patchedRef`.

### S3 — Backfill de docs `commentLikes` existentes

- Script one-off `scripts/backfill-commentlikes-businessid.mjs`, siguiendo el patron canonico de `scripts/migrate-displayname-lower-sync.mjs`: modos `--audit` (default, read-only) y `--apply`, idempotente, Admin SDK via Application Default Credentials (ADC), primitivas exportadas para testeo, bloque CLI gateado por `import.meta.url === file://${process.argv[1]}`, batches de 500.
- Logica: por cada doc de `commentLikes` sin `businessId`, leer `comments/{commentId}.businessId` y escribir el campo. Si el comentario fue borrado (no existe), el like es huerfano — el script lo cuenta en una categoria `orphan` y en `--apply` lo **elimina** (un like sin comentario no aporta y nunca volveria a leerse por la query nueva). Agrupar los reads de `comments` con `getAll()` en chunks de 30 para evitar N+1 (mismo patron que `fanOutToFollowers` #312).
- **Orden de rollout (critico):** (1) deploy del indice compuesto, (2) deploy de rules con `businessId` en `hasOnly()` permitiendo el campo nuevo, (3) deploy del codigo con la firma nueva de `likeComment` y la query directa, (4) correr el backfill `--apply`. Hasta que el backfill termine, los likes legacy (sin `businessId`) no apareceran en la query nueva — degradacion suave: el usuario veria un like propio antiguo como "no likeado" hasta el backfill. Documentar este window en el plan.

### UX

Sin cambios visibles de UI. El toggle de like sigue siendo optimista (logica inline en `BusinessComments`/`BusinessQuestions` via `useCommentListBase`). La unica diferencia perceptible es la **mejora**: el estado "ya le diste like" aparece junto con los comentarios en vez de tras un segundo round-trip.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — `businessId` en write + rules + type + converter | Alta | S |
| S2 — indice compuesto + query directa en `Promise.all` + borrar `fetchUserLikes` | Alta | S |
| S3 — script backfill (`--audit`/`--apply`, idempotente, orphan cleanup) | Alta | M |
| Tests: businessData (query directa), comments (firma), rules allow+deny, backfill primitivas | Alta | M |
| Rollout secuenciado (indice → rules → codigo → backfill) | Alta | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Los hallazgos menores del mismo /health-check (M1 `MenuPhotoViewer` lazy, L1 `OnboardingContext` useMemo, L2 `useUserSearch` debounce cleanup, L3 `BusinessComments` virtualizacion) — son issues/tareas separadas.
- Cambiar el doc ID compuesto de `commentLikes` (sigue siendo `{userId}__{commentId}`).
- Migrar `RankingsView.tsx` y `MapView.tsx` a `getBusinessMap()` (followup pendiente de #302/#324, no relacionado a likes).
- Agregar likes a entidades distintas de comentarios (preguntas ya usan la misma coleccion `comments`, cubiertas).

---

## Tests

Politica `docs/reference/tests.md`: cobertura >= 80% del codigo nuevo, validacion de inputs, paths condicionales, side effects.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/businessData.ts` | Service | Query directa de likes dentro del `Promise.all` mapea a `Set<commentId>`; lista vacia de comentarios no dispara query innecesaria; `fetchSingleCollection('comments')` resuelve likes via query directa |
| `src/services/comments.ts` | Service | `likeComment` escribe `businessId` en el doc; firma de 3 args; `comments.test.ts` (16 cases) actualizado |
| `src/config/converters/businessConverters.ts` | Converter | `commentLikeConverter` round-trip con `businessId` (`businessConverters.test.ts` ya cubre commentLike) |
| `src/services/registerOfflineHandlers.ts` | Handler | `comment_like` replay pasa `action.businessId` a `likeComment` |
| `scripts/backfill-commentlikes-businessid.mjs` | Script | `--audit` no escribe; `--apply` setea `businessId` desde el comment; idempotencia (re-run = no-op); orphan (comment borrado) se elimina en `--apply`; chunking de reads |
| `tests/rules/commentLikes.rules.test.ts` | Firestore rules | allow create con `businessId` valido + owner + timestamp; deny si `businessId` invalido / falta / campo extra / userId != auth.uid; allow/deny delete por owner |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (lista vacia, orphan, idempotencia)
- Side effects verificados (cache, analytics `comment_like`, perf `businessData_userLikes`)
- `commentLikes` marca su checkbox allow+deny en el inventario de rules tests de `tests.md`

---

## Seguridad

- [ ] `commentLikes` create rule agrega `businessId` a `keys().hasOnly(['userId','commentId','businessId','createdAt'])`
- [ ] `businessId` validado con `isValidBusinessId()` (mismo helper que `userTags`/`favorites`/`listItems`)
- [ ] `userId == request.auth.uid` y `createdAt == request.time` se conservan
- [ ] La query nueva `where('userId','==',uid)` mantiene el aislamiento: un usuario solo lee sus propios likes (no se exponen likes ajenos)
- [ ] Comentario obsoleto en `firestore.rules` (lineas 172-175) reemplazado — ya no aplica la justificacion de "no resource.data checks"
- [ ] Rate limit server-side de `commentLikes` (50/dia) en `onCommentLikeCreated` se conserva intacto — `businessId` no altera el path del trigger
- [ ] Backfill corre con ADC (`gcloud auth application-default login`), sin Service Account keys en disco (security.md env vars #5)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Write de `commentLike` con `businessId` arbitrario | Inyectar businessId falso para envenenar la query / inflar conteos cross-business | `isValidBusinessId()` en rules (regex `biz_NNN`), rate limit 50/dia en trigger (ya existe) |
| Write con campo extra adjunto | Inyeccion de datos | `hasOnly()` whitelist estricta |
| Query masiva de likes ajenos | Scraping | Query siempre filtra `userId == auth.uid`; read rule `auth != null` ya restringe a autenticados |

(El feature escribe a Firestore — checklist):

- [ ] Create rule tiene `hasOnly()` con whitelist de campos (`userId`, `commentId`, `businessId`, `createdAt`)
- [ ] CADA campo en `hasOnly()` tiene validacion de tipo (`userId == auth.uid`, `commentId is string` + size>0, `businessId` via `isValidBusinessId`, `createdAt == request.time`)
- [ ] Campos string con limite/patron (`commentId.size() > 0`, `businessId` regex)
- [ ] No hay update rule (commentLikes solo create/delete) — no aplica `affectedKeys()`
- [ ] Campos immutables (userId, commentId, businessId) no se pueden modificar (no hay update path)
- [ ] Rate limit server-side ya existe en `onCommentLikeCreated` con `snap.ref.delete()` al exceder (no se toca)
- [ ] La coleccion ya tiene trigger con rate limit (sin cambios)
- [ ] Sin campos `is list` ni texto libre — no aplica moderacion

(No agrega campos a `userSettings`. Lee solo datos propios del usuario — no habilita scraping nuevo.)

---

## Deuda tecnica y seguridad

Consultado: `gh issue list --label security/tech debt --state open` (no hay issues con esos labels; todos los tech-debt actuales estan bajo `enhancement`). Issues abiertos relacionados al area: #347 (perf-instrumentation), #344 (offline guard en custom tags / profile), #342 (deps + secrets).

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Guard #302 R3 (`docs/reference/guards/302-performance.md`) | mitiga (este feature lo cierra) | Implementar el fix exacto documentado en el guard; marcar como cumplido |
| #347 (count queries sin `measureAsync`) | empeora si se ignora | La query nueva DEBE usar `measuredGetDocs` (`businessData_userLikes`) — no introducir otra query sin instrumentar |
| #344 (offline guard) | afecta | El path `comment_like` offline ya esta cubierto; verificar que el replay con `businessId` no rompa la cola existente |

### Mitigacion incorporada

- Cerrar guard #302 R3 (fan-out prohibido → query directa). Paso en el plan: S2.
- Instrumentar la query nueva con `measuredGetDocs` (alineado con #347). Paso en el plan: S2.
- Limpiar el comentario obsoleto en `firestore.rules`. Paso en el plan: S1.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] No se agregan hooks nuevos — `useCommentListBase` ya existe y maneja toggle/error con `try/catch` + `toast.error`
- [ ] Handlers async existentes conservan su `try/catch` (no se tocan)
- [ ] `fetchUserLikes` se elimina (funcion no exportada fuera del modulo + tests) — verificar que no quede referenciada
- [ ] No hay `setState` post-async sin guard nuevo
- [ ] El script de backfill vive en `scripts/` (no en `src/hooks/`)
- [ ] Sin nuevas keys de localStorage
- [ ] Archivos nuevos (script) no superan 400 lineas
- [ ] `logger.error` no envuelto en `if (DEV)`

### Checklist de observabilidad

- [ ] Trigger no cambia — `trackFunctionTiming` ya presente en `onCommentLikeCreated/Deleted`
- [ ] Query nueva usa `measuredGetDocs('businessData_userLikes', ...)` y la clave `businessData_userLikes` se agrega a `perfHelpers.ts:QUERY_LABELS` con label en espanol (hoy falta — ver #347)
- [ ] No hay `trackEvent` nuevo (`comment_like` ya existe en GA4 definitions)

### Checklist offline

- [ ] El toggle de like ya deshabilita/encola correctamente offline (`withOfflineSupport`) — verificar que el replay pase `businessId`
- [ ] Error handlers muestran `toast.error` en todos los environments (ya implementado en `useCommentListBase`)

### Checklist de documentacion

- [ ] No hay secciones nuevas de HomeScreen
- [ ] No hay eventos analytics nuevos
- [ ] `CommentLike` type modificado en `src/types/business.ts` (dominio correcto, no barrel)
- [ ] `docs/reference/firestore.md` actualizado: campo `businessId` en `commentLikes` + indice nuevo
- [ ] `docs/reference/patterns.md` actualizado: `Batched likes` entry (linea ~91 de project-reference) reemplazado por "query directa por (userId, businessId)"
- [ ] `docs/reference/guards/302-performance.md` R3 marcado como cumplido
- [ ] `docs/reference/security.md` tabla de rules: fila `commentLikes` actualizada con `businessId`
- [ ] `docs/reference/tests.md`: marcar checkbox allow+deny de `commentLikes` en inventario de rules

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `likeComment` (con businessId) | write | Encolar en IndexedDB via `withOfflineSupport('comment_like', {businessId}, ...)` (ya existe) | Toggle optimista local; revert on error |
| `unlikeComment` | write | Idem `comment_unlike` (ya existe) | Idem |
| Query de likes en `fetchBusinessData` | read | Persistencia offline de Firestore (prod) + readCache 3-tier de `useBusinessData` | StaleBanner si datos stale |
| Backfill | write (server, one-off) | N/A (corre con Admin SDK online) | N/A |

### Checklist offline

- [ ] Reads de Firestore: la query nueva entra al `Promise.all` que ya pasa por readCache 3-tier de `useBusinessData`
- [ ] Writes: el like ya tiene queue offline; el replay debe propagar `businessId`
- [ ] APIs externas: N/A
- [ ] UI: el indicador offline existente del toggle se conserva
- [ ] Datos criticos: los likes se cachean junto al resto del business data

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica en services (`businessData.ts`, `comments.ts`) — no en componentes de layout
- [ ] No se agregan componentes nuevos
- [ ] No se agregan useState a AppShell/SideMenu
- [ ] Firebase SDK solo en services/ y scripts/ (Admin SDK) — no en components/
- [ ] El script de backfill no es un hook (vive en `scripts/`)
- [ ] No se crean barrels ni se appendea a barrels compartidos
- [ ] El converter modificado vive en `businessConverters.ts` (dominio correcto)
- [ ] Ningun archivo nuevo supera 400 lineas
- [ ] No se necesita estado global nuevo

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Cambio confinado a service layer; ningun componente se modifica salvo propagacion de `businessId` ya presente |
| Estado global | = | Sin contextos nuevos |
| Firebase coupling | = | Query sigue en service, no en componente; elimina una funcion (`fetchUserLikes`), reduce superficie |
| Organizacion por dominio | = | Cambios en dominio business correcto |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] No se agregan elementos interactivos nuevos (sin cambios de UI)
- [ ] El boton de like existente conserva su `aria-label` y `aria-live` en el contador
- [ ] No hay imagenes nuevas
- [ ] No hay formularios nuevos

### Checklist de copy

- [ ] Sin copy nuevo user-facing (los toasts de error de like ya existen en `MSG_COMMENT`)
- [ ] Logs y comentarios de codigo del script en espanol consistente
- [ ] Terminologia: "comercios", "comentarios", "me gusta"

---

## Success Criteria

1. Abrir un comercio con N comentarios ejecuta **1** read de `commentLikes` (no `ceil(N/30)`), medible como caida en operaciones via la clave `businessData_userLikes` del dashboard de performance.
2. El estado "ya le diste me gusta" se resuelve dentro del `Promise.all` principal (sin round-trip extra post-load).
3. Todo doc `commentLikes` nuevo incluye `businessId` valido; las rules rechazan writes sin `businessId` o con `businessId` invalido (test allow+deny verde).
4. El backfill `--apply` setea `businessId` en el 100% de los docs legacy con comentario existente, elimina los huerfanos, y es idempotente (re-run = 0 writes).
5. Guard #302 R3 cumplido: `fetchUserLikes` eliminado y la query directa es la unica via de lectura de likes; CI de cobertura >= 80% verde.

---

## Validacion Funcional

**Analista**: Sofia (checklist aplicado por prd-writer — el agente subagente no es spawneable en este contexto; se ejecutaron las verificaciones `grep`/`ls` de Ciclo 1 contra el codebase)
**Fecha**: 2026-06-09
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos cerrados en esta iteracion

- IMPORTANTE: "clave de perf afirmada como registrada sin verificar" → corregido en S2 y checklist de observabilidad: `businessData_userLikes` NO esta en `QUERY_LABELS`; se agrega como parte del feature (verificado con `grep` en `perfHelpers.ts`).
- IMPORTANTE: "interaccion con readCache y merge de refetch parcial no documentada" → agregado edge en S2 explicando que el shape del `Set<commentId>` no cambia, no requiere invalidar cache (verificado en `readCache.ts:22/115` y `useBusinessData.ts:126`).
- BLOQUEANTE potencial: "que ven los usuarios con likes legacy durante el rollout (backwards compat de docs sin `businessId`)" → resuelto en S3: window de degradacion suave documentado (like antiguo aparece como "no likeado" hasta el backfill), con orden de rollout secuenciado y reversible.

### Verificaciones de Ciclo 1 ejecutadas

- `isValidBusinessId()` existe en `firestore.rules` (linea 12, usado en 8 colecciones) — confirmado.
- `businessId` ya disponible en todos los call sites de like (`useCommentListBase.ts:116-120`, `OfflineAction` top-level) — confirmado, sin cambio de payload.
- No quedan otros consumidores de `fetchUserLikes` fuera de `businessData.ts` — confirmado.

### Observaciones abiertas para el implementador

- Free tier billing: el feature **reduce** reads (de `ceil(N/30)+1` a 1 por apertura de comercio). Riesgo de billing nulo. El write de like suma un campo, no un doc — sin impacto en write count.
- El backfill toca toda la coleccion `commentLikes` una vez. En `--apply`, contar el volumen en `--audit` antes para estimar si supera el cap de writes/dia del tier (batches de 500, eventualmente correr en ventanas si el volumen es alto). Decision operativa para el plan.
- Race entre dos tabs/devices likeando el mismo comentario: el doc ID compuesto `{userId}__{commentId}` ya garantiza idempotencia (setDoc); sin cambio de comportamiento.


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** El handler offline comment_like destructura {userId,payload} y NO extrae businessId — debe pasar action.businessId. Re-like durante el window de backfill re-dispara onCommentLikeCreated (notif duplicada + rate limit). El --audit debe reportar el conteo de docs legacy.
