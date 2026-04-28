# Specs: Firestore rules type guards + bootstrap admin gate (#322)

**PRD:** [prd.md](prd.md) (Sofia VALIDADO CON OBSERVACIONES, Ciclo 3, 2026-04-25)
**Issue:** [#322](https://github.com/benoffi7/modo-mapa/issues/322)
**Issues relacionadas:** [#332](https://github.com/benoffi7/modo-mapa/issues/332) (rules tests infra — out of scope)
**Fecha:** 2026-04-25

---

## Resumen tecnico

Cinco workstreams (S1..S5) que cierran 12 hallazgos del health-check del 2026-04-25. Sin features nuevas: solo type guards en `firestore.rules`, comportamiento uniforme en callables que aceptan email, gate en bootstrap admin, revoke de refresh tokens en cleanup, enforcement real del rate limit de deletes en checkins, y un cambio UX minimo en el flow de invitar editor.

Los archivos tocados:

- `firestore.rules` (modificado)
- `functions/src/admin/claims.ts`
- `functions/src/admin/featuredLists.ts`
- `functions/src/callable/inviteListEditor.ts`
- `functions/src/callable/removeListEditor.ts`
- `functions/src/callable/cleanAnonymousData.ts`
- `functions/src/triggers/checkins.ts`
- `src/components/lists/InviteEditorDialog.tsx`
- `src/components/lists/ListDetailScreen.tsx`
- `src/constants/messages/list.ts`
- `scripts/migrate-displayname-lower-sync.mjs` (NUEVO)
- `docs/procedures/reset-bootstrap-admin.md` (NUEVO)

Tests:

- AMPLIAR: `functions/src/__tests__/admin/claims.test.ts`, `callable/inviteListEditor.test.ts`, `callable/removeListEditor.test.ts`, `triggers/checkins.test.ts`, `admin/featuredLists.test.ts`
- CREAR: `functions/src/__tests__/callable/cleanAnonymousData.test.ts`

---

## Modelo de datos

Sin tipos TypeScript nuevos a nivel de cliente. Solo cambios en Firestore: un documento nuevo de configuracion server-side y un nuevo path en `_rateLimits/`.

### Documento nuevo: `config/bootstrap`

Usado por S5 para gatear la rama bootstrap de `setAdminClaim`.

```ts
// Firestore document at /config/bootstrap
{
  adminAssigned: boolean,    // true tras primer bootstrap admin asignado
  assignedAt?: Timestamp,    // server-time del primer assignment (informativo)
  assignedTo?: string,       // uid del primer admin (informativo, no PII)
}
```

- Inicial: el doc no existe (equivale a `adminAssigned: false`).
- Lectura: solo admin (cubierto por matchall `match /config/{document=**}` linea 248 de `firestore.rules`).
- Escritura: solo Cloud Functions via admin SDK (matchall tiene `allow write: if false`; admin SDK bypassea rules).

### Documento nuevo: `_rateLimits/checkin_create_suspended_{uid}`

Usado por S3 para gatear `onCheckInCreated` cuando un usuario excedio 20 deletes/dia.

```ts
// Firestore document at /_rateLimits/checkin_create_suspended_{userId}
{
  suspendedUntil: number,    // epoch ms — checkin creates rejected mientras now < suspendedUntil
  reason: 'delete_abuse',
  userId: string,            // mantiene el patron del cleanup de #240
  createdAt: Timestamp,
}
```

- Lectura/escritura: solo Cloud Functions (matchall existente `match /_rateLimits/{docId}` linea 705-707 con `allow read, write: if false`).
- TTL: el cleanup de `_rateLimits/` ya existe via #240 (no requiere accion).
- Path elegido para no colisionar con el flag de delete actual `_rateLimits/checkin_delete_{userId}` (linea 61 de `triggers/checkins.ts`).

### Tipo nuevo en `claims.ts` (informativo, no exportado)

El log de `setAdminClaim` agrega un campo discriminador:

```ts
type AdminAssignmentVia = 'bootstrap' | 'existing_admin' | 'emulator';
```

No requiere agregar al cliente — solo se usa internamente para `logger.info`.

---

## Firestore Rules

Cambios concretos en `firestore.rules`. Todos los snippets usan la sintaxis CEL del archivo actual.

### S1 — Type guards explicitos (R12)

#### `feedback.message` (lineas 178-181 actuales)

Agregar `is string` antes de `.size()`. Aplica al bloque `create`. (El bloque `update` admin-only sobre `status`/`adminResponse`/etc. no toca `message`, asi que no requiere cambio).

```text
allow create: if request.auth != null
  && request.resource.data.keys().hasOnly([...])
  && request.resource.data.userId == request.auth.uid
  && request.resource.data.message is string                  // NEW (R12)
  && request.resource.data.message.size() > 0
  && request.resource.data.message.size() <= 1000
  && ...
```

#### `notifications.read` (linea 337-338)

Agregar `is bool` al update. El campo se valida via `affectedKeys()`.

```text
allow update: if request.auth != null && resource.data.userId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
  && request.resource.data.read is bool;                      // NEW (R12)
```

**Invariante (importante para futuras modificaciones):** el campo `read` SIEMPRE existe en docs de `notifications` — lo crea Cloud Functions via admin SDK con `read: false` al momento de crear la notificacion (no hay path de creacion sin `read`). Por eso `is bool` se evalua incondicionalmente sin gate por `affectedKeys()`. Si en el futuro se agregan otros campos a `affectedKeys().hasOnly([...])` (ej: `archived`, `pinned`), hay que reformular esta linea — usar el patron canonico `(!('read' in affectedKeys) || request.resource.data.read is bool)`. Mientras `read` sea el unico campo updatable, el snippet actual es correcto.

#### `userSettings.localityLat/Lng` range check (lineas 401-402, 430-431)

Mirror del patron de `checkins.location` (lineas 624-628). NaN/Infinity son rechazados como side-effect del range check (en CEL `NaN >= -90` evalua a `false`).

Create:

```text
&& (!('localityLat' in request.resource.data)
    || (request.resource.data.localityLat is number
        && request.resource.data.localityLat >= -90
        && request.resource.data.localityLat <= 90))
&& (!('localityLng' in request.resource.data)
    || (request.resource.data.localityLng is number
        && request.resource.data.localityLng >= -180
        && request.resource.data.localityLng <= 180))
```

Update: idem, pero gateado por `affectedKeys()` (ver siguiente seccion para detalle).

#### `userSettings` update — `affectedKeys()` consistency (lineas 421-431)

Hoy hay inconsistencia: algunos guards usan `affectedKeys()` (correcto), otros leen directo de `request.resource.data` (bloquea updates legitimos a otros campos cuando el doc tiene un valor invalido pre-existente). Estandarizar TODOS los guards a `affectedKeys()`.

Patron canonico para CADA campo del bloque:

```text
&& (!('FIELD' in request.resource.data.diff(resource.data).affectedKeys())
    || <typecheck of request.resource.data.FIELD>)
```

Campos a normalizar (HOY leen directo `request.resource.data`):

- `notifyFollowers`, `notifyRecommendations`, `notificationDigest` (lineas 421-423)
- `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt` (lineas 425-427)
- `locality`, `localityLat`, `localityLng` (lineas 429-431)

**Excepcion explicita — `updatedAt` (linea 432):** mantiene su equality dura actual (`request.resource.data.updatedAt == request.time`). NO se mueve al patron `affectedKeys()`. Razon: es invariante de freshness — el cliente esta obligado a escribir `updatedAt: serverTimestamp()` en CADA update de `userSettings`, sin excepcion. Moverlo a `affectedKeys()` lo haria opcional cuando NO esta en el diff, rompiendo la invariante. La equality dura sigue evaluandose siempre y forza al cliente a incluir el field. Documentado como decision tecnica para evitar que el implementador lo refactore por inercia.

Despues del fix, los guards quedan asi (ejemplo para `notificationDigest`):

```text
// ANTES
&& (!('notificationDigest' in request.resource.data)
    || (request.resource.data.notificationDigest is string
        && request.resource.data.notificationDigest.size() <= 10))

// DESPUES (usa affectedKeys)
&& (!('notificationDigest' in request.resource.data.diff(resource.data).affectedKeys())
    || (request.resource.data.notificationDigest is string
        && request.resource.data.notificationDigest.size() <= 10))
```

### S3 — `displayName` regex con anclaje no-whitespace (lineas 34, 44)

Cambiar de:

```text
&& request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ ._-]+$')
```

a:

```text
&& request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$')
```

**Invariante de aceptacion (verificado):** la regex acepta `displayName` de 1 caracter. El primer literal `[A-Za-z0-9À-ÿ_-]` matchea cualquier alfanumerico/unicode/`_`/`-` solo (ej: `"J"`, `"A"`, `"3"`, `"_"`). El grupo opcional `([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?` puede quedar vacio. El size guard `>= 1` ya esta presente en las rules existentes (linea 33-34). Casos verificados:

| Input | Match | Comentario |
|-------|-------|-----------|
| `"J"` | YES | primer literal solo, grupo vacio |
| `"Juan"` | YES | primer literal + `"uan"` en grupo opcional cerrando con `"n"` |
| `"L."` | NO | termina en `.`, ultimo literal del grupo opcional no acepta `.` |
| `" Pedro"` | NO | empieza con espacio, primer literal no acepta espacio |
| `"a b"` | YES | `"a"` + grupo `" b"` (espacio en medio + `"b"` cerrando) |

Caso de 1 caracter explicitado para evitar que el grupo opcional `(...)?` confunda al lector. Se incluye en el test de specs (test del migration script verifica que `"J"` no aparece como `invalidRegex`).

Tradeoff documentado en PRD Out of Scope: rechaza `"L."`, `"Mr."` (terminados en `.`). El script de migracion audita conteo de usuarios actuales en esa situacion antes del deploy.

Aplicar en bloque `users.create` (linea 34) Y `users.update` (linea 44).

### S3 — `displayNameLower == displayName.lower()` equality bidireccional (R12)

#### Create (linea 35-36)

Agregar equality + obligar el campo:

```text
&& request.resource.data.displayNameLower is string
&& request.resource.data.displayNameLower == request.resource.data.displayName.lower()    // NEW
```

(El campo ya esta en `keys().hasOnly()` linea 29; el cambio es exigirlo siempre y ligarlo al `displayName`.)

#### Update (linea 38-46) — formulacion bidireccional

Sintaxis CEL exacta acordada en PRD Ciclo 3 (tabla de verdad re-verificada por Sofia):

```text
allow update: if request.auth != null && request.auth.uid == userId
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'displayNameLower', 'avatarId'])
  && request.resource.data.displayName is string
  && request.resource.data.displayName.size() > 0
  && request.resource.data.displayName.size() <= 30
  && request.resource.data.displayName.matches('^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$')
  && (!('displayNameLower' in request.resource.data) || request.resource.data.displayNameLower is string)
  && (!('avatarId' in request.resource.data) || request.resource.data.avatarId is string)
  // NEW R12 — equality bidireccional. Si CUALQUIERA de los dos campos esta en
  // affectedKeys, ambos deben matchear. Esto cierra el vector B5 (mutacion
  // unilateral de displayNameLower) y B4 (mutacion unilateral de displayName
  // dejando lower stale).
  && (
    (!('displayName' in request.resource.data.diff(resource.data).affectedKeys())
      && !('displayNameLower' in request.resource.data.diff(resource.data).affectedKeys()))
    || (request.resource.data.displayNameLower == request.resource.data.displayName.lower())
  );
```

Tabla de verdad (re-verificada Ciclo 3 por Sofia):

| `displayName` cambio | `displayNameLower` cambio | Match | Resultado |
|---------------------|--------------------------|-------|-----------|
| NO | NO | n/a | ALLOW (rama 1) |
| SI | NO | (lower viejo vs name nuevo) | DENY si no matchea |
| NO | SI (vector B5) | (lower nuevo vs name actual) | DENY si no matchea — cierra hijack |
| SI | SI | match | ALLOW |
| SI | SI | sin match | DENY |

### S3 — `feedback.mediaUrl` con `feedbackId` segment (lineas 189, 209)

Hoy:

```text
&& request.resource.data.mediaUrl.matches(
     '^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F'
     + request.auth.uid + '%2F.*')
```

Despues — agregar `docId` (parametro de `match /feedback/{docId}`):

```text
&& request.resource.data.mediaUrl.matches(
     '^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F'
     + request.auth.uid + '%2F' + docId + '%2F.*')
```

Aplicar a `create` (linea 189) Y a la rama owner-update sobre `mediaUrl/mediaType` (linea 209).

**Riesgo:** invalida URLs ya escritas que NO tengan el `feedbackId` segment. Mitigacion: el path REAL del Storage upload (server-side, controlado por el cliente actual) ya incluye el `feedbackId` como segundo segmento — **verificado**: `src/services/feedback.ts:53` actual genera `feedback-media/${userId}/${docRef.id}/${mediaFile.name}` (el `docRef.id` es el `feedbackId`). La rule nueva NO introduce regresion en feedbacks creados con la version actual del cliente. Si algun upload muy antiguo (pre-actual implementation) no incluye el segmento, el `update` de owner sobre `mediaUrl/mediaType` se bloqueara para esos feedbacks viejos — riesgo bajo (los uploads se hacen al crear el doc, no se modifican post-creacion). Verificacion ya cerrada; no requiere paso pre-deploy adicional.

---

## Rules impact analysis

Cada query existente que toca colecciones afectadas, contra las nuevas rules.

| Query (origen) | Coleccion | Auth context | Rule que la permite | Cambio? |
|----------------|-----------|--------------|---------------------|---------|
| `users.create` con `{displayName, displayNameLower}` | users | Owner | `users.create` con equality | SI — cliente DEBE incluir `displayNameLower == displayName.lower()` |
| `users.update` con `{displayName, displayNameLower}` (displayName change) | users | Owner | `users.update` bidireccional | SI — cliente DEBE co-actualizar ambos campos |
| `users.update` con solo `{avatarId}` | users | Owner | `users.update` bidireccional rama 1 | NO — `displayName` y `displayNameLower` no estan en affectedKeys |
| `feedback.create` con `mediaUrl` | feedback | Owner | `feedback.create` regex con feedbackId | SI — cliente DEBE incluir feedbackId en el path Storage |
| `feedback.update` owner sobre `mediaUrl` | feedback | Owner | rama owner-update | SI — mismo caso |
| `notifications.update` `{read: true}` | notifications | Recipient | `notifications.update` con `is bool` | NO — existing UI ya escribe bool |
| `userSettings.update` con `localityLat: NaN` | userSettings | Owner | `userSettings.update` con range check | SI — cliente debe enviar valores validos (no era posible legalmente antes igual) |
| `userSettings.update` legitimo con localityLat invalido pre-existente | userSettings | Owner | rama de affectedKeys | NO — affectedKeys solo gatilla validacion si el campo esta en el diff (mejora vs hoy) |
| `setAdminClaim` rama bootstrap (segunda invocacion) | config/bootstrap (read in handler) | bootstrap user | admin SDK bypassea | SI a nivel callable — la handler lee el flag y rechaza |

### Field whitelist check

| Coleccion | Campo nuevo/modificado | En `keys().hasOnly()` create? | En `affectedKeys().hasOnly()` update? | Cambio? |
|-----------|-----------------------|-------------------------------|--------------------------------------|---------|
| users | `displayNameLower` | YES (linea 29 actual) | YES (linea 39 actual) | NO — ya estaba |
| feedback | `mediaUrl` | YES (linea 178 actual) | YES (linea 206 actual) | NO — ya estaba |
| userSettings | `localityLat`, `localityLng` | YES (lineas 379-381) | YES (lineas 411-412) | NO — ya estaba |
| `config/bootstrap` | `adminAssigned`, `assignedAt`, `assignedTo` | n/a | n/a | NO — admin SDK bypassea rules |
| `_rateLimits/checkin_create_suspended_{uid}` | `suspendedUntil`, `reason`, `userId`, `createdAt` | n/a | n/a | NO — admin SDK bypassea rules |

---

## Cloud Functions

### S2 — `inviteListEditor` (R13) uniform response

`functions/src/callable/inviteListEditor.ts`

Cambios concretos al handler (PRD Ciclo 1 + 2 Sofia):

**Imports nuevos (top del archivo):** agregar `import { createHash } from 'crypto';`. El archivo actual NO importa `crypto` — patron consistente con `functions/src/callable/cleanAnonymousData.ts:3` que ya usa el mismo import para hashear UIDs.

```ts
// 1. getUserByEmail throw → log internal, return success
let targetUid: string | null;
try {
  const userRecord = await getAuth().getUserByEmail(targetEmail.toLowerCase().trim());
  targetUid = userRecord.uid;
} catch (err) {
  logger.warn('inviteListEditor: target email not registered', {
    listId,
    ownerUid: request.auth.uid,
    // NO logear el targetEmail en claro — usar hash para correlacion sin PII
    emailHash: createHash('sha256').update(targetEmail.toLowerCase().trim()).digest('hex').slice(0, 12),
  });
  return { success: true };  // R13 — no enumerar
}

// 2. self-invite → success silencioso
if (targetUid === request.auth.uid) {
  return { success: true };
}

// 3. ya editor → success idempotente
const editorIds: string[] = list.editorIds ?? [];
if (editorIds.includes(targetUid)) {
  return { success: true };
}

// 4. Cap excedido → resource-exhausted (info del owner, NO leak)
if (editorIds.length >= MAX_EDITORS) {
  throw new HttpsError('resource-exhausted', 'Máximo 5 editores por lista');
}
```

Errores que SE MANTIENEN (info del owner sobre su propia lista, no leak):

- `unauthenticated` (no auth)
- `invalid-argument` (listId/email faltante)
- `not-found` (lista no existe — info del owner)
- `permission-denied` (no es owner)
- `resource-exhausted` (rate limit + MAX_EDITORS)

Errores que CAMBIAN a `{success: true}`:

- `not-found` cuando email no existe
- `invalid-argument` cuando inviting self
- `already-exists` cuando ya editor

### S2 — `removeListEditor` (mirror)

`functions/src/callable/removeListEditor.ts`

El callable acepta `targetUid` (no email), asi que NO enumera por email. Pero un atacante podria hacer `invite(email)` luego `remove(email)` y comparar respuestas. Para simetria:

- Si `targetUid` no esta en `editorIds`, devolver `{success: true}` (idempotente, sin mutar).
- Mantener todos los demas errores existentes.

```ts
const list = listSnap.data()!;
const editorIds: string[] = list.editorIds ?? [];
if (!editorIds.includes(targetUid)) {
  return { success: true };  // idempotente, no leak
}
// ... continue with arrayRemove update
```

### S3 — `getFeaturedLists` rate limit + page size cap + ENFORCE_APP_CHECK

`functions/src/admin/featuredLists.ts`

Tres cambios en la callable `getFeaturedLists` (linea 128-173):

#### 1. Cambiar `enforceAppCheck`

```ts
// ANTES
export const getFeaturedLists = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
  ...

// DESPUES
import { ENFORCE_APP_CHECK, ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';

export const getFeaturedLists = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  ...
```

`getPublicLists` y `toggleFeaturedList` siguen usando `ENFORCE_APP_CHECK_ADMIN`.

#### 2. Bajar rate limit de 60 a 20/dia

```ts
// linea 136
await checkCallableRateLimit(db, `featured_lists_${request.auth.uid}`, 20, request.auth.uid);
```

#### 3. Cap local de pageSize a 100

**Decision tecnica (Sofia O4)**: parametrizar `extractPageSize` con un cap opcional. Las dos opciones son funcionalmente equivalentes; eligo la parametrizacion porque es mas declarativa y mantiene el helper como fuente unica de la logica (incluyendo el `Math.min/Math.floor/Number.isFinite`):

```ts
// MODIFICAR el helper extractPageSize (lineas 19-27):
function extractPageSize(data: unknown, maxOverride?: number): number {
  const cap = maxOverride ?? MAX_PAGE_SIZE;
  if (data && typeof data === 'object' && 'pageSize' in data) {
    const raw = (data as { pageSize?: unknown }).pageSize;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return Math.min(Math.floor(raw), cap);
    }
  }
  return Math.min(DEFAULT_PAGE_SIZE, cap);  // NEW: tambien clampar el default
}

// AGREGAR la constante local (cerca de la linea 7):
const FEATURED_LISTS_MAX_PAGE_SIZE = 100;

// USAR en getFeaturedLists (linea 137):
const pageSize = extractPageSize(request.data, FEATURED_LISTS_MAX_PAGE_SIZE);
```

**Edge case (Sofia O4)**: el `DEFAULT_PAGE_SIZE = 100` actual es exactamente igual al cap nuevo. Cuando un caller no pasa `pageSize`, hoy obtiene 100; con la nueva firma, obtiene `min(100, 100) = 100`. Sin cambio observable. Si en el futuro alguien sube `DEFAULT_PAGE_SIZE`, el `Math.min(DEFAULT_PAGE_SIZE, cap)` agregado en la rama del default protege contra regresion silenciosa.

`getPublicLists` y `toggleFeaturedList` siguen llamando `extractPageSize(request.data)` sin segundo argumento — el cap general `MAX_PAGE_SIZE = 500` se mantiene.

### S3 — `onCheckInDeleted` enforcement real

`functions/src/triggers/checkins.ts`

#### Cambio 1: `onCheckInDeleted` escribe flag de suspension

Cuando excede 20 deletes/dia (linea 68 actual), ademas del `logAbuse`:

```ts
if (deleteCount >= 20) {
  await logAbuse(db, {
    userId,
    type: 'rate_limit',
    collection: 'checkins_delete',
    detail: `Exceeded 20 checkin deletes/day (count: ${deleteCount + 1})`,
  });

  // NEW: escribir flag de suspension de creates por 24h
  const SUSPENSION_HOURS = 24;
  await db.doc(`_rateLimits/checkin_create_suspended_${userId}`).set({
    suspendedUntil: Date.now() + SUSPENSION_HOURS * 3_600_000,
    reason: 'delete_abuse',
    userId,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

#### Cambio 2: `onCheckInCreated` lee el flag

DESPUES del `checkRateLimit` actual (linea 20-25) y ANTES del `incrementCounter` (linea 37):

```ts
// existing rate limit check
const exceeded = await checkRateLimit(...);
if (exceeded) { ... return; }

// NEW: check suspension flag
const suspensionRef = db.doc(`_rateLimits/checkin_create_suspended_${userId}`);
const suspensionSnap = await suspensionRef.get();
if (suspensionSnap.exists) {
  const suspendedUntil = suspensionSnap.data()?.suspendedUntil as number | undefined;
  if (suspendedUntil && suspendedUntil > Date.now()) {
    await snap.ref.delete();
    await logAbuse(db, {
      userId,
      type: 'rate_limit',
      collection: 'checkins',
      detail: `Create suspended until ${new Date(suspendedUntil).toISOString()} due to delete abuse`,
    });
    return;
  }
}

await incrementCounter(...);
```

Nota: `checkRateLimit` lee la coleccion `checkins` directamente (no `_rateLimits/`), por eso el flag separado funciona como gate adicional sin colisionar con el path existente.

### S4 — `cleanAnonymousData` revoke refresh tokens

`functions/src/callable/cleanAnonymousData.ts`

Cambios:

```ts
import { getAuth } from 'firebase-admin/auth';

// ... existing code ...

const result = await deleteAllUserData(db, uid);

// NEW (S4): revocar refresh tokens server-side
let tokensRevoked = false;
let tokensRevokedError: string | null = null;
try {
  await getAuth().revokeRefreshTokens(uid);
  tokensRevoked = true;
} catch (err) {
  tokensRevokedError = String(err);
  logger.error('Failed to revoke refresh tokens', { uidHash, error: tokensRevokedError });
  // Defense-in-depth: el flow continua igual. Loggeamos el fallo.
}

// audit log entry — agregar tokensRevoked
await db.collection('deletionAuditLogs').add({
  uidHash,
  type: 'anonymous_clean',
  status,
  collectionsProcessed: result.collectionsProcessed,
  collectionsFailed: result.collectionsFailed,
  storageFilesDeleted: result.storageFilesDeleted,
  storageFilesFailed: result.storageFilesFailed,
  aggregatesCorrected: result.aggregatesCorrected,
  durationMs: result.durationMs,
  triggeredBy: 'user',
  tokensRevoked,                        // NEW
  ...(tokensRevokedError ? { tokensRevokedError } : {}),  // NEW (solo en fallo)
  timestamp: FieldValue.serverTimestamp(),
});
```

`getAuth` ya esta importado indirectamente por otros callables; verificar agregar el import explicito.

### S5 — `setAdminClaim` bootstrap gate (R14)

`functions/src/admin/claims.ts`

Cambios al handler `setAdminClaim`:

```ts
import { getFirestore } from 'firebase-admin/firestore';

export const setAdminClaim = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    let via: 'bootstrap' | 'existing_admin' | 'emulator' = 'emulator';

    if (!IS_EMULATOR) {
      const isExistingAdmin = request.auth?.token.admin === true;
      const isBootstrap =
        request.auth?.token.email_verified === true &&
        request.auth?.token.email === ADMIN_EMAIL_PARAM.value();

      // NEW (S5): gate bootstrap path
      let bootstrapAllowed = isBootstrap;
      if (isBootstrap) {
        const db = getFirestore();
        const bootstrapSnap = await db.doc('config/bootstrap').get();
        const adminAssigned = bootstrapSnap.exists && bootstrapSnap.data()?.adminAssigned === true;
        if (adminAssigned) {
          bootstrapAllowed = false;
        }
      }

      if (!isExistingAdmin && !bootstrapAllowed) {
        throw new HttpsError('permission-denied', 'Not authorized to set admin claims');
      }

      via = isExistingAdmin ? 'existing_admin' : 'bootstrap';
    }

    // existing code: merge claims + setCustomUserClaims
    const user = await getAuth().getUser(targetUid);
    const currentClaims = user.customClaims ?? {};
    await getAuth().setCustomUserClaims(targetUid, { ...currentClaims, admin: true });

    // NEW (S5): tras assignment exitoso por rama bootstrap, marcar el flag.
    // Idempotente — set with merge, no toca el doc si ya existe.
    if (via === 'bootstrap') {
      const db = getFirestore();
      await db.doc('config/bootstrap').set({
        adminAssigned: true,
        assignedAt: FieldValue.serverTimestamp(),
        assignedTo: targetUid,
      }, { merge: true });
    }

    logger.info('Admin claim set', {
      targetUid,
      setBy: request.auth?.uid ?? 'emulator',
      via,                                                    // NEW
    });

    return { success: true as const };
  },
);
```

**Race condition analysis (edge case tecnico):** dos invocaciones concurrentes de bootstrap antes de que se setee el flag. Ambas leen `adminAssigned: false` y proceden. El resultado: dos UIDs se marcan admin (uno se sobrescribe en `assignedTo`, ambos quedan con custom claim). En la practica:

- El flujo de bootstrap real es manual, no automatico — el admin lo invoca una sola vez.
- Si pasara: ambos UIDs son admins legitimos (mismo email). El `adminAssigned: true` queda escrito y el gate funciona en futuras invocaciones.
- Mitigacion adicional (no bloqueante): usar transaction para `get + set`. Decision: NO la agregamos en este issue para mantener el cambio minimo. Documentado como observacion del implementador. Si se quiere bulletproof, se puede sumar en seguimiento.

**Edge case: paso 3 (escribir flag) falla post-paso 2 (claim ya seteado):** el orden de operaciones del handler es deliberado y secuencial:

1. `setCustomUserClaims(targetUid, { admin: true })` — paso 2: asigna el claim (Auth API, no Firestore).
2. `db.doc('config/bootstrap').set({ adminAssigned: true, ... }, { merge: true })` — paso 3: marca el flag (Firestore).

Estos dos writes NO son envolvibles en transaction — `setCustomUserClaims` es Auth (Identity Platform), `set` es Firestore. No hay primitiva atomica que cubra ambos servicios.

Si el paso 3 falla (Firestore down, IAM glitch, network timeout), el primer admin queda asignado pero el flag NO se setea, dejando la rama bootstrap abierta hasta remediation manual.

**Decision: opcion (a) — set claim primero, flag despues, sin retry automatico.** Razonamiento:

- Set claim es la accion semanticamente critica (sin claim, el admin no funciona). Si falla, el handler throws y nada queda hecho — comportamiento limpio.
- Set flag es defense-in-depth (cierra la rama bootstrap para futuras invocaciones). Si falla, hay log explicito y ops puede setear manualmente con el procedimiento de `docs/procedures/reset-bootstrap-admin.md` (mismo bash que el reset, pero con `adminAssigned: true`).
- Wrappear con retry automatico (ej: `p-retry`) introduce complejidad sin beneficio: el flujo es manual, ops puede re-invocar el handler (segunda vez: claim ya esta, set is idempotente, flag se escribe).
- Wrappear ambos en una transaction NO es posible (cross-service).
- Opcion (c) — flag primero, claim despues — es peor: si claim falla, queda flag activo SIN admin → bootstrap cerrado sin admin → requiere reset.

**Logging requerido para visibilidad operativa:** envolver el `set` del flag en `try/catch`:

```ts
if (via === 'bootstrap') {
  const db = getFirestore();
  try {
    await db.doc('config/bootstrap').set({
      adminAssigned: true,
      assignedAt: FieldValue.serverTimestamp(),
      assignedTo: targetUid,
    }, { merge: true });
  } catch (flagErr) {
    logger.error('Bootstrap flag write FAILED — manual remediation required', {
      targetUid,
      error: flagErr instanceof Error ? flagErr.message : String(flagErr),
      remediation: 'Set config/bootstrap.adminAssigned manually via reset-bootstrap-admin.md procedure',
    });
    // NO re-throw — el claim ya se asigno, no queremos engañar al cliente con success:false
  }
}
```

El `logger.error` dispara alerta en Sentry; ops sigue el procedimiento documentado para setear el flag manualmente. Documentar este edge case en `docs/procedures/reset-bootstrap-admin.md` como variante "Variante: claim asignado pero flag no escrito".

**Rate limiting en `setAdminClaim`:** decision documentada — NO aplicamos rate limit. Razonamiento: el threat real del bootstrap path es email comprometido (atacante controla `ADMIN_EMAIL` y se autentica con email_verified: true). Un rate limit de N/hora no mitiga ese ataque — el atacante solo necesita UNA invocacion exitosa para asignarse admin claim. El gate real es (1) email verificado coincide con secret `ADMIN_EMAIL`, (2) flag `config/bootstrap.adminAssigned` no esta seteado. Una vez asignado el primer admin, la rama bootstrap se cierra y futuras invocaciones requieren `existing_admin === true` (que ya tiene rate limit implicito por ser una callable admin-only). La mitigacion ante compromiso del email es la rotacion del secret + reset del flag (`docs/procedures/reset-bootstrap-admin.md`), NO un rate limit. Documentar explicitamente en el handler con un comment para evitar que un futuro auditor lo agregue por inercia:

```ts
// NO rate limit on setAdminClaim. Threat model: see specs S5 — bootstrap is email+flag gated;
// rate limit does not mitigate compromised ADMIN_EMAIL. Existing-admin path is naturally
// rate-limited by being admin-only.
```

`removeAdminClaim` no cambia.

---

## Seed Data

No aplica. Este issue no introduce colecciones nuevas escribibles por usuarios. El doc `config/bootstrap` y los flags `_rateLimits/checkin_create_suspended_*` son escritos por Cloud Functions on-demand. Los emuladores arrancan sin esos docs (estado equivalente a `adminAssigned: false`, sin suspensiones), que es el estado canonico inicial.

---

## Componentes

### `InviteEditorDialog` (modificado)

`src/components/lists/InviteEditorDialog.tsx`

Cambios:

1. Toast nuevo: en vez de `MSG_LIST.editorInvited(email.trim())` (parametrizado), usar `MSG_LIST.invitationProcessed` (constante).
2. El callback `onInvited()` se sigue llamando — el cambio de comportamiento esta en el padre (ListDetailScreen separa `handleEditorInvited` de `handleEditorsChanged`).
3. Sin cambios en la firma de props.

```tsx
// Solo cambia esta linea:
toast.success(MSG_LIST.invitationProcessed);
setEmail('');
onClose();
onInvited();
```

### `ListDetailScreen` (modificado)

`src/components/lists/ListDetailScreen.tsx`

Cambios:

1. Agregar handler dedicado `handleEditorInvited`:

```tsx
const handleEditorInvited = useCallback(async () => {
  await handleEditorsChanged();    // refresh editorIds
  setEditorsOpen(true);            // auto-open EditorsDialog (idempotente — ver nota)
}, [handleEditorsChanged]);
```

**Idempotencia visible de `setEditorsOpen(true)`:** la llamada es idempotente. Si `editorsOpen === false` al momento de invocar, el state pasa a `true` y MUI monta el `<Dialog>`. Si `editorsOpen === true` (caso teorico actual: no existe path de invite-from-inside-editors, pero un futuro change podria abrirlo desde el dialog mismo), React no dispara re-render porque el state value no cambia (`Object.is(true, true) === true`); el `<Dialog>` ya montado no se re-monta. Sin glitch visual, sin flicker, sin doble-mount. La idempotencia esta garantizada por React state setter semantics + MUI Dialog stable mount. Documentado para que un futuro reviewer no se preocupe por el caso "ya abierto".

2. Pasar `handleEditorInvited` (no `handleEditorsChanged`) al `InviteEditorDialog.onInvited`:

```tsx
// linea 273-278 actual
<InviteEditorDialog
  listId={inviteOpen ? list.id : null}
  onClose={() => setInviteOpen(false)}
  onInvited={handleEditorInvited}    // CAMBIO: era handleEditorsChanged
