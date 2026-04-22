# Specs: Tech debt de seguridad — dependencias criticas, App Check y vectores de abuso

**PRD:** [prd.md](./prd.md)
**Plan:** [plan.md](./plan.md)
**Issue:** #300

---

## Archivos a modificar

### Workstream S1 — Dependencias criticas

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `package.json` | actualizar | bump `vite` a `^7.3.1` (ultima patched) |
| `package-lock.json` | regenerar | via `npm audit fix` — resuelve protobufjs + vite + lodash |
| `functions/package.json` | actualizar | dejar las versiones target; `audit fix --force` solo si el breaking de `@google-cloud/storage` es compatible con nuestro uso (validar con tests) |
| `functions/package-lock.json` | regenerar | via `npm audit fix` (o `--force` con review) |
| `.github/workflows/deploy.yml` | agregar step | `npm audit --audit-level=high` en root y functions (bloqueante) |

### Workstream S2 — App Check enforcement

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `functions/.env` | editar | remover `APP_CHECK_ENFORCEMENT=enabled`; reemplazar con comentario apuntando a Secret Manager |
| `.github/workflows/deploy.yml` | editar | inyectar `APP_CHECK_ENFORCEMENT` via `${{ secrets.APP_CHECK_ENFORCEMENT }}` al paso de `firebase deploy --only functions` o via `firebase functions:config:set`/params |
| `functions/src/helpers/env.ts` | auditar | sin cambios de logica — `process.env.APP_CHECK_ENFORCEMENT` sigue siendo la fuente |
| `functions/src/__tests__/appCheckEnforcement.test.ts` | nuevo | test unitario: mockear `process.env`, confirmar `ENFORCE_APP_CHECK === true` con env=`enabled` y `FUNCTIONS_EMULATOR !== 'true'` |
| `.github/workflows/deploy.yml` | agregar step | post-deploy: `curl` al endpoint callable con JWT auth pero sin App Check token; verificar `403` |
| `docs/reference/security.md` | editar | seccion "App Check — Configuracion": agregar subseccion "Deploy verification" con pasos del post-deploy check |

### Workstream S3 — Fan-out, rate limits, follows

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `functions/src/constants/fanOut.ts` | nuevo | `FANOUT_DEDUP_WINDOW_HOURS = 24`, `FANOUT_MAX_RECIPIENTS_PER_ACTION = 5000` |
| `functions/src/utils/fanOut.ts` | editar | agregar dedup por `(actor,type,business,followerId)` en `_fanoutDedup/{sha256}` con TTL 24h; skip write si dedup existe. Instrumentar con `trackFunctionTiming('fanOut')` |
| `functions/src/utils/ipRateLimiter.ts` | editar | modificar `hashIp(ip)`: si `ip.includes(':')` bucketear primeros 4 hextets (`/64`) antes de SHA-256; IPv4 sin cambios. Agregar `isIpv6(ip)` helper |
| `functions/src/__tests__/utils/fanOut.test.ts` | nuevo | cubrir: primera entrega, dedup hit, skip si `profilePublic=false`, cap por followers=5000 |
| `functions/src/__tests__/utils/ipRateLimiter.test.ts` | editar | agregar cases: IPv6 `/64` bucketing (5 sub-IPs del mismo /64 → 1 bucket), IPv4 sin cambios, IP invalida |
| `functions/src/triggers/listItems.ts` | editar | reordenar: check rate limit ANTES de `incrementCounter`; solo incrementar si pasa el limite |
| `functions/src/triggers/userSettings.ts` | auditar | verificar si `onUserSettingsWritten` incrementa counters antes del rate limit; si es asi, reordenar |
| `functions/src/triggers/sharedLists.ts` | auditar | idem (M-7) |
| `functions/src/admin/featuredLists.ts` | editar | `getFeaturedLists`, `getPublicLists`: agregar `.limit(pageSize)` y `startAfter(cursor)`. Response incluye `nextCursor` (doc snapshot path) |
| `src/services/adminLists.ts` | editar (si existe) | adoptar paginacion en el caller; si no existe, modificar `src/services/admin.ts` |
| `src/components/admin/ListsPanel.tsx` | editar | consumir paginacion (infinite scroll o "Cargar mas") |
| `firestore.rules` | editar | `match /follows/{docId}`: cambiar `!exists(...) \|\| ... != false` a `exists(...) && get(...).profilePublic == true` |
| `firestore.rules` | editar | agregar `match /_fanoutDedup/{docId} { allow read, write: if false; }` |
| `functions/src/triggers/authBlocking.ts` | editar | despues de confirmar alta exitosa del usuario anonimo, seed `userSettings/{uid}` con `profilePublic: false, ...defaults` si no existe (idempotente) |
| `functions/src/triggers/users.ts` | editar (si existe) | onUserCreated similar: garantizar que crea userSettings default |

