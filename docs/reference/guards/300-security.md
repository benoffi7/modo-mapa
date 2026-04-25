# Guard: Security invariants (#300)

Regression-guard para los fixes del issue #300 (tech debt de seguridad — dependencias criticas, App Check enforcement y vectores de abuso). Cada regla aca es un invariante testeable. Si la auditoria encuentra uno de los patrones de deteccion, hay que reabrir #300 o escalar.

## Rules

- **R1 — App Check enforcement en callables user-facing.** Toda funcion `onCall` expuesta a usuarios (`cleanAnonymousData`, `reportMenuPhoto`, `writePerfMetrics`, `deleteUserAccount`, `inviteListEditor`, `removeListEditor`, y cualquier callable nuevo llamable desde el cliente) DEBE declarar `enforceAppCheck: ENFORCE_APP_CHECK` en las opciones de `onCall`. Callables admin-only estan exentos (ya protegidos por `assertAdmin`), pero igual deben setearlo.
- **R2 — CI gate de `npm audit`.** El workflow de deploy (`.github/workflows/deploy.yml`) DEBE correr `npm audit --audit-level=high` bloqueante en el tree root y en `functions/`. Ambos deben retornar 0 vulnerabilidades.
- **R3 — Fan-out con cap por destinatario.** `fanOutToFollowers` (`functions/src/utils/fanOut.ts`) DEBE chequear `_fanoutDedup/{sha256(actor|type|business|follower)}` antes de cada `batch.set(feedRef, ...)`. Si existe y `createdAt > now - FANOUT_DEDUP_WINDOW_HOURS * 3600 * 1000`, skip. Cap total en `FANOUT_MAX_RECIPIENTS_PER_ACTION = 5000`.
- **R4 — IPv6 bucketing a /64 en rate limiter.** `hashIp(ip)` (`functions/src/utils/ipRateLimiter.ts`) DEBE detectar IPv6 via `isIpv6(ip)` y hashear solo los primeros 4 hextets (prefijo `/64`). IPv4 e IPv6-mapped IPv4 (`::ffff:a.b.c.d`) siguen el flujo IPv4.
- **R5 — Paginacion en queries publicas de listas.** `getFeaturedLists` y `getPublicLists` (`functions/src/admin/featuredLists.ts`) DEBEN usar `.limit(pageSize)` (default 100, max 500) + cursor `startAfter(doc)` y devolver `{ lists, nextCursor }`. Ningun caller puede invocar estas funciones sin paginar.
- **R6 — `users` read filtrado por `profilePublic` u ownership.** La rule de `match /users/{userId}` en `firestore.rules` DEBE chequear `request.auth != null && (resource.data.profilePublic == true || request.auth.uid == userId || isAdmin())`. Prohibido volver a `allow read: if request.auth != null`.
- **R7 — `displayName` charset conservador.** La rule de create/update de `users` DEBE incluir `request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ ._-]+$')` (regex equivalente a `^[\p{L}\p{N} _.-]+$` con lista CEL-compatible). Bloquea RTL, ZWJ y control chars.
- **R8 — `feedback.mediaUrl` con prefijo de owner.** Las rules de create/update de `feedback` DEBEN validar que `mediaUrl` matchee el prefijo `feedback-media/{request.auth.uid}/` (regex con URL-encoding `%2F`). No alcanza con chequear el host `firebasestorage.googleapis.com`.
- **R9 — `listItems` trigger: rate limit ANTES del counter.** `onListItemCreated` (`functions/src/triggers/listItems.ts`) DEBE chequear rate limit y borrar el doc ANTES de `incrementCounter`. Mismo patron aplica a `onUserSettingsWritten` y `onSharedListCreated` (ya enforced por #289, no regresar).
- **R10 — `beforeUserCreated` seed de `userSettings`.** El blocking function `beforeUserCreated` (`functions/src/triggers/authBlocking.ts`) DEBE crear `userSettings/{uid}` con al menos `{ profilePublic: false, updatedAt: serverTimestamp() }` de forma idempotente antes de permitir el alta. Garantiza que la rule de `follows` (que exige `exists(userSettings)`) nunca falle por race con `onUserCreated`.
- **R11 — `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` en Secret Manager.** Ninguno de los dos valores puede vivir en `functions/.env`. `assertAdmin` lee `ADMIN_EMAIL` via `defineSecret('ADMIN_EMAIL').value()`, y `APP_CHECK_ENFORCEMENT` se inyecta via GitHub Secret en el workflow de deploy. `functions/.env` puede documentar con comentario que apunte a Secret Manager.
- **R12 — Type guards explicitos en firestore.rules.** Toda regla `create`/`update` que valide tamaños o estructura DEBE chequear el tipo primitivo antes de operar:
  - Strings con `.size()` requieren `is string` (`.size()` aplica a strings, listas y maps).
  - Booleanos requieren `is bool`.
  - Numeros lat/lng requieren `is number` + range check (`>= -90 && <= 90` / `>= -180 && <= 180`).
  - Numeros con semantica de ID (`displayNameLower == displayName.lower()`) requieren equality contra el campo source.
  Aplica especificamente a: `feedback.message`, `notifications.read`, `userSettings.localityLat/localityLng`, `users.displayNameLower`, y cualquier campo nuevo.
- **R13 — Callables que aceptan email no deben enumerar usuarios.** `inviteListEditor`, `removeListEditor`, y cualquier callable que reciba `targetEmail` DEBE devolver respuesta uniforme (success generico) sin importar si el email mapea a un usuario registrado. La accion real (agregar editor, enviar invitacion) se ejecuta solo cuando el usuario existe; la API no leak la existencia.
- **R14 — Bootstrap admin gateado tras primer admin.** `setAdminClaim` (`functions/src/admin/claims.ts`) tiene una rama de bootstrap (`isBootstrap` via `email_verified === true && email === ADMIN_EMAIL`). Esta rama DEBE quedar deshabilitada despues del primer admin asignado: gatear con un flag `config/bootstrap.adminAssigned == true` que el handler setea atomicamente al asignar el primer claim. Una vez asignado, la rama de bootstrap rechaza con `permission-denied`.

## Detection patterns

Patrones de codigo o regex que el auditor de seguridad debe tratar como trip-wire. Cada hallazgo = regresion de #300.

```bash
# R1 — onCall sin enforceAppCheck
rg -n "onCall\\(" functions/src --type ts -A 6 | rg -B 1 "async \\(" | rg -v "enforceAppCheck"

# R2 — deploy workflow sin audit step
rg -n "npm audit --audit-level=high" .github/workflows/deploy.yml

# R3 — fanOutToFollowers que escribe sin consultar _fanoutDedup
rg -n "_fanoutDedup|fanOutDedupKey" functions/src/utils/fanOut.ts
rg -n "batch\\.set\\(feedRef" functions/src/utils/fanOut.ts

# R4 — hashIp sin branch IPv6
rg -n "isIpv6|bucketIpv6" functions/src/utils/ipRateLimiter.ts
rg -n "hashIp" functions/src/utils/ipRateLimiter.ts -A 10 | rg "includes\\(':'\\)"

# R5 — getFeaturedLists / getPublicLists sin limit o cursor
rg -n "getFeaturedLists|getPublicLists" functions/src/admin/featuredLists.ts -A 20 | rg "\\.limit\\(|startAfter\\("

# R6 — users read permissivo
rg -n "match /users/\\{" firestore.rules -A 3 | rg "allow read:"
rg -n "allow read: if request.auth != null;" firestore.rules

# R7 — displayName sin charset validation
rg -n "displayName" firestore.rules | rg -v "matches\\("

# R8 — feedback.mediaUrl sin prefijo owner
rg -n "mediaUrl" firestore.rules -A 2 | rg "feedback-media"

# R9 — listItems: incrementCounter antes de rate limit
rg -n "incrementCounter|checkRateLimit" functions/src/triggers/listItems.ts -A 1

# R10 — beforeUserCreated sin seed de userSettings
rg -n "userSettings" functions/src/triggers/authBlocking.ts

# R11 — secretos en functions/.env
rg -n "^(ADMIN_EMAIL|APP_CHECK_ENFORCEMENT)=" functions/.env
rg -n "defineSecret\\('ADMIN_EMAIL'\\)" functions/src

# R12 — campos sin type guard en firestore.rules
# feedback.message sin "is string"
rg -n "feedback" firestore.rules -A 30 | rg "message" | rg -v "is string"
# notifications.read sin "is bool"
rg -n "notifications" firestore.rules -A 30 | rg "'read'" | rg -v "is bool"
# locality lat/lng sin range check
rg -n "localityLat|localityLng" firestore.rules -A 1 | rg -v ">=|<="
# displayNameLower sin equality contra displayName.lower()
rg -n "displayNameLower" firestore.rules | rg -v "displayName\\.lower\\(\\)"

# R13 — inviteListEditor/removeListEditor con error messages distintos por estado de email
rg -n "no encontrado|no existe|invalid email|user not found|invitarte a vos mismo|ya es editor" functions/src/callable/

# R14 — bootstrap admin sin gate
rg -n "isBootstrap|bootstrap.adminAssigned" functions/src/admin/claims.ts
```

## Correct patterns

Ejemplos minimos con la forma canonica. Copiar y adaptar.

### R1 — onCall con enforceAppCheck

```ts
import { onCall } from 'firebase-functions/v2/https';
import { ENFORCE_APP_CHECK } from '../helpers/env';
import { ADMIN_EMAIL } from '../secrets';

export const reportMenuPhoto = onCall(
  {
    region: 'southamerica-east1',
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [ADMIN_EMAIL],
  },
  async (request) => {
    // ...
  }
);
```

### R3 — fanOut dedup

```ts
const dedupKey = fanOutDedupKey(data.actorId, data.type, data.businessId, followerId);
const dedupRef = db.collection('_fanoutDedup').doc(dedupKey);
const dedupSnap = await dedupRef.get();

if (dedupSnap.exists) {
  const createdAt = dedupSnap.get('createdAt')?.toMillis?.() ?? 0;
  if (Date.now() - createdAt < FANOUT_DEDUP_WINDOW_HOURS * 3_600_000) {
    continue; // skip recipient
  }
}

batch.set(dedupRef, { createdAt: FieldValue.serverTimestamp() });
batch.set(feedRef, feedItem);
```

### R4 — IPv6 /64 bucketing

```ts
export function isIpv6(ip: string): boolean {
  return ip.includes(':') && !ip.startsWith('::ffff:');
}

export function bucketIpv6(ip: string): string {
  const clean = ip.split('%')[0]; // strip zone id
  const hextets = clean.split(':').slice(0, 4);
  return hextets.join(':');
}

export function hashIp(ip: string): string {
  const input = isIpv6(ip) ? bucketIpv6(ip) : ip;
  return createHash('sha256').update(input).digest('hex');
}
```

### R5 — paginacion estable

```ts
const PAGE_MAX = 500;
const pageSize = Math.min(request.data.pageSize ?? 100, PAGE_MAX);
let query = db.collection('lists').orderBy('createdAt', 'desc').limit(pageSize);

if (request.data.startAfter) {
  const cursor = await db.collection('lists').doc(request.data.startAfter).get();
  query = query.startAfter(cursor);
}

const snap = await query.get();
const nextCursor = snap.size === pageSize ? snap.docs[snap.size - 1].id : null;
return { lists: snap.docs.map((d) => d.data()), nextCursor };
```

### R6/R7 — users rule

```text
match /users/{userId} {
  allow read: if request.auth != null
    && (request.auth.uid == userId
        || resource.data.profilePublic == true
        || isAdmin());

  allow create: if request.auth != null
    && request.auth.uid == userId
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() <= 30
    && request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ ._-]+$')
    && request.resource.data.keys().hasOnly(['displayName','displayNameLower','avatarId','profilePublic']);
}
```

### R8 — feedback.mediaUrl

```text
match /feedback/{docId} {
  allow create: if request.auth != null
    && (!('mediaUrl' in request.resource.data)
        || request.resource.data.mediaUrl.matches(
             '^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F'
             + request.auth.uid + '%2F.*'));
}
```

### R9 — listItems reorder

```ts
export const onListItemCreated = onDocumentCreated(
  { document: 'lists/{listId}/items/{itemId}', region: 'southamerica-east1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const exceeded = await checkRateLimit(snap.get('addedBy'), 'listItems.create', 150);
    if (exceeded) {
      await snap.ref.delete();
      await logAbuse('listItems_rate_limit', { userId: snap.get('addedBy') });
      return; // do NOT incrementCounter
    }

    await incrementCounter(db, `lists/${event.params.listId}`, 'itemCount', 1);
    await trackWrite('listItems.create');
  }
);
```

### R10 — beforeUserCreated seed

```ts
export const beforeUserCreated = beforeUserCreatedV2(
  { region: 'southamerica-east1' },
  async (event) => {
    await enforceAnonymousIpRateLimit(event);

    const uid = event.data.uid;
    const settingsRef = db.collection('userSettings').doc(uid);
    await settingsRef.set(
      { profilePublic: false, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
);
```

### R11 — ADMIN_EMAIL via Secret Manager

```ts
// functions/src/secrets.ts
import { defineSecret } from 'firebase-functions/params';
export const ADMIN_EMAIL = defineSecret('ADMIN_EMAIL');

// functions/src/helpers/assertAdmin.ts
import { ADMIN_EMAIL } from '../secrets';
export function assertAdmin(context: CallableRequest) {
  const email = context.auth?.token?.email;
  if (email !== ADMIN_EMAIL.value()) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
}
```

## Related

- PRD: [/docs/feat/security/300-security-critical-deps-appcheck-abuse/prd.md](../../feat/security/300-security-critical-deps-appcheck-abuse/prd.md)
- Specs: [/docs/feat/security/300-security-critical-deps-appcheck-abuse/specs.md](../../feat/security/300-security-critical-deps-appcheck-abuse/specs.md)
- Plan: [/docs/feat/security/300-security-critical-deps-appcheck-abuse/plan.md](../../feat/security/300-security-critical-deps-appcheck-abuse/plan.md)
- Security reference: [/docs/reference/security.md](../security.md)
- Firestore reference: [/docs/reference/firestore.md](../firestore.md)
- Patterns reference: [/docs/reference/patterns.md](../patterns.md)

### Affected files

- `functions/src/utils/fanOut.ts`
- `functions/src/utils/ipRateLimiter.ts`
- `functions/src/constants/fanOut.ts`
- `functions/src/triggers/listItems.ts`
- `functions/src/triggers/authBlocking.ts`
- `functions/src/triggers/userSettings.ts`
- `functions/src/triggers/sharedLists.ts`
- `functions/src/admin/featuredLists.ts`
- `functions/src/helpers/assertAdmin.ts`
- `functions/src/helpers/env.ts`
- `functions/src/secrets.ts`
- `functions/src/index.ts`
- `functions/.env`
- `firestore.rules`
- `.github/workflows/deploy.yml`
- `package.json`, `package-lock.json`, `functions/package.json`, `functions/package-lock.json`
- `scripts/backfill-profile-public.mjs`
- `src/services/admin.ts`
- `src/components/admin/ListsPanel.tsx`

### Related issues

- #289 sharedLists rate limit (patron replicado en listItems)
- #240 `_rateLimits` userId cleanup
- #251 userSettings rules hardening
- #168 vite / eslint peer deps
- #301 coverage branches
- #303 perf instrumentation untracked reads
