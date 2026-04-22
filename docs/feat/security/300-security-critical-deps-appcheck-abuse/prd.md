# PRD: Tech debt de seguridad — dependencias criticas, App Check y vectores de abuso

**Feature:** 300-security-critical-deps-appcheck-abuse
**Categoria:** security
**Fecha:** 2026-04-18
**Issue:** #300
**Prioridad:** Critica (C-1 critical + 4 high + 7 medium)

---

## Contexto

El health-check del 2026-04-18 sobre `new-home` detecto 12 hallazgos de seguridad: una vulnerabilidad critica de ejecucion arbitraria de codigo (`protobufjs <7.5.5` transitivo), tres de severidad alta en Vite + fan-out sin cap + bypass de rate-limit por IP, siete medios en queries sin paginacion, enumeracion de usuarios privados, TOCTOU en follows y rate limits que se contabilizan antes del gate. Varios de estos regresionan trabajo previo (#289 `sharedLists` rate limit, #251 `userSettings`, #240 `_rateLimits` userId cleanup) o se apoyan en configuracion runtime (`APP_CHECK_ENFORCEMENT=enabled`) que nunca fue verificada en produccion despues del deploy.

## Problema

- **C-1 (critica):** `protobufjs <7.5.5` transitivo permite ejecucion arbitraria de codigo via `_.template` / path traversal. Afecta `package-lock.json` y `functions/package-lock.json`. Tambien hay `vite` 7.0.0-7.3.1 con 3 advisories high (path traversal en `.map`, bypass `fs.deny`, lectura arbitraria via WS) y `lodash <=4.17.23` con prototype pollution en el tree principal.
- **H-1 App Check:** `functions/.env:8` tiene `APP_CHECK_ENFORCEMENT=enabled` commiteado pero ese archivo NO se despliega a prod (Firebase Functions v2 ignora `.env` fuera del ambiente); el flag vive en Secret Manager o en variables de runtime del CI. No tenemos verificacion automatizada de que `ENFORCE_APP_CHECK === true` en prod para `cleanAnonymousData`, `reportMenuPhoto`, `writePerfMetrics`, `deleteUserAccount`, `inviteListEditor`, `removeListEditor`.
- **H-3 fan-out sin cap:** `fanOutToFollowers` en `favorites.ts`, `ratings.ts` y `comments.ts` escribe un `activityFeed` item por cada seguidor sin deduplicar ni limitar por destinatario. Un actor con 10k followers que favoritea 10 veces/dia inunda 100k inboxes y la cuenta de Firestore con writes.
- **H-4 beforeUserCreated bypass:** `checkIpRateLimit` hashea la IP completa — atacantes con IPv6 rotan `/128` o proxies y cada uno cuenta como IP nueva. El rate limit se puede eludir ilimitadamente.
- **M-1 scraping listas publicas:** `getFeaturedLists` / `getPublicLists` traen TODA la coleccion sin paginar. Scraper puede enumerar listas publicas sin limite; ademas `getFeaturedLists` no toca paginacion y puede OOM al crecer.
- **M-5 listItems counter drift:** `onListItemCreated` incrementa counter ANTES de chequear rate limit. Cuando excede, borra el doc pero el counter queda inflado.
- **M-6 follows TOCTOU:** regla de follow permite el write si `userSettings` del target NO existe — `profilePublic` default en cliente es `false` pero la regla lo interpreta como "no privado". Atacante con follow rapido antes de que `onUserCreated` cree settings burla la privacidad.
- **M-7 billing amplification:** `onUserSettingsWritten` y `onSharedListCreated` incrementan counters antes del rate-limit check — el atacante paga writes reales aunque el trigger termine borrando.

## Solucion

Abordamos el issue en 5 workstreams priorizados por severidad:

### S1 — Dependencias criticas (C-1, H-2)

- Ejecutar `npm audit fix` en el tree root y en `functions/` (este ultimo requiere `--force` por el breaking change de `@google-cloud/storage`). Validar que `firebase-admin`/`firebase-functions` continuen funcionando contra el emulator.
- Bump de `vite` al parche mas reciente (7.3.1+ que cubre los tres advisories).
- Agregar job `npm audit --audit-level=high` en CI (bloqueante) para prevenir regresiones.

### S2 — App Check enforcement verificacion (H-1)

- Migrar `APP_CHECK_ENFORCEMENT` de `functions/.env` a Secret Manager o variable de runtime del CI (`.github/workflows/deploy.yml`). Documentar en `docs/reference/security.md`.
- Agregar test de integracion en `functions/src/__tests__/appCheckEnforcement.test.ts` que valide `ENFORCE_APP_CHECK === true` cuando `APP_CHECK_ENFORCEMENT=enabled && FUNCTIONS_EMULATOR !== 'true'`.
- Agregar post-deploy check en el workflow: llamar a `cleanAnonymousData` sin App Check token y confirmar rejection.

### S3 — Fan-out y rate limits (H-3, H-4, M-1, M-5, M-6, M-7)

- **Fan-out cap por destinatario** (`functions/src/utils/fanOut.ts`): antes de escribir `activityFeed/{followerId}/items`, chequear cuantos items de `(actorId, type, businessId)` ya existen en las ultimas 24h (usar subcollection index por `(actorId, type, businessId)` o un key dedup en `_fanoutDedup/{hash}`). Saltar si ya existe.
- **IPv6 bucketing** (`functions/src/utils/ipRateLimiter.ts`): cuando la IP sea IPv6 (`includes(':')`), hashear solo los primeros 4 octetos (`/64`). Mantener IPv4 tal cual. Test unitario.
- **Paginacion en admin listas** (`functions/src/admin/featuredLists.ts`): agregar `.limit(100)` + cursor via parametro `startAfter`. Actualizar el panel admin para consumirlo.
- **listItems: rate-limit antes de counter** (`functions/src/triggers/listItems.ts`): reordenar — chequear limite primero, borrar antes de incrementar. Idem `onUserSettingsWritten` y `onSharedListCreated`.
- **follows: exigir userSettings** (`firestore.rules:638-639`): cambiar `!exists(...) || get(...).profilePublic != false` a `exists(...) && get(...).profilePublic == true`. Garantizar que `onUserCreated` crea `userSettings` con `profilePublic: false` (o valor default explicito) — ya se hace en el flujo actual via AuthContext, pero no es atomico. Agregar fallback en `beforeUserCreated` que seed `userSettings` en el mismo blocking function.

### S4 — Rules y enumeration hardening (M-2, M-3, M-4)

- **users read restriction** (`firestore.rules:21`): cambiar `allow read: if request.auth != null` a chequear `resource.data.profilePublic == true` o `resource.id == request.auth.uid`. Esto rompe `searchUsers` solo si hay docs sin `profilePublic` denormalizado — el trigger `onUserSettingsWritten` ya lo sincroniza, pero agregar migracion one-shot para backfill.
- **displayName charset** (`firestore.rules:24-26,32-34`): agregar regex `^[\p{L}\p{N} _.-]{1,30}$` o equivalente CEL (Firestore no soporta `\p{L}` nativo — usar lista conservadora `[A-Za-zÀ-ÿ0-9 _.-]`). Bloquea RTL/ZWJ/control chars.
- **feedback.mediaUrl storagePath validation** (`firestore.rules:191-197`): agregar regex que fuerce `feedback-media/{uid}/` en el path, no solo `firebasestorage.googleapis.com`.

### S5 — Documentacion, changelog y auditoria (L-3, housekeeping)

- Mover `ADMIN_EMAIL` de `functions/.env` a Secret Manager (L-3). Actualizar `functions/src/helpers/assertAdmin.ts` para leerlo.
- Actualizar `docs/reference/security.md` con nuevos patrones (fan-out dedup, IPv6 bucketing, audit CI).
- Agregar entry en `docs/reports/changelog.md`.

UX consideraciones: ninguna de estas correcciones debe afectar la UI visible. La migracion de `users` read requiere verificar que cada consumidor lee solo docs con `profilePublic=true` o su propio doc. Si `searchUsers` rompe, el UserSearchField mostrara resultados incompletos — hay que backfillear el campo denormalizado antes de desplegar la regla.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — `npm audit fix` root + functions + CI gate | Critica | S |
| S1 — bump vite 7.3.1+ | Alta | XS |
| S2 — App Check migration a Secret Manager + test + post-deploy check | Alta | M |
| S3 — fanOut dedup/cap por (actor,type,business,recipient) | Alta | M |
| S3 — IPv6 `/64` bucketing en ipRateLimiter | Alta | S |
| S3 — paginacion getFeaturedLists/getPublicLists | Media | S |
| S3 — listItems/userSettings/sharedLists: rate limit antes de counter | Media | S |
| S3 — follows: exigir userSettings exists + seed en beforeUserCreated | Media | M |
| S4 — users read restriction + backfill profilePublic | Media | M |
| S4 — displayName charset regex | Baja | XS |
| S4 — feedback.mediaUrl storagePath regex | Baja | XS |
| S5 — ADMIN_EMAIL a Secret Manager | Baja | S |
| S5 — docs security.md + changelog + features.md | Baja | XS |

**Esfuerzo total estimado:** L (10-14 dias de trabajo agrupados en 4-5 PRs separados por riesgo)

---

## Out of Scope

- Reforma completa del sistema de rate limiting (seguimos usando `_rateLimits` Firestore-backed, no migramos a Redis/Memorystore).
- reCAPTCHA Enterprise en `beforeUserCreated` — es la alternativa mas robusta a IP rate-limit pero requiere reasignar quota y tocar `enrollment`; queda para issue separado si el IPv6 bucketing no mitiga.
- Auditoria de CSP y headers (se hizo en #236).
- Cambios a la logica de moderacion (`checkModeration`).
- Refactor del trigger `onFollowCreated` — solo tocamos la rule y el seeding de userSettings.

---

## Tests

Politica: >=80% cobertura del codigo nuevo, todos los paths condicionales cubiertos.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/fanOut.ts` | Util | Cap por destinatario, dedup por `(actor,type,business)` en ventana 24h, skip si `profilePublic=false` |
| `functions/src/utils/ipRateLimiter.ts` | Util | Bucketing IPv6 `/64` (hashea solo los primeros 4 octetos), IPv4 sin cambios, edge case IP mixta/unknown |
| `functions/src/triggers/authBlocking.ts` | Trigger | Rate limit por IPv6 bucket, seed de `userSettings` con `profilePublic: false` en creacion anonima |
| `functions/src/triggers/listItems.ts` | Trigger | Rate limit ANTES de counter: si excede no se incrementa, si no excede si |
| `functions/src/admin/featuredLists.ts` | Callable | Paginacion con `limit()` y `startAfter` cursor, orden estable |
| `functions/src/helpers/assertAdmin.ts` | Helper | Lee ADMIN_EMAIL de Secret Manager (mockear secret) |
| `functions/src/__tests__/appCheckEnforcement.test.ts` | Integ | `ENFORCE_APP_CHECK === true` cuando env=enabled y !emulator |
| `firestore.rules` tests (via emulator) | Rules | users read: permite owner + profilePublic=true, deniega ajenos privados; follows: deniega si no existe userSettings target; displayName: deniega RTL/ZWJ; feedback.mediaUrl: deniega URL fuera de `feedback-media/{uid}/` |
| `scripts/backfill-profile-public.mjs` | Script | Itera `users` docs, lee `userSettings`, escribe `profilePublic` si falta. Idempotente, paginado, dry-run flag |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications, counters)
- Tests de rules con `@firebase/rules-unit-testing` para cada cambio

---

## Seguridad

- [x] **Firestore rules:** Modificaciones en `users`, `follows`, `feedback` — todos los cambios validan auth, ownership, regex de campos y mantienen `keys().hasOnly()` existente
- [x] **Sin strings magicos:** Colecciones siguen usando `COLLECTIONS` de `src/config/collections.ts`
- [x] **Sin secretos en codigo:** `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` migran a Secret Manager
- [x] **Rate limiting:** Fan-out dedup reduce billing amplification (H-3); listItems/userSettings/sharedLists corrigen counter drift (M-5, M-7)
- [x] **Moderacion:** sin cambios (moderator.ts no tocado)
- [x] **CSP:** sin cambios (no hay nuevos origenes)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `fanOutToFollowers` | Actor con muchos followers favoritea N veces/dia → 10k·N writes + 10k·N inbox items | Dedup por `(actor,type,business,recipient)` en ventana 24h; cap por destinatario |
| `beforeUserCreated` (IPv6) | Atacante rota sub-IPs `/128` → crea cuentas ilimitadas | Hashear `/64` (primeros 4 hextets) para IPv6 |
| `getFeaturedLists`/`getPublicLists` | Scraper paginado trae toda la coleccion | `.limit(100)` + cursor server-side |
| `searchUsers` via `users` collection | Enumeracion de users privados via prefix `displayNameLower` | Rule: `allow read if resource.data.profilePublic == true || resource.id == auth.uid` |
| `follows` create con target sin userSettings | Seguir antes de que settings exista → bypass privacidad | Exigir `exists(userSettings) && profilePublic == true` |
| `displayName` con RTL/ZWJ/control chars | Impersonacion visual de otros usuarios | Regex charset conservador en rule |
| `feedback.mediaUrl` | Owner substituye URL por cualquier archivo de Firebase Storage | Regex que fuerce prefijo `feedback-media/{uid}/` |

**Firestore rules hardening:**

- [x] Create rule de `users` mantiene `hasOnly()` con whitelist de campos permitidos — no cambia
- [x] `users` read rule pasa a chequear `profilePublic == true || resource.id == auth.uid`
- [x] Update rule de `users` sigue con `affectedKeys().hasOnly(['displayName','displayNameLower','avatarId'])` — agregar regex charset a `displayName`
- [x] `follows` create rule exige `exists(userSettings(target)) && get(...).profilePublic == true`
- [x] `feedback` create/update rule: `mediaUrl` debe matchear `^https://firebasestorage\.googleapis\.com/.*/feedback-media%2F{request.auth.uid}%2F.*`
- [x] Fan-out trigger mantiene rate limit server-side (nueva capa: dedup key por `(actor,type,business,recipient)`)
- [x] Nueva coleccion `_fanoutDedup/{hash}` escribible solo por Cloud Functions admin SDK (rule: `allow read, write: if false`)

**Campos `is list` validados individualmente:** N/A (no agregamos listas nuevas)

**Si el feature agrega campos a userSettings:** N/A (no agregamos campos)

**Si el feature lee datos:** `getFeaturedLists`/`getPublicLists` limitan scraping masivo con `.limit(100)` + cursor.

---

## Deuda tecnica y seguridad

Consultamos issues abiertos con `gh issue list --state open`. Todos los issues abiertos son tech debt y todos menos #168 son nuevos (la mayoria del health-check reciente).

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #301 coverage branches <80% | empeora | cada archivo tocado debe mantener cobertura; agregar tests en este PRD cubre parte |
| #302 performance: bundle + waterfalls | mitiga | bump vite 7.3.1+ puede mejorar build time marginalmente |
| #303 perf-instrumentation untracked Firestore reads | se ve afectado | dedup por fanOut agrega una lectura mas por write; instrumentar con `trackFunctionTiming` y `measureAsync` |
| #306 architecture: prop-drilling + console.error bypass | no afecta | separado |
| #308 privacy: Sentry + Google Maps drift | no afecta | separado |
| #289 sharedLists rate limit (cerrado) | afectado | nuestra correccion de M-7 (rate limit antes de counter) es consistente con #289, validar que `onSharedListCreated` tenga el mismo patron |
| #240 rate limit userId cleanup (cerrado) | afectado | `_rateLimits` sigue siendo la fuente; no introducimos nuevos rate limits fuera de ese patron |
| #251 userSettings rules (cerrado) | mitigacion | rules hardening en este PRD (M-3, M-4) continuan el trabajo de #251 |
| #168 vite/eslint peer deps (bloqueado) | relacionado | bump de vite a 7.3.1 no resuelve #168 pero libera 3 advisories high |

### Mitigacion incorporada

- Corregir counter drift en `onListItemCreated` (M-5) — consistente con patron de #289 en `onSharedListCreated`
- Migrar `ADMIN_EMAIL` a Secret Manager (L-3) — seguridad operacional
- Agregar `npm audit --audit-level=high` en CI — previene regresion de deps criticas
- Paso en plan para auditar que `onUserSettingsWritten`, `onSharedListCreated` y `onListItemCreated` tengan el mismo orden: check rate limit → update counters (M-5, M-7)

---

## Robustez del codigo

### Checklist de hooks async

- [x] N/A — este feature no agrega hooks nuevos al frontend
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — revisado, nuestros archivos nuevos no lo hacen
- [x] Archivos nuevos no superan 300 lineas (warn) ni 400 lineas (blocker)
- [x] Constantes nuevas (como `FANOUT_DEDUP_WINDOW_HOURS`) van en `functions/src/constants/` o `src/constants/`

### Checklist de observabilidad

- [x] Nuevos paths en fanOut y listItems rate-limit instrumentados con `trackFunctionTiming`
- [x] Nuevas lecturas a `_fanoutDedup` instrumentadas con `trackWrite`/`trackRead` si aplica
- [x] No agregamos nuevos `trackEvent` del lado cliente — sin cambios en analytics

### Checklist offline

- [x] N/A — este feature es server-side (Cloud Functions + rules)
- [x] Migraciones/backfill corren como script admin, no desde cliente

### Checklist de documentacion

- [x] `docs/reference/security.md` actualizado con: fan-out dedup, IPv6 bucketing, App Check verification, ADMIN_EMAIL en Secret Manager
- [x] `docs/reference/firestore.md` actualizado con: nueva coleccion `_fanoutDedup` (si se usa)
- [x] `docs/reference/patterns.md` actualizado si introducimos patron `fanout-dedup`
- [x] `docs/reports/changelog.md` con entry para la version que incluye estos fixes

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| App Check env var migration | N/A deploy-time | N/A | N/A |
| `fanOutToFollowers` dedup read | server-side read | N/A (Cloud Function) | N/A |
| `checkIpRateLimit` (IPv6) | server-side write | N/A | N/A |
| `searchUsers` (afectado por rule) | client read | persistencia Firestore usa cache | Lista vacia + toast de error (existente) |
| Backfill `profilePublic` | server-side batch | N/A (script) | N/A |

### Checklist offline

- [x] Reads de Firestore: `searchUsers` sigue usando cache persistente (no cambia)
- [x] Writes: sin nuevos writes desde cliente
- [x] APIs externas: sin cambios
- [x] UI: sin cambios visuales
- [x] Datos criticos: sin cambios

### Esfuerzo offline adicional: XS

---

## Modularizacion y % monolitico

El proyecto esta en ~30% monolitico. Este feature es 95% server-side y no toca componentes UI. Debe mantener el %.

### Checklist modularizacion

- [x] Logica de negocio en `functions/src/utils/` (fanOut, ipRateLimiter) — no se mueve a triggers
- [x] Sin componentes UI nuevos
- [x] Sin nuevos useState globales
- [x] Backfill script en `scripts/` — no en `src/`
- [x] Ningun archivo nuevo importa `firebase/firestore` desde `components/`
- [x] Ningun archivo nuevo supera 400 lineas
- [x] Nuevos helpers van al directorio de dominio correcto (`functions/src/utils/` para utilidades, `functions/src/constants/` para constantes)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | sin cambios UI |
| Estado global | = | sin nuevos contexts |
| Firebase coupling | = | helpers en functions/, cliente sin cambios |
| Organizacion por dominio | = | nuevos archivos en functions/src/utils/, constants/, __tests__/ |

---

## Accesibilidad y UI mobile

N/A — este feature es infra y seguridad server-side. No toca UI.

### Checklist de accesibilidad

- [x] N/A — sin componentes UI nuevos

### Checklist de copy

- [x] N/A — sin strings user-facing nuevos

---

## Success Criteria

1. **Dependencias criticas resueltas:** `npm audit --audit-level=high` devuelve 0 vulnerabilidades en el tree root y en `functions/` post-fix. CI bloquea futuros regresos.
2. **App Check verificado en prod:** tests automatizados confirman que `ENFORCE_APP_CHECK === true` cuando `APP_CHECK_ENFORCEMENT=enabled && !emulator`. Post-deploy smoke check llama a `cleanAnonymousData` sin App Check token y confirma rechazo.
3. **Billing DoS mitigado:** un actor con 10k followers que hace 10 favorites en 24h crea a lo sumo N items de `activityFeed` donde N = min(followers, followers_unicos_con_dedup_window); actualmente son 100k items.
4. **IPv6 rate limit efectivo:** test unitario confirma que 100 IPv6 distintas del mismo `/64` cuentan como 1 IP; IPv4 mantiene comportamiento actual.
5. **Users enumeration bloqueada:** regla `users` read deniega lectura de docs con `profilePublic=false` a no-owners; `searchUsers` solo retorna users publicos (comportamiento existente) + filtrado ahora server-side.