/>
```

3. `EditorsDialog.onEditorRemoved` SIGUE usando `handleEditorsChanged` (refresh sin tocar `editorsOpen`). Sin cambios en linea 268.

Esta separacion cierra la regresion identificada en Ciclo 2 Sofia: si `handleEditorsChanged` abriera el dialog, removiendo un editor desde EditorsDialog reabriria espureamente el dialog tras el refresh.

### Mutable prop audit

| Componente | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|--------------------|-----------------|
| InviteEditorDialog | `listId`, `onClose`, `onInvited` | n/a (dialog ad-hoc) | NO — dialog no muta el padre directamente; solo dispara callbacks | onInvited (existente, semantica preservada) |
| ListDetailScreen | `list: SharedList` | n/a (sin cambios) | YES (ya existe — `editorIds`, `currentColor`, etc.) | onBack, onDeleted (existentes) |

No hay nuevos props mutables. El cambio es estrictamente coordinacion interna de dialogs.

---

## Textos de usuario

### Constante nueva en `src/constants/messages/list.ts`

| Clave | Valor | Donde se usa | Notas |
|-------|-------|--------------|-------|
| `invitationProcessed` | `'Invitación procesada — revisá la lista de editores'` | Toast en `InviteEditorDialog` tras success | Voseo (`revisá`), tilde en `Invitación` |

### Decision sobre `MSG_LIST.editorInvited` (Sofia O5)

Verificado via grep: la unica referencia a `MSG_LIST.editorInvited` es la linea 37 de `InviteEditorDialog.tsx`, que se reemplaza por `invitationProcessed`. **Decision tecnica**: ELIMINAR `editorInvited` de `src/constants/messages/list.ts`. No tiene otros consumidores, mantenerla seria deuda (una constante muerta + una funcion parametrizada que ya no se necesita).

```ts
// REMOVER linea 21:
// editorInvited: (email: string) => `Editor invitado: ${email}` as const,

