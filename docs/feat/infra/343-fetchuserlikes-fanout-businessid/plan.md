# Plan: fetchUserLikes fan-out → query-by-businessId (cerrar guard #302 R3)

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-12
**Issue:** #343

> Basado en `specs.md` (VALIDADO CON OBSERVACIONES por Diego, 2026-06-12) y `prd.md` (VALIDADO CON OBSERVACIONES por Sofia, 2026-06-10).

---

## Orden de rollout obligatorio (gate de Diego)

El feature toca schema + rules + query + datos historicos. El orden de despliegue **no es opcional** — invertirlo deja la query nueva devolviendo vacio o las rules rechazando writes. Cada paso es reversible.

```
(1) Indice compuesto   → deploy firestore.indexes.json
(2) Rules              → deploy firestore.rules (businessId en hasOnly + isValidBusinessId)
(3) Codigo             → merge + deploy de la firma nueva + query directa + offline handler
(4) Backfill           → scripts/backfill-commentlikes-businessid.mjs --audit, validar conteo, luego --apply
```

**Por que ese orden:**

| Si se despliega antes... | Consecuencia |
|--------------------------|--------------|
| Codigo (3) antes de Rules (2) | El `setDoc` con `businessId` es rechazado por `hasOnly()` viejo → todo like nuevo falla |
| Codigo (3) antes de Indice (1) | La query `where(userId)+where(businessId)` lanza `failed-precondition` (indice faltante) |
| Backfill (4) antes de Rules (2)/Codigo (3) | Backfill corre con Admin SDK (bypasea rules) — tecnicamente posible, pero deja docs con `businessId` que el codigo viejo ignora; sin valor hasta que (3) este live |

**Window de degradacion suave (documentado en specs S3):** entre el deploy del codigo (3) y el fin del `--apply` (4), los likes legacy (sin `businessId`) **no aparecen** en la query nueva → el usuario ve un like propio antiguo como "no le di me gusta". Es un estado **transitorio y no destructivo**: el dato del like sigue existiendo, solo no se resuelve hasta el backfill. Mitigacion operativa: correr `--apply` **inmediatamente** despues del deploy del codigo para minimizar el window (orden de minutos). Re-like en ese intervalo auto-backfillea via `setDoc` idempotente (con re-dispatch de trigger aceptado, ver specs Cloud Functions).

### Gap critico F2→F3: la rule nueva ROMPE el codigo viejo (BLOQUEANTE)

El `hasOnly(['userId','commentId','businessId','createdAt'])` de F2 **exige** `businessId` (ademas, `isValidBusinessId(request.resource.data.businessId)` falla si el campo esta ausente). Pero el codigo de F3 (el que escribe `businessId`) todavia no esta live. Resultado: **entre el deploy de Rules (2) y el deploy de Codigo (3), todo like nuevo del codigo viejo —que escribe solo 4 campos sin `businessId`— es rechazado por la rule.** Esto NO es el "window de degradacion suave" (ese es de lectura/visual y empieza en F3); este es un window de **escritura rota** que empieza en F2.

**Por que no se puede cerrar haciendo la rule opcional:** una rule transitoria que acepte `businessId` ausente (`!('businessId' in request.resource.data) || isValidBusinessId(...)`) re-abre la puerta a escribir likes sin `businessId` mientras este live → contamina datos durante el window y obliga a un segundo backfill. Se descarta.

**Mitigacion adoptada — minimizar y secuenciar el window F2→F3:**

