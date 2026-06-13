# PRD: Tech debt seguridad — firestore rules type guards + bootstrap admin path

**Feature:** 322-firestore-rules-hardening-bootstrap-admin
**Categoria:** security
**Fecha:** 2026-04-25
**Issue:** [#322](https://github.com/benoffi7/modo-mapa/issues/322)
**Issues relacionadas:** [#332](https://github.com/benoffi7/modo-mapa/issues/332) (rules tests infra — out of scope para #322)
**Prioridad:** Alta (5 high + 6 medium + 1 bootstrap)

---

## Contexto

El health-check de seguridad del 2026-04-25 sobre `new-home` (post-#300) detecto 12 hallazgos: cinco de severidad alta en type guards faltantes en firestore.rules y enumeracion de usuarios en `inviteListEditor`, seis medios en validaciones de `displayName`/`displayNameLower`/`mediaUrl` y rate limits demasiado generosos, y una observacion sobre el bootstrap admin path que hoy queda abierto para siempre. Varios de estos hallazgos refuerzan invariantes que ya quedaron documentados en `docs/reference/guards/300-security.md` (R12, R13, R14) pero que no se aplicaron de forma exhaustiva al codigo en producto. Este issue cierra el bucle entre el contrato (300-security.md) y la implementacion real (`firestore.rules`, `claims.ts`, `inviteListEditor.ts`).

## Problema

- **Type confusion en CEL (.size() en strings vs listas vs maps):** sin `is string` previo, `request.resource.data.message.size() <= 1000` es satisfacible enviando `message: ['x','y',...]` (50 elementos) o un map de 50 keys. CEL aplica `.size()` indistintamente. Mismo patron en `notifications.read` sin `is bool` (recipient puede escribir un map gigante en su propia subcoleccion).
- **NaN/Infinity en lat/lng:** `userSettings.localityLat`/`localityLng` solo validan `is number`. NaN, Infinity y -Infinity son `is number` true en CEL — pasan la validacion. Permite escribir valores invalidos que rompen rendering del mapa o queries geograficas.
- **`affectedKeys()` inconsistente en userSettings:** el bloque update usa una mezcla — algunos guards chequean `affectedKeys()` (`profilePublic`, `notificationsEnabled`, etc.) pero otros chequean directamente `request.resource.data` (`notifyFollowers`, `notifyRecommendations`, `notificationDigest`, `followedTags`, `locality`, `localityLat`, `localityLng`). Si el campo no se modifica pero ya esta presente con un valor invalido en `resource.data`, los guards que leen `request.resource.data` pueden bloquear updates legitimos a otros campos. Inconsistente con el patron del resto del archivo.
- **Email enumeration en `inviteListEditor`:** los mensajes de error distinguen "email no existe" (`getUserByEmail` falla, devuelve `not-found`) vs "ya es editor" (`already-exists`) vs "te invitas a vos mismo" (`invalid-argument`). Un atacante puede enumerar emails registrados llamando al callable con cada email candidato. Viola R13 del guard 300-security (callables que aceptan email no deben enumerar). Cumple parcialmente — la respuesta success no leak `targetUid`, pero los errores si.
- **`displayName` whitespace:** la regex `^[A-Za-z0-9À-ÿ ._-]+$` (post-#300 R7) acepta `"   "` (3 espacios), `" Juan"` (leading), `"Juan "` (trailing). El charset es correcto pero falta trim/reject all-whitespace.
- **`displayNameLower` no equivale a `displayName.lower()`:** create rule no chequea `displayNameLower == displayName.lower()`. Cliente puede enviar `displayName: "Juan"` y `displayNameLower: "admin"` — la busqueda por prefijo (que usa `displayNameLower`) devuelve un perfil que no matchea el `displayName` real. Hijack de busqueda.
- **`feedback.mediaUrl` sin `feedbackId` segment:** el regex valida `feedback-media%2F{auth.uid}%2F.*` pero no chequea que el path incluya el `feedbackId` (doc.id) como segundo segmento. Permite reuso cross-feedback: usuario sube media para feedback A, despues asocia esa misma URL a feedback B (mismo owner) en el create.
- **`getFeaturedLists` rate limit muy generoso:** 60/dia × `pageSize` 500 = 30k items/dia por usuario. Demasiado para una superficie de discovery publica. Permite scraping si `featured` crece.
- **`onCheckInDeleted` rate limit log-only:** trigger registra abuse cuando se exceden 20 deletes/dia pero no bloquea creates ni hace nada operativo. Loop create+delete puede saltarse el limite de creates (10/dia) sin consecuencia real. El comentario "We can't undo a delete" es correcto, pero si excede deletes podemos suspender la ventana de creates 24h.
- **`cleanAnonymousData` no revoca refresh tokens:** anonymous accounts auto-expiran pero los refresh tokens emitidos siguen validos hasta que expira el access token (1h). Comentario en codigo dice "auto-expire" pero deja una ventana de hasta 1h donde el cliente puede seguir actuando con la session "limpiada".
- **Bootstrap admin path siempre abierto:** `setAdminClaim` permite que cualquier cuenta con `email_verified === true && email === ADMIN_EMAIL` se haga admin. Si la cuenta del email bootstrap se compromete (phishing, password leak), el atacante puede asignarse admin. No hay gate post-primer-admin. Viola R14 del guard 300-security.

## Solucion

Abordamos los 12 hallazgos en 4 workstreams agrupados por archivo afectado y nivel de riesgo. Todos los cambios son server-side (firestore.rules + Cloud Functions) — la unica UX visible afectada es el flow de invitar editores (S2), que pasa a abrir `EditorsDialog` automaticamente como mitigacion del cambio de copy.

### S1 — Type guards en firestore.rules (5 high)

Aplicamos R12 (type guards explicitos) del guard 300-security a las 4 ubicaciones afectadas:

- **`feedback.message`** (firestore.rules:178-181): agregar `request.resource.data.message is string` antes de `.size() > 0 && .size() <= 1000`. Cierra el vector de `.size()` ambiguo (lista/map).
- **`userSettings.localityLat/Lng`** (firestore.rules:401-402, 430-431): mirror del patron de `checkins` (linea 624-628) — `is number && >= -90 && <= 90` para lat, `>= -180 && <= 180` para lng. Rechaza NaN/Infinity como side effect del range check (NaN > -90 es false).
- **`notifications.read`** (firestore.rules:337-338): agregar `request.resource.data.read is bool`. Cierra el vector de map gigante en update.
- **`userSettings` affectedKeys consistency** (firestore.rules:421-431): estandarizar todos los guards a usar `affectedKeys()`. Si el campo no esta en `affectedKeys()`, no se valida (el valor anterior ya paso por la rule de create). Patron canonico: `(!('field' in affectedKeys()) || <typecheck>)`. Aplicar a `notifyFollowers`, `notifyRecommendations`, `notificationDigest`, `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt`, `locality`, `localityLat`, `localityLng`.

### S2 — Email enumeration en `inviteListEditor` (1 high) [R13]

Refactor de `functions/src/callable/inviteListEditor.ts:36-45` para devolver respuesta uniforme. Cambios en el callable:

- Si `getUserByEmail` falla con `auth/user-not-found`, NO throw — log internamente y devolver `{ success: true }` (mismo shape que el happy path).
- Si `targetUid === request.auth.uid`, devolver `{ success: true }` sin mutar la lista — no dar pista de que se "auto-invito".
- Si el target ya es editor, devolver `{ success: true }` (idempotente). No `already-exists`.
- Si `editorIds.length >= MAX_EDITORS`, mantener `resource-exhausted` (el owner ya conoce el estado de su propia lista — no leak ajeno).

Aplicar el mismo patron a `removeListEditor` para consistencia (no leak por simetria — un atacante podria hacer `invite(email)` luego `remove(email)` y comparar respuestas).

#### UX cuando el email no existe (decision Ciclo 1 Sofia)

Para no mentirle al owner sin enumerar al atacante: tras `inviteListEditor` exitoso, el frontend abre `EditorsDialog` automaticamente. La lista actualizada le da feedback real al owner sin que la API declare nada sobre el target.

- En `src/components/lists/InviteEditorDialog.tsx`:
  - Cambiar el toast de `MSG_LIST.editorInvited(email)` ("Editor invitado: {email}") a `MSG_LIST.invitationProcessed` (string nuevo).
  - El callback `onInvited()` (que ya hace `handleEditorsChanged` en `ListDetailScreen.tsx`) se enriquece para abrir `EditorsDialog` automaticamente.
  - El cierre de `InviteEditorDialog` (`onClose`) se mantiene tras success.

- En `src/components/lists/ListDetailScreen.tsx`:
  - **NO** modificar el `handleEditorsChanged` compartido — abrir el dialog ahi reabriria espureamente cuando el usuario remueve un editor desde dentro de `EditorsDialog` (observacion Ciclo 2 Sofia).
  - **Solucion**: separar la responsabilidad. El callback `onInvited` de `InviteEditorDialog` debe llamar a un handler dedicado (ej: `handleEditorInvited`) que hace `handleEditorsChanged()` (refresh) **+** `setEditorsOpen(true)` (auto-open). El callback `onEditorRemoved` de `EditorsDialog` sigue llamando solo a `handleEditorsChanged()` (refresh, sin tocar `editorsOpen`).
  - Asi: invitar abre el dialog (feedback al owner), remover dentro del dialog refresca pero no toggla la apertura.

- En `src/constants/messages/list.ts`:
  - Agregar `invitationProcessed: 'Invitación procesada — revisá la lista de editores'` (voseo, consistente con tono).

Resultado:
- Si el email no era usuario → `EditorsDialog` no muestra al "invitado" → owner se da cuenta del problema sin que la API lo declare.
- Si el email ya era editor → `EditorsDialog` lo muestra (ya estaba) → owner ve idempotencia.
- Si el email era nuevo y registrado → `EditorsDialog` lo muestra como editor nuevo → owner ve confirmacion.
- Si fue auto-invite → `EditorsDialog` no agrega nada (owner es owner, no editor) → comportamiento consistente con el silencio del backend.

Cumple R13 (no enumeration) sin degradar la UX del owner.

### S3 — Validaciones de campos (5 medium)

- **`displayName` trim + no whitespace** (firestore.rules:30-34, 40-44): cambiar regex a `^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$`. Primer y ultimo char no son espacio. Bloquea `"   "`, `" Juan"`, `"Juan "`. Tradeoff conocido: rechaza `"L."`, `"Mr."` (terminados en `.`). Es deliberado — si users actuales lo necesitan, otro issue.
- **`displayNameLower == displayName.lower()`** (firestore.rules:35-36, 45-46): equality estricta bidireccional + co-update obligatorio (decision Ciclo 1 Sofia, refinado en Ciclo 2 por hallazgo B5):
  - **Create**: `displayNameLower` es obligatorio en el doc. Equality `request.resource.data.displayNameLower == request.resource.data.displayName.lower()` enforced.
  - **Update — invariante funcional**: si **cualquiera** de los dos campos (`displayName` o `displayNameLower`) esta en `affectedKeys()`, ambos campos deben matchear via `request.resource.data.displayNameLower == request.resource.data.displayName.lower()`. La condicion es **simetrica** — no se puede mutar uno sin el otro, y cuando se mutan, deben quedar sincronizados. Patron CEL canonico:
    ```
    allow update: if request.auth.uid == userId
      && request.resource.data.keys().hasOnly([...])
      && (
        // Invariante: si NINGUNO de los dos cambia, no hay nada que validar.
        // Si CUALQUIERA cambia, los DOS deben matchear.
        (!('displayName' in request.resource.data.diff(resource.data).affectedKeys())
          && !('displayNameLower' in request.resource.data.diff(resource.data).affectedKeys()))
        || (request.resource.data.displayNameLower == request.resource.data.displayName.lower())
      );
    ```
    Tabla de verdad bajo esta formulacion:
    - `displayName=NO`, `displayNameLower=NO` → permitido (ningun campo relevante cambia).
    - `displayName=SI`, `displayNameLower=NO` → bloqueado (la rama del OR exige equality, y como el lower no se toco queda con el valor anterior que no matchea el nuevo displayName).
    - `displayName=NO`, `displayNameLower=SI` → bloqueado (la rama del OR exige equality contra el displayName actual, que no se toco — si el lower nuevo no matchea, falla).
    - `displayName=SI`, `displayNameLower=SI` con match → permitido.
    - `displayName=SI`, `displayNameLower=SI` sin match → bloqueado.

    Esto cierra B5: el atacante NO puede mutar solo `displayNameLower: "admin"` sin tocar `displayName`, porque la equality se evalua contra el `displayName` actual del doc (que no se toco) y va a fallar.
  - **Migracion previa al deploy** (deliverable obligatorio): `scripts/migrate-displayname-lower-sync.mjs`. Reusa `scripts/migrateDisplayNameLower.ts` como base. Diferencias clave:
    - Escanea `users/`, encuentra docs donde `displayNameLower !== displayName.toLowerCase()` o donde `displayNameLower` no existe.
    - Modo `--audit` (default): cuenta y lista UIDs en violacion sin escribir. Tambien cuenta users con `displayName` que NO matchea la nueva regex (pre-flight para detectar usuarios que romperian al hacer un update legitimo).
    - Modo `--apply`: actualiza los docs en violacion via batch (max 500 por commit).
    - Output: numero de docs en violacion / migrados, breakdown entre "missing" y "desync".
  - **Plan de rollout** (orden estricto):
    1. Mergear el script al branch — sin ejecutarlo aun.
    2. Correr `--audit` en prod (manual via gcloud/admin SDK con creds gonzalo). Anotar el conteo en el ticket.
    3. Si conteo > 0 → correr `--apply` en prod.
    4. Re-correr `--audit` para verificar 0 docs en violacion.
    5. Recien entonces, deploy de `firestore.rules` con la equality enforced.
  - Si los pasos 2-4 detectan algun caso edge no anticipado (ej: `displayName` con caracteres que `toLowerCase()` no normaliza igual que la rule lower()), pausar el rollout y abrir issue follow-up.
- **`feedback.mediaUrl` con feedbackId segment** (firestore.rules:189, 209): cambiar regex a `^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F` + `request.auth.uid` + `%2F` + `docId` (el path de la regla `match /feedback/{docId}`) + `%2F.*`. Refuerza el binding feedbackId↔mediaUrl.
- **`getFeaturedLists` rate limit + pageSize cap** (`functions/src/admin/featuredLists.ts:128-130`): bajar rate limit de 60 a 20/dia. Para evitar afectar a `getPublicLists` (admin-only) y `toggleFeaturedList`, NO bajar la constante de modulo `MAX_PAGE_SIZE` (linea 7) — en cambio, introducir una **constante local especifica** `FEATURED_LISTS_MAX_PAGE_SIZE = 100` aplicada SOLO al cap de `getFeaturedLists`. Esta decision (Ciclo 2 Sofia, observacion sobre `MAX_PAGE_SIZE` global): los admins paginan con el cap general intacto, mientras la superficie publica baja a 100. Aprovechar el toque del archivo para corregir `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN` → `ENFORCE_APP_CHECK` (callable publico, no admin).
- **`onCheckInDeleted` enforcement real** (`functions/src/triggers/checkins.ts:60-75`): cuando excede 20 deletes/dia, escribir un flag `_rateLimits/checkin_create_suspended_{userId}` con `{ suspendedUntil: timestamp_24h_from_now, reason: 'delete_abuse' }`. **Importante**: `checkRateLimit` actual NO lee `_rateLimits/`, lee directamente la coleccion (`checkins where userId==X and createdAt >= startOfDay`). Por eso `onCheckInCreated` tiene que leer el flag de suspension explicitamente, despues de su `checkRateLimit` actual y antes del `incrementCounter`. Si `suspendedUntil > now`, hace `await snap.ref.delete()` + `logAbuse({ type: 'rate_limit', detail: 'create suspended due to delete abuse' })` + return. El path exacto del flag (`_rateLimits/checkin_create_suspended_{userId}`) se eligio para no colisionar con el flag actual de delete (`_rateLimits/checkin_delete_${userId}` — linea 61 de `checkins.ts` actual). El cleanup de `_rateLimits/` ya existe via #240, no requiere accion adicional.

### S4 — `cleanAnonymousData` revoke refresh tokens (1 medium)

Agregar `await getAuth().revokeRefreshTokens(uid)` en `functions/src/callable/cleanAnonymousData.ts:49-50` antes del audit log. Garantiza que el access token actual sigue valido hasta que expire (1h max), pero el cliente no puede hacer refresh — al expirar, no hay forma de volver a la session limpiada. El frontend ya hace `signOut()` despues del callable; el revoke es defense-in-depth si el flow se interrumpe.

Agregar `tokensRevoked: true` al audit log entry. La rule `match /deletionAuditLogs/{docId}` (firestore.rules:272) tiene `allow create, update, delete: if false` — Cloud Functions escribe via admin SDK que bypassea rules, asi que no requiere cambio de rule. Verificar que el dashboard admin de audit logs renderiza el campo (si no, ampliar la vista).

### S5 — Bootstrap admin gating (1 bootstrap) [R14]

Implementar gate post-primer-admin en `functions/src/admin/claims.ts:21-30`:

- Crear documento `config/bootstrap` con campo `adminAssigned: bool`. Inicial: no existe (equivale a `false`).
- En `setAdminClaim`, antes de evaluar `isBootstrap`, leer `config/bootstrap`. Si `adminAssigned === true`, ignorar la rama bootstrap (solo `isExistingAdmin` aplica).
- Tras asignar el primer claim exitoso por la rama bootstrap, escribir `config/bootstrap.adminAssigned = true` en el mismo handler (idempotente — `set({ adminAssigned: true }, { merge: true })`).
- Logging: distinguir entre "bootstrap assignment" y "existing admin assignment" con un campo `via: 'bootstrap' | 'existing_admin' | 'emulator'`.

**Rule de Firestore para `config/bootstrap`**: la matchall actual `match /config/{document=**}` (firestore.rules:248) ya cubre el doc — admin SDK bypassea rules para escritura, y solo admin puede leer. No requiere rule explicita adicional.

**Procedimiento de recovery** (deliverable obligatorio): `docs/procedures/reset-bootstrap-admin.md` documentando:
- **Operadores autorizados**: solo Gonzalo via gcloud directamente (proyecto modo-mapa-prod).
- **Condiciones legitimas**: recovery por perdida de email del primer admin (cuenta deshabilitada, password perdido, MFA roto).
- **Pasos**:
  1. Rotar el secret `ADMIN_EMAIL` en Secret Manager (apuntar al nuevo email).
  2. Resetear `config/bootstrap.adminAssigned = false` via Firebase Admin SDK (snippet incluido en el doc).
  3. La proxima invocacion de `setAdminClaim` con el nuevo email re-bootstrappea.
  4. Verificar audit log: la entrada nueva debe tener `via: 'bootstrap'`.
- **Postcondition**: el doc queda con `adminAssigned: true` para el nuevo email — gate vuelve a estar activo.

UX consideraciones: solo S2 tiene cambio user-facing (toast nuevo + auto-open de `EditorsDialog`). El resto de los workstreams son invisibles al usuario final.

---

## Scope

| Item | Severidad | Esfuerzo |
|------|-----------|----------|
| S1 — `feedback.message` is string guard | High | XS |
| S1 — `userSettings.localityLat/Lng` range check | High | S |
| S1 — `notifications.read` is bool guard | High | XS |
| S1 — `userSettings` affectedKeys consistency refactor | High | S |
| S2 — `inviteListEditor` uniform response (R13) | High | M |
| S2 — `removeListEditor` consistency mirror | High | S |
| S2 — UX: auto-open `EditorsDialog` + `MSG_LIST.invitationProcessed` | High | S |
| S3 — `displayName` whitespace regex | Medium | XS |
| S3 — `displayNameLower == displayName.lower()` equality + co-update | Medium | M |
| S3 — Script de migracion `migrate-displayname-lower-sync.mjs` (audit + apply) | Medium | M |
| S3 — `feedback.mediaUrl` con feedbackId segment | Medium | S |
| S3 — `getFeaturedLists` rate limit 20/day + `FEATURED_LISTS_MAX_PAGE_SIZE=100` (constante local, no afecta `getPublicLists`) + ENFORCE_APP_CHECK fix | Medium | XS |
| S3 — `onCheckInDeleted` enforce create suspension via `_rateLimits/checkin_create_suspended_{uid}` | Medium | S |
| S4 — `cleanAnonymousData` revokeRefreshTokens + `tokensRevoked` en audit log | Medium | XS |
| S5 — Bootstrap admin gate (`config/bootstrap.adminAssigned`) | Bootstrap | M |
| Tests — Cloud Functions coverage para vectores de S1+S3 (cobertura indirecta) | — | M |
| Tests — `inviteListEditor`/`removeListEditor` ampliacion para uniform behavior | — | S |
| Tests — `claims.test.ts` ampliacion para bootstrap gate | — | S |
| Tests — `cleanAnonymousData.test.ts` (NUEVO archivo) | — | S |
| Tests — `triggers/checkins.test.ts` ampliacion para suspension flag | — | S |
| Tests — `featuredLists.test.ts` ampliacion para nuevo cap | — | S |
| Docs — `docs/procedures/reset-bootstrap-admin.md` (NUEVO) | — | S |
| Docs — actualizar `security.md`, `firestore.md`, `guards/300-security.md` | — | S |

**Esfuerzo total estimado:** L (5-7 dias)

---

## Out of Scope

- Migracion de `ADMIN_EMAIL` a Secret Manager (ya tracked en R11 de guard 300-security; pendiente en otro issue).
- Cambios al modelo de auth blocking (`beforeUserCreated` y rate limit IP) — ya cubiertos por #300.
- Refactor de `fanOutToFollowers` o sus rate limits — fuera del scope, ya tracked en #312.
- Reforma del `_rateLimits` schema — seguimos usando el patron actual (Firestore-backed).
- Reemplazar el bootstrap admin path por una solucion server-only (CI script con admin SDK) — el callable sigue existiendo, solo se gatea.
- Removal de `getPublicLists` (admin-only ya esta cubierto). Solo tocamos `getFeaturedLists` (publico).
- **Tests de Firestore rules via `@firebase/rules-unit-testing`** — la infra no existe en el repo. Tracked en [#332](https://github.com/benoffi7/modo-mapa/issues/332). #322 cubre los vectores de ataque indirectamente via tests de Cloud Functions e integracion (los flows que las rules permiten/bloquean igual son ejercitados por triggers y callables, que SI tienen tests).
- Permitir `"."` final en `displayName` (ej: `"L."`, `"Mr."`). La nueva regex lo rechaza deliberadamente. El script de migracion incluye un audit que cuenta usuarios actuales en esa situacion para dar visibilidad pre-deploy. Si el conteo es alto, abrir issue follow-up.

---

## Tests

Politica: >=80% cobertura del codigo nuevo, todos los paths condicionales cubiertos. **No usamos rules tests via emulator** — la infra no existe (tracked en #332). Cubrimos los vectores indirectamente via tests de Cloud Functions y callables.

### Archivos de tests existentes (AMPLIAR — no recrear)

| Archivo | Tipo | Que AGREGAR |
|---------|------|-------------|
| `functions/src/__tests__/admin/claims.test.ts` (existe — 96-109) | Callable | **S5:** primera invocacion bootstrap → setea `config/bootstrap.adminAssigned = true`. Segunda invocacion bootstrap (con flag true) → throws `permission-denied`. Existing admin invocation con flag true → success (no afectado). `via` field en log diferenciado para los 3 paths (`bootstrap`/`existing_admin`/`emulator`) |
| `functions/src/__tests__/callable/inviteListEditor.test.ts` (existe — 11 cases) | Callable | **S2:** algunos tests existentes ROMPEN intencionalmente (los que asserteaban `not-found`/`already-exists`/`invalid-argument` para los 3 paths uniformizados). Reescribir esos tests para esperar `{ success: true }`. Agregar: email no registrado → `{success:true}` + log internal verificado. Email = self → `{success:true}` sin mutacion. Email ya editor → `{success:true}` sin mutacion (idempotente). Mantener: MAX_EDITORS exceeded → `resource-exhausted`. List no encontrada / no owner → siguen throws (info del owner, no leak) |
| `functions/src/__tests__/callable/removeListEditor.test.ts` (existe — 6 cases) | Callable | **S2 mirror:** tests existentes que asserteaban "no es editor" → throws ahora deben asserteear `{ success: true }` (idempotente). Agregar tests de simetria con invite (atacante no puede comparar respuestas) |
| `functions/src/__tests__/triggers/checkins.test.ts` (existe) | Trigger | **S3:** delete count > 20 escribe flag `_rateLimits/checkin_create_suspended_{uid}` con `suspendedUntil` ~24h. Crear despues del flag → `onCheckInCreated` borra el doc + loguea abuse. Crear despues de que `suspendedUntil < now` → permite crear (el flag esta vencido). Crear sin flag → permite (path actual sigue funcionando) |
| `functions/src/__tests__/admin/featuredLists.test.ts` (existe) | Callable | **S3:** rate limit 20/day se enforce (pre-fix era 60). pageSize > 100 se clampa a 100. Confirma que `enforceAppCheck` es ahora `ENFORCE_APP_CHECK` (no _ADMIN) — test puede leer la export config |

### Archivos de tests NUEVOS (CREAR)

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/__tests__/callable/cleanAnonymousData.test.ts` | Callable | **S4:** `revokeRefreshTokens` se llama con uid (mock de admin auth). Audit log entry incluye `tokensRevoked: true`. Falla en `revokeRefreshTokens` no aborta el flow (defense-in-depth — siempre se loguea, audit log se escribe igual con `tokensRevoked: false` y mensaje de error si falla) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo modificado
- Cada hallazgo S1/S3 tiene al menos un test "denies" (caso bloqueado) y un test "allows" (caso valido sigue pasando) — ejercitado via callable/trigger correspondiente
- Los tests deben FALLAR antes del fix y pasar despues — aplicado a tests de Cloud Functions / integracion (no rules tests, que no existen). Si un test pasa antes del fix, el test esta mal escrito o el fix es trivial y debe re-evaluarse.
- Para S2, asserts contra `assert.deepEqual(result, { success: true })` — no `expect(toThrow)` para los casos uniformizados
- Para S5, mockear `getDoc(config/bootstrap)` con tres estados (no existe, false, true) y validar transiciones
- Tests reusan el patron de `vi.hoisted()` + `vi.resetAllMocks()` ya establecido en el repo (ver `functions/src/__tests__/callable/inviteListEditor.test.ts` como referencia)

### Tests de equality bidireccional displayName/displayNameLower (B5)

Aunque `users.test` directo via `@firebase/rules-unit-testing` esta out-of-scope (ver #332), la cobertura del invariante bidireccional se ejercitara indirectamente. Cuando #332 habilite la infra de rules tests, deben existir como minimo los siguientes casos para `users` collection (anotados aca como contract para #332):

| Caso | Pre-estado | Update | Esperado pre-fix | Esperado post-fix |
|------|-----------|--------|------------------|--------------------|
| Update solo `displayNameLower` (vector B5) | `displayName: "Juan"`, `displayNameLower: "juan"` | `{ displayNameLower: "admin" }` | ALLOW (bug) | DENY |
| Update solo `displayName` sin co-update lower | `displayName: "Juan"`, `displayNameLower: "juan"` | `{ displayName: "Maria" }` | ALLOW (bug B4) | DENY |
| Update ambos con match | `displayName: "Juan"`, `displayNameLower: "juan"` | `{ displayName: "Maria", displayNameLower: "maria" }` | ALLOW | ALLOW |
| Update ambos con mismatch | `displayName: "Juan"`, `displayNameLower: "juan"` | `{ displayName: "Maria", displayNameLower: "admin" }` | ALLOW (bug) | DENY |
| Update otros campos sin tocar ninguno | `displayName: "Juan"`, `displayNameLower: "juan"` | `{ bio: "..." }` | ALLOW | ALLOW |

El test del vector B5 (primera fila) es el critico: debe FALLAR antes del fix bidireccional y pasar despues. Si #332 todavia no esta listo cuando se implementa #322, dejar este contrato anotado en `firestore.rules` como comentario referenciando #332 y verificar manualmente via emulator durante el plan de rollout. El plan de implementacion debe documentar esta verificacion manual como deliverable explicito.

### Consideraciones

- `inviteListEditor.test.ts` y `removeListEditor.test.ts` ya tienen tests amplios — algunos VAN A ROMPER por el cambio de comportamiento (deseable). El plan debe indicar explicitamente cuales se reescriben.
- `claims.test.ts` ya cubre el flow actual — solo se amplia para gate.
- `cleanAnonymousData.ts` no tiene tests hoy — este issue cierra esa deuda creando el archivo de cero.
- El script `scripts/migrate-displayname-lower-sync.mjs` no requiere tests unitarios (one-off, idempotente, audit mode permite verificar sin escribir). Documentar en el plan que se ejercita via dry-run en staging antes de prod.

---

## Seguridad

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `feedback.message` (writable por owner) | Spam con array de 50 strings de 1000 chars cada uno (50KB / doc), bypass del limite 1KB | `is string` guard — S1 |
| `notifications.read` (writable por recipient) | Recipient escribe `read: { ...50KB de garbage map... }` para bloat su propia subcoleccion | `is bool` guard — S1 |
| `userSettings.localityLat/Lng` | Cliente escribe `NaN`/`Infinity`, rompe queries geograficas o rendering del mapa al leer back | range check `>=-90 && <=90` rechaza NaN — S1 |
| `inviteListEditor` callable (publico) | Bot enumera emails registrados llamando con cada candidato, comparando `not-found` vs `already-exists` vs `success` | Uniform success response — S2 |
| `users.displayNameLower` (writable por owner) | Owner crea perfil con `displayName: "Juan"` y `displayNameLower: "admin"`, busqueda por "admin" devuelve perfil hijack | Equality check `displayNameLower == displayName.lower()` + co-update obligatorio — S3 |
| `users.displayNameLower` (writable por owner — vector B5) | Atacante mute SOLO `displayNameLower: "admin"` sin tocar `displayName` (bypass del co-update unidireccional) | Equality bidireccional en update: si `displayName` O `displayNameLower` cambia, ambos deben matchear via `request.resource.data.displayNameLower == request.resource.data.displayName.lower()` — S3 |
| `feedback.mediaUrl` (Storage) | Owner reusa URL de feedback A en feedback B (mismo owner) — viola binding feedbackId↔mediaUrl | Regex con `feedbackId` segment — S3 |
| `getFeaturedLists` callable | Bot scraperea 30k items/dia/usuario con auth multi-cuenta | Rate limit 20/day + pageSize max 100 + ENFORCE_APP_CHECK correcto — S3 |
| `checkins` create+delete loop | Atacante hace 100 creates+deletes/dia para inflar `dailyMetrics.checkins_count` (counter solo decrementa hasta 0) | Trigger `onCheckInDeleted` escribe flag `_rateLimits/checkin_create_suspended_{uid}` que `onCheckInCreated` lee y honra — S3 |
| `cleanAnonymousData` callable | Cliente con session "limpiada" sigue actuando 1h con el access token vigente | `revokeRefreshTokens` para invalidar refresh — S4 |
| `setAdminClaim` callable (bootstrap path) | Cuenta del email bootstrap comprometida (phishing) → atacante se hace admin | Gate `config/bootstrap.adminAssigned` — S5 |

### Checklist Firestore rules

- [x] Cada `create` rule tiene `keys().hasOnly()` con whitelist (ya enforced previamente)
- [ ] Cada campo string en `hasOnly()` tiene `is string` previo a `.size()` (S1 — feedback.message)
- [ ] Cada campo bool tiene `is bool` (S1 — notifications.read)
- [ ] Cada campo number con semantica geografica tiene range check ademas de `is number` (S1 — localityLat/Lng)
- [ ] Update rule de userSettings usa `affectedKeys()` consistentemente para todos los campos (S1)
- [ ] Cada campo con `storagePath`/`storageUrl` valida patron regex con `request.auth.uid` Y otros segmentos contextuales (S3 — feedback.mediaUrl con feedbackId)
- [ ] Campo derivado tiene equality check contra fuente (`displayNameLower == displayName.lower()`) en create Y equality **bidireccional** en update — el invariante se gatilla cuando CUALQUIERA de los dos campos esta en `affectedKeys()`, no solo cuando cambia la fuente (S3)
- [ ] Campos string user-facing rechazan whitespace puro/leading/trailing (S3 — displayName)

### Checklist Cloud Functions

- [ ] Callables que aceptan `targetEmail` devuelven respuesta uniforme — no enumeran (S2 — R13)
- [ ] Rate limits para superficies publicas (`getFeaturedLists`) son conservadores y producen costos manejables al cap (S3)
- [ ] Triggers con rate limit que no pueden bloquear el evento (deletes) escriben gate para evento opuesto via path explicitamente leido por el evento opuesto (`onCheckInDeleted` → flag → `onCheckInCreated`) (S3)
- [ ] Callables de cleanup invalidan tokens server-side (`revokeRefreshTokens`) (S4)
- [ ] Bootstrap admin path se cierra tras primer admin asignado (S5 — R14)

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #300 (security critical deps + abuse vectors) | El guard 300-security.md (R12, R13, R14) es el contrato directo que este issue implementa | Aplicar rules R12/R13/R14 al codigo afectado |
| #332 (rules tests infra) | Sofia detecto que la infra de rules tests no existe; #322 hubiera asumido que si | Out of scope para #322; #332 implementa la infra |
| #289 (sharedLists rate limit + rules field gaps) | Tocamos los mismos archivos pero no la misma area | Reusar el patron de tests de callables (vi.hoisted + vi.resetAllMocks) |
| #251 (userSettings rules fix) | Tocamos exactamente el bloque update de userSettings que #251 establecio | El refactor de S1 mantiene compat con #251 — solo agrega type guards y consistencia de affectedKeys |
| #250 (menuPhotos storagePath validation) | Patron de regex con `auth.uid` en path | S3 (`feedback.mediaUrl`) replica el patron extendiendolo con `feedbackId` |
| #240 (rate limit userId cleanup) | Tocamos `_rateLimits/checkin_create_suspended_{uid}` | Schema nuevo de flag de suspension; cleanup existente cubre todo el namespace `_rateLimits/` |
| #208 (users hasOnly) | Ya cerrado, no afectado por este issue (no tocamos `users.create.keys().hasOnly()`) | No accion |

### Mitigacion incorporada

- Cierra R12 (type guards) en todas las superficies user-writable identificadas (S1)
- Cierra R13 (no email enumeration) en los dos callables que aceptan email (S2) — incluyendo UX no-mentirosa via auto-open de `EditorsDialog`
- Cierra R14 (bootstrap admin gate) (S5)
- Refuerza el patron de `affectedKeys()` consistente en update rules (S1) — sirve de modelo para futuras colecciones
- Cubre el archivo `functions/src/callable/cleanAnonymousData.ts` con tests por primera vez (deuda pre-existente)
- Provee script de migracion reutilizable para `displayNameLower` con audit mode — patron transferible a futuros campos derivados

### Tech debt nuevo introducido

- **Procedimiento de recovery del bootstrap admin** (S5): si el primer admin pierde acceso, hay que tocar Firestore manualmente. Documentado como deliverable en `docs/procedures/reset-bootstrap-admin.md` (no es un riesgo abierto — es un procedimiento documentado).

---

## Robustez del codigo

### Checklist de hooks async

- [x] N/A — este issue no agrega hooks de React. Cambios solo en `firestore.rules`, `functions/`, `scripts/` y un toast/dialog en `lists/`

### Checklist de observabilidad

- [ ] `setAdminClaim` log incluye campo `via: 'bootstrap' | 'existing_admin' | 'emulator'` (S5)
- [ ] `inviteListEditor` log internal (no expuesto al cliente) cuando email no se encontro — necesario para debugging de owner que dice "no funciona" (S2)
- [ ] `onCheckInCreated` log abuse cuando rechaza por suspension flag incluye campo `suspended_until: timestamp` para alertas (S3)
- [ ] `cleanAnonymousData` log incluye `tokensRevoked: true|false` en audit log (S4)

### Checklist offline

- [x] N/A — los cambios son server-side. Los flows existentes (lists, feedback, settings) ya tienen su comportamiento offline definido. La unica modificacion UX (S2) opera dentro de `InviteEditorDialog` que ya esta gated por `isOffline` (linea 58)

### Checklist de documentacion

- [ ] `docs/reference/security.md` actualizado con:
  - [ ] Rate limit nuevo de `getFeaturedLists` (20/day, pageSize 100)
  - [ ] Nuevo flag `config/bootstrap.adminAssigned` (S5)
  - [ ] Patron de uniform response en callables que aceptan email (S2)
  - [ ] Flag de suspension `_rateLimits/checkin_create_suspended_{uid}` (S3)
- [ ] `docs/reference/firestore.md` actualizado con:
  - [ ] Type guards explicitos en cada coleccion afectada (S1)
  - [ ] `displayNameLower == displayName.lower()` invariante + co-update (S3)
  - [ ] `config/bootstrap` doc nuevo (S5)
- [ ] `docs/reference/guards/300-security.md`:
  - [ ] Marcar R12, R13, R14 como "implementadas en #322" (link)
  - [ ] **Affected files**: actualizar la lista con los archivos modificados al cierre del issue
- [ ] `docs/procedures/reset-bootstrap-admin.md` (NUEVO — deliverable de S5)
- [ ] `docs/reports/changelog.md` entry

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| `inviteListEditor` callable | Write | Bloqueado offline (callable requires connectivity) | `InviteEditorDialog` ya gated por `isOffline` (linea 58) — no cambia |
| `removeListEditor` callable | Write | Bloqueado offline | Toast existente — sin cambios |
| `setAdminClaim` callable | Write | Bloqueado offline (admin only en /admin) | N/A — admin no soporta offline |
| `cleanAnonymousData` callable | Write | Bloqueado offline (require server-side delete) | Toast — sin cambios |
| Writes a `feedback`, `notifications`, `userSettings` | Write | Cubierto por offline queue existente | Sin cambios |
| Writes a `users` (displayName + displayNameLower co-update) | Write | Cubierto por offline queue existente — el co-update va junto en el mismo write | Sin cambios |
| Auto-open `EditorsDialog` tras invitar (S2) | Read | Cubierto por persistencia offline existente | Sin cambios — el dialog ya maneja su loading state |

### Checklist offline

- [x] Reads de Firestore: no afectado por este issue
- [x] Writes: el offline queue existente seguira funcionando — los rules no rechazan writes legitimos, solo cierran vectores de ataque. El co-update de displayName/displayNameLower es atomico (mismo doc) — compatible con el queue.
- [x] APIs externas: N/A
- [x] UI: el flow nuevo de S2 (auto-open `EditorsDialog`) opera tras un callable que requiere conectividad — no introduce caso edge offline
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: XS

---

## Modularizacion y % monolitico

Este issue toca:

- 1 archivo `firestore.rules` (modificado)
- 6 archivos `functions/src/` (modificados): `admin/claims.ts`, `admin/featuredLists.ts`, `callable/inviteListEditor.ts`, `callable/removeListEditor.ts`, `callable/cleanAnonymousData.ts`, `triggers/checkins.ts`
- 2 archivos `src/` (modificados): `components/lists/InviteEditorDialog.tsx`, `components/lists/ListDetailScreen.tsx`, `constants/messages/list.ts` (S2 UX)
- 1 script nuevo: `scripts/migrate-displayname-lower-sync.mjs`
- 1 doc nuevo: `docs/procedures/reset-bootstrap-admin.md`
- N archivos de tests (modificados/creados en `functions/src/__tests__/`)

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) — el cambio en `ListDetailScreen.tsx` es minimo: nuevo handler dedicado `handleEditorInvited` (refresh + setEditorsOpen) separado del existente `handleEditorsChanged` (solo refresh, usado por `onEditorRemoved`). No hay logica nueva, es coordinacion de dialogs.
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout — N/A
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu — N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout — N/A
- [x] Cada prop de accion tiene un handler real especificado — N/A (no se agregan props nuevas)
- [x] Ningun componente nuevo importa directamente de `firebase/firestore` — N/A
- [x] Archivos en `src/hooks/` contienen al menos un React hook — N/A
- [ ] Ningun archivo nuevo supera 400 lineas — verificar al cerrar (esperado: ningun archivo crece >50 lineas; el script `migrate-displayname-lower-sync.mjs` esperado <200 lineas)
- [x] Converters nuevos van en archivo de dominio correcto — N/A
- [x] Archivos nuevos van en carpeta de dominio correcta — tests en `functions/src/__tests__/{admin|callable|triggers}/`
- [x] Si el feature necesita estado global, evaluar si un contexto existente lo cubre — N/A

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | El cambio en `ListDetailScreen.tsx` es de 1 linea, no aumenta acoplamiento — `handleEditorsChanged` es una funcion local |
| Estado global | = | No tocamos contextos React |
| Firebase coupling | = | Solo cambios en rules y functions; el toast nuevo en frontend no agrega imports de Firebase |
| Organizacion por dominio | = | Tests nuevos van en `__tests__/` adjacent al codigo |

---

## Accesibilidad y UI mobile

El unico cambio user-facing es el toast nuevo + apertura automatica de `EditorsDialog`. Ambos componentes son existentes y ya pasan checklist a11y.

### Checklist de accesibilidad

- [x] Todo `<IconButton>` tiene `aria-label` descriptivo — N/A (no se agregan IconButtons)
- [x] Elementos interactivos usan semantica correcta — N/A
- [x] Touch targets minimo 44x44px — N/A
- [x] Componentes con carga de datos tienen error state — `EditorsDialog` ya lo tiene
- [x] Imagenes con URLs dinamicas tienen `onError` fallback — N/A
- [x] Formularios tienen labels visibles o aria-labels — N/A

### Checklist de copy

- [ ] Mensaje uniforme `MSG_LIST.invitationProcessed` ("Invitación procesada — revisá la lista de editores") en voseo, accionable (no solo "Listo")
- [x] Tono consistente: voseo — `revisá` en lugar de `revisa`
- [x] Strings reutilizables centralizados en `src/constants/messages/list.ts`
- [x] Mensajes de error accionables — el callable mantiene errores existentes para casos legitimos (`resource-exhausted`, `not-found` para list, `permission-denied`); solo unifica los 3 paths de target email

---

## Success Criteria

1. Los 5 hallazgos high estan cerrados con type guards explicitos en `firestore.rules` (S1) y respuesta uniforme en `inviteListEditor`/`removeListEditor` (S2). Tests de Cloud Functions e integracion validan cada vector de ataque listado en la tabla de "Vectores de ataque automatizado" — cada test debe FALLAR antes del fix y pasar despues. (Rules tests directos via emulator quedan cubiertos por #332.)
2. Los 6 hallazgos medium estan cerrados (`displayName` whitespace, `displayNameLower` equality + co-update + script de migracion ejecutado, `feedback.mediaUrl` con feedbackId, `getFeaturedLists` rate limit 20/day + ENFORCE_APP_CHECK fix, `onCheckInDeleted` enforcement real, `cleanAnonymousData` revokeRefreshTokens + audit log enriquecido).
3. El bootstrap admin path queda gateado tras el primer admin asignado: `config/bootstrap.adminAssigned === true` bloquea la rama bootstrap. El procedimiento de recovery esta documentado en `docs/procedures/reset-bootstrap-admin.md` (deliverable nuevo de #322).
4. Coverage de `claims.ts` (ampliacion), `inviteListEditor.ts`, `removeListEditor.ts`, `cleanAnonymousData.ts` (NUEVO test file), y `triggers/checkins.ts` (ampliacion) >= 80%.
5. La UX del flow de invitar editor mantiene feedback util al owner (auto-open de `EditorsDialog`) sin enumerar emails — verificado manualmente en staging con 4 escenarios (email registrado / no registrado / ya editor / self).
6. Auditor de seguridad (proximo health-check) NO encuentra ninguno de los 12 patrones de deteccion documentados en `docs/reference/guards/300-security.md` R12/R13/R14. La regla R12 se actualiza con un comment "verified in #322" y la lista de archivos afectados queda registrada en el guard como referencia historica.
7. El script de migracion `migrate-displayname-lower-sync.mjs` se ejecuto en prod en modo `--audit` (conteo registrado en el ticket) y `--apply` (si fue necesario), con 0 docs en violacion verificado antes del deploy de la rule de equality.

---

## Validacion Funcional

**Analista**: Sofia
**Fecha Ciclo 1**: 2026-04-25
**Fecha Ciclo 2**: 2026-04-25
**Fecha Ciclo 3**: 2026-04-25
**Estado**: VALIDADO CON OBSERVACIONES

### Cerrado en Ciclo 2

- **B1 (rules tests infra)** → resuelto: out-of-scope con referencia a #332. Tabla de Tests, Out of Scope, Success Criteria #1 y "Vectores de ataque" reescritos coherentemente.
- **B2 (paths tests existentes)** → resuelto: tabla de Tests separa "AMPLIAR" (5 archivos con paths reales en `functions/src/__tests__/`) de "CREAR" (`cleanAnonymousData.test.ts`). Para cada test ampliado se documenta que se AGREGA. Se elimino la afirmacion incorrecta sobre claims.ts.
- **B3 (UX uniforme + auto-open EditorsDialog)** → resuelto en S2: copy nuevo `MSG_LIST.invitationProcessed` documentado, casos edge listados (registrado / no registrado / ya editor / self), backend uniform en `inviteListEditor` y `removeListEditor` (mirror).
- **B4 (`displayNameLower` co-update + migracion)** → resuelto: el plan de migracion (script `migrate-displayname-lower-sync.mjs` con audit/apply, rollout en 5 pasos, deliverable obligatorio) es solido.
- **I1 (`displayName` regex)** → resuelto: tradeoff `"L."`/`"Mr."` documentado en Out of Scope; audit del script reporta conteo pre-deploy.
- **I2 (bootstrap recovery)** → resuelto: `docs/procedures/reset-bootstrap-admin.md` deliverable obligatorio con operadores autorizados, condiciones, pasos numerados, postcondition.
- **I3 (`ENFORCE_APP_CHECK_ADMIN` fix)** → resuelto: cambio explicito en S3, test asserts contra la export config.
- **I4 (`onCheckInDeleted` enforcement)** → resuelto: verificado que `checkRateLimit` lee la coleccion directa, no `_rateLimits/`. Nuevo path `_rateLimits/checkin_create_suspended_{uid}` no colisiona con el flag existente `_rateLimits/checkin_delete_${uid}` (linea 61). `onCheckInCreated` lo lee explicitamente despues del `checkRateLimit` actual.
- **I5 (`tokensRevoked` audit log)** → resuelto: confirmado que admin SDK bypassea la rule `match /deletionAuditLogs/{docId}`, no requiere modificarla.
- **O1, O2, O3** → todas aplicadas.

### Cerrado en Ciclo 3 (mini-fix post-Ciclo 2)

- **B5 (equality unidireccional permitia hijack via mutacion solo de `displayNameLower`)** → resuelto. Verificado: la formulacion CEL bidireccional propuesta en S3 (lineas 86-95 del PRD) cierra el vector. Tabla de verdad re-verificada por Sofia caso por caso:
  - `displayName=NO, displayNameLower=NO` → rama 1 TRUE → ALLOW ✓
  - `displayName=SI, displayNameLower=NO` → rama 2 evalua equality; lower viejo no matchea displayName nuevo → DENY ✓
  - `displayName=NO, displayNameLower=SI` (vector B5) → rama 2 evalua equality entre lower nuevo y displayName actual.lower(); si atacante puso "admin" pero displayName quedo "Juan" → DENY ✓
  - `displayName=SI, displayNameLower=SI` con match → rama 2 TRUE → ALLOW ✓
  - `displayName=SI, displayNameLower=SI` sin match → rama 2 FALSE → DENY ✓
  La formulacion es simetrica y elimina el bypass unidireccional. La migracion previa al deploy (S3 paso 2-4) sigue siendo critica para garantizar que docs viejos sin `displayNameLower` no queden bloqueados por la equality cuando el cliente toque otros campos. Documentado.
- **Auto-open `EditorsDialog` espureo en `onEditorRemoved`** → resuelto: S2 separa `handleEditorInvited` (refresh + setEditorsOpen) del `handleEditorsChanged` compartido (solo refresh, usado por `onEditorRemoved`). Verificado contra `ListDetailScreen.tsx` actual: `handleEditorsChanged` se reusa hoy en `onInvited` y `onEditorRemoved` — la separacion en dos handlers es correcta y evita la regresion. ✓
- **`MAX_PAGE_SIZE` global afectaba a `getPublicLists` y `toggleFeaturedList`** → resuelto: S3 introduce `FEATURED_LISTS_MAX_PAGE_SIZE = 100` local, NO modifica `MAX_PAGE_SIZE = 500` (linea 7 de `functions/src/admin/featuredLists.ts`). Verificado contra el archivo: el helper `extractPageSize` (lineas 19-27) usa `MAX_PAGE_SIZE` y es compartido por las tres callables. La constante local solo afecta `getFeaturedLists`. ✓ (ver O4 abajo).

### Observaciones para el implementador

- **O4 (helper `extractPageSize` compartido)**: el helper `extractPageSize` actual (lineas 19-27 de `functions/src/admin/featuredLists.ts`) clampa a `MAX_PAGE_SIZE` que es modulo-level. Para que `getFeaturedLists` use `FEATURED_LISTS_MAX_PAGE_SIZE = 100` sin tocar el cap de `getPublicLists`/`toggleFeaturedList`, el implementador debe decidir entre (a) parametrizar el helper con un cap opcional o (b) hacer un clamp adicional en `getFeaturedLists` post-helper. Decision queda al plan; ambas son funcionalmente equivalentes. No bloqueante.
- **O5 (destino de `MSG_LIST.editorInvited`)**: el PRD agrega `MSG_LIST.invitationProcessed` para reemplazar el toast actual `MSG_LIST.editorInvited(email)`. No queda explicito si la funcion `editorInvited` se elimina o queda muerta. Verificar uso: si nadie mas la usa, eliminar. No bloqueante.
- **O6 (verificacion manual de equality bidireccional via emulator)**: dado que rules tests directos quedan en #332, la verificacion del vector B5 + los otros 4 casos de la tabla de tests bidireccional debe quedar como deliverable explicito del plan de implementacion (manual via Firestore emulator). El PRD ya lo menciona en la seccion Tests pero conviene reforzarlo en el plan: "antes de mergear, ejecutar los 5 casos manualmente contra el emulator". El Ciclo 3 confirma que esto es suficiente como interim — pero el plan debe trackearlo.

### Listo para specs-plan-writer?

**Si.** El PRD esta validado para arrancar specs/plan junto con #323 y #324. Las 3 observaciones (O4, O5, O6) son detalles de plan, no bloqueantes.

### Veredicto firmado

— Sofia (analista funcional senior, equipo Modo Mapa) — Ciclo 3 VALIDADO CON OBSERVACIONES (2026-04-25). B5 cerrado por formulacion bidireccional verificada caso por caso. Los dos fixes de observaciones Ciclo 2 (handler dedicado + constante local) verificados contra el codigo actual. No se introdujo regresion nueva. Tres observaciones de plan trasladadas al implementador.