// AGREGAR (orden alfabetico no aplica — el archivo no lo respeta):
invitationProcessed: 'Invitación procesada — revisá la lista de editores',
```

`MSG_LIST.editorInviteError` se mantiene (sigue usado en el catch de `handleInvite`).

### Reglas aplicadas

- Voseo: `revisá` (no `revisa`).
- Tildes: `Invitación`.
- Tono: el copy es deliberadamente vago sobre el resultado para no permitir enumeration. El feedback "real" lo da el auto-open de `EditorsDialog` que muestra (o no) al supuesto invitado.

---

## Hooks

No se agregan hooks de React. Los cambios en `src/components/lists/` son coordinacion local de state.

---

## Servicios

No se agregan servicios. `inviteEditor` (en `src/services/sharedLists.ts`) sigue siendo el llamador de la callable — el cambio de comportamiento es en la callable, no en el wrapper.

---

## Migracion: `scripts/migrate-displayname-lower-sync.mjs`

Deliverable obligatorio para S3 (paso 1 del rollout).

### Especificacion

**Path:** `scripts/migrate-displayname-lower-sync.mjs`

Reusa la logica de `scripts/migrateDisplayNameLower.ts` como base, con mejoras:

- ESM (`.mjs`) consistente con otros scripts recientes del repo.
- Usa Firebase Admin SDK (credenciales via `GOOGLE_APPLICATION_CREDENTIALS`).
- Dos modos: `--audit` (default, no escribe) y `--apply` (commits batch).
- Output estructurado (counts por categoria).

### Precondition check (handling de `GOOGLE_APPLICATION_CREDENTIALS`)

Al inicio del script, verificar que el env var este seteada y fallar fast con mensaje accionable. Patron consistente con `scripts/migrateDisplayNameLower.ts` existente:

```js
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS env var not set.');
  console.error('Set it to the path of a service account JSON with Firestore read/write access.');
  console.error('Example: export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json');
  process.exit(1);
}
```

Esta precondition se ejecuta antes de `initializeApp()` para que el error sea claro (no un stack trace de Admin SDK). Documentar en el header del script como comment.

### Modos

**Audit (default):**

```bash
node scripts/migrate-displayname-lower-sync.mjs --audit
# o sin flag: node scripts/migrate-displayname-lower-sync.mjs
```

Output esperado:

```text
Scanning users collection...
Total users: 12345