### Workstream S4 — Rules hardening

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `firestore.rules` | editar | `match /users/{userId}` read: `allow read: if request.auth != null && (request.auth.uid == userId || resource.data.profilePublic == true || isAdmin())` |
| `firestore.rules` | editar | `match /users/{userId}` create/update: agregar validacion charset de `displayName` — regex `matches('^[A-Za-z0-9À-ÿÁÉÍÓÚáéíóúÑñÜü ._-]+$')` (sin soporte `\p{L}` nativo) |
| `firestore.rules` | editar | `match /feedback/{docId}` create/update: `mediaUrl` regex mas estricto: `matches('^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F' + request.auth.uid + '%2F.*')` |
| `firestore.rules` tests | nuevo | suite con `@firebase/rules-unit-testing`: ownership, profilePublic filter, displayName charset, feedback.mediaUrl pattern |
| `scripts/backfill-profile-public.mjs` | nuevo | itera `users` via batches de 500, lee `userSettings/{uid}`, escribe `profilePublic` en `users/{uid}` via admin SDK. Dry-run + flag `--apply`. Idempotente |
| `functions/src/triggers/userSettings.ts` | auditar | confirmar que `onUserSettingsWritten` sincroniza `profilePublic` a `users/{uid}` (denormalizacion ya existe segun #129) — no tocar logica, solo verificar |

### Workstream S5 — Housekeeping

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `functions/src/helpers/assertAdmin.ts` | editar | leer `ADMIN_EMAIL` de Secret Manager (`defineSecret('ADMIN_EMAIL')`) en vez de `process.env.ADMIN_EMAIL` |
| `functions/src/index.ts` | editar | agregar `ADMIN_EMAIL` al `secrets` de cada callable admin |
| `functions/.env` | editar | remover `ADMIN_EMAIL` |
| `docs/reference/security.md` | editar | agregar entrada de ADMIN_EMAIL en Secret Manager, fan-out dedup pattern, IPv6 bucketing |
| `docs/reference/firestore.md` | editar | agregar coleccion `_fanoutDedup` a la tabla |
| `docs/reference/patterns.md` | editar | agregar fila "Fan-out dedup" bajo "Follows y activity feed" |
| `docs/reports/changelog.md` | editar | entry para version post-merge |

---

## Interfaces y tipos

### `functions/src/utils/fanOut.ts`

```ts
interface FanOutData {
  actorId: string;
  actorName: string;
  type: 'rating' | 'comment' | 'favorite';
  businessId: string;
  businessName: string;
  referenceId: string;
}

// Nuevo
function fanOutDedupKey(actorId: string, type: string, businessId: string, followerId: string): string {
  // SHA-256(actor|type|business|follower) → doc ID en _fanoutDedup
}

async function fanOutToFollowers(db: Firestore, data: FanOutData): Promise<void>;
// Interno: antes del batch.set(feedRef, ...), chequear _fanoutDedup/{dedupKey}
// Si existe Y createdAt > now - 24h → skip
// Si no existe → batch.set _fanoutDedup/{dedupKey} con TTL 24h
```

### `functions/src/utils/ipRateLimiter.ts`

```ts
export function isIpv6(ip: string): boolean;
export function bucketIpv6(ip: string): string; // toma primeros 4 hextets
export function hashIp(ip: string): string;
  // si isIpv6 → SHA-256(bucketIpv6(ip))
  // else → SHA-256(ip)
```

### `functions/src/admin/featuredLists.ts`

```ts
interface GetListsRequest {
  databaseId?: string;
  pageSize?: number;       // default 100, max 500
  startAfter?: string;     // doc ID del ultimo item de la pagina anterior
}

interface GetListsResponse {
  lists: ListData[];
  nextCursor: string | null; // doc ID del ultimo item, null si no hay mas
}
```

### `firestore.rules` snippets

```text
match /users/{userId} {
  allow read: if request.auth != null
    && (request.auth.uid == userId
        || resource.data.profilePublic == true
        || isAdmin());
  // create/update: agregar charset validation a displayName
  allow create: if ...
    && request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ ._-]+$')
    && ...
}

match /follows/{docId} {
  allow create: if request.auth != null
    && ...
    && exists(/databases/$(database)/documents/userSettings/$(request.resource.data.followedId))
    && get(/databases/$(database)/documents/userSettings/$(request.resource.data.followedId)).data.profilePublic == true;
}

match /_fanoutDedup/{docId} {
  allow read, write: if false;
}
```

---

## Dependencias y orden de ejecucion

**Grupo 1 (standalone, sin dependencias):**
- S1 dependencias (npm audit fix)
- S3 IPv6 bucketing
- S3 listItems rate limit reorder
- S3 fanOut dedup
- S3 admin lists paginacion
- S5 ADMIN_EMAIL a Secret Manager

**Grupo 2 (requiere backfill previo):**
- S4 users read rule (requiere backfill de `profilePublic` en users)
- S3 follows rule (requiere que `onUserCreated` / `beforeUserCreated` seed userSettings)

**Grupo 3 (requiere Grupo 1 completo):**
- S2 App Check enforcement verification (requiere que el deploy pipeline este operativo)

**Grupo 4 (docs al final):**
- S5 docs + changelog

---

## Errores y edge cases

### Fan-out dedup

- **Dedup doc no existe (primer envio):** escribir doc + feed item.
- **Dedup doc existe con `createdAt < now - 24h`:** borrar doc viejo y escribir uno nuevo + feed item.
- **Dedup doc existe dentro de ventana:** skip (no escribir feed item).
- **Escritura en batch falla:** log con `logger.error` + re-throw (el trigger se reintentara por la config de Firestore functions).

### IPv6 bucketing

- **IPv6 mapped IPv4 (`::ffff:a.b.c.d`):** extraer IPv4 y usar IPv4 flow.
- **IP invalida o `unknown`:** retornar false (comportamiento actual).
- **IPv6 con zone id (`fe80::1%eth0`):** stripear zone id antes de bucketear.

### users read rule

- **User sin `profilePublic` en el doc (backfill pendiente):** el `resource.data.profilePublic == true` falla → solo el owner ve su doc. Ok para el usuario afectado; la mitigacion es ejecutar backfill ANTES del deploy de la rule.
- **Backfill corre en parcial (mitad de users migrados):** deploy de la rule despues del 100% del backfill para evitar rompe `searchUsers`.

### listItems rate limit reorder

- **Race condition:** dos writes del mismo usuario dentro del mismo segundo. `count().get()` es `strong consistency` en Firestore — la segunda transaccion vera la primera. Ok.
- **Admin SDK bypasea rule y escribe directo:** el trigger corre igual, el rate limit aplica solo si `addedBy` es user uid. Ok.

### follows rule

- **Target `userSettings` no existe:** follow denegado (cambio). Previamente permitido. Esto puede romper seguir a usuarios viejos sin settings migrados. Mitigacion: backfill o seed-on-read.
- **Target eligio `profilePublic: false`:** sigue denegado (comportamiento actual).

---

## Plan de rollout

1. **PR 1 (S1 + S5 docs minimo):** `npm audit fix` + CI gate + changelog. Zero breaking changes esperados. Deploy inmediato.
2. **PR 2 (S3 grupo 1):** IPv6 bucketing + listItems reorder + fanOut dedup + admin lists paginacion. Cambios server-side con tests exhaustivos. Deploy con monitoreo de `_fanoutDedup` collection growth.
3. **PR 3 (S5 ADMIN_EMAIL + S2):** ADMIN_EMAIL a Secret Manager + App Check verification en CI. Requiere actualizar GitHub Secrets antes del deploy.
4. **PR 4 (backfill + S4 rules):** correr backfill script en prod, validar, luego merge rules (users read, follows, feedback.mediaUrl, displayName charset). Deploy con rollback plan.
5. **PR 5 (docs):** actualizar `docs/reference/security.md`, `firestore.md`, `patterns.md`. Update `features.md` si corresponde.

---

## Tests

### Archivos a testear

| Archivo | Tipo | Tests nuevos |
|---------|------|-------------|
| `functions/src/utils/fanOut.ts` | Util | Happy path, dedup hit, dedup expirado, profilePublic=false skip, cap en 5000 followers |
| `functions/src/utils/ipRateLimiter.ts` | Util | IPv6 /64 bucketing, IPv4 unchanged, IPv6 mapped IPv4, IP invalida |
| `functions/src/triggers/listItems.ts` | Trigger | Rate limit antes de counter: no exceeded → incrementa; exceeded → borra sin incrementar |
| `functions/src/admin/featuredLists.ts` | Callable | Paginacion con pageSize, nextCursor, startAfter |
| `functions/src/helpers/assertAdmin.ts` | Helper | Lee de Secret Manager (mock) |
| `functions/src/__tests__/appCheckEnforcement.test.ts` | Integ | ENV matrix: enabled+emulator, enabled+prod, disabled+prod, undefined+prod |
| `firestore.rules` (emulator) | Rules | users read profilePublic matrix, follows sin userSettings, displayName charset, feedback.mediaUrl regex |
| `scripts/backfill-profile-public.mjs` | Script | Dry-run imprime, --apply escribe, idempotente, paginacion |

### Casos a cubrir

- [ ] Happy path completo de cada cambio
- [ ] Edge cases: IP mapped, IPv6 zone id, dedup expirado, race entre triggers
- [ ] Error handling: Firestore errors, Secret Manager unavailable, backfill interrupted
- [ ] Side effects: counters NO incrementan cuando se excede limit, `_fanoutDedup` entries escritos
- [ ] Regresion: tests existentes siguen pasando

### Mock strategy

- Firestore Admin SDK: `mockDb()` pattern existente en `functions/src/__tests__/`
- Firestore v1 SDK rules tests: `@firebase/rules-unit-testing` con emulador Firestore en CI
- Secret Manager: mock `defineSecret` → devolver valor fijo
- `@google-cloud/storage` (post `npm audit fix --force`): correr suite completa de admin/backups para detectar breaking

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo (enforced por CI thresholds)
- Todos los paths condicionales cubiertos
- Tests de rules para cada cambio en `firestore.rules`
- Tests de integracion de App Check enforcement en pipeline

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| `npm audit fix --force` rompe functions por breaking de `@google-cloud/storage` | Correr suite completa de admin/backups tests antes de merge; rollback plan documentado |
| Backfill parcial + deploy de users rule deja users privados enumerables | Validar que backfill termine al 100% via admin panel query antes de merge rules |
| Fan-out dedup reduce engagement (notificaciones duplicadas legitimas de acciones distintas) | Dedup por `(actor,type,business,follower)` solo colapsa la misma accion — no distintas. Monitor `dailyMetrics.activityFeed` post-deploy |
| IPv6 /64 bucketing bloquea usuarios legitimos con NAT grande | IPv6 /64 es por hogar/celular individual — bajo riesgo. Monitorear `abuseLogs` por `anon_flood` post-deploy |
| follows rule cambio bloquea seguir a users sin userSettings | Backfill + seed en `beforeUserCreated` asegura que nuevos users siempre tengan settings |
| App Check verification deploy breaks el pipeline si GitHub Secret esta mal configurado | Probar en staging primero |
