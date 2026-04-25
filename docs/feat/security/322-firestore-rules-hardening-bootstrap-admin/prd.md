# PRD: Tech debt seguridad — firestore rules type guards + bootstrap admin path

**Feature:** 322-firestore-rules-hardening-bootstrap-admin
**Categoria:** security
**Fecha:** 2026-04-25
**Issue:** [#322](https://github.com/benoffi7/modo-mapa/issues/322)
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

Abordamos los 12 hallazgos en 4 workstreams agrupados por archivo afectado y nivel de riesgo. Todos los cambios son server-side (firestore.rules + Cloud Functions) — no hay UX visible afectada.

### S1 — Type guards en firestore.rules (5 high)

Aplicamos R12 (type guards explicitos) del guard 300-security a las 4 ubicaciones afectadas:

- **`feedback.message`** (firestore.rules:178-181): agregar `request.resource.data.message is string` antes de `.size() > 0 && .size() <= 1000`. Cierra el vector de `.size()` ambiguo (lista/map).
- **`userSettings.localityLat/Lng`** (firestore.rules:401-402, 430-431): mirror del patron de `checkins` (linea 624-628) — `is number && >= -90 && <= 90` para lat, `>= -180 && <= 180` para lng. Rechaza NaN/Infinity como side effect del range check (NaN > -90 es false).
- **`notifications.read`** (firestore.rules:337-338): agregar `request.resource.data.read is bool`. Cierra el vector de map gigante en update.
- **`userSettings` affectedKeys consistency** (firestore.rules:421-431): estandarizar todos los guards a usar `affectedKeys()`. Si el campo no esta en `affectedKeys()`, no se valida (el valor anterior ya paso por la rule de create). Patron canonico: `(!('field' in affectedKeys()) || <typecheck>)`. Aplicar a `notifyFollowers`, `notifyRecommendations`, `notificationDigest`, `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt`, `locality`, `localityLat`, `localityLng`.

### S2 — Email enumeration en `inviteListEditor` (1 high) [R13]

Refactor de `functions/src/callable/inviteListEditor.ts:36-45` para devolver respuesta uniforme. Cambios:

- Si `getUserByEmail` falla con `auth/user-not-found`, NO throw — log internamente y devolver `{ success: true }` (mismo shape que el happy path).
- Si `targetUid === request.auth.uid`, devolver `{ success: true }` sin mutar la lista — no dar pista de que se "auto-invito".
- Si el target ya es editor, devolver `{ success: true }` (idempotente). No `already-exists`.
- Si `editorIds.length >= MAX_EDITORS`, mantener `resource-exhausted` (el owner ya conoce el estado de su propia lista — no leak ajeno).

Tradeoff de UX: el owner pierde feedback explicito ("email no encontrado", "ya es editor"). Mitigacion: el panel de editores muestra la lista actualizada despues de la invitacion. Si el editor no aparece, el owner asume que el email no estaba registrado o ya estaba.

Aplicar el mismo patron a `removeListEditor` para consistencia (no leak por simetria — un atacante podria hacer `invite(email)` luego `remove(email)` y comparar respuestas).

### S3 — Validaciones de campos (5 medium)

- **`displayName` trim + no whitespace** (firestore.rules:30-34, 40-44): cambiar regex a `^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$`. Primer y ultimo char no son espacio. Bloquea `"   "`, `" Juan"`, `"Juan "`.
- **`displayNameLower == displayName.lower()`** (firestore.rules:35-36, 45-46): agregar `request.resource.data.displayNameLower == request.resource.data.displayName.lower()` en create, y la misma chequeo condicional en update si `displayName` esta en `affectedKeys()`. Cierra el hijack de busqueda.
- **`feedback.mediaUrl` con feedbackId segment** (firestore.rules:189, 209): cambiar regex a `^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F` + `request.auth.uid` + `%2F` + `docId` (el path de la regla `match /feedback/{docId}`) + `%2F.*`. Refuerza el binding feedbackId↔mediaUrl.
- **`getFeaturedLists` rate limit + pageSize cap** (`functions/src/admin/featuredLists.ts:136`): bajar rate limit de 60 a 20/dia. Bajar `MAX_PAGE_SIZE` para esta funcion especifica de 500 a 100. (`getPublicLists` queda igual — admin only via `assertAdmin`.) Si los productos quieren mas, paginan.
- **`onCheckInDeleted` enforcement real** (`functions/src/triggers/checkins.ts:60-75`): cuando excede 20 deletes/dia, escribir un flag `_rateLimits/checkin_create_{userId}` con `count: 999, date: today` para que el siguiente create chequee este flag y rechace por 24h. La logica no rompe creates legitimos (el siguiente dia el flag se resetea por la comparacion `date === today`). Conserva el log abuse.

### S4 — `cleanAnonymousData` revoke refresh tokens (1 medium)

Agregar `await getAuth().revokeRefreshTokens(uid)` en `functions/src/callable/cleanAnonymousData.ts:49-50` antes del audit log. Garantiza que el access token actual sigue valido hasta que expire (1h max), pero el cliente no puede hacer refresh — al expirar, no hay forma de volver a la session limpiada. El frontend ya hace `signOut()` despues del callable; el revoke es defense-in-depth si el flow se interrumpe.

### S5 — Bootstrap admin gating (1 bootstrap) [R14]

Implementar gate post-primer-admin en `functions/src/admin/claims.ts:21-30`:

- Crear documento `config/bootstrap` con campo `adminAssigned: bool`. Inicial: no existe (equivale a `false`).
- En `setAdminClaim`, antes de evaluar `isBootstrap`, leer `config/bootstrap`. Si `adminAssigned === true`, ignorar la rama bootstrap (solo `isExistingAdmin` aplica).
- Tras asignar el primer claim exitoso por la rama bootstrap, escribir `config/bootstrap.adminAssigned = true` en el mismo handler (idempotente — `set({ adminAssigned: true }, { merge: true })`).
- Logging: distinguir entre "bootstrap assignment" y "existing admin assignment" con un campo `via: 'bootstrap' | 'existing_admin' | 'emulator'`.

Tradeoff: si el primer admin pierde acceso (cuenta deshabilitada), no hay forma de re-asignar via callable — habra que tocar manualmente Firestore (`config/bootstrap.adminAssigned = false` por admin SDK directo). Documentar el procedimiento en `docs/reference/security.md`.

UX consideraciones: ninguna superficie visible cambia. Los unicos cambios user-facing son los mensajes de error en `inviteListEditor` (S2) — el owner perdio feedback explicito sobre estado del email target, pero gana privacidad para los usuarios potencialmente invitados.

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
| S3 — `displayName` whitespace regex | Medium | XS |
| S3 — `displayNameLower == displayName.lower()` equality | Medium | S |
| S3 — `feedback.mediaUrl` con feedbackId segment | Medium | S |
| S3 — `getFeaturedLists` rate limit 20/day + pageSize 100 | Medium | XS |
| S3 — `onCheckInDeleted` enforce create suspension | Medium | S |
| S4 — `cleanAnonymousData` revokeRefreshTokens | Medium | XS |
| S5 — Bootstrap admin gate (`config/bootstrap.adminAssigned`) | Bootstrap | M |
| Tests — rules emulator coverage para S1+S3 | — | M |
| Tests — `inviteListEditor`/`removeListEditor` uniform behavior | — | S |
| Tests — `claims.ts` bootstrap path gating | — | M |
| Docs — actualizar `security.md` (rate limits + bootstrap procedure) | — | XS |

**Esfuerzo total estimado:** L (5-7 dias en 1-2 PRs separados — S1+S3 reglas Firestore en uno, S2+S4+S5 functions en otro)

---

## Out of Scope

- Migracion de `ADMIN_EMAIL` a Secret Manager (ya tracked en R11 de guard 300-security; pendiente en otro issue).
- Cambios al modelo de auth blocking (`beforeUserCreated` y rate limit IP) — ya cubiertos por #300.
- Refactor de `fanOutToFollowers` o sus rate limits — fuera del scope, ya tracked en #312.
- Reforma del `_rateLimits` schema — seguimos usando el patron actual (Firestore-backed).
- Reemplazar el bootstrap admin path por una solucion server-only (CI script con admin SDK) — el callable sigue existiendo, solo se gatea.
- Removal de `getPublicLists` (admin-only ya esta cubierto). Solo tocamos `getFeaturedLists` (publico).

---

## Tests

Politica: >=80% cobertura del codigo nuevo, todos los paths condicionales cubiertos. Tests de rules via Firestore emulator (patron de #289 / #251).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `firestore.rules` (via emulator) | Rules | **S1 (high):** feedback.message rechaza array/map; localityLat/Lng rechaza NaN/Infinity y >90/<-90/>180/<-180; notifications.read rechaza map; userSettings update con un campo a la vez no rompe por valores legacy en otros campos. **S3 (medium):** displayName rechaza `"   "`, `" x"`, `"x "`; displayNameLower != displayName.lower() rechaza; feedback.mediaUrl sin feedbackId rechaza |
| `functions/src/callable/inviteListEditor.test.ts` | Callable test | **S2 (high):** email no registrado → `{success:true}` (no error). Email = self → `{success:true}`. Email ya editor → `{success:true}` (idempotente). MAX_EDITORS exceeded → throws `resource-exhausted`. List no encontrada → throws `not-found` (info del owner, no leak). Permission denied (no owner) → throws `permission-denied` (info del owner, no leak) |
| `functions/src/callable/removeListEditor.test.ts` | Callable test | Mirror del anterior — uniform response cuando target no es editor o no existe |
| `functions/src/admin/featuredLists.test.ts` | Callable test | **S3 (medium):** rate limit 20/day se enforce; pageSize > 100 se clampa a 100 |
| `functions/src/triggers/checkins.test.ts` | Trigger test | **S3 (medium):** delete count > 20 escribe flag `_rateLimits/checkin_create_{uid}` con `count: 999`. Crear despues del flag falla |
| `functions/src/callable/cleanAnonymousData.test.ts` | Callable test | **S4 (medium):** verifica que `revokeRefreshTokens` se llama con uid (mock de admin auth) |
| `functions/src/admin/claims.test.ts` | Callable test | **S5 (bootstrap):** primera invocacion bootstrap → setea `config/bootstrap.adminAssigned = true`. Segunda invocacion bootstrap (con flag true) → throws `permission-denied`. Existing admin invocation con flag true → success (no afectado). `via` field en log diferenciado |
| `functions/src/admin/__fixtures__/bootstrapState.ts` | Test fixture | Helper para mock de `config/bootstrap` doc en distintos estados (no existe / `false` / `true`) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Cada hallazgo tiene al menos un test "denies" (caso bloqueado) y un test "allows" (caso valido sigue pasando)
- Para S1, los tests rules deben usar payloads reales que disparen el bug pre-fix (ej: `message: ['x'] * 50`) — si el test pasa antes del fix, el test esta mal escrito
- Para S2, asserts contra `assert.deepEqual(result, { success: true })` y `expect(error).toBeUndefined()` — no `expect(toThrow)` para los casos uniformizados
- Para S5, mockear `getDoc(config/bootstrap)` con tres estados (no existe, false, true) y validar transiciones
- Tests rules: usar `firebase-rules-unit-testing` con `assertSucceeds` / `assertFails`

### Consideraciones

- Las rules son idempotentes — se puede testear cada hallazgo de forma aislada
- `inviteListEditor` y `removeListEditor` ya tienen tests (`inviteListEditor.test.ts` con 11 cases, `removeListEditor.test.ts` con 6 cases). Ampliarlos para cubrir el cambio de comportamiento — algunos tests existentes que asserteaban `not-found` van a romper, eso es esperado y deseable
- `claims.ts` no tiene tests hoy (`functions/src/admin/claims.ts` esta en la lista de pendientes en `tests.md`). Este issue cierra esa deuda

---

## Seguridad

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `feedback.message` (writable por owner) | Spam con array de 50 strings de 1000 chars cada uno (50KB / doc), bypass del limite 1KB | `is string` guard — S1 |
| `notifications.read` (writable por recipient) | Recipient escribe `read: { ...50KB de garbage map... }` para bloat su propia subcoleccion | `is bool` guard — S1 |
| `userSettings.localityLat/Lng` | Cliente escribe `NaN`/`Infinity`, rompe queries geograficas o rendering del mapa al leer back | range check `>=-90 && <=90` rechaza NaN — S1 |
| `inviteListEditor` callable (publico) | Bot enumera emails registrados llamando con cada candidato, comparando `not-found` vs `already-exists` vs `success` | Uniform success response — S2 |
| `users.displayNameLower` (writable por owner) | Owner crea perfil con `displayName: "Juan"` y `displayNameLower: "admin"`, busqueda por "admin" devuelve perfil hijack | Equality check `displayNameLower == displayName.lower()` — S3 |
| `feedback.mediaUrl` (Storage) | Owner reusa URL de feedback A en feedback B (mismo owner) — viola binding feedbackId↔mediaUrl | Regex con `feedbackId` segment — S3 |
| `getFeaturedLists` callable | Bot scraperea 30k items/dia/usuario con auth multi-cuenta | Rate limit 20/day + pageSize max 100 — S3 |
| `checkins` create+delete loop | Atacante hace 100 creates+deletes/dia para inflar `dailyMetrics.checkins_count` (counter solo decrementa hasta 0) | Trigger `onCheckInDeleted` suspende creates 24h tras 20 deletes — S3 |
| `cleanAnonymousData` callable | Cliente con session "limpiada" sigue actuando 1h con el access token vigente | `revokeRefreshTokens` para invalidar refresh — S4 |
| `setAdminClaim` callable (bootstrap path) | Cuenta del email bootstrap comprometida (phishing) → atacante se hace admin | Gate `config/bootstrap.adminAssigned` — S5 |

### Checklist Firestore rules

- [x] Cada `create` rule tiene `keys().hasOnly()` con whitelist (ya enforced previamente)
- [ ] Cada campo string en `hasOnly()` tiene `is string` previo a `.size()` (S1 — feedback.message)
- [ ] Cada campo bool tiene `is bool` (S1 — notifications.read)
- [ ] Cada campo number con semantica geografica tiene range check ademas de `is number` (S1 — localityLat/Lng)
- [ ] Update rule de userSettings usa `affectedKeys()` consistentemente para todos los campos (S1)
- [ ] Cada campo con `storagePath`/`storageUrl` valida patron regex con `request.auth.uid` Y otros segmentos contextuales (S3 — feedback.mediaUrl con feedbackId)
- [ ] Campo derivado tiene equality check contra fuente (`displayNameLower == displayName.lower()`) (S3)
- [ ] Campos string user-facing rechazan whitespace puro/leading/trailing (S3 — displayName)

### Checklist Cloud Functions

- [ ] Callables que aceptan `targetEmail` devuelven respuesta uniforme — no enumeran (S2 — R13)
- [ ] Rate limits para superficies publicas (`getFeaturedLists`) son conservadores y producen costos manejables al cap (S3)
- [ ] Triggers con rate limit que no pueden bloquear el evento (deletes) escriben gate para evento opuesto (`onCheckInDeleted` → suspende creates) (S3)
- [ ] Callables de cleanup invalidan tokens server-side (`revokeRefreshTokens`) (S4)
- [ ] Bootstrap admin path se cierra tras primer admin asignado (S5 — R14)

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #300 (security critical deps + abuse vectors) | El guard 300-security.md (R12, R13, R14) es el contrato directo que este issue implementa | Aplicar rules R12/R13/R14 al codigo afectado |
| #289 (sharedLists rate limit + rules field gaps) | Patron de rules tests via emulator | Reusar el patron de `firebase-rules-unit-testing` |
| #251 (userSettings rules fix) | Tocamos exactamente el bloque update de userSettings que #251 establecio | El refactor de S1 mantiene compat con #251 — solo agrega type guards |
| #250 (menuPhotos storagePath validation) | Patron de regex con `auth.uid` en path | S3 (`feedback.mediaUrl`) replica el patron extendiendolo con `feedbackId` |
| #240 (rate limit userId cleanup) | Tocamos `_rateLimits/checkin_create_{uid}` | S3 (`onCheckInDeleted`) escribe en mismo schema, debe ser compat con cleanup |
| #208 (users hasOnly) | Ya cerrado, no afectado por este issue (no tocamos `users.create.keys().hasOnly()`) | No accion |
| Pre-existente — `claims.ts` sin tests | tests.md lista `admin/claims.ts` en pendientes | Este issue cierra la deuda como parte de S5 |

### Mitigacion incorporada

- Cierra R12 (type guards) en todas las superficies user-writable identificadas (S1)
- Cierra R13 (no email enumeration) en los dos callables que aceptan email (S2)
- Cierra R14 (bootstrap admin gate) (S5)
- Agrega tests para `claims.ts` (deuda tecnica pre-existente listada en `tests.md`)
- Refuerza el patron de `affectedKeys()` consistente en update rules (S1) — sirve de modelo para futuras colecciones

### Tech debt nuevo introducido

- **Procedimiento de recovery del bootstrap admin** (S5): si el primer admin pierde acceso, hay que tocar Firestore manualmente. Documentar en `docs/reference/security.md` con un script `scripts/reset-bootstrap-admin.mjs` (admin SDK con ADC). NO incluir el script en este issue — solo documentar el procedimiento manual.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] N/A — este issue no agrega hooks de React. Cambios solo en `firestore.rules` y `functions/`

### Checklist de observabilidad

- [ ] `setAdminClaim` log incluye campo `via: 'bootstrap' | 'existing_admin' | 'emulator'` (S5)
- [ ] `inviteListEditor` log internal (no expuesto al cliente) cuando email no se encontro — necesario para debugging de owner que dice "no funciona" (S2)
- [ ] `onCheckInDeleted` log abuse cuando suspende creates incluye campo `suspension_until: timestamp` para alertas (S3)
- [ ] `cleanAnonymousData` log incluye `tokensRevoked: true` en audit log (S4)

### Checklist offline

- [ ] N/A — los cambios son server-side. Los flows existentes (lists, feedback, settings) ya tienen su comportamiento offline definido

### Checklist de documentacion

- [ ] `docs/reference/security.md` actualizado con:
  - [ ] Rate limit nuevo de `getFeaturedLists` (20/day, pageSize 100)
  - [ ] Nuevo flag `config/bootstrap.adminAssigned` (S5)
  - [ ] Procedimiento de recovery del bootstrap admin
  - [ ] Patron de uniform response en callables que aceptan email (S2)
- [ ] `docs/reference/firestore.md` actualizado con:
  - [ ] Type guards explicitos en cada coleccion afectada (S1)
  - [ ] `displayNameLower == displayName.lower()` invariante (S3)
  - [ ] `config/bootstrap` doc nuevo (S5)
- [ ] `docs/reference/guards/300-security.md`:
  - [ ] Marcar R12, R13, R14 como "implementadas en #322" (link)
- [ ] `docs/reports/changelog.md` entry

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| `inviteListEditor` callable | Write | Bloqueado offline (callable requires connectivity) | Toast existente "Sin conexion" — sin cambios |
| `removeListEditor` callable | Write | Bloqueado offline | Toast existente — sin cambios |
| `setAdminClaim` callable | Write | Bloqueado offline (admin only en /admin) | N/A — admin no soporta offline |
| `cleanAnonymousData` callable | Write | Bloqueado offline (require server-side delete) | Toast — sin cambios |
| Writes a `feedback`, `notifications`, `userSettings` | Write | Cubierto por offline queue existente | Sin cambios |
| Writes a `users` (displayName) | Write | Cubierto por offline queue existente | Sin cambios |

### Checklist offline

- [x] Reads de Firestore: no afectado por este issue
- [x] Writes: el offline queue existente seguira funcionando — los rules no rechazan writes legitimos, solo cierran vectores de ataque
- [x] APIs externas: N/A
- [x] UI: N/A
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: XS

(Solo verificar que tests rules existentes via emulator no rompen el flow offline-replay.)

---

## Modularizacion y % monolitico

Este issue no modifica componentes de UI. Cambios son:

- 1 archivo `firestore.rules` (modificado)
- 4 archivos `functions/src/` (modificados): `admin/claims.ts`, `admin/featuredLists.ts`, `callable/inviteListEditor.ts`, `callable/removeListEditor.ts`, `callable/cleanAnonymousData.ts`, `triggers/checkins.ts`
- N archivos de tests nuevos (`__tests__/`)

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) — N/A
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout — N/A
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu — N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout — N/A
- [x] Cada prop de accion tiene un handler real especificado — N/A
- [ ] Ningun componente nuevo importa directamente de `firebase/firestore` — N/A (no UI)
- [x] Archivos en `src/hooks/` contienen al menos un React hook — N/A
- [ ] Ningun archivo nuevo supera 400 lineas — verificar al cerrar (esperado: ningun archivo crece >50 lineas)
- [x] Converters nuevos van en archivo de dominio correcto — N/A
- [x] Archivos nuevos van en carpeta de dominio correcta — tests en `functions/src/admin/__tests__/`, `functions/src/callable/__tests__/`, `functions/src/triggers/__tests__/`
- [x] Si el feature necesita estado global, evaluar si un contexto existente lo cubre — N/A
- [ ] Ningun archivo nuevo supera 400 lineas — verificar

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No tocamos UI |
| Estado global | = | No tocamos contextos React |
| Firebase coupling | = | Solo cambios en rules y functions |
| Organizacion por dominio | = | Tests nuevos van en `__tests__/` adjacent al codigo |