Issues:
  Missing displayNameLower: 23
  Desynced (lower !== name.toLowerCase()): 5
  Invalid displayName regex (post-fix would block): 12

Sample UIDs in violation (max 20):
  - abc123 (missing)
  - def456 (desync: name="Juan", lower="juan ")
  - ...

Sample UIDs with invalid displayName regex (max 20):
  - ghi789: "Mr."
  - jkl012: " Pedro"
  - ...

DRY RUN — no writes. Re-run with --apply to migrate.
```

**Apply:**

```bash
node scripts/migrate-displayname-lower-sync.mjs --apply
```

- Solo migra los casos `missing` + `desync`.
- NO modifica usuarios con `displayName` invalido por la nueva regex (eso requiere decision humana — abrir issue follow-up si el conteo es alto).
- Batch size 500 (limit de Firestore writes en transaction batch).
- Output: `Updated N of M users.`

### Logica detallada

```js
// Pseudocode del script
const usersSnap = await db.collection('users').get();

let missing = 0, desync = 0, invalidRegex = 0;
const sampleMissing = [], sampleDesync = [], sampleInvalid = [];

const NEW_REGEX = /^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$/;

for (const doc of usersSnap.docs) {
  const data = doc.data();
  const displayName = data.displayName;
  if (!displayName || typeof displayName !== 'string') continue;

  const expectedLower = displayName.toLowerCase();
  const currentLower = data.displayNameLower;

  if (currentLower === undefined) {
    missing++;
    if (sampleMissing.length < 20) sampleMissing.push(doc.id);
  } else if (currentLower !== expectedLower) {
    desync++;
    if (sampleDesync.length < 20) sampleDesync.push({ id: doc.id, name: displayName, lower: currentLower });
  }

  if (!NEW_REGEX.test(displayName)) {
    invalidRegex++;
    if (sampleInvalid.length < 20) sampleInvalid.push({ id: doc.id, name: displayName });
  }
}
```

En modo apply, ejecutar `db.batch()` con `update({ displayNameLower: expectedLower })` por cada doc en violacion (missing + desync), commitear en batches de 500.

### Idempotencia

Re-correr en modo apply tras una primera ejecucion exitosa devuelve `Updated 0 of M users.` (todos los docs ya estan sincronizados).

### Plan de rollout (orden estricto)

1. Mergear el script al branch (sin ejecutar). Codigo deployable, rules NO deployadas todavia.
2. Correr `--audit` en prod (Gonzalo, manual via gcloud o admin SDK con creds). Anotar conteos en el issue.
3. Si `missing + desync > 0`: correr `--apply`.
4. Re-correr `--audit`. Verificar `missing: 0, desync: 0`.
5. Si `invalidRegex > 0`: decidir caso por caso (el script da el conteo + samples). Si conteo alto, abrir issue follow-up y postponer el deploy de la regex nueva. Si conteo bajo (ej: <5), contactar a esos usuarios manualmente o aceptar que el proximo update legitimo de su displayName lo bloqueara con error (cubrir desde UI con mensaje accionable).
6. Recien entonces: deploy de `firestore.rules` con la equality + regex nueva.

---

## Documento: `docs/procedures/reset-bootstrap-admin.md`

Deliverable obligatorio para S5.

### Estructura

```markdown
# Procedimiento: Reset del bootstrap admin gate

## Cuando aplica

Tras el primer admin asignado, `config/bootstrap.adminAssigned === true` y la rama
bootstrap de `setAdminClaim` queda cerrada. Si el primer admin pierde acceso (cuenta
deshabilitada, password perdido, MFA roto, email comprometido), no hay forma de
asignar otro admin sin un admin existente. Este procedimiento es la salida.

## Operadores autorizados

- **Solo Gonzalo Benoffi** (gonzalo.benoffi@modo.com.ar) via gcloud CLI con
  credenciales de proyecto `modo-mapa-prod`.
- En staging: cualquier dev con acceso a `modo-mapa-staging` (sin restriccion,
  staging es desechable).

## Condiciones legitimas

- Cuenta del email bootstrap deshabilitada.
- Password perdido sin posibilidad de reset (ej: email asociado tambien perdido).
- MFA roto sin codigos de recovery.
- Email bootstrap comprometido — bajo investigacion (rotar el secret antes de
  re-bootstrappear).

## Pasos

### 1. Rotar el secret `ADMIN_EMAIL` (si compromiso)

Si el motivo es compromiso del email, rotar antes:

\`\`\`bash
echo -n "nuevo-admin@modo.com.ar" | gcloud secrets versions add ADMIN_EMAIL \\
  --project=modo-mapa-prod --data-file=-
\`\`\`

Re-deploy de funciones para que tomen la nueva version del secret:

\`\`\`bash
firebase deploy --only functions --project=modo-mapa-prod
\`\`\`

### 2. Reset del flag `config/bootstrap.adminAssigned`

\`\`\`bash
# Via Firebase Admin SDK desde maquina autorizada
node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'modo-mapa-prod' });
  const db = getFirestore();
  db.doc('config/bootstrap').set({ adminAssigned: false }, { merge: true })
    .then(() => console.log('Reset OK'))
    .catch(console.error);
"
\`\`\`

### 3. Loguear con el nuevo email y invocar `setAdminClaim`

Desde la app admin: login con el nuevo `ADMIN_EMAIL` (Google o email/password
verificado), invocar `setAdminClaim({ targetUid: <new-admin-uid> })`. La rama
bootstrap esta abierta (flag false), asignara el claim.

### 4. Verificar audit log

Revisar `deletionAuditLogs` (no, ese no aplica). Mejor, revisar Cloud Functions
logs (Cloud Console → Logging) para `Admin claim set` con `via: 'bootstrap'`.

\`\`\`bash
gcloud logging read \\
  'resource.type="cloud_run_revision" AND jsonPayload.message="Admin claim set"' \\
  --project=modo-mapa-prod --limit=10 --format=json
\`\`\`

### 5. Postcondition

Tras el assignment exitoso, el handler escribe `config/bootstrap.adminAssigned = true`
automaticamente (idempotente). Verificar manualmente:

\`\`\`bash
node -e "
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'modo-mapa-prod' });
  getFirestore().doc('config/bootstrap').get()
    .then(s => console.log(s.data()))
    .catch(console.error);
"
\`\`\`

Esperado: `{ adminAssigned: true, assignedAt: <timestamp>, assignedTo: '<uid>' }`.

## Notas de seguridad

- Documentar en el ticket interno la razon del reset (compromise vs lockout).
- Si fue compromise: revisar logs de auth de las ultimas N dias para detectar
  actividad sospechosa del email anterior.
- El reset NO revoca el admin claim del primer admin perdido — si todavia tiene
  acceso al dispositivo, sigue siendo admin. Para revocar, primero invocar
  `removeAdminClaim` desde el admin nuevo.
```

---

## Integracion

Conexiones entre cambios y codigo existente.

| Cambio | Codigo existente afectado | Integracion |
|--------|---------------------------|-------------|
| S1 type guards en rules | UI existente que escribe a `feedback`/`notifications`/`userSettings` | NO requiere cambios — los UIs ya envian tipos correctos. Las rules nuevas solo bloquean payloads adversariales. |
| S1 displayName regex | UI de signup/edit profile | NO requiere cambios — el UI no permite ingresar `"   "` o leading/trailing spaces (trim implicito). Verificar manualmente que el flow no rompa. |
| S3 displayNameLower co-update | `src/services/users.ts` | Verificar que `updateProfile` envie ambos campos. El cliente actual ya lo hace (linea X de service — verificar en plan). |
| S3 feedback.mediaUrl + feedbackId | `src/services/feedback.ts` upload paths | Verificar que el path de Storage incluya `feedback-media/{uid}/{feedbackId}/...`. Si solo es `feedback-media/{uid}/...`, ajustar service. |
| S2 callable uniform | `src/services/sharedLists.ts` `inviteEditor` | NO cambia el contrato del wrapper. El handler ya devuelve `{success: true}`; los nuevos paths son uniformes. |
| S2 toast nuevo | `InviteEditorDialog.tsx` | Cambio mecanico. |
| S2 auto-open | `ListDetailScreen.tsx` | Nuevo handler `handleEditorInvited`. |
| S5 bootstrap gate | `src/components/admin/AdminPanel.tsx` (no afectado) | NO cambia el UI admin. Los admins existentes siguen invocando `setAdminClaim` igual. |