1. **F2 y F3 se despliegan en la misma ventana operativa, consecutivos, F2 primero.** No se deja correr produccion con la rule de F2 y el codigo de F3 sin desplegar mas alla del tiempo de un deploy (orden de minutos). El indice de F2 SI debe estar `Enabled` antes (puede tardar) — por eso se deploya el indice primero (puede adelantarse dias, es aditivo), y recien cuando el indice esta `Enabled` se hace el par consecutivo **rules → codigo**.
2. **Secuencia operativa exacta:**
   - (a) `firebase deploy --only firestore:indexes` → esperar `Enabled` (puede ser dias antes; aditivo, no rompe nada).
   - (b) Con el indice ya `Enabled`: `firebase deploy --only firestore:rules` **e inmediatamente despues** deploy del codigo de F3. Ventana de escritura rota = duracion entre ambos deploys (minutos).
   - (c) `--audit`/`--apply` del backfill (F4).
3. **Consecuencia aceptada del window (minutos):** un usuario que likee un comentario en la ventana exacta entre (b)-rules y (b)-codigo recibe un error de permisos en ese `setDoc`. El offline handler reintenta; al reintentar con el codigo ya live (3-arg), el `setDoc` incluye `businessId` y pasa. Sin perdida de dato, sin corrupcion. Window de minutos, no de backfill.

> **Implicancia para F2 (paso de deploy) y F3 (deploy inmediato):** el "deploy inmediato" de F3 ya NO es solo para minimizar el window de lectura — es **obligatorio** para cerrar el window de escritura rota abierto por F2. El indice se adelanta; rules+codigo van juntos y consecutivos.

---

## Staging de riesgo

| Fase | Riesgo | Esfuerzo | Notas |
|------|--------|----------|-------|
| F1 — Type + converter + seeds (S1 parcial) | Bajo | S (~0.5d) | Cambio de tipos/datos local; sin efecto runtime hasta F2-F4 |
| F2 — Rules + indice (S1/S2 parcial, deploy) | Medio | M (~1d) | Indice nuevo es aditivo; la rule NO es aditiva (el `hasOnly` nuevo exige `businessId`, ver gap F2→F3 abajo). Reversible. **Se despliega antes que el codigo**. Esfuerzo incluye el suite de rules tests nuevo |
| F3 — Codigo: write con businessId + query directa + offline handler (S1/S2) | Medio | L (~1.5d) | Elimina `fetchUserLikes` + reescribe 4 tests; toca 3 services + hook + offline handler; abre el window de degradacion suave hasta el backfill |
| F4 — Backfill (S3) | Alto | M (~1d) | Script nuevo + test; toca toda la coleccion `commentLikes` una vez. `--audit` obligatorio antes de `--apply`; ventanear si excede cap (el ventaneo puede extender el calendario, no el esfuerzo) |
| F5 — Docs (obligatoria) | Bajo | S (~0.5d) | Cierre de guard #302 R3 + reference docs |

> **Leyenda esfuerzo:** S = chico (<= 0.5 dia), M = medio (~1 dia), L = grande (~1.5 dias). Estimacion de ingenieria para un owner (nico); excluye tiempos de espera de deploy (indice `Enabled`) y de ventaneo de backfill, que son calendario operativo, no esfuerzo. Total ingenieria ~4.5 dias.

---

## File ownership por agente

| Agente | Archivos | Fase |
|--------|----------|------|
| **nico** (data/services/backend) | `src/types/business.ts`, `src/config/converters/businessConverters.ts`, `src/services/comments.ts`, `src/services/businessData.ts`, `src/services/registerOfflineHandlers.ts`, `src/hooks/useCommentListBase.ts`, `firestore.rules`, `firestore.indexes.json`, `scripts/backfill-commentlikes-businessid.mjs`, `scripts/seed-admin-data.mjs`, `scripts/seed-staging.ts`, `src/components/admin/perf/perfHelpers.ts`, todos los tests asociados | F1-F4 |
| **luna** (UI) | — (sin cambios de UI; el toggle ya existe) | — |
| **deploy/operativo** (humano con `gcloud`/`firebase`) | deploy de indice, rules, ejecucion de backfill `--audit`/`--apply` | F2, F4 |

