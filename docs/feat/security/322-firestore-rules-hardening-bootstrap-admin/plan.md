# Plan: Firestore rules type guards + bootstrap admin gate (#322)

**Specs:** [specs.md](specs.md) (Diego VALIDADO CON OBSERVACIONES, Ciclo 2 cierre, 2026-04-25)
**PRD:** [prd.md](prd.md) (Sofia VALIDADO, Ciclo 3, 2026-04-25)
**Issue:** [#322](https://github.com/benoffi7/modo-mapa/issues/322)
**Issues relacionadas:** [#332](https://github.com/benoffi7/modo-mapa/issues/332) (rules tests infra — out of scope; verificacion manual via emulator hasta merge de #332)
**Fecha:** 2026-04-25
**Branch base:** `new-home`

---

## Resumen del plan

Cinco workstreams (S1..S5) ordenados por **risk staging**: primero el script de migracion (read-only), luego rules de Firestore (gateway), luego Cloud Functions (callables/triggers), luego frontend (UX). Cada paso es **un commit atomico** — no se mezclan dominios. Los pasos del frontend (S2-UX) corren en paralelo a los pasos backend porque NO comparten archivos con el resto.

**Branch unico:** `feat/322-firestore-rules-hardening`. NO usar branches por-issue. Todo va al mismo branch y se mergea via `/merge` skill.

**Ownership:**

- **nico** (backend / rules / functions / scripts): Fase 0, 1, 2, 3, 4, 5, 6 (test infra), 7 (tests backend), 9 (rollout).
- **luna** (frontend / copy / dialogs): Fase 8 (S2-UX). Sin overlap con nico — paraleliza desde Fase 0 (no depende de Fases 1-7).
- **gonzalo (manu)**: Fase 9 pasos manuales (correr migracion en prod, smoke tests prod, deploy gating).

---

## Coordinacion con #332 (rules tests infra)

Tests directos contra `firestore.rules` via `@firebase/rules-unit-testing` quedan **out-of-scope para #322**. Mientras #332 no este mergeado, la verificacion del invariante bidireccional `displayNameLower == displayName.lower()` y los demas type guards de S1 se hace **manualmente contra el Firestore emulator local** (deliverable explicito en Fase 9 paso 9.5). Cuando #332 mergee, los 5 casos de la tabla bidireccional + los casos de S1 type guards se trasladan a tests automaticos en otro PR.

---

## Fases de implementacion

### Fase 0 — Setup del branch

**Owner:** nico
**Branch:** crear `feat/322-firestore-rules-hardening` desde `new-home`

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 0.1 | n/a | Crear branch desde `new-home` (verificar `new-home` actualizada con `git pull origin new-home`) | n/a | `git branch -D feat/322-firestore-rules-hardening` |

**Commit (no aplica — branch creation no commitea).**

---

### Fase 1 — Script de migracion (read-only first, no efecto en prod hasta Fase 9)

**Owner:** nico
**Riesgo:** minimo — el script no se ejecuta automaticamente, solo queda en disco para que gonzalo lo corra en prod en Fase 9.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 1.1 | `scripts/migrate-displayname-lower-sync.mjs` (NUEVO) | Crear el script con `--audit` (default) y `--apply`. Reusa logica de `scripts/migrateDisplayNameLower.ts`. Precondition check de `GOOGLE_APPLICATION_CREDENTIALS`. Usa `NEW_REGEX = /^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$/`. Output con counts: `missing`, `desync`, `invalidRegex`. Modo apply solo migra `missing + desync`, NO toca `invalidRegex`. Batch size 500. | Sin tests unitarios (one-off, idempotente; verificacion via dry-run en emulator local Fase 9). | Borrar archivo. |

**Commit 1:** `feat(#322): add scripts/migrate-displayname-lower-sync.mjs (audit + apply)`.

---

### Fase 2 — `firestore.rules` (gateway critico, no deploya hasta Fase 9)

**Owner:** nico
**Riesgo:** mergea al branch sin deploy. Deploy esta gateado por la migracion en Fase 9. Si la migracion falla, no deployamos rules nuevas.

Cada paso es un commit independiente para que `git bisect` aisle el bloque que rompe en caso de regresion. NO mergear los 5 commits de S1 + S3-rules en uno solo.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 2.1 | `firestore.rules` (linea ~180) | S1 — agregar `request.resource.data.message is string` antes de `.size()` en `feedback.create`. | Verificacion manual emulator Fase 9. | `git revert <sha>`. |
| 2.2 | `firestore.rules` (linea ~338) | S1 — agregar `&& request.resource.data.read is bool` en `notifications.update`. | Verificacion manual emulator Fase 9. | `git revert <sha>`. |
| 2.3 | `firestore.rules` (lineas ~401-402, ~430-431) | S1 — agregar range check `>=-90 && <=90` para `localityLat`, `>=-180 && <=180` para `localityLng` en `userSettings.create` y `userSettings.update`. NaN/Infinity rechazados como side-effect. | Verificacion manual emulator Fase 9. | `git revert <sha>`. |
| 2.4 | `firestore.rules` (lineas ~421-431) | S1 — refactor de `userSettings.update` para que TODOS los guards usen `affectedKeys()`. Patron canonico `(!('FIELD' in affectedKeys()) || <typecheck>)`. **Excepcion explicita: `updatedAt` mantiene equality dura `request.resource.data.updatedAt == request.time`** (NO se mueve al patron). | Verificacion manual emulator Fase 9 — toggle de cada flag boolean por separado para asegurar que el refactor no rompe ningun flow + que `updatedAt` sigue obligatorio. | `git revert <sha>`. |
| 2.5 | `firestore.rules` (lineas 34, 44) | S3 — cambiar regex `displayName` a `^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$` en `users.create` Y `users.update`. | Verificacion manual emulator Fase 9 (con casos `"J"`, `"L."`, `" Pedro"`). | `git revert <sha>`. |
| 2.6 | `firestore.rules` (lineas 35-36 create, 38-46 update) | S3 — equality bidireccional `displayNameLower == displayName.lower()`. Create: agregar equality + `displayNameLower is string`. Update: agregar el OR bidireccional documentado en specs L218-235. | Verificacion manual emulator Fase 9 — los 5 casos de la tabla bidireccional (specs L1100-1106). | `git revert <sha>`. |
| 2.7 | `firestore.rules` (lineas 189, 209) | S3 — agregar `+ docId + '%2F'` en regex de `feedback.mediaUrl`. Aplicar a `create` y a la rama owner-update sobre `mediaUrl/mediaType`. | Verificacion manual emulator Fase 9 (intento de update con URL sin feedbackId → DENY). | `git revert <sha>`. |

**Commits 2-8:** uno por paso, todos con prefijo `feat(#322): firestore.rules — ...`.

---

### Fase 3 — Cloud Functions: callables (S2 backend, S3 partial, S4)

**Owner:** nico
**Riesgo:** medio-bajo. Backward-compatible para clientes existentes; los cambios solo modifican shape de respuesta en paths de error que el frontend ya maneja como toast generico.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 3.1 | `functions/src/callable/inviteListEditor.ts` | S2 — uniform success response para 3 paths (email no registrado, self-invite, ya editor). Agregar `import { createHash } from 'crypto';` al top. `logger.warn` con `emailHash = sha256(email).slice(0,12)` cuando email no existe (NO email en claro). Mantener errores legitimos del owner (`unauthenticated`, `invalid-argument` por listId/email faltante, `not-found` para lista, `permission-denied`, `resource-exhausted`). | Tests S2 en mismo commit (paso 7.2). | `git revert <sha>`. |
| 3.2 | `functions/src/callable/removeListEditor.ts` | S2 mirror — si `targetUid` no esta en `editorIds`, devolver `{success: true}` sin mutar. Mantener todos los demas errores. | Tests S2 mirror en mismo commit (paso 7.3). | `git revert <sha>`. |
| 3.3 | `functions/src/admin/featuredLists.ts` | S3 — (a) cambiar import: agregar `ENFORCE_APP_CHECK` (junto a `ENFORCE_APP_CHECK_ADMIN`); (b) cambiar `enforceAppCheck` de `getFeaturedLists` a `ENFORCE_APP_CHECK`; (c) bajar rate limit de 60 a 20/dia; (d) parametrizar `extractPageSize` con `maxOverride?: number` opcional + agregar `Math.min(DEFAULT_PAGE_SIZE, cap)` en rama del default; (e) agregar constante local `FEATURED_LISTS_MAX_PAGE_SIZE = 100`; (f) usarla en `getFeaturedLists`. `getPublicLists` y `toggleFeaturedList` siguen sin segundo arg. | Tests S3 (3 casos: rate limit 20, pageSize clamp 100, spy de `enforceAppCheck === ENFORCE_APP_CHECK` con index correcto = 2) en mismo commit (paso 7.5). | `git revert <sha>`. |
| 3.4 | `functions/src/callable/cleanAnonymousData.ts` | S4 — agregar `import { getAuth } from 'firebase-admin/auth';` (verificar si ya esta). Llamar `await getAuth().revokeRefreshTokens(uid)` en `try/catch`. Capturar `tokensRevoked: boolean` y `tokensRevokedError: string | null`. Loguear con `logger.error` si falla (NO swallow). Agregar `tokensRevoked` (siempre) y `tokensRevokedError` (solo en fallo) al audit log entry de `deletionAuditLogs`. | Tests S4 (archivo NUEVO `cleanAnonymousData.test.ts`) en mismo commit (paso 7.6). | `git revert <sha>`. |

**Commits 9-12:** uno por paso, prefijos `feat(#322): inviteListEditor uniform response`, `feat(#322): removeListEditor mirror`, `feat(#322): getFeaturedLists rate limit + cap + ENFORCE_APP_CHECK`, `feat(#322): cleanAnonymousData revokeRefreshTokens`.

---

### Fase 4 — Cloud Functions: triggers (S3 trigger)

**Owner:** nico
**Riesgo:** bajo. Solo agrega comportamiento (escribir flag, leer flag); no altera el path actual cuando no hay abuse.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 4.1 | `functions/src/triggers/checkins.ts` | S3 — (a) `onCheckInDeleted`: cuando `deleteCount >= 20`, ademas del `logAbuse`, escribir `_rateLimits/checkin_create_suspended_${userId}` con `{suspendedUntil: now + 24h, reason: 'delete_abuse', userId, createdAt}`; (b) `onCheckInCreated`: DESPUES del `checkRateLimit` actual y ANTES del `incrementCounter`, leer el flag; si `suspendedUntil > now`, hacer `await snap.ref.delete()` + `logAbuse` + return. Mantener `trackFunctionTiming` existente. | Tests S3 trigger (4 casos: write flag, lee flag con suspension activa, lee flag vencido permite create, sin flag permite create) en mismo commit (paso 7.4). | `git revert <sha>`. |

**Commit 13:** `feat(#322): checkins trigger — suspension flag for delete abuse`.

---

### Fase 5 — Cloud Functions: bootstrap admin gate (S5)

**Owner:** nico
**Riesgo:** medio. Cambia el flujo del bootstrap path. Mitigacion: el `try/catch` del flag set evita engañar al cliente; ops puede setear manualmente con el procedimiento.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 5.1 | `functions/src/admin/claims.ts` | S5 — (a) agregar `import { getFirestore } from 'firebase-admin/firestore';`; (b) leer `config/bootstrap.adminAssigned` en handler; si `true` y la rama es `isBootstrap`, rechazar con `permission-denied`; (c) tras `setCustomUserClaims` exitoso por rama bootstrap, escribir `config/bootstrap.adminAssigned = true` con `merge: true` envuelto en `try/catch` (logger.error con `remediation` en payload, NO re-throw); (d) discriminar `via: 'bootstrap' \| 'existing_admin' \| 'emulator'` en el `logger.info`; (e) NO agregar rate limit (comment explicito que cita threat model en S5). | Tests S5 (5 casos en `claims.test.ts`: primera bootstrap → success + flag escrito; segunda bootstrap → permission-denied; existing admin con flag → success; via field correcto en log para los 3 paths; **fallo simulado de `db.doc('config/bootstrap').set(...)` → handler NO re-throws + `logger.error` con `remediation`**) en mismo commit (paso 7.1). | `git revert <sha>`. Si ya se deployo y el flag quedo escrito en prod por error, seguir `docs/procedures/reset-bootstrap-admin.md`. |

**Commit 14:** `feat(#322): setAdminClaim bootstrap gate + recovery procedure`.

---

### Fase 6 — Tests infra (preparacion para Fase 7)

**Owner:** nico
**Riesgo:** cero — solo tests, no toca codigo de produccion.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 6.1 | n/a | Verificar que el patron `vi.hoisted()` + `vi.resetAllMocks()` ya esta disponible en cada `__tests__/` afectado. Confirmar baseline `npm test --prefix functions` verde antes de empezar Fase 7. | n/a | n/a |

**No hay commit en este paso.**

---

### Fase 7 — Tests de Cloud Functions (paralelos a Fases 3-5; commitean POST-implementacion en mismo commit)

**Owner:** nico
**Riesgo:** cero — solo tests.

**Importante:** los tests de cada paso van **en el mismo commit** que la implementacion correspondiente. Esta fase los lista juntos como mapping para chequeo. Si un test pasa antes del fix, el test esta mal escrito (criterio del PRD: tests deben FALLAR antes del fix).

| Paso | Archivo | Cambio | Aplica a commit | Tipo |
|------|---------|--------|----------------|------|
| 7.1 | `functions/src/__tests__/admin/claims.test.ts` | AMPLIAR — agregar 5 casos S5: (a) primera invocacion bootstrap (config/bootstrap no existe) → success + setea `adminAssigned: true`; (b) segunda invocacion bootstrap (flag true) → throws `permission-denied`; (c) existing admin con flag true → success; (d) `via` field correcto para los 3 paths; (e) **fallo de `set(config/bootstrap)` → handler NO re-throws + `logger.error` se llamo con campo `remediation`**. Mock de `getFirestore().doc('config/bootstrap').get()` con tres estados (no existe / `{adminAssigned:false}` / `{adminAssigned:true}`). Mock del `set` para simular throw en caso (e). | Commit 14 (S5) | Test |
| 7.2 | `functions/src/__tests__/callable/inviteListEditor.test.ts` | **REESCRIBIR** los 3 tests existentes que asserteaban throws (`not-found`/`already-exists`/`invalid-argument`) → ahora `assert.deepEqual(result, { success: true })` (no `expect(toThrow)`). Tests afectados: linea 68-73 (email not found), 75-80 (inviting self), 82-87 (already editor). Agregar 1 test nuevo: `logger.warn` se llamo con `emailHash` (no email en claro) cuando email no existia. Mantener todos los demas tests (rate limit, owner check, list not found, MAX_EDITORS). | Commit 9 (S2) | Test |
| 7.3 | `functions/src/__tests__/callable/removeListEditor.test.ts` | AMPLIAR — agregar test: `targetUid` no en `editorIds` → `{success: true}` sin llamar `update`. Agregar test de simetria: invite + remove de email no registrado devuelven `{success: true}` con shape identico (atacante no distingue). Reescribir tests existentes que asserteaban "no es editor" → throws si los hay. | Commit 10 (S2 mirror) | Test |
| 7.4 | `functions/src/__tests__/triggers/checkins.test.ts` | AMPLIAR — 4 casos: (a) `onCheckInDeleted` con `deleteCount > 20` escribe doc `_rateLimits/checkin_create_suspended_{uid}` con `suspendedUntil` ~24h en futuro; (b) `onCheckInCreated` lee flag con suspension activa → borra doc + loguea abuse + return (NO incrementCounter); (c) flag vencido → permite create; (d) sin flag → permite create. Mock del flag via `mockGet` adicional. | Commit 13 (S3 trigger) | Test |
| 7.5 | `functions/src/__tests__/admin/featuredLists.test.ts` | AMPLIAR — 3 casos: (a) modificar test existente: rate limit ahora 20 (no 60); (b) test nuevo: `pageSize: 500` clampa a 100; (c) spy `enforceAppCheck === ENFORCE_APP_CHECK` (no _ADMIN). **`GET_FEATURED_LISTS_CONFIG_INDEX = 2`** (no 1; orden real: toggleFeaturedList=0, getPublicLists=1, getFeaturedLists=2) — alternativa preferida: busqueda por shape (encontrar el config cuyo handler matchee getFeaturedLists). Si el spy resulta fragil, fallback aceptado: confiar en `tsc --noEmit` por el cambio de import. Tests existentes de `getPublicLists` NO cambian. | Commit 11 (S3 callable) | Test |
| 7.6 | `functions/src/__tests__/callable/cleanAnonymousData.test.ts` (NUEVO) | CREAR — archivo nuevo. Casos minimos: (a) auth requerido; (b) email accounts rejected; (c) rate limit 60s funciona; (d) `revokeRefreshTokens` se llamo con `uid` (mock de `getAuth().revokeRefreshTokens`); (e) audit log entry incluye `tokensRevoked: true` en happy path; (f) `revokeRefreshTokens` throws → flow continua, audit log queda con `tokensRevoked: false` + `tokensRevokedError`, abuse log se escribe. Mocks `vi.hoisted()` + `vi.mock('firebase-admin/auth', ...)`. | Commit 12 (S4) | Test |

**No hay commits adicionales en esta fase** — los tests van con la implementacion.

---

### Fase 8 — Frontend (S2 UX) — paraleliza con Fases 3-5

**Owner:** luna
**Riesgo:** bajo. Cambio mecanico de copy + nuevo handler local.

**Paralelizable**: Fase 8 puede arrancar cuando Fase 0 termine (no depende de las fases 1-7). Como toca archivos diferentes (`src/components/lists/*` y `src/constants/messages/list.ts`), no hay overlap con nico. La integracion final ocurre cuando ambos ramos del trabajo lleguen al branch comun.

| Paso | Archivo | Cambio | Test mismo commit | Rollback |
|------|---------|--------|-------------------|----------|
| 8.1 | `src/constants/messages/list.ts` | Eliminar funcion `editorInvited(email)` (verificada por grep como sin otros consumidores). Agregar constante `invitationProcessed: 'Invitación procesada — revisá la lista de editores'`. Mantener `editorInviteError`. Voseo + tilde correctas. | Tests existentes de `list.ts` (si los hay) deben seguir pasando. | `git revert <sha>`. |
| 8.2 | `src/components/lists/InviteEditorDialog.tsx` | Cambiar la unica referencia a `MSG_LIST.editorInvited(email.trim())` por `MSG_LIST.invitationProcessed`. Sin cambios en firma de props. Sin cambios en logica de `handleInvite` excepto el toast. | Sin tests nuevos requeridos (cambio mecanico de copy). Verificar que tests existentes del dialog (si los hay) sigan pasando. | `git revert <sha>`. |
| 8.3 | `src/components/lists/ListDetailScreen.tsx` | Agregar `handleEditorInvited = useCallback(async () => { await handleEditorsChanged(); setEditorsOpen(true); }, [handleEditorsChanged])`. En `<InviteEditorDialog onInvited=...>` cambiar `handleEditorsChanged` por `handleEditorInvited`. `<EditorsDialog onEditorRemoved=...>` SIGUE usando `handleEditorsChanged` (no se toca). | Tests existentes del screen deben seguir pasando. Verificar manualmente Fase 9 paso 9.5: invite editor abre EditorsDialog; remover editor desde EditorsDialog NO cierra ni reabre el dialog espureamente. | `git revert <sha>`. |

**Commits 15-17:** `feat(#322): list messages — invitationProcessed copy`, `feat(#322): InviteEditorDialog uniform toast`, `feat(#322): ListDetailScreen handleEditorInvited auto-open`.

---

### Fase 9 — Rollout y verificacion (orden estricto, manual)

**Owner:** gonzalo (manu coordina)
**Riesgo:** medio — toca prod. Rollback documentado por paso.

**Critical path:** los pasos 9.1-9.5 deben ejecutarse ANTES del paso 9.6 (deploy de rules). Si la migracion (9.2-9.3) falla o `--audit` reporta `invalidRegex > 0`, **PAUSAR** y abrir issue follow-up antes de seguir. La verificacion manual contra emulator (9.5) tambien gatea el deploy: bugs en rules detectables localmente no deben llegar a prod.

| Paso | Accion | Riesgo si falla | Reversibilidad |
|------|--------|-----------------|----------------|
| 9.1 | Mergear branch `feat/322-firestore-rules-hardening` a `new-home` via skill `/merge`. Codigo deployable, **rules NO deployadas todavia** (no se ejecuta `firebase deploy`). | Cero — codigo sin efecto sin deploy. | `git revert <merge-sha>` o reverso por commits individuales. |
| 9.2 | Correr `node scripts/migrate-displayname-lower-sync.mjs --audit` en prod (gonzalo manual via gcloud o admin SDK con creds). Anotar en el issue: `missing: N`, `desync: N`, `invalidRegex: N`. | Cero — read-only. | n/a |
| 9.3 | Si `missing + desync > 0`: correr `node scripts/migrate-displayname-lower-sync.mjs --apply` en prod. Re-correr `--audit` para verificar `missing: 0, desync: 0`. | Bajo — solo escribe `displayNameLower` consistente. Idempotente. | Revert via batch update con `displayNameLower: undefined` (no recomendado; deja la coleccion peor que antes). |
| 9.4 | Si `--audit` reporta `invalidRegex > 0`: **PAUSA**. Decidir caso por caso (issue follow-up vs comunicacion a usuarios afectados vs tolerar — el cliente NO podra hacer un update legitimo de `displayName` sin un fix manual de su valor). Si conteo bajo (<5), aceptar con plan de comunicacion. Si alto, abrir issue follow-up y POSTPONER el paso 9.6. | Alto si se ignora — bloquea updates legitimos a perfiles afectados tras deploy. | Revisar conteos antes de seguir. |
| 9.5 | **Verificacion manual de los 5 casos de equality bidireccional contra Firestore emulator local** (deliverable explicito Sofia O6 + Diego). Levantar `npm run dev:full`. Crear user doc desde el cliente. Para cada caso de la tabla bidireccional (specs L1100-1106), intentar el update con auth del owner: (1) `{displayNameLower:"admin"}` → DENY; (2) `{displayName:"Maria"}` → DENY; (3) `{displayName:"Maria", displayNameLower:"maria"}` → ALLOW; (4) `{displayName:"Maria", displayNameLower:"admin"}` → DENY; (5) `{bio:"..."}` → ALLOW. Documentar en el ticket: `5/5 OK` (o detalle de fallos). **Tambien verificar manualmente los demas type guards de S1**: `feedback.message: ['x','y',...]` → DENY; `notifications.update {read: {garbage: 'map'}}` → DENY; `userSettings.update {localityLat: NaN}` → DENY; `userSettings.update` con flag boolean toggle por separado → ALLOW + `updatedAt` sigue obligatorio. | Critico — si algun caso reporta resultado distinto al esperado, las rules tienen un bug. PAUSAR y abrir issue. | n/a (verificacion local). |
| 9.6 | Deploy de `firestore.rules` en prod: `firebase deploy --only firestore:rules --project=modo-mapa-prod`. | Medio — bloquea writes invalidos. Si rompe writes legitimos (improbable post-9.5), revertir. | `firebase deploy --only firestore:rules --project=modo-mapa-prod` con la version anterior (checkout previo de `firestore.rules` + deploy). |
| 9.7 | Deploy de Cloud Functions: `firebase deploy --only functions --project=modo-mapa-prod`. Incluye S2/S3/S4/S5. Backward-compatible — clientes existentes no rompen. | Bajo — backward compatible. | `firebase deploy --only functions --project=modo-mapa-prod` con commit anterior (cherry-pick revert). **Si entre el deploy y el rollback se invoco `setAdminClaim` exitoso (rama bootstrap), ademas del cherry-pick revert seguir `docs/procedures/reset-bootstrap-admin.md` para resetear el flag `config/bootstrap.adminAssigned`** — sin reset, la siguiente invocacion bootstrap post-rollback seguira rechazando con `permission-denied`. |
| 9.8 | **Verificacion smoke en prod post-deploy**: invite editor con 4 escenarios desde la cuenta de gonzalo (o cuenta test): (1) email registrado **nuevo** → `EditorsDialog` muestra al editor agregado; (2) email registrado **ya editor** → `EditorsDialog` lo muestra (idempotencia); (3) email **NO registrado** → `EditorsDialog` no muestra al "invitado" (owner se da cuenta sin que la API enumere); (4) email **self** (gonzalo invitando a gonzalo) → `EditorsDialog` no agrega nada (silencio backend consistente). Documentar en el ticket: `4/4 OK` (o detalle). | Critico — si algun escenario rompe, revert de Cloud Functions. | Revert via paso 9.7 con commit anterior. |
| 9.9 | **Verificacion smoke bootstrap idempotencia**: SIN tocar `config/bootstrap` manualmente, verificar Cloud Functions logs que la primera invocacion exitosa de `setAdminClaim` (cuando ocurra naturalmente, ej: nuevo admin asignado) tenga `via: 'bootstrap'` y que la segunda invocacion bootstrap (caso tedio: re-correrlo a proposito con el mismo email) reciba `permission-denied`. Si el flag ya fue escrito previamente por test/staging y la rama bootstrap esta cerrada, verificar `via: 'existing_admin'` en futuros assignments. | Bajo — el cambio es backward-compatible para existing admins. | n/a |
| 9.10 | **Verificacion smoke checkin abuse**: mas dificil de simular en prod. Confiar en tests de Fase 7. Opcional: levantar emulator y simular 21 deletes desde una cuenta test para verificar que el flag se escribe + el siguiente create se borra. | Bajo. | n/a |

---

### Fase 10 — Documentacion (OBLIGATORIA)

**Owner:** nico (durante implementacion) + gonzalo (post-rollout)

| Paso | Archivo | Cambio | Cuando |
|------|---------|--------|--------|
| 10.1 | `docs/procedures/reset-bootstrap-admin.md` (NUEVO) | Crear el procedimiento (specs L909-1009): operadores autorizados, condiciones legitimas, pasos 1-5 (rotar secret, reset flag, login + setAdminClaim, verificar audit log, postcondition). Incluir variante "claim asignado pero flag no escrito" (specs L653). | Junto a commit 14 (S5). |
| 10.2 | `docs/reference/security.md` | Actualizar: (a) rate limit nuevo de `getFeaturedLists` (20/dia, pageSize 100); (b) nuevo flag `config/bootstrap.adminAssigned`; (c) patron de uniform response en callables que aceptan email; (d) flag de suspension `_rateLimits/checkin_create_suspended_{uid}`. | Pre-merge (Fase 9.1). |
| 10.3 | `docs/reference/firestore.md` | Actualizar: (a) type guards explicitos en cada coleccion afectada (S1); (b) `displayNameLower == displayName.lower()` invariante + co-update (S3); (c) nuevo doc `config/bootstrap`; (d) actualizar tabla de campos de `users` para reflejar el invariante bidireccional. | Pre-merge (Fase 9.1). |
| 10.4 | `docs/reference/guards/300-security.md` | Marcar R12, R13, R14 como "implementadas en #322" (link al PR). Actualizar lista de "Affected files" con los archivos modificados al cierre del issue. | Pre-merge (Fase 9.1). |
| 10.5 | `docs/reference/project-reference.md` | Actualizar version + fecha + resumen del closure de #322 (12 hallazgos cerrados). | Pre-merge (Fase 9.1). |
| 10.6 | `docs/reports/changelog.md` | Entry de #322. | Pre-merge (Fase 9.1). |
| 10.7 | `docs/_sidebar.md` | Agregar entradas de specs/plan/procedure al sidebar. | Pre-merge (Fase 9.1). |

**Commit 18:** `docs(#322): update security/firestore/guards references + reset-bootstrap-admin procedure + changelog`. Junto a 10.1-10.7 en un commit (es documentacion coordinada).

---

## Orden de implementacion (dependency chain)

```
Fase 0 (branch setup)
  ↓
Fase 1 (script migration — read-only, no efecto)
  ↓
Fase 2 (firestore.rules — 7 commits atomicos, no deploy)        ─┐
  ↓                                                                │
Fase 6 (tests infra baseline check — `npm test` verde antes       │
       de empezar Fases 3-5; los tests de Fase 7 son INLINE       │
       en commits de Fases 3-5)                                    │
  ↓                                                                │
Fase 3 (callables S2/S3/S4 — 4 commits con tests inline)         ─┤── nico (paraleliza con Fase 8 luna)
  ↓                                                                │
Fase 4 (trigger S3 — 1 commit con tests inline)                  ─┤
  ↓                                                                │
Fase 5 (claims.ts S5 — 1 commit con tests inline)                ─┘
                                                                   │
Fase 8 (frontend S2-UX — 3 commits) ─────────────────────────────┘── luna (paralelo a Fases 1-5, arranca tras Fase 0)

Fase 7 (tests — INLINE en commits de Fases 3/4/5; no fase aparte)

Fase 10 (docs) — pre-merge
  ↓
Fase 9 (rollout) — orden estricto: 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 → 9.8 → 9.9 → 9.10
```

**Total commits planificados:**

- Fase 1: 1 commit (script)
- Fase 2: 7 commits (rules atomicos)
- Fase 3: 4 commits (callables, cada uno con tests inline)
- Fase 4: 1 commit (trigger checkins)
- Fase 5: 1 commit (claims bootstrap gate)
- Fase 8: 3 commits (frontend luna, paralelo)
- Fase 10: 1 commit (docs)

**Total: 18 commits.**

**Paralelizacion segura:**

- Nico avanza Fases 1-5 + Fase 7 en branch comun.
- Luna avanza Fase 8 en mismo branch (sin overlap de archivos: luna toca `src/components/lists/*` + `src/constants/messages/list.ts`; nico toca `firestore.rules`, `functions/src/*`, `scripts/`).
- No hay merge conflicts esperables. Si algun commit de luna llega antes que el de nico, se rebasea sin friccion.

**Dependencias entre pasos:**

- 1.1 → independiente (script standalone).
- 2.1-2.7 → independientes entre si (cada bloque de rules es self-contained); orden de commit por trazabilidad.
- 3.1, 3.2 → independientes; 3.3, 3.4 → independientes.
- 4.1 → independiente.
- 5.1 → depende de NADA (los tests de 7.1 dependen de 5.1; ambos van en el mismo commit).
- 8.1 → 8.2 → 8.3 (orden estricto: el toast usa la constante; el screen usa el dialog).
- 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 → 9.8 → 9.9 → 9.10 (orden estricto del rollout).
- 10.1 → vinculado a 5.1 (commit 14).
- 10.2-10.7 → independientes entre si, todos pre-merge (commit 18).

---

## Riesgos

1. **Migracion `displayNameLower` reporta `invalidRegex > 0` alto en prod.** Mitigacion: el script audit corre ANTES del deploy (Fase 9.2). Si el conteo es alto, PAUSAR y abrir issue follow-up. Si bajo, comunicacion manual o tolerar (cliente vera error en proximo update legitimo).

2. **Rules deployadas bloquean writes legitimos por edge cases unicode (EC3 de specs).** Mitigacion: el script audit detecta cualquier desync via `displayName.toLowerCase() !== displayNameLower` antes del deploy. Probabilidad practica baja (charset es ASCII + Latin-1 extendido).

3. **Bootstrap gate cierra acceso prematuramente si test/staging escribe el flag en prod por error.** Mitigacion: el procedimiento `reset-bootstrap-admin.md` documenta como reabrirlo. Verificar Fase 9.9 que `config/bootstrap` no exista en prod antes del deploy de Cloud Functions.

4. **Spy test de `enforceAppCheck` con indice incorrecto (Diego OBS #6).** Mitigacion: plan documenta `GET_FEATURED_LISTS_CONFIG_INDEX = 2` (no 1) o busqueda por shape. Si fragil, fallback aceptado: confiar en `tsc --noEmit` por el cambio explicito de import (de `_ADMIN` a sin-sufijo).

5. **Race condition en bootstrap gate (D4).** Aceptado como teorico — bootstrap es manual one-shot. Documentado en `setAdminClaim` con comment.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — N/A, no se agregan componentes nuevos.
- [x] Archivos nuevos en carpeta de dominio correcta:
  - `scripts/migrate-displayname-lower-sync.mjs` → `scripts/`.
  - `docs/procedures/reset-bootstrap-admin.md` → `docs/procedures/`.
  - `functions/src/__tests__/callable/cleanAnonymousData.test.ts` → adjacent al codigo.
- [x] Logica de negocio en hooks/services, no en componentes. El cambio en `ListDetailScreen.tsx` es coordinacion local de dialogs, no logica nueva.
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — N/A, no hay tech debt no-relacionado en los archivos tocados.
- [x] Ningun archivo resultante supera 400 lineas. Estimaciones:
  - `firestore.rules` actual: ~720 lineas. Crecimiento esperado: +30 lineas (refactor neto compensa). Final: ~750. No es codigo TS — el limite de 400 lineas no aplica a `.rules` (ver `docs/reference/file-size-directive.md` si existe), pero documentado.
  - `functions/src/admin/claims.ts` actual: pequeño. Final: ~150-180 lineas.
  - `functions/src/callable/inviteListEditor.ts` actual: ~120 lineas. Final: ~140 lineas.
  - `functions/src/triggers/checkins.ts` actual: ~100 lineas. Final: ~150 lineas.
  - `scripts/migrate-displayname-lower-sync.mjs` (NUEVO): esperado <200 lineas.
  - `src/components/lists/ListDetailScreen.tsx`: +6 lineas (handler nuevo).

---

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` en create + `affectedKeys().hasOnly()` en update — `config/bootstrap` y `_rateLimits/checkin_create_suspended_*` son admin-SDK only (matchall `if false` en rules).
- [x] Todo campo string tiene `.size() <= N` en rules — preservado.
- [x] Todo campo list tiene `.size() <= N` — preservado.
- [x] Admin writes tambien tienen validacion de campos — los nuevos docs (`config/bootstrap`) son admin SDK; no aplica.
- [x] Counter decrements en triggers usan `Math.max(0, ...)` — N/A (no se tocan counters).
- [x] Rate limits llaman `snap.ref.delete()` cuando exceden — `onCheckInCreated` con suspension flag llama `snap.ref.delete()` (Fase 4).
- [x] Toda coleccion nueva escribible por usuarios tiene Cloud Function trigger con rate limit — N/A (no hay colecciones nuevas escribibles por usuarios).
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificado: el script de migracion lee `GOOGLE_APPLICATION_CREDENTIALS` (path en disco, no committed); claims.ts lee `ADMIN_EMAIL` via `defineSecret`.
- [x] `getCountFromServer` → usar `getCountOfflineSafe` siempre — N/A.

---

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — `onCheckInDeleted`/`onCheckInCreated` ya lo tienen y se preserva.
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — N/A, no hay services nuevos.
- [x] Todo `trackEvent` nuevo esta registrado en `GA4_EVENT_NAMES` — N/A, no hay eventos nuevos.
- [x] Todo `trackEvent` nuevo tiene feature card en `ga4FeatureDefinitions.ts` — N/A.
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — todos los `logger.error` nuevos (S4 revokeRefreshTokens, S5 flag write fail) corren en prod sin gate de DEV.

**Nota sobre `trackFunctionTiming` en callables:** este issue NO agrega instrumentacion en callables tocados (S2/S4/S5). Decision tecnica: scope — el issue cierra hardening de seguridad, NO deuda preexistente de instrumentacion en callables. La realidad del repo es que la mayoria de callables actuales no tiene `trackFunctionTiming` (deuda preexistente que el guard 303 manda cerrar). El comentario en codigo (si se agrega alguno) NO debe afirmar "convencion del repo" — la convencion del guard es la opuesta. **Diego OBS #7**: documentado aqui sin reformular el guard.

---

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — N/A, no se agregan IconButtons.
- [x] No hay `<Typography onClick>` — N/A.
- [x] Touch targets minimo 44x44px — N/A.
- [x] Componentes con fetch tienen error state con retry — el `EditorsDialog` ya lo tiene (sin cambios).
- [x] `<img>` con URL dinamica tienen `onError` fallback — N/A.
- [x] httpsCallable en componentes user-facing tienen guard offline — `InviteEditorDialog` ya gated por `isOffline` (linea 58, sin cambios).

---

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo — `revisá` (no `revisa`).
- [x] Tildes correctas — `Invitación`.
- [x] Terminologia consistente — N/A (no se agregan terminos nuevos).
- [x] Strings reutilizables en `src/constants/messages/` — `invitationProcessed` en `list.ts`. `editorInvited` eliminado por estar muerto (D2).

---

## Criterios de done

- [ ] Los 5 hallazgos high cerrados (S1 type guards + S2 R13 uniform response).
- [ ] Los 6 hallazgos medium cerrados (S3 displayName regex + bidireccional + script migracion + feedback.mediaUrl + getFeaturedLists rate limit + onCheckInDeleted enforcement; S4 cleanAnonymousData revoke).
- [ ] Bootstrap admin gate cerrado (S5) + procedimiento de recovery documentado.
- [ ] Coverage >= 80% del codigo nuevo modificado en Cloud Functions (claims.ts, inviteListEditor.ts, removeListEditor.ts, cleanAnonymousData.ts NUEVO test, triggers/checkins.ts).
- [ ] Tests de Cloud Functions pasan (`npm test --prefix functions` verde).
- [ ] Tests del cliente pasan (`npm test` verde).
- [ ] No lint errors (`npm run lint` verde).
- [ ] Build succeeds (`npm run build` + `npm run build --prefix functions`).
- [ ] Migracion `migrate-displayname-lower-sync.mjs` ejecutada en prod en modo `--audit` (conteos en el ticket) y `--apply` (si fue necesario), con 0 docs en violacion verificado.
- [ ] **Verificacion manual de los 5 casos de equality bidireccional + 4 type guards de S1 contra emulator local — 5/5 + 4/4 OK documentado en el ticket.**
- [ ] **Verificacion smoke en prod post-deploy: invite editor 4 escenarios — 4/4 OK documentado en el ticket.**
- [ ] **Test del IMPORTANTE #4 (Diego)**: simular fallo de `db.doc('config/bootstrap').set(...)` en `claims.test.ts` y assert que el handler NO re-throws + `logger.error` se llamó con `remediation` en payload.
- [ ] **Tests reescritos (no ampliados) en `inviteListEditor.test.ts`**: los 3 casos uniformizados (linea 68-73, 75-80, 82-87) usan `assert.deepEqual(result, { success: true })` — no `expect(toThrow)`.
- [ ] **`GET_FEATURED_LISTS_CONFIG_INDEX = 2`** en el spy test (no 1; orden real verificado).
- [ ] No hay comentario en codigo afirmando "callables NO usan trackFunctionTiming por convencion del repo" (si se agrega comment, reformular como "scope: deuda preexistente").
- [ ] Privacy policy revisada — N/A (no hay nuevos data collection paths visible al usuario).
- [ ] Reference docs actualizadas (Fase 10): `security.md`, `firestore.md`, `guards/300-security.md`, `project-reference.md`, `changelog.md`, `_sidebar.md`.
- [ ] PR description incluye link al ticket #322 + resumen de los 12 hallazgos cerrados + checklist de rollout.

---

## Validacion de Plan

**Delivery Lead**: Pablo
**Fecha Ciclo 1**: 2026-04-25
**Fecha Ciclo 2**: 2026-04-25
**Estado**: VALIDADO CON OBSERVACIONES (Ciclo 2 cierre, 2026-04-25)

---

### Veredicto Pablo — Ciclo 2

**Estado final**: VALIDADO CON OBSERVACIONES.

Plan listo para implementacion. Los 5 IMPORTANTES quedaron correctamente cerrados; verificados con grep contra el plan actualizado:

- **IMPORTANTE #1** (critical path Fase 9) — cerrado. Linea 178: "los pasos 9.1-9.5 deben ejecutarse ANTES del paso 9.6". Nota explicita sobre 9.5 como gate previo a deploy de rules. Lineas 238 y 267 actualizadas.
- **IMPORTANTE #2** (cita "9.4" → "9.5") — cerrado. Linea 28: "deliverable explicito en Fase 9 paso 9.5".
- **IMPORTANTE #3** (Fase 6 mal ubicada en diagrama) — cerrado. Lineas 215-238: Fase 6 reposicionada despues de Fase 2 y antes de Fase 3, con texto explicito "baseline check antes de empezar Fases 3-5; los tests de Fase 7 son INLINE". Fase 7 conservada como anotacion fuera del eje de dependencias.
- **IMPORTANTE #4** (paralelismo de luna inconsistente) — cerrado. Lineas 14, 21, 161, 232: tres pasajes ahora alineados en "luna paraleliza desde Fase 0".
- **IMPORTANTE #5** (paso 9.11 redundante) — cerrado. Tabla de Fase 9 termina en 9.10; lineas 191, 238, 267 lo reflejan; docs queda exclusivamente en Fase 10.

Sin regresiones detectadas. Numeracion 9.x consistente en todos los pasajes (texto, diagrama y dependency chain).

#### Decisiones sobre OBSERVACIONES

- **OBSERVACION #1 (estimaciones per paso)** — ACEPTADA tal cual. Justificacion: el PRD ya define L=5-7 dias agregado; los planes anteriores del repo no usan columna por paso; la granularidad de 18 commits con commit-messages explicitos da suficiente visibilidad para que manu reparta carga entre nico y luna. Si durante implementacion manu detecta que necesita mayor granularidad para schedulear, lo agrega ad-hoc.
- **OBSERVACION #2 (`features.md` / `patterns.md`)** — ACEPTADA con matiz. `features.md` no necesita entry (el cambio de copy `invitationProcessed` + auto-open no es nueva capacidad, es ajuste correctivo de UX). `patterns.md` SI deberia tener entry para "uniform response anti-enumeration en callables que aceptan email" — `security.md` (paso 10.2) documenta la regla, pero `patterns.md` documenta como replicarlo en futuras callables (es un patron transversal, no solo de seguridad). Sin embargo, dado que ya queda registrado en `security.md`, no escalo a BLOQUEANTE; queda como **observacion abierta no-bloqueante** para que manu (o quien implemente Fase 10) considere agregarlo como paso 10.8 durante la pasada de docs. Si no se agrega en este issue, abrir issue follow-up al cierre.
- **OBSERVACION #3 (rollback 9.7)** — CERRADA. Linea 188 cita reset del flag via `docs/procedures/reset-bootstrap-admin.md`. Cross-ref con 5.1 confirmado.

#### Cobertura specs → plan (re-verificacion Ciclo 2)

- [x] Cada bloque de specs (S1/S2/S3/S4/S5) aparece en pasos del plan (Fase 2 para S1+S3 rules; Fase 3 para S2+S3+S4 callables; Fase 4 para S3 trigger; Fase 5 para S5).
- [x] Cada test mencionado en specs tiene paso en Fase 7 mapeado a commit de implementacion.
- [x] Fuera de scope NO aparece (rules tests via `@firebase/rules-unit-testing` quedan en #332, documentado en linea 28).
- [x] Riesgos del specs tienen mitigacion agendada (script audit pre-deploy, procedure reset-bootstrap, fallback de spy index).

#### Granularidad y ownership

- [x] 18 commits atomicos, uno por paso. Sin "y tambien hace Y".
- [x] Ownership claro: nico (Fases 0-7, 9), luna (Fase 8), gonzalo (Fase 9 manual). Sin overlap de archivos entre nico y luna verificado en linea 256.
- [x] Test plan integrado: tests inline en mismo commit que la feature (no fase final "agregar tests").

#### Risk staging y rollback

- [x] Rules NO se deployan en mismo commit que merge (gate via 9.5 emulator + 9.6 deploy explicito). Backwards: si 9.5 falla, no se deploya nada.
- [x] Rollback documentado por paso. Paso 9.7 incluye reset del flag bootstrap (OBS #3).
- [x] Risk staging: read-only script primero (Fase 1), rules sin deploy despues (Fase 2), CFs (Fases 3-5), rollout manual al final (Fase 9).

#### Documentacion agendada

- [x] `reset-bootstrap-admin.md` (10.1) junto a commit S5 — correcto.
- [x] `security.md`, `firestore.md`, `guards/300-security.md`, `project-reference.md`, `changelog.md`, `_sidebar.md` (10.2-10.7) pre-merge.
- [ ] `patterns.md` no agendado (OBS #2 abierta no-bloqueante). Recomendacion: agregar 10.8 si manu lo decide; sino, issue follow-up al cierre.

### Observaciones para la implementacion (heads-up para manu)

- **Concurrencia luna/nico**: si luna mergea Fase 8 antes que nico complete Fases 3-5, no hay conflicto (archivos disjoint). El diagrama lo refleja. Manu puede arrancar luna en paralelo desde el dia 1.
- **Fase 9 es manual y secuencial**: 9.1 → 9.10 sin paralelizar. 9.4 puede PAUSAR todo el rollout si `invalidRegex > 0` en prod. Tener cuenta para no asumir que el rollout es ininterrumpido.
- **Spy de `enforceAppCheck` (Fase 7.5)**: si el index 2 resulta fragil al refactorearse el orden de exports en `featuredLists.ts`, fallback aceptado documentado en linea 149 (busqueda por shape o confiar en `tsc --noEmit`).
- **Patron uniform response**: si OBS #2 se acepta agregar entry en `patterns.md`, hacerlo en mismo commit 18 (docs).

### Listo para pasar a implementacion?

**Si.** Plan VALIDADO CON OBSERVACIONES. Las observaciones abiertas (OBS #1 estimaciones, OBS #2 patterns.md) NO bloquean inicio de implementacion.

**Firma**: Pablo, Delivery Lead — 2026-04-25 (Ciclo 2 cierre).