### Preventive checklist

- [x] **Service layer**: ningun componente importa `firebase/firestore` para writes nuevos. Todo va via callables o services existentes.
- [x] **Duplicated constants**: `FEATURED_LISTS_MAX_PAGE_SIZE` es una constante local nueva, no duplica ninguna existente.
- [x] **Context-first data**: no aplica.
- [ ] **Silent .catch**: el bloque nuevo de `revokeRefreshTokens` en S4 usa `try/catch` con `logger.error` — NO silent. Verificar tambien que el bloque nuevo de `getDoc(config/bootstrap)` no swallowee errores (si Firestore esta caido, debe propagar). Decision en plan.
- [x] **Stale props**: no aplica — no hay props nuevas mutables.

---

## Tests

### Tabla detallada (referencia: tabla del PRD seccion Tests, lineas 200-216)

| Archivo | Accion | Que testear (especifico) |
|---------|--------|--------------------------|
| `functions/src/__tests__/admin/claims.test.ts` | AMPLIAR | S5 — 4 casos nuevos: (a) primera invocacion bootstrap (config/bootstrap no existe) → success + setea `adminAssigned: true`; (b) segunda invocacion bootstrap (flag true) → throws `permission-denied`; (c) existing admin con flag true → success (no afectado); (d) `via` field en log = bootstrap/existing_admin/emulator segun el path. Mock de `getFirestore().doc('config/bootstrap').get()` con tres estados (no existe / `{adminAssigned:false}` / `{adminAssigned:true}`). |
| `functions/src/__tests__/callable/inviteListEditor.test.ts` | AMPLIAR + REESCRIBIR | S2 — Reescribir 3 tests existentes: el de `email not found` (linea 68-73 actual) ahora espera `{success:true}`, NO throws; el de `inviting self` (linea 75-80) idem; el de `already editor` (linea 82-87) idem. Agregar 1 test nuevo: verificar que `logger.warn` se llamo con el `emailHash` (no con el email en claro) cuando email no existia. Mantener todos los demas tests (rate limit, owner check, list not found, MAX_EDITORS). |
| `functions/src/__tests__/callable/removeListEditor.test.ts` | AMPLIAR | S2 mirror — Agregar test: si `targetUid` no esta en `editorIds`, devuelve `{success:true}` sin llamar `update`. Agregar test de simetria: invite de un email no registrado y remove del mismo email NO permiten distinguirlos (ambos devuelven `{success:true}` con shape identico). |
| `functions/src/__tests__/triggers/checkins.test.ts` | AMPLIAR | S3 — 4 casos nuevos: (a) `onCheckInDeleted` con `deleteCount > 20` escribe doc `_rateLimits/checkin_create_suspended_{uid}` con `suspendedUntil` ~24h en el futuro; (b) `onCheckInCreated` lee el flag de suspension; si `suspendedUntil > now`, borra el doc + loguea abuse + return; (c) `onCheckInCreated` con flag vencido (`suspendedUntil < now`) NO bloquea; (d) `onCheckInCreated` sin flag (path actual) sigue funcionando. Mock del flag via `mockGet` adicional. |
| `functions/src/__tests__/admin/featuredLists.test.ts` | AMPLIAR | S3 — 3 casos nuevos: (a) rate limit ahora se llama con `20` (no 60) — modificar el test existente que asserta el limit; (b) pageSize > 100 se clampa a 100 (test nuevo con `data: { pageSize: 500 }` → assert `chain.limit` con 100); (c) la export `getFeaturedLists` configurada con `enforceAppCheck: ENFORCE_APP_CHECK` (no _ADMIN). Patron concreto del spy detallado abajo. Tests existentes de `getPublicLists` NO cambian (sigue usando `MAX_PAGE_SIZE = 500`). |
| `functions/src/__tests__/callable/cleanAnonymousData.test.ts` | CREAR | S4 — Archivo nuevo (no existe). Casos minimos: (a) auth requerido; (b) email accounts rejected; (c) rate limit 60s funciona; (d) `revokeRefreshTokens` se llamo con `uid` (mock de `getAuth().revokeRefreshTokens`); (e) audit log entry incluye `tokensRevoked: true` en happy path; (f) si `revokeRefreshTokens` throws, el flow continua, audit log queda con `tokensRevoked: false` + `tokensRevokedError`, abuse log se escribe; (g) el `signOut` lo hace el cliente (no el callable) — no testeable aca. Patron de mocks: `vi.hoisted()` para `mockGetAuth`, `vi.mock('firebase-admin/auth', ...)`. |

### Patron concreto del spy de `enforceAppCheck` (test S3 case c)

El test debe assertar que `getFeaturedLists` se exporta con `{ enforceAppCheck: ENFORCE_APP_CHECK }` (no `_ADMIN`). El repo mockea `firebase-functions/v2/https` via factory que devuelve el handler — para inspeccionar el config (primer arg de `onCall`), capturarlo en `vi.hoisted()`. Snippet exacto a agregar al top del file (junto a los demas mocks):

```ts
const { capturedConfigs } = vi.hoisted(() => ({
  capturedConfigs: [] as Array<{ enforceAppCheck?: unknown }>,
}));

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>('firebase-functions/v2/https');
  return {
    ...actual,
    onCall: (cfg: { enforceAppCheck?: unknown }, handler: unknown) => {
      capturedConfigs.push(cfg);
      return handler;
    },
  };
});
```

Test concreto:

```ts
import { AppCheck } from 'firebase-functions/v2/https';

it('getFeaturedLists is configured with ENFORCE_APP_CHECK (not _ADMIN)', async () => {
  // Trigger module load (importing the module runs onCall, populating captures)
  await import('../../admin/featuredLists');

  // The order in capturedConfigs depends on import order in featuredLists.ts.
  // Find the config whose handler matches getFeaturedLists by inspecting the export shape,
  // OR rely on the fact that featuredLists.ts only exports two callables (toggle + get) and
  // the order is stable in the source file. Document the index in a const for clarity:
  const GET_FEATURED_LISTS_CONFIG_INDEX = 1; // toggleFeaturedList is index 0, getFeaturedLists is 1
  const cfg = capturedConfigs[GET_FEATURED_LISTS_CONFIG_INDEX];

  expect(cfg.enforceAppCheck).toBe(true); // ENFORCE_APP_CHECK constant resolves to true in test env
  // Counter-assert: it is NOT _ADMIN sentinel
  expect(cfg.enforceAppCheck).not.toBe('ADMIN_ONLY_SENTINEL'); // adapt to actual ENFORCE_APP_CHECK_ADMIN value
});
```

**Alternativa aceptada como fallback** (si el spy resulta fragil por orden de import o cambios en el factory): confiar en `tsc --noEmit` — el cambio del `import` (de `ENFORCE_APP_CHECK_ADMIN` a `ENFORCE_APP_CHECK`) lo asegura a nivel binding. En ese caso el plan documenta "spy test no agregado por fragilidad; cobertura via tipos + cambio de import explicito en el commit". **Decision documentada para el plan**: intentar el spy primero; si falla por shape del mock factory existente, aceptar el fallback.

### Tests de equality bidireccional (Sofia O6)