> Todo el codigo es service-layer / scripts / rules → ownership de **nico**. No hay trabajo de **luna** (sin cambios de markup ni a11y, confirmado en specs "Componentes" y "Accesibilidad"). Es un feature de un solo owner; las fases se ordenan por dependencia, no por handoff entre agentes.

---

## Fases de implementacion

### Fase 1 — Schema local: type + converter + seeds (sin runtime aun)

**Branch:** `feat/343-commentlikes-businessid`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/business.ts` | Agregar `businessId: string` a la interface `CommentLike` |
| 2 | `src/config/converters/businessConverters.ts` | `commentLikeConverter`: agregar `businessId` en `toFirestore` y leerlo en `fromFirestore` (ver specs) |
| 3 | `src/config/converters/businessConverters.test.ts` | Ampliar el round-trip de `commentLikeConverter` para cubrir `businessId` (toFirestore incluye, fromFirestore lee) |
| 4 | `scripts/seed-admin-data.mjs` | Capturar `businessId` del comment en `commentIds.push({ id, userId, businessId })` (linea ~232) y propagarlo al `setDoc` del like (linea ~281). Idem bloque replies si se likean |
| 5 | `scripts/seed-staging.ts` | Like: agregar `businessId: BUSINESS_IDS[i % BUSINESS_IDS.length]` (commentId sintetico → solo necesita `biz_NNN` valido) |

- **Test:** `businessConverters.test.ts` verde. Los seeds actualizados se EDITAN en F1 pero se EJECUTAN recien tras F2 (la rule vieja rechaza el campo `businessId` extra via `hasOnly`).
- **Commit:** `feat(#343): CommentLike.businessId — type, converter y seeds`
- **Rollback:** revert del commit; tipos/converter/seeds vuelven a 4 campos.

### Fase 2 — Rules + indice (deploy, ANTES del codigo)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Reemplazar `match /commentLikes/{docId}` (lineas ~172-185): `hasOnly(['userId','commentId','businessId','createdAt'])`, `isValidBusinessId(request.resource.data.businessId)`, conservar `userId == auth.uid` / `commentId.size() > 0` / `createdAt == request.time`. Eliminar el comentario obsoleto (lineas ~173-175) sobre la imposibilidad de `resource.data` checks |
| 2 | `firestore.indexes.json` | Agregar indice `commentLikes(userId ASC, businessId ASC)`, scope `COLLECTION`. Conservar el indice `(userId, createdAt)` existente (aditivo) |
| 3 | `tests/rules/commentLikes.rules.test.ts` (nuevo) | ALLOW create owner + `businessId` valido + `commentId` no vacio + `createdAt==request.time`; DENY `businessId` invalido / ausente / campo extra / `userId != auth.uid` / `createdAt != request.time`; ALLOW delete owner; DENY delete no-owner; ALLOW read autenticado |
| 4 | (deploy) | `firebase deploy --only firestore:indexes` y esperar a que el indice quede `Enabled`. Luego `firebase deploy --only firestore:rules`. Validar seeds actualizados (F1) contra emulador con rules nuevas |

- **Test:** `commentLikes.rules.test.ts` verde contra emulador (`@firebase/rules-unit-testing` v5, helpers de `tests/rules/setup.ts`).
- **Commit:** `feat(#343): rules + indice compuesto commentLikes(userId, businessId)`
- **Rollback:** revert de rules (vuelve a `hasOnly` sin `businessId`); el indice nuevo es aditivo y puede dejarse (no molesta) o borrarse. Reglas reversibles sin perdida de datos.
- **Riesgo de orden:** este deploy NO debe mergear/desplegarse junto al codigo de F3 — debe estar live primero. Si CI despliega rules+codigo en el mismo pipeline, separar en dos PRs o gatear el deploy de F3.

### Fase 3 — Codigo: write con businessId + query directa + offline handler

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/comments.ts` | `likeComment(userId, commentId, businessId)`: agregar 3er arg y escribir `businessId` en el `setDoc`. `unlikeComment` sin cambio |
| 2 | `src/hooks/useCommentListBase.ts` | call site (~linea 116-122): `onlineAction` pasa `businessId` a `likeComment(user.uid, commentId, businessId)` (`businessId` ya esta en el closure scope, dependencia listada) |
| 3 | `src/services/registerOfflineHandlers.ts` | Handler `comment_like` (~linea 83-87): destructurar `{ userId, businessId, payload }` de `OfflineAction` y pasar `action.businessId` como 3er arg a `likeComment`. `comment_unlike` sin cambio. `CommentLikePayload` NO cambia |
| 4 | `src/services/businessData.ts` | En `fetchBusinessData`: agregar la query directa de likes como octavo elemento del `Promise.all` (`measuredGetDocs('businessData_userLikes', query(...where(userId)...where(businessId)...))`); mapear a `Set` desde `d.data().commentId`. Eliminar la llamada post-`Promise.all` a `fetchUserLikes` (linea 148) |
| 5 | `src/services/businessData.ts` | En `fetchSingleCollection` case `'comments'` (linea ~72): reemplazar `fetchUserLikes(...)` por la misma query directa filtrada por `(userId, businessId)`. Shape de retorno `{ comments, userCommentLikes }` sin cambio |
| 6 | `src/services/businessData.ts` | Eliminar la funcion `fetchUserLikes` (lineas 21-50) e importar `commentLikeConverter` desde `../config/converters` |
| 7 | `src/components/admin/perf/perfHelpers.ts` | Agregar `businessData_userLikes: 'Detalle: likes del usuario'` a `QUERY_LABELS` (cierra parte de #347) |
| 8 | `src/services/comments.test.ts` | Actualizar cases que llaman `likeComment` con 2 args → 3 args; assertion de que el `setDoc` payload incluye `businessId` |
| 9 | `src/services/businessData.test.ts` | **Actualizar/eliminar los 4 tests de `fetchUserLikes`** (gate Diego, ver detalle abajo) |
| 10 | `src/services/businessData.test.ts` | Agregar `commentLikeConverter: {}` al `vi.mock('../config/converters')` (hoy falta — linea 27-34); la query nueva lo importa. Nuevos cases de query directa |
| 11 | tests de `registerOfflineHandlers` | Assertion explicita: `comment_like` replay pasa `action.businessId` como 3er arg a `likeComment` |

**Detalle de los 4 tests de `fetchUserLikes` a actualizar (gate Diego, businessData.test.ts):**

| # | Test actual | Accion |
|---|-------------|--------|
| 1 | `describe('fetchUserLikes — measureAsync instrumentation')` → `wraps Promise.all of batches...` (l.138) | **Eliminar** (funcion ya no existe) |
| 2 | idem → `short-circuits ... when commentIds is empty` (l.145) | **Eliminar** → reemplazar por: "lista de comentarios vacia → query directa devuelve Set vacio sin romper" |
| 3 | idem → `returns a Set of comment ids that have likes` (l.152) | **Reescribir** como test de la query directa: `Set` derivado de `d.data().commentId` (no del doc id `split`) |
| 4 | idem → `splits 35 ids into 2 batches (30 + 5)` (l.168) | **Eliminar** (ya no hay batching; 1 sola query) |
| (+) | `comments case ... fires fetchUserLikes if ids present` (l.116) y su assertion `measureAsync ... businessData_userLikes` (l.129) | **Actualizar**: ahora `fetchSingleCollection('comments')` resuelve likes via `measuredGetDocs('businessData_userLikes', ...)` — cambiar la assertion de `mockMeasureAsync` a `mockMeasuredGetDocs` |

> El case de `fetchBusinessData` (l.60) debe pasar a esperar `businessData_userLikes` en `mockMeasuredGetDocs` (octava query del `Promise.all`).

- **Test:** suite completa de `businessData.test.ts`, `comments.test.ts`, `businessConverters.test.ts`, `registerOfflineHandlers` verde; cobertura >= 80% del codigo nuevo; verificar que no quedan referencias a `fetchUserLikes` (`grep -rn fetchUserLikes src/`).
- **Commit:** `feat(#343): query directa commentLikes(userId, businessId) + elimina fetchUserLikes (cierra guard #302 R3)`
- **Rollback:** revert del commit. Restaura `fetchUserLikes` y el fan-out. Las rules/indice de F2 quedan (aditivos, no rompen el codigo viejo). El `businessId` en docs nuevos escritos durante el window queda inerte para el codigo viejo (lo ignora) — sin corrupcion.
- **Deploy:** correr **inmediatamente** despues del merge para minimizar el window de degradacion suave antes de F4.

### Fase 4 — Backfill de docs legacy

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `scripts/backfill-commentlikes-businessid.mjs` (nuevo) | Patron de `migrate-displayname-lower-sync.mjs`: modos `--audit`/`--apply`, Admin SDK via ADC, CLI gateado por `import.meta.url`, primitivas exportadas (`parseMode`, `getDb`, `audit`, `applyBackfill`, `printAuditReport`, `run`), `BATCH_SIZE=500`, reads de comments via `db.getAll()` en chunks de 30 |
| 2 | `scripts/backfill-commentlikes-businessid.mjs` | `audit(db)`: clasificar `withBusinessId` (skip) / `toBackfill` (comment existe → `{likeId, businessId}`) / `orphan` (comment borrado → `{likeId}`). Reportar `total`, `withBusinessId`, `toBackfill`, `orphan` y la linea explicita del cap: `"Legacy docs a escribir: <N>. Cap free tier writes/dia: 20000. Ventanear si N supera el cap."` |
| 3 | `scripts/backfill-commentlikes-businessid.mjs` | `applyBackfill(db, plan)`: `toBackfill` → `batch.update(ref, {businessId})`; `orphan` → `batch.delete(ref)`; commit cada 500 ops; idempotente (re-run = 0 ops) |
| 4 | `scripts/__tests__/backfill-commentlikes-businessid.test.mjs` (nuevo) | `--audit` no escribe; clasificacion correcta; chunking `getAll` en grupos de 30; `applyBackfill` setea `businessId`; orphan se elimina; idempotencia (re-run = 0 ops); reporte imprime conteo de legacy docs |
| 5 | (operativo) | **Correr `--audit` PRIMERO** (gate Diego). Leer el reporte: si `toBackfill + orphan` supera el cap de writes/dia (20000), **ventanear** el `--apply` (multiples dias o pausas entre lotes). Solo entonces correr `--apply` |

- **Test:** `backfill-commentlikes-businessid.test.mjs` verde (db fake inyectado, sin emulador, patron del test de `migrate-displayname-lower-sync`).
- **Commit:** `feat(#343): script backfill commentlikes businessId (--audit/--apply, orphan cleanup)`
- **Rollback:** el `--apply` setea un campo y borra orphans — el set de `businessId` es idempotente y no destructivo. Los orphans borrados eran likes sin comentario (no leibles por ninguna query) → su borrado es seguro y no necesita rollback. Si el `--apply` se interrumpe, re-correrlo lo completa (idempotente).
- **Gate operativo:** NO correr `--apply` sin haber leido el reporte de `--audit` y validado el conteo contra el cap.

### Fase 5 — Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Campo `businessId` en `commentLikes` + indice nuevo `(userId, businessId)` |
| 2 | `docs/reference/security.md` | Fila `commentLikes` en tabla de rules: `businessId` en `hasOnly()` + `isValidBusinessId()` |
| 3 | `docs/reference/patterns.md` | Reemplazar entry "Batched likes" por "query directa por (userId, businessId)" |
| 4 | `docs/reference/guards/302-performance.md` | Marcar R3 como **cumplido** (fan-out eliminado, query directa) |
| 5 | `docs/reference/tests.md` | Marcar checkbox allow+deny de `commentLikes` en inventario de rules tests |
| 6 | `docs/_sidebar.md` | Agregar entradas Specs/Plan bajo la seccion `infra` (#343) |

- **Commit:** `docs(#343): firestore/security/patterns + cierre guard #302 R3`
- **Rollback:** revert del commit de docs.

---

## Orden de implementacion (cadena de dependencias)

1. **F1** — type + converter + seeds (editar, no ejecutar seeds aun).
2. **F2** — rules + indice → **deploy** (indice `Enabled`, luego rules). Validar seeds contra emulador.
3. **F3** — codigo (write 3-arg, offline handler, query directa, borrar `fetchUserLikes`, perf label) + tests → merge + **deploy inmediato**.
4. **F4** — `--audit` → validar conteo → `--apply` (ventanear si excede cap).
5. **F5** — docs + sidebar + cierre guard.

> F1 puede solaparse con F2 en el mismo PR (ambos son "preparacion" sin runtime), pero el **deploy** de F2 debe preceder al **deploy** de F3. F4 depende del deploy de F3 (codigo live). F5 al final.

---

## Merge / PR strategy

El gap F2→F3 (ver "Gap critico F2→F3" arriba) impone que rules y codigo **no compartan un deploy automatico que los publique juntos sin orden**. Para que el orden de deploy sea explicito y auditable, se separa en PRs:

| PR | Fases | Contenido | Gate de merge | Deploy disparado |
|----|-------|-----------|---------------|------------------|
| **PR-1** | F1 + F2 | Type + converter + seeds + rules + indice + rules tests | CI verde (lint, build, rules tests, converter test) | `firestore:indexes` primero (esperar `Enabled`), luego `firestore:rules`. **NO** mergear PR-2 hasta que el indice este `Enabled` |
| **PR-2** | F3 | Codigo (3-arg, query directa, offline handler, borrar `fetchUserLikes`, perf label) + tests | CI verde + indice de PR-1 `Enabled` + rules de PR-1 ya live | Deploy de codigo **inmediatamente** tras merge (cierra el window de escritura rota abierto por las rules de PR-1) |
| **PR-3** | F4 + F5 | Script backfill + test + docs + sidebar + cierre guard | CI verde; el script NO corre en CI | `--audit`/`--apply` operativo (humano) tras confirmar PR-2 live |

**Reglas de la estrategia:**

- **PR-1 y PR-2 NO se mergean juntos ni en cadena automatica.** Entre el merge/deploy de PR-1 (rules) y el merge/deploy de PR-2 (codigo) hay un window de escritura rota (minutos) que se cierra desplegando PR-2 inmediatamente. El indice de PR-1 se adelanta (puede tardar dias en `Enabled`); rules + codigo van consecutivos una vez el indice esta listo.
- **Si el pipeline de CI despliega rules automaticamente al mergear:** PR-1 debe mergearse en una ventana coordinada con la persona que despliega PR-2, o gatear el deploy de rules para que sea manual. Confirmar el comportamiento del pipeline antes de mergear PR-1.
- **PR-3 (backfill) NO bloquea la disponibilidad del feature**, pero el feature queda en "window de degradacion suave de lectura" hasta que `--apply` termine. Mergear y correr PR-3 lo antes posible tras PR-2 live.
- Cada PR es revertible de forma independiente (ver "Rollback" de cada fase).

### Base branch

- **Base branch de los 3 PRs: `new-home`** (NO `main`). El repo esta trabajando sobre `new-home` como integracion activa; `main` es el branch por defecto pero el trabajo en curso vive en `new-home`. Las feature branches (`feat/343-commentlikes-businessid` y derivadas por PR) parten de `new-home` y apuntan su PR a `new-home`.
- Confirmar con el delivery lead que `new-home` sigue siendo el target de integracion al momento de abrir los PRs (si `new-home` ya se mergeo a `main`, rebasear sobre `main`).

---

## Test plan global

| Archivo | Que valida | Fase |
|---------|-----------|------|
| `businessConverters.test.ts` | round-trip `businessId` en `commentLikeConverter` | F1 |
| `commentLikes.rules.test.ts` (nuevo) | allow+deny create/delete/read con `businessId` | F2 |
| `comments.test.ts` (16 cases) | `likeComment` 3-arg escribe `businessId` | F3 |
| `businessData.test.ts` | query directa → `Set` desde `d.data().commentId`; lista vacia; `fetchSingleCollection('comments')`; **4 tests de `fetchUserLikes` actualizados/eliminados**; mock `commentLikeConverter` agregado | F3 |
| `registerOfflineHandlers` test | replay `comment_like` pasa `action.businessId` (3er arg) | F3 |
| `backfill-commentlikes-businessid.test.mjs` (nuevo) | audit no escribe; clasificacion; chunking 30; apply setea businessId; orphan delete; idempotencia; reporte de conteo | F4 |

- Verificacion de eliminacion: `grep -rn "fetchUserLikes" src/` debe devolver 0 matches tras F3.
- Cobertura >= 80% del codigo nuevo (CI gate).
- `npm run lint` + `npm run build` verde.

---

## Riesgos

1. **Despliegue fuera de orden (indice/rules/codigo).** Si el pipeline despliega F3 antes que F2, todo like nuevo falla (rule) o la query lanza `failed-precondition` (indice). **Mitigacion:** separar F2 y F3 en deploys distintos; F2 debe estar live y el indice `Enabled` antes de mergear F3.
2. **Window de degradacion suave visible al usuario.** Entre deploy de F3 y fin de `--apply`, likes legacy aparecen como "no likeado". **Mitigacion:** correr `--apply` inmediatamente post-deploy; el dato no se pierde (transitorio); re-like auto-backfillea.
3. **Volumen del backfill excede cap de writes/dia.** **Mitigacion:** `--audit` obligatorio antes de `--apply` (gate Diego); ventanear si `toBackfill + orphan` > 20000.
4. **Test `businessData.test.ts` con mock incompleto.** El `vi.mock('../config/converters')` actual NO incluye `commentLikeConverter` — la query nueva lo importa. **Mitigacion:** agregarlo al mock (F3 paso 10) o el import rompe el test.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — todo en `services/` y `scripts/` (Admin SDK).
- [x] Archivos en carpeta de dominio correcta (`services/`, `config/converters/`, `types/business.ts`, `scripts/`).
- [x] Logica en services/scripts, no en componentes.
- [x] Se ELIMINA `fetchUserLikes` (reduce superficie) — no agrava deuda.
- [x] Script de backfill < 400 lineas (patron `migrate-displayname-lower-sync.mjs`).
- [x] No se agregan barrels ni god-context.

## Guardrails de seguridad

- [x] Create rule tiene `hasOnly(['userId','commentId','businessId','createdAt'])`.
- [x] Cada campo validado: `userId == auth.uid`, `commentId is string` + `.size() > 0`, `businessId` via `isValidBusinessId()`, `createdAt == request.time`.
- [x] `businessId` string con patron (`isValidBusinessId` regex `biz_NNN`).
- [x] No hay update rule (solo create/delete) → `businessId` inmutable por construccion.
- [x] Rate limit 50/dia en `onCommentLikeCreated` (`snap.ref.delete()` al exceder) — intacto.
- [x] Coleccion ya tiene trigger con rate limit (sin cambios).
- [x] Backfill corre con ADC, sin Service Account keys en disco.
- [x] Query siempre filtra `userId == auth.uid` → sin scraping de likes ajenos.

## Guardrails de observabilidad

- [x] Query nueva usa `measuredGetDocs('businessData_userLikes', ...)`.
- [x] `businessData_userLikes` agregada a `QUERY_LABELS` (cierra parte de #347).
- [x] Sin `trackEvent` nuevo (`comment_like` ya en GA4 definitions).
- [x] Trigger conserva `trackFunctionTiming` (no se toca).
- [x] `logger.error` del script no envuelto en `if (DEV)`.

## Guardrails de copy

- [x] Sin copy user-facing nuevo (toasts de like ya en `MSG_COMMENT`).
- [x] Logs/comentarios del script en espanol; label de perf en espanol ("Detalle: likes del usuario").
- [x] Terminologia: "comercios", "comentarios", "me gusta".

## Criterios de done

- [ ] Schema: `CommentLike.businessId` en type + converter + seeds (F1).
- [ ] Rules + indice desplegados, allow+deny verde (F2).
- [ ] `likeComment` 3-arg, query directa, `fetchUserLikes` eliminada, offline handler propaga `businessId` (F3).
- [ ] 4 tests de `fetchUserLikes` actualizados/eliminados; suite verde >= 80% cobertura nuevo (F3).
- [ ] Backfill `--audit` corrido y conteo validado contra cap; `--apply` completado e idempotente (F4).
- [ ] Guard #302 R3 marcado como cumplido.
- [ ] Reference docs actualizados (firestore, security, patterns, tests) + sidebar (F5).
- [ ] No lint errors; build succeeds; `grep fetchUserLikes src/` = 0.

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Cerrado en esta iteracion:**
- BLOQUEANTE #1 "Gap F2→F3 rules-nuevas/codigo-viejo no contemplado" → resuelto: nueva subseccion "Gap critico F2→F3" nombra el window de escritura rota (distinto del window de lectura), descarta la rule opcional transitoria, y fija la secuencia operativa indice-Enabled → rules+codigo consecutivos (minutos). Corregida la etiqueta "Aditivo" de F2 en Staging de riesgo.
- IMPORTANTE #2 "Merge/PR strategy fase→PR no explicita" → resuelto: nueva seccion "Merge / PR strategy" con 3 PRs (PR-1=F1+F2, PR-2=F3, PR-3=F4+F5), gates de merge y regla explicita de no-cadena PR-1/PR-2.
- IMPORTANTE #3 "Estimacion de esfuerzo por fase ausente" → resuelto: columna Esfuerzo (S/M/L con dias) en Staging de riesgo; total ~4.5d ingenieria, coherente con "M" del PRD (F3 es el L dominante).
- OBSERVACION #4 "Base branch no especificado" → resuelto: subseccion "Base branch" fija `new-home` como base de los 3 PRs.

**Observaciones para el implementador:**
- El window de escritura rota F2→F3 es operativo, no de codigo: depende de que quien despliega coordine rules+codigo en la misma ventana (minutos) DESPUES de que el indice este `Enabled`. Confirmar ANTES de mergear PR-1 si el pipeline de CI despliega rules automaticamente al mergear — si lo hace, gatear ese deploy o coordinar la ventana con quien mergea PR-2.
- Correr `backfill --audit` y validar el conteo de legacy docs contra el cap de writes/dia (20000) ANTES de `--apply`; ventanear si excede. Gate operativo, no automatizable en CI.
- F3 es la fase pesada (L, ~11 pasos: 3 services + hook + offline handler + 4 tests reescritos + perf label). Verificar `grep -rn fetchUserLikes src/` = 0 tras F3 antes de cerrar la fase.
- Ownership de un solo agente (nico); sin paralelismo ni overlap de archivos → sin riesgo de conflicto de merge entre agentes.

**Listo para pasar a implementacion:** Si, con observaciones (el orden de deploy F2→F3 es el unico punto que requiere disciplina operativa; el resto es mergeable de forma independiente por PR).