---

## Accesibilidad y UI mobile

N/A — este issue no introduce UI nueva. Las superficies afectadas son server-side (rules, callables, triggers) y los flujos de UI consumidores (`EditorsDialog` para `inviteListEditor`/`removeListEditor`, `SettingsPanel` para `userSettings`, `FeedbackForm` para `feedback`, `MapAppShell` para `checkins`) no cambian comportamiento visible.

### Checklist de accesibilidad

- [x] Todo `<IconButton>` tiene `aria-label` descriptivo — N/A
- [x] Elementos interactivos usan semantica correcta — N/A
- [x] Touch targets minimo 44x44px — N/A

### Checklist de copy

- [ ] Mensajes de error en `inviteListEditor` cambian a "success generico" — verificar que el toast del owner mantiene tono consistente (no "Invitacion enviada" si no se envio nada). Sugerencia: mensaje neutro tipo "Invitacion procesada" que aplica a los 3 paths uniformes (registrado / no registrado / ya editor)
- [x] Tono consistente: voseo — los mensajes existentes ya estan en voseo
- [x] Strings reutilizables centralizados en `src/constants/messages/` — sugerir mover el mensaje uniforme a `MSG_LIST.invitationProcessed` si no existe

---

## Success Criteria

1. Los 5 hallazgos high estan cerrados con type guards explicitos en `firestore.rules` (S1) y respuesta uniforme en `inviteListEditor`/`removeListEditor` (S2). Tests rules via emulator validan cada vector de ataque listado en la tabla de "Vectores de ataque automatizado" — cada test debe FALLAR antes del fix y pasar despues.
2. Los 6 hallazgos medium estan cerrados (`displayName` whitespace, `displayNameLower` equality, `feedback.mediaUrl` con feedbackId, `getFeaturedLists` rate limit 20/day, `onCheckInDeleted` enforcement real, `cleanAnonymousData` revokeRefreshTokens).
3. El bootstrap admin path queda gateado tras el primer admin asignado: `config/bootstrap.adminAssigned === true` bloquea la rama bootstrap. El procedimiento de recovery esta documentado en `docs/reference/security.md`.
4. Coverage de `claims.ts`, `inviteListEditor.ts`, `removeListEditor.ts`, `cleanAnonymousData.ts`, y `triggers/checkins.ts` >= 80% (cierra deuda pre-existente listada en `tests.md`).
5. Auditor de seguridad (proximo health-check) NO encuentra ninguno de los 12 patrones de deteccion documentados en `docs/reference/guards/300-security.md` R12/R13/R14. La regla R12 se actualiza con un comment "verified in #322" y la lista de archivos afectados queda registrada en el guard como referencia historica.