`@firebase/rules-unit-testing` esta out-of-scope (#332). En el plan, deliverable explicito: **verificacion manual via Firestore emulator antes de mergear**. Los 5 casos de la tabla de tests bidireccional (PRD lineas 230-235):

| # | Pre-estado | Update payload | Esperado |
|---|------------|----------------|----------|
| 1 | `{displayName:"Juan", displayNameLower:"juan"}` | `{displayNameLower:"admin"}` | DENY (vector B5) |
| 2 | `{displayName:"Juan", displayNameLower:"juan"}` | `{displayName:"Maria"}` | DENY (vector B4) |
| 3 | `{displayName:"Juan", displayNameLower:"juan"}` | `{displayName:"Maria", displayNameLower:"maria"}` | ALLOW |
| 4 | `{displayName:"Juan", displayNameLower:"juan"}` | `{displayName:"Maria", displayNameLower:"admin"}` | DENY |
| 5 | `{displayName:"Juan", displayNameLower:"juan"}` | `{bio:"..."}` | ALLOW |

**Procedimiento manual:**

1. Levantar emuladores: `npm run dev:full`.
2. Crear user doc desde el cliente via Firebase console del emulator UI (`http://localhost:4000/firestore`).
3. Para cada caso, intentar el update con la cuenta autenticada del owner.
4. Anotar resultado vs esperado.
5. Documentar en el ticket: `5/5 casos OK` (o detalle de fallos).

El plan debe llamar a este paso como "deliverable explicito" antes del merge. Cuando #332 este listo, los mismos casos se migran a tests automaticos.

### Criterios

- Cobertura >= 80% del codigo nuevo.
- Tests deben FALLAR antes del fix (validar pulling el branch sin los fixes), pasar despues.
- Patron de mocks consistente con `vi.hoisted()` + `vi.resetAllMocks()` ya establecido.

---

## Analytics

No se agregan eventos de tracking nuevos. Los cambios son server-side (rules) o internos (gate, revoke, copy). El unico cambio user-facing (auto-open de EditorsDialog) reusa el flow existente — ningun nuevo `trackEvent`.

---

## Offline

Cubierto en PRD seccion Offline. Resumen tecnico:

| Operacion | Tipo | Estrategia | Fallback UI |
|-----------|------|-----------|-------------|
| `inviteListEditor` callable | Write | Bloqueado offline (callables requieren conectividad) | `InviteEditorDialog` ya gated por `isOffline` (linea 58) |
| `removeListEditor` callable | Write | Idem | Toast existente |
| `setAdminClaim` callable | Write | Idem | Admin no soporta offline |
| `cleanAnonymousData` callable | Write | Idem | Toast existente |
| `users.update` con `displayName + displayNameLower` | Write | Cubierto por offline queue existente | Sin cambios — el co-update es atomico |
| Auto-open `EditorsDialog` tras invitar | Read | El dialog ya tiene su loading state | Sin cambios |

### Cache strategy

No aplica — no hay reads nuevos.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|---------------------|
| `users.update` co-update displayName | Firestore offline queue | Last-writer-wins (default Firestore). Como ambos campos van en el mismo write, no hay split-brain entre `displayName` y `displayNameLower`. |

### Fallback UI

No requiere componentes nuevos.

---

## Accesibilidad y UI mobile

Sin cambios estructurales. El unico cambio user-facing es:

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|------------------|-------------|
| InviteEditorDialog | submit Button | Implicito ("Invitar") | OK (44+px) | Toast existente |
| EditorsDialog (auto-open) | n/a | Existing | Existing | Existing |

### Reglas

- El `<Dialog>` de auto-open ya tiene foco + escape handling de MUI.
- El toast nuevo usa `useToast` ya accesible.
- Sin nuevas IconButtons sin label.

---

## Decisiones tecnicas

Lista explicita de las decisiones donde el PRD dejaba opciones (pre-PR del plan):

### D1 — `extractPageSize` parametrizado vs clamp post-helper (Sofia O4)

**Eleccion:** parametrizar el helper con un `maxOverride?: number` opcional.

**Alternativa rechazada:** clampar post-helper en el callsite de `getFeaturedLists`. Funcionalmente equivalente pero duplica logica (`Math.min` aplicado dos veces) y deja al lector sin claridad de cual cap aplica al fin.

**Razonamiento:** la parametrizacion mantiene `extractPageSize` como fuente unica de la logica de pageSize (incluyendo `Math.min/Math.floor/Number.isFinite`). El override es opt-in — `getPublicLists` y `toggleFeaturedList` no pasan el segundo arg y siguen con el cap general. Adicional: el `Math.min(DEFAULT_PAGE_SIZE, cap)` en la rama de "no pageSize" protege contra regresion silenciosa si alguien sube `DEFAULT_PAGE_SIZE` arriba del cap especifico en el futuro.

### D2 — Eliminacion vs preservacion de `MSG_LIST.editorInvited` (Sofia O5)

**Eleccion:** ELIMINAR la funcion `editorInvited(email)` de `src/constants/messages/list.ts`.

**Alternativa rechazada:** mantener la funcion por si en el futuro se quiere reusar.

**Razonamiento:** verificado por grep que la unica referencia es el lugar donde se reemplaza por `invitationProcessed`. Mantenerla es deuda — codigo muerto que un proximo dev podria copiar pensando que es la forma canonica. Si en el futuro hace falta, se agrega.

### D3 — Verificacion manual de equality bidireccional (Sofia O6)

**Eleccion:** documentar como deliverable explicito del plan, ejecutado por el implementador antes del merge, contra el emulator.

**Alternativa rechazada:** esperar a #332 (rules tests infra).

**Razonamiento:** #322 cierra B5 (vector critico). Bloquear #322 sobre #332 dilataria el fix. La verificacion manual de 5 casos contra el emulator es suficiente para garantizar que las rules nuevas funcionan; cuando #332 este listo, los mismos casos se trasladan a tests automaticos. El plan trackea esto.

### D4 — Race condition en bootstrap gate (no usar transaction)

**Eleccion:** mantener el patron `get + set` no-transaccional para el flag `config/bootstrap.adminAssigned`.

**Alternativa rechazada:** envolver en `db.runTransaction()`.

**Razonamiento:** el bootstrap es un flow manual, invocado una vez. Concurrencia es teorica (mismo email, mismo dispositivo, intervalo de milisegundos). Si pasara: dos UIDs con el mismo `ADMIN_EMAIL` quedan admins — ambos legitimos. El gate queda escrito y futuras invocaciones (no-bootstrap) se rechazan correctamente. Agregar transaction es defense-in-depth con costo (un `runTransaction` extra en cada invocacion bootstrap exitosa). No bloqueante; documentado como observacion.

### D5 — Path del flag de suspension de checkins

**Eleccion:** `_rateLimits/checkin_create_suspended_{userId}`.

**Alternativa rechazada:** reusar `_rateLimits/checkin_delete_{userId}` con un campo extra `suspendedUntil`.

**Razonamiento:** el flag de delete actual (linea 61 de `triggers/checkins.ts`) tiene shape `{date, count}` (rate counter). Reutilizar mezclaria semanticas — un counter rotativo diario con un flag de suspension de 24h. El path separado es mas claro, no colisiona con el cleanup existente de `_rateLimits/` (#240), y permite TTL natural cuando el counter de delete se resetea al dia siguiente.

### D6 — Hash de email en logs de inviteListEditor (defensa adicional)

**Eleccion:** loggear `sha256(email).slice(0,12)` en vez de email en claro cuando email no existia.

**Alternativa rechazada:** loggear email en claro al `logger.warn` (es servidor, solo logs internos).

**Razonamiento:** logs en GCP son visibles a developers con permisos de logging. El hash da correlacion (mismo email → mismo hash) sin exponer PII en claro. Patron consistente con `cleanAnonymousData` (linea 52 actual usa `sha256(uid).slice(0,12)`).

---

## Hardening de seguridad

### Firestore rules requeridas (resumen)

Ya documentadas en seccion "Firestore Rules" arriba. Cobertura por R-rule:

- R12 (type guards): `feedback.message is string`, `notifications.read is bool`, `userSettings.localityLat/Lng` range, `users.displayNameLower == displayName.lower()` bidireccional.
- R7 (charset): regex con anclaje no-whitespace en `displayName`.
- R8 (mediaUrl prefix): regex con `feedbackId` segment en `feedback.mediaUrl`.

### Rate limiting

| Coleccion / Callable | Limite nuevo | Implementacion |
|---------------------|--------------|----------------|
| `getFeaturedLists` | 20/dia/user | `checkCallableRateLimit` (existente) — solo cambia el numero |
| `inviteListEditor` | 10/dia/user (sin cambio) | n/a |
| `removeListEditor` | 10/dia/user (sin cambio) | n/a |
| `cleanAnonymousData` | 1/min/user (sin cambio) | n/a |
| `setAdminClaim` | NO aplicamos rate limit | decision documentada en S5 — bootstrap path es email+flag gated, rate limit no mitiga email comprometido; existing-admin path es naturalmente admin-only |
| `checkins create` (post-suspension) | 0/24h via flag | flag `_rateLimits/checkin_create_suspended_{uid}`, leido por `onCheckInCreated` |

### Observabilidad (perf instrumentation)

Convencion del repo (verificada via grep): `trackFunctionTiming` se aplica solo a triggers (`functions/src/triggers/*`). Los callables NO usan `trackFunctionTiming` por convencion documentada en `docs/reference/guards/303-perf-instrumentation.md`. Este issue NO agrega observabilidad nueva en S2 (`inviteListEditor`/`removeListEditor`), S4 (`cleanAnonymousData`) ni S5 (`setAdminClaim`) — siguen sin `trackFunctionTiming` por consistencia con el resto del repo. El unico trigger nuevo (`onCheckInDeleted` + `onCheckInCreated` modificado en S3) ya tiene `trackFunctionTiming` aplicado en su version actual y el cambio lo preserva.

### Vectores de ataque mitigados

Ya tabulados en PRD seccion "Vectores de ataque automatizado". Mapping a archivos:

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| `feedback.message` con array 50KB | `is string` | `firestore.rules` linea 180 |
| `notifications.read` con map gigante | `is bool` | `firestore.rules` linea 338 |
| `localityLat: NaN/Infinity` | range check | `firestore.rules` lineas 401-402, 430-431 |
| Email enumeration en invite | uniform success | `functions/src/callable/inviteListEditor.ts` |
| `displayNameLower: "admin"` hijack | equality bidireccional | `firestore.rules` lineas 38-46 |
| `feedback.mediaUrl` cross-feedback reuse | regex con feedbackId | `firestore.rules` linea 189, 209 |
| `getFeaturedLists` scraping | rate limit 20/d + cap 100 | `functions/src/admin/featuredLists.ts` |
| Checkin create+delete loop | flag de suspension 24h | `functions/src/triggers/checkins.ts` |
| Anonymous session post-clean | revokeRefreshTokens | `functions/src/callable/cleanAnonymousData.ts` |
| Bootstrap admin re-asignacion | flag `config/bootstrap.adminAssigned` | `functions/src/admin/claims.ts` |

---

## Deuda tecnica: mitigacion incorporada

Issues abiertos verificables con `gh issue list --label security --state open --json number,title`:

| Issue | Que se resuelve | Workstream |
|-------|----------------|-----------|
| #300 R12 (type guards) | implementadas en TODAS las superficies user-writable identificadas | S1 |
| #300 R13 (no email enumeration) | implementadas en `inviteListEditor` + mirror en `removeListEditor` | S2 |
| #300 R14 (bootstrap admin gate) | gate via `config/bootstrap.adminAssigned` + procedimiento de recovery | S5 |

Issues NO abordados aca pero referenciados:

- #332 (rules tests infra) — out of scope. Verificacion de bidireccional via emulator manual.
- #251 (userSettings rules) — el refactor de affectedKeys mantiene compat, refuerza el patron.
- #240 (rate limit cleanup) — el path nuevo `_rateLimits/checkin_create_suspended_*` queda cubierto por el cleanup existente.

### Tech debt nuevo

- Procedimiento de recovery del bootstrap admin (S5) — documentado en `docs/procedures/reset-bootstrap-admin.md`. NO es deuda abierta; es procedimiento operativo.

---

## Edge cases tecnicos

### EC1 — Race condition en bootstrap gate

Documentada en D4. Mitigacion: aceptar el riesgo teorico (bootstrap es manual one-shot).

### EC2 — Datos legacy `displayNameLower` desincronizado o ausente

Documentada en seccion Migracion. Mitigacion: script audit + apply ANTES del deploy de la rule.

### EC3 — `displayName` con caracteres que `toLowerCase()` no normaliza igual que CEL `lower()`

Caracteres unicode con multiples representaciones de "case folding" (ej: turca `İ` vs `i`, alemana `ß` vs `ss`). El CEL `lower()` y JavaScript `toLowerCase()` usan algoritmos casi-pero-no-iguales para algunos edge cases unicode.

**Mitigacion:** el script audit detecta cualquier desync via `displayName.toLowerCase() !== displayNameLower`. Si en `--audit` aparece un caso edge donde el browser ya escribio un valor que CEL `lower()` no acepta como equality, el script lo flaggeara (categoria `desync`). En esa instancia, pausar el rollout y abrir issue follow-up (ver Plan de rollout paso 5).

**Probabilidad practica:** baja (charset actual de la regex es ASCII + Latin-1 extendido, donde JS y CEL coinciden).

### EC4 — `extractPageSize` con `DEFAULT_PAGE_SIZE` igual al cap

Cuando `DEFAULT_PAGE_SIZE = 100` y `FEATURED_LISTS_MAX_PAGE_SIZE = 100`, el caller que no pasa `pageSize` obtiene 100 — sin cambio observable. El `Math.min(DEFAULT_PAGE_SIZE, cap)` agregado en la rama del default protege regresion futura si alguien sube `DEFAULT_PAGE_SIZE`. Documentado en D1.

### EC5 — Suspension flag de checkins persiste tras rollover de dia

El cleanup de `_rateLimits/` (#240) corre con un TTL configurado. El flag `checkin_create_suspended_{uid}` con `suspendedUntil = now + 24h` queda en la coleccion hasta que el cleanup lo borre. Mientras el flag esta vencido (`suspendedUntil < now`), `onCheckInCreated` no lo respeta — ningun bloqueo erroneo. El cleanup eventual mantiene la coleccion limpia.

### EC6 — `revokeRefreshTokens` falla en cleanAnonymousData

Defensa-en-profundidad: el flow continua, audit log se escribe con `tokensRevoked: false` + `tokensRevokedError`. El cliente sigue haciendo `signOut()` post-callable, que invalida la session local. Solo queda la ventana de hasta 1h donde el access token vigente puede actuar — mismo comportamiento que el sistema actual (sin cambio funcional negativo, ganamos defensa en el path feliz).

### EC7 — feedbackId segment en URLs de Storage existentes

La rule nueva exige el segmento `feedbackId` en el path. Verificacion pre-deploy:

```bash
# Buscar el codigo del cliente que sube a Storage para feedback
grep -rn "feedback-media" /home/walrus/proyectos/modo-mapa/src
```

Si el cliente ya estructura el path como `feedback-media/{uid}/{feedbackId}/{filename}`, no hay regresion. Si no, ajustar `src/services/feedback.ts` (paso del plan).

---

## Rollout plan (orden estricto)

Documentado en seccion Migracion (S3 paso 1-5). Resumen:

| # | Accion | Riesgo si falla | Reversibilidad |
|---|--------|-----------------|----------------|
| 1 | Mergear branch (script + cambios de codigo, rules NO deployadas todavia) | Cero — codigo sin efecto | Revert PR |
| 2 | Correr `migrate-displayname-lower-sync.mjs --audit` en prod | Cero — read-only | n/a |
| 3 | Si `missing + desync > 0`: correr `--apply` en prod | Bajo — solo escribe `displayNameLower` consistente | Revert via batch update con `displayNameLower: undefined` (no recomendado) |
| 4 | Re-correr `--audit` para verificar 0 violaciones | Cero | n/a |
| 5 | Verificar manualmente los 5 casos de equality bidireccional contra emulator | Cero — emulator local | n/a |
| 6 | Deploy de `firestore.rules` (incluye equality + regex nueva + type guards + mediaUrl con feedbackId) | Medio — bloquea writes invalidos | `firebase deploy --only firestore:rules` con la version anterior |
| 7 | Deploy de Cloud Functions (callables S2/S3/S4 + claims S5) | Bajo — todos backward compatible | `firebase deploy` con commit anterior |
| 8 | Verificar smoke tests en prod: invite editor (4 escenarios), bootstrap idempotencia, checkin abuse path | n/a | n/a |

**Critical path:** pasos 2-4 ANTES de paso 6 (rules deploy). Si el script no se corre, las rules nuevas pueden bloquear writes legitimos de usuarios con `displayNameLower` desincronizado.

**Reversibilidad:** el deploy de rules es backward-incompatible para clientes que envien `displayNameLower` no sincronizado. En revert, los clientes nuevos (que asumen la rule nueva) seguiran funcionando; los hipoteticos clientes que dependieran del bug de mismatch seguiran fallando, pero ese bug era el vector de ataque. No hay regresion legitima.

---

## Validacion Tecnica

**Auditor**: Diego (Solution Architect)
**Fecha Ciclo 1**: 2026-04-25
**Fecha Ciclo 2**: 2026-04-25
**Fecha Ciclo 2 (cierre)**: 2026-04-25
**Estado final**: VALIDADO CON OBSERVACIONES

### Cobertura PRD → specs (Ciclo 1, mantenida)

Verificado contra los 12 hallazgos del PRD (5 high + 6 medium + 1 bootstrap). Las referencias de linea en la tabla son indicativas (el archivo cambio post-Ciclo 1; los anchors de cierre en la tabla "Hallazgos del Ciclo 1 cerrados en Ciclo 2" mas abajo apuntan a los bloques nombrados, que es lo que cuenta).

| Hallazgo PRD | Workstream specs | Estado |
|--------------|------------------|--------|
| `feedback.message` sin `is string` | S1 — bloque "feedback.message" | Cubierto |
| `userSettings.localityLat/Lng` NaN/Infinity | S1 — bloque "userSettings.localityLat/Lng range check" | Cubierto |
| `notifications.read` sin `is bool` | S1 — bloque "notifications.read" | Cubierto |
| `userSettings` `affectedKeys` inconsistency | S1 — bloque "userSettings update — affectedKeys() consistency" | Cubierto |
| Email enumeration `inviteListEditor` (R13) | S2 — bloque "inviteListEditor (R13) uniform response" | Cubierto |
| `removeListEditor` mirror | S2 — bloque "removeListEditor (mirror)" | Cubierto |
| Auto-open `EditorsDialog` (UX no-mentirosa) | "ListDetailScreen (modificado)" | Cubierto |
| `displayName` whitespace | S3 — bloque "displayName regex con anclaje no-whitespace" | Cubierto |
| `displayNameLower` equality bidireccional (B5) | S3 — bloque "displayNameLower == displayName.lower() equality bidireccional" | Cubierto |
| Migration script previa al deploy | "Migracion: scripts/migrate-displayname-lower-sync.mjs" | Cubierto |
| `feedback.mediaUrl` con `feedbackId` segment | S3 — bloque "feedback.mediaUrl con feedbackId segment" | Cubierto |
| `getFeaturedLists` rate limit + cap + ENFORCE_APP_CHECK | S3 — bloque "getFeaturedLists rate limit + page size cap + ENFORCE_APP_CHECK" | Cubierto |
| `onCheckInDeleted` enforcement real | S3 — bloque "onCheckInDeleted enforcement real" | Cubierto |
| `cleanAnonymousData` revoke refresh tokens | S4 — bloque "cleanAnonymousData revoke refresh tokens" | Cubierto |
| Bootstrap admin gate (R14) | S5 — bloque "setAdminClaim bootstrap gate (R14)" | Cubierto |
| Procedimiento recovery | "Documento: docs/procedures/reset-bootstrap-admin.md" | Cubierto |

Decisiones D1-D6 documentadas en seccion "Decisiones tecnicas". D3 cierra Sofia O6, D4 documenta race concurrente.

### Sintaxis CEL bidireccional (R12 displayNameLower)

Verificada caso por caso contra la tabla de Sofia Ciclo 3:

- En CEL, `request.resource.data.displayName` refleja la imagen post-update completa (no solo el delta). Si el cliente NO toca `displayName`, el valor presente en `request.resource.data.displayName` es el del doc actual.
- Rama 2 del OR: `request.resource.data.displayNameLower == request.resource.data.displayName.lower()`. Aplicada al vector B5 (`displayName` no cambia, atacante intenta `displayNameLower: "admin"`): `"admin" == "Juan".lower()` → FALSE → DENY.
- Confirmado: la formulacion cierra B5 y B4 sin falsos positivos para el caso "no se tocan ninguno de los dos".

### Verificaciones de codigo existente (Ciclo 2 re-verificadas)

| Verificacion | Resultado |
|--------------|-----------|
| `src/services/userProfile.ts:145` co-update displayName/displayNameLower | OK — `updateDoc(ref, { displayName: name, displayNameLower: name.toLowerCase() })` confirmado |
| `src/services/feedback.ts:53` path Storage `feedback-media/${userId}/${docRef.id}/${mediaFile.name}` | OK — el segmento feedbackId YA esta presente, la rule nueva no rompe uploads existentes |
| `functions/src/callable/cleanAnonymousData.ts:3` `import { createHash } from 'crypto';` | OK — patron consistente para hashear emails en `inviteListEditor` |
| Tests existentes referenciados (claims/inviteListEditor/removeListEditor/checkins/featuredLists) | OK — line counts confirmados (185/119/77/100/262) |
| Helper `extractPageSize` en `functions/src/admin/featuredLists.ts:19` | OK — parametrizable preserva semantica de `getPublicLists`/`toggleFeaturedList` |
| `_rateLimits/checkin_delete_${userId}` en `functions/src/triggers/checkins.ts:61` | OK — shape `{date, count}` confirmado, no colisiona con flag nuevo `_rateLimits/checkin_create_suspended_*` |
| Rule `match /config/{document=**}` (firestore.rules L247) | OK — cubre `config/bootstrap` automaticamente, `allow write: if false` (admin SDK bypassea) |
| Rule `match /_rateLimits/{docId}` (firestore.rules L705) | OK — cubre `_rateLimits/checkin_create_suspended_*` automaticamente |
| `firestore.rules` L25-46 users.create/update | OK — `displayNameLower is string` ya exigido en create; el cambio S3 lo refuerza con equality y no rompe payloads del cliente actual |
| Triggers `onCheckInCreated`/`onCheckInDeleted` ya tienen `trackFunctionTiming` | OK — `functions/src/triggers/checkins.ts:39,79` preservados |

### Hallazgos del Ciclo 1 cerrados en Ciclo 2

Los 7 IMPORTANTE y las 5 OBSERVACION reportados en el Ciclo 1 fueron resueltos con decisiones tecnicas explicitas integradas al cuerpo del specs. Tabla de cierre:

#### IMPORTANTE (7) — todos cerrados

| # | Titulo | Decision | Donde se documenta |
|---|--------|----------|-------------------|
| 1 | Tratamiento de `userSettings.updatedAt` | Mantiene equality dura `request.resource.data.updatedAt == request.time`. NO se mueve al patron `affectedKeys()`. Razon: invariante de freshness. | Seccion "S1 — `userSettings` update — `affectedKeys()` consistency" → bloque "Excepcion explicita — `updatedAt`" |
| 2 | Invariante para `notifications.update.read is bool` evaluado incondicionalmente | Documentado: el campo `read` siempre existe (Cloud Functions lo crea con `read: false`). Si se agregan campos a `affectedKeys().hasOnly([...])`, reformular con el patron canonico `(!('read' in affectedKeys) || ...)`. | Seccion "S1 — `notifications.read`" → bloque "Invariante (importante para futuras modificaciones)" |
| 3 | `displayName` de 1 caracter sigue aceptado | Verificado y documentado con tabla de casos. La regex acepta 1-char por el primer literal solo (grupo opcional vacio). | Seccion "S3 — `displayName` regex con anclaje no-whitespace" → bloque "Invariante de aceptacion (verificado)" con tabla |
| 4 | Orden de operaciones en `setAdminClaim` cuando paso 3 (flag write) falla post-paso 2 | Decision: opcion (a) — set claim primero, luego flag, sin retry automatico. Wrap del flag set en `try/catch` con `logger.error` que dispara Sentry. NO transaction (cross-service Auth+Firestore). | Seccion "S5 — `setAdminClaim`" → bloque "Edge case: paso 3 (escribir flag) falla post-paso 2" con snippet `try/catch` |
| 5 | Rate limiting en `setAdminClaim` | Decision: NO aplicamos rate limit. UNA invocacion exitosa basta para asignarse admin claim, rate limit N/hora no lo mitiga. Mitigacion ante compromiso: rotacion del secret + reset del flag. | Seccion "S5 — `setAdminClaim`" → bloque final "Rate limiting en `setAdminClaim`" + tabla "Rate limiting" en Hardening |
| 6 | Idempotencia visible de `setEditorsOpen(true)` | Documentado: idempotencia garantizada por React state setter semantics + MUI Dialog stable mount. Sin glitch, sin flicker, sin doble-mount. | Seccion "`ListDetailScreen` (modificado)" → bloque "Idempotencia visible de `setEditorsOpen(true)`" |
| 7 | Patron concreto para test de spy de `enforceAppCheck` | Snippet completo documentado con `vi.hoisted()` + factory de `vi.mock('firebase-functions/v2/https', ...)`. Decision: intentar el spy primero; fallback `tsc --noEmit` aceptado. | Seccion "Tests" → subbloque "Patron concreto del spy de `enforceAppCheck` (test S3 case c)" |

#### OBSERVACION (5) — todas cerradas

| # | Titulo | Cierre | Donde se documenta |
|---|--------|--------|-------------------|
| 1 | Convencion `trackFunctionTiming` | Documentado: este issue no agrega observabilidad nueva en callables tocados (S2/S4/S5). El trigger nuevo (`onCheckInDeleted`/`onCheckInCreated`) ya tiene `trackFunctionTiming` y se preserva. Ver O7 nuevo abajo respecto al wording de la justificacion. | Seccion "Hardening de seguridad" → subbloque "Observabilidad (perf instrumentation)" |
| 2 | Verificacion `feedback.ts:53` ya OK | Wording actualizado de "verificar pre-deploy" a "**verificado**". Verificacion cerrada. | Seccion "S3 — `feedback.mediaUrl` con `feedbackId` segment" → bloque "Riesgo" |
| 3 | Import de `createHash` en `inviteListEditor.ts` | Especificado `import { createHash } from 'crypto';` al top del archivo. Patron consistente con `cleanAnonymousData.ts:3`. | Seccion "S2 — `inviteListEditor` (R13) uniform response" → bloque "Imports nuevos (top del archivo)" |
| 4 | Handling de `GOOGLE_APPLICATION_CREDENTIALS` en migration script | Precondition check explicito al inicio del script con mensaje accionable. | Seccion "Migracion: ..." → subbloque "Precondition check (handling de `GOOGLE_APPLICATION_CREDENTIALS`)" |
| 5 | Cobertura `>=80%` (criterio de tests) | Convencion del repo (`docs/reference/tests.md`). No bloqueante. | Sin cambio |

### Hallazgos nuevos del Ciclo 2

Solo dos OBSERVACION introducidas por el snippet/wording del Ciclo 2. Ningun BLOQUEANTE ni IMPORTANTE nuevo.

#### OBSERVACION #6 — Indice incorrecto en snippet del spy test (`GET_FEATURED_LISTS_CONFIG_INDEX`)

- **Hueco:** el snippet de test en seccion "Patron concreto del spy de `enforceAppCheck` (test S3 case c)" declara `const GET_FEATURED_LISTS_CONFIG_INDEX = 1;` con comentario inline "toggleFeaturedList is index 0, getFeaturedLists is 1". El orden real de exports en `functions/src/admin/featuredLists.ts` es `toggleFeaturedList` (L37) → index 0, `getPublicLists` (L83) → index 1, `getFeaturedLists` (L128) → index 2. El indice correcto es **2**, no 1.
- **Escenario:** si el implementador copia el snippet literal, `capturedConfigs[1]` apunta a `getPublicLists` (que sigue usando `ENFORCE_APP_CHECK_ADMIN`). El assert `expect(cfg.enforceAppCheck).toBe(true)` falla, induciendo a confusion (parece que el cambio del import no se aplico cuando si).
- **Que se necesita:** corregir en el snippet a `const GET_FEATURED_LISTS_CONFIG_INDEX = 2;` con comentario "toggleFeaturedList is index 0, getPublicLists is 1, getFeaturedLists is 2", o (preferible) usar busqueda por shape en vez de indice fijo. No bloqueante: hay fallback a `tsc --noEmit` documentado en L1094.

#### OBSERVACION #7 — Wording de la justificacion `trackFunctionTiming` invierte el guard 303

- **Hueco:** seccion "Observabilidad (perf instrumentation)" afirma "callables NO usan `trackFunctionTiming` por convencion documentada en `docs/reference/guards/303-perf-instrumentation.md`". El guard 303 lineas 37-38 dice exactamente lo contrario: "Toda Cloud Function `callable` user-invocada (en `functions/src/callable/`) DEBE invocar `trackFunctionTiming`."
- **Escenario:** la realidad del repo es que la mayoria de callables actuales NO tiene `trackFunctionTiming` (deuda preexistente: solo `admin/listItems.ts` y `admin/rateLimits.ts` lo tienen). La decision practica de NO agregar instrumentacion en callables tocados aca (S2/S4/S5) es razonable como scope, pero la justificacion cita el guard al reves.
- **Que se necesita:** reformular el wording — la decision es "scope: este issue no cierra deuda preexistente de instrumentacion en callables; se trackea como tech debt separado", NO "callables no usan `trackFunctionTiming` por convencion". No bloqueante: el codigo resultante no introduce regresion (preserva el estado actual). Pero puede inducir a un futuro auditor a entender mal el guard.

### Observaciones tecnicas para el plan (Pablo)

- Deliverables explicitos del plan:
  1. Verificacion manual de los 5 casos de equality bidireccional contra Firestore emulator (Sofia O6).
  2. Ejecucion de `migrate-displayname-lower-sync.mjs --audit` en prod ANTES del deploy de rules; anotar conteos en el ticket.
  3. Si `--audit` reporta `invalidRegex > 0`: pausa y decision (issue follow-up vs comunicacion a usuarios afectados vs tolerar).
  4. Verificacion smoke en prod post-deploy: invite editor con 4 escenarios (registrado / no registrado / ya editor / self), todos respondiendo `{success: true}` con shape identico.
- El plan debe especificar el orden estricto de los pasos del rollout — el critical path es S3-migration-script ANTES del deploy de rules.
- El plan debe incluir Phase de revisar que los 3 tests de `inviteListEditor.test.ts` (linea 68-73, 75-80, 82-87 actuales) se REESCRIBEN — no se "amplian". Que pase de `expect(toThrow)` a `assert.deepEqual(result, { success: true })`.
- El plan debe incluir checklist de verificacion del refactor de `userSettings` rules: ejecutar manualmente updates legitimos contra emulator (toggle de cada flag boolean por separado) para asegurar que el refactor no rompe ningun flow + que `updatedAt` sigue siendo obligatorio en cada update (la equality dura no se movio).
- El plan debe incluir verificacion del `try/catch` del flag set en `setAdminClaim` (IMPORTANTE #4): test que simule fallo del `db.doc('config/bootstrap').set(...)` y assert que el handler NO re-throws + que `logger.error` se llamo con `remediation` en el payload.
- **Ciclo 2 nuevo — para Pablo:** si el implementador llega al snippet del spy test, advertir que el indice declarado es incorrecto (debe ser 2, no 1). Ver OBSERVACION #6.
- **Ciclo 2 nuevo — para Pablo:** el wording de la justificacion de `trackFunctionTiming` cita el guard 303 al reves. La decision practica (no agregar instrumentacion en callables tocados aca) es valida como scope; el plan puede reformular el comentario en codigo o dejarlo asi, siempre que NO afirme "convencion del repo". Ver OBSERVACION #7.

### Listo para pasar a plan?

**Si — VALIDADO CON OBSERVACIONES.**

Los 7 IMPORTANTE y las 5 OBSERVACION del Ciclo 1 quedaron cerrados con anchors trazables al cuerpo del specs. Las 2 OBSERVACION nuevas del Ciclo 2 (#6 indice del spy, #7 wording del guard) son no-bloqueantes — pueden cerrarse en el plan sin reabrir el specs.

### Re-verificacion final Ciclo 2 (cierre)

Pasada de cierre tras los ajustes aplicados por specs-plan-writer. Verificadas las 12 entradas (7 IMPORTANTE + 5 OBSERVACION) anchor por anchor contra el cuerpo del specs:

| Hallazgo Ciclo 1 | Anchor declarado | Estado tras revision de cierre |
|------------------|------------------|--------------------------------|
| IMPORTANTE #1 (`updatedAt` excepcion) | L155 — bloque "Excepcion explicita — `updatedAt`" | Cerrado correctamente |
| IMPORTANTE #2 (`notifications.read` invariante) | L117 — bloque "Invariante (importante para futuras modificaciones)" con patron canonico documentado | Cerrado correctamente |
| IMPORTANTE #3 (`displayName` 1-char) | L185 — tabla con caso `"J"` → YES + razonamiento del primer literal solo | Cerrado correctamente |
| IMPORTANTE #4 (orden ops setAdminClaim) | L614 — opcion (a) elegida, snippet `try/catch` con `logger.error` + `remediation` | Cerrado correctamente |
| IMPORTANTE #5 (no rate limit setAdminClaim) | L655-661 + tabla L1245 (Hardening) | Cerrado correctamente |
| IMPORTANTE #6 (idempotencia setEditorsOpen) | L708 — argumento React state setter + MUI Dialog stable mount | Cerrado correctamente |
| IMPORTANTE #7 (snippet spy enforceAppCheck) | L1051 — snippet completo + fallback documentado | Cerrado con bug menor en el snippet (genera OBSERVACION #6 nueva, ya catalogada) |
| OBSERVACION #1 (convencion trackFunctionTiming) | L1253-1255 | Documentado pero con wording invertido (genera OBSERVACION #7 nueva, ya catalogada) |
| OBSERVACION #2 (`feedback.ts:53` verificado) | L268 — wording cambiado a "**verificado**" + cita exacta del path | Cerrado correctamente |
| OBSERVACION #3 (import `createHash`) | L308 — import declarado al top + cita `cleanAnonymousData.ts:3` | Cerrado correctamente |
| OBSERVACION #4 (precondition `GOOGLE_APPLICATION_CREDENTIALS`) | L793-806 | Cerrado correctamente |
| OBSERVACION #5 (cobertura >=80%) | Sin cambio (convencion del repo) | Cerrado correctamente |

Verificaciones de hechos contra el codigo en disco (re-corridas para esta pasada de cierre):

- `functions/src/admin/featuredLists.ts` exports: `toggleFeaturedList` L37, `getPublicLists` L83, `getFeaturedLists` L128. Confirma que el indice declarado en el snippet del spy (L1085 del specs, valor `1`) es incorrecto — el correcto es `2`. OBSERVACION #6 reconfirmada.
- `docs/reference/guards/303-perf-instrumentation.md:37-39` exige `trackFunctionTiming` en TODA callable user-invocada. Realidad del repo: solo `admin/listItems.ts` y `admin/rateLimits.ts` la usan; ninguna `callable/*.ts` la usa. La afirmacion del specs L1255 ("callables NO usan `trackFunctionTiming` por convencion") es factualmente incorrecta — la realidad es deuda preexistente que el guard manda cerrar. OBSERVACION #7 reconfirmada.
- `firestore.rules:248` `match /config/{document=**}` — confirmado. El specs L1412 cita "L247" (off-by-one menor, no afecta funcionalidad).
- `firestore.rules:705` `match /_rateLimits/{docId}` — confirmado.
- `src/services/userProfile.ts:145` co-update displayName/displayNameLower — confirmado.
- `src/services/feedback.ts:53` `feedback-media/${userId}/${docRef.id}/${mediaFile.name}` — confirmado, segmento feedbackId presente.
- `functions/src/triggers/checkins.ts` `trackFunctionTiming` L39 (`onCheckInCreated`) y L79 (`onCheckInDeleted`) — confirmado.
- `functions/src/triggers/checkins.ts:61` `_rateLimits/checkin_delete_${userId}` — confirmado, no colisiona con el flag nuevo `_rateLimits/checkin_create_suspended_*`.
- Line counts de tests existentes: 185/119/77/100/262 — confirmado.

**No se introdujeron BLOQUEANTES ni IMPORTANTES nuevos en el Ciclo 2.** Las dos OBSERVACION nuevas (#6 y #7) son no-bloqueantes y estan trazadas para que Pablo las atienda en el plan.

### Veredicto firmado

— Diego (Solution Architect, equipo Modo Mapa)

- **Ciclo 1 (2026-04-25):** VALIDADO CON OBSERVACIONES. Cobertura PRD → specs completa. Sintaxis CEL bidireccional verificada caso por caso. 7 IMPORTANTE + 5 OBSERVACION para refinar el specs antes del plan; ningun BLOQUEANTE.
- **Ciclo 2 (2026-04-25):** VALIDADO CON OBSERVACIONES. Los 7 IMPORTANTE y las 5 OBSERVACION del Ciclo 1 quedaron cerrados con anchors trazables. Verificaciones de codigo existente re-confirmadas (`userProfile.ts:145`, `feedback.ts:53`, `cleanAnonymousData.ts:3`, `featuredLists.ts:19`, `triggers/checkins.ts:39,79`, `firestore.rules` L25-46/L247/L705). Detectadas 2 OBSERVACION nuevas (#6 indice incorrecto en snippet del spy test, #7 wording invertido del guard 303) — ambas no-bloqueantes y resolubles en el plan sin reabrir el specs. Ningun BLOQUEANTE detectado.
- **Ciclo 2 cierre (2026-04-25):** re-verificada la pasada de specs-plan-writer anchor por anchor + hechos sobre disco (orden de exports, guard 303, paths de Storage, line counts de tests). Cierre confirmado. **Specs firmado y listo para pasar al plan (Pablo). No requiere Ciclo 3.**
