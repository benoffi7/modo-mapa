# Specs: Hardening Audit #260-#265

**Issues:** #260, #261, #262, #263, #264, #265
**Fecha:** 2026-03-31

---

## Resumen de issues

| Issue | Severidad | Descripcion |
|-------|-----------|-------------|
| #260 | CRITICAL | `client_secret` de OAuth hardcodeado en `scripts/seed-staging.ts` linea 24 |
| #261 | CRITICAL | `sa-key.json` en disco, no commiteado pero key activa sin rotar |
| #262 | HIGH | Admin email hardcodeado en `.env` y `functions/.env` |
| #263 | HIGH | Colecciones `specials` y `achievements` no tienen validacion de campos en admin writes |
| #264 | HIGH | `likeCount` puede quedar negativo; rate limit de `menuPhotos` no elimina el doc; falta `.size()` en `userSettings` |
| #265 | MEDIUM | `userSettings` usa `write` en vez de `create`/`update`; feedback update rule sin parentesis; sin cooldown en checkin deletes |

---

## #260: OAuth client_secret en seed-staging.ts

### Estado actual

`scripts/seed-staging.ts` lineas 20-28 construye un archivo ADC manualmente:

```typescript
const adcContent = {
  type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',   // CRITICO: secret hardcodeado
  refresh_token: firebaseConfig.tokens.refresh_token,
};
```

El `client_secret` es el secreto OAuth del cliente de Firebase Tools (Google). Este valor es el mismo para todos los proyectos que usan firebase-tools y su presencia en git representa un riesgo real si alguien lo combina con un refresh token robado.

### Solucion

Eliminar el bloque que construye el ADC manualmente. El script debe asumir que `gcloud auth application-default login` ya fue ejecutado, lo cual genera `~/.config/gcloud/application_default_credentials.json` correctamente sin necesidad de crearlo programaticamente.

```typescript
// ANTES (lines 12-28) — eliminar todo este bloque:
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
const firebaseConfig = JSON.parse(readFileSync(...));
const adcPath = resolve(...);
import { mkdirSync } from 'fs';
mkdirSync(...);
const adcContent = { type: 'authorized_user', client_id: '...', client_secret: '...' };
writeFileSync(adcPath, JSON.stringify(adcContent));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
// ...y el process.on('exit') cleanup

// DESPUES — solo validar que ADC exista:
import { existsSync } from 'fs';
import { resolve } from 'path';
const adcPath = resolve(process.env.HOME!, '.config/gcloud/application_default_credentials.json');
if (!existsSync(adcPath)) {
  console.error('ERROR: Application Default Credentials no encontradas.');
  console.error('Ejecutar: gcloud auth application-default login');
  process.exit(1);
}
```

### Purga del historial de git

El `client_secret` fue introducido en un commit anterior. Aunque este secreto en particular es el secreto publico de Firebase Tools (no especifico del proyecto), se debe purgar del historial para mantener el repo limpio y pasar auditorias futuras.

Procedimiento:
1. Usar `git filter-repo` (no `filter-branch`) para reemplazar la cadena en el historial
2. Force-push a `new-home` (rama base) con coordinacion con el equipo
3. Los colaboradores deben re-clonar o hacer `git fetch --all && git reset --hard origin/new-home`

**Nota:** El client_secret de Firebase Tools (`j9iVZfS8kkCEFUPaAeJV0sAi`) es un secreto compartido publicamente por Google para el CLI de firebase-tools. No es un secreto exclusivo del proyecto. Aun asi, se purga para mantener el repo limpio.

---

## #261: sa-key.json en disco

### Estado actual

- `sa-key.json` esta en `.gitignore` (linea 43) — no commiteado.
- El archivo existe en disco con una Service Account key activa.
- La key activa representa riesgo si el equipo de desarrollo es comprometido.

### Solucion

1. **Revocar la key en GCP Console**: IAM & Admin > Service Accounts > seleccionar la SA > Keys > eliminar la key comprometida.
2. **Eliminar el archivo del disco**: `rm sa-key.json` en la maquina de desarrollo.
3. **Usar ADC en su lugar**: `gcloud auth application-default login` para desarrollo local. Para CI/CD usar Workload Identity Federation en lugar de SA keys.
4. **Documentar en `docs/reference/security.md`** que no se usan SA keys descargadas.

No requiere cambios de codigo en el repositorio — es una accion operacional.

---

## #262: Admin email hardcodeado

### Estado actual

- `.env` linea 7: `VITE_ADMIN_EMAIL=benoffi11@gmail.com`
- `functions/.env` linea 4: `ADMIN_EMAIL=benoffi11@gmail.com`
- `docs/reference/security.md` linea 80 menciona el email en texto plano
- `docs/reference/patterns.md` linea 9 menciona el email en texto plano

El email en `functions/.env` es preocupante porque ese archivo **esta commiteado** (ver comentario en la linea 1 del archivo: "This file IS committed to git"). El email del admin esta expuesto publicamente en el repo.

### Solucion

**Para `functions/.env` (prioritario — archivo commiteado):**

Mover `ADMIN_EMAIL` a Firebase Secret Manager:

```bash
# Crear el secret
echo -n "benoffi11@gmail.com" | gcloud secrets create ADMIN_EMAIL --data-file=-

# Dar acceso al runtime de Cloud Functions
gcloud secrets add-iam-policy-binding ADMIN_EMAIL \
  --member="serviceAccount:modo-mapa-app@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

En `functions/src/helpers/env.ts` o en cada función que necesite el email:

```typescript
import { defineSecret } from 'firebase-functions/params';
export const ADMIN_EMAIL_SECRET = defineSecret('ADMIN_EMAIL');
```

Las funciones que usan `ADMIN_EMAIL` deben declararlo en `runWith({ secrets: ['ADMIN_EMAIL'] })` o como parametro de `onCall`.

**Para `.env` (client-side):**

`VITE_ADMIN_EMAIL` es solo para el `AdminGuard` frontend. Dado que el repo es publico, este valor ya esta expuesto de todas formas via el codigo de `AdminGuard`. La mitigacion real es que el guard es solo cosmético — la autorizacion real ocurre en las Firestore rules y Cloud Functions. Aun asi, se puede mover a una variable de entorno sin prefijo `VITE_` si no se necesita client-side, o simplemente documentar que el email no es un secreto en este contexto.

**Para los docs:**

Reemplazar `benoffi11@gmail.com` con `{ADMIN_EMAIL}` en `security.md` y `patterns.md`.

---

## #263: specials y achievements sin field validation

### Estado actual

```javascript
// firestore.rules lineas 448-458
match /specials/{docId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();    // SIN validacion de campos
}

match /achievements/{docId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();    // SIN validacion de campos
}
```

Un admin comprometido (o un token de admin robado) podria escribir campos arbitrarios.

### Estructuras de datos esperadas

Para `specials` (tarjetas en pantalla Inicio):

```typescript
interface Special {
  title: string;          // 1-100 chars
  subtitle?: string;      // <= 200 chars
  imageUrl?: string;      // https://firebasestorage...
  businessId?: string;    // biz_NNN format
  category?: string;      // <= 30 chars
  active: boolean;
  order?: number;         // int >= 0
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Para `achievements` (definiciones de logros):

```typescript
interface Achievement {
  id: string;             // 1-50 chars, slug format
  title: string;          // 1-60 chars
  description: string;    // 1-200 chars
  icon: string;           // 1-50 chars
  category: string;       // one of allowed set
  threshold: number;      // int >= 1
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Reglas nuevas (Firestore rules)

```javascript
// Specials — tarjetas especiales en la pantalla Inicio.
// Cualquier usuario autenticado puede leer. Solo admin puede escribir.
// Admin writes validados con hasOnly() como defense-in-depth.
match /specials/{docId} {
  allow read: if request.auth != null;
  allow create: if isAdmin()
    && request.resource.data.keys().hasOnly(['title', 'subtitle', 'imageUrl', 'businessId', 'category', 'active', 'order', 'createdAt', 'updatedAt'])
    && request.resource.data.title is string
    && request.resource.data.title.size() > 0
    && request.resource.data.title.size() <= 100
    && (!('subtitle' in request.resource.data) || (request.resource.data.subtitle is string && request.resource.data.subtitle.size() <= 200))
    && (!('imageUrl' in request.resource.data) || (request.resource.data.imageUrl is string && request.resource.data.imageUrl.matches('^https://firebasestorage\\.googleapis\\.com/.*')))
    && (!('businessId' in request.resource.data) || isValidBusinessId(request.resource.data.businessId))
    && (!('category' in request.resource.data) || (request.resource.data.category is string && request.resource.data.category.size() <= 30))
    && request.resource.data.active is bool
    && (!('order' in request.resource.data) || (request.resource.data.order is int && request.resource.data.order >= 0))
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;
  allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['title', 'subtitle', 'imageUrl', 'businessId', 'category', 'active', 'order', 'updatedAt'])
    && (!('title' in request.resource.data.diff(resource.data).affectedKeys()) || (request.resource.data.title is string && request.resource.data.title.size() > 0 && request.resource.data.title.size() <= 100))
    && (!('subtitle' in request.resource.data) || (request.resource.data.subtitle is string && request.resource.data.subtitle.size() <= 200))
    && (!('imageUrl' in request.resource.data) || (request.resource.data.imageUrl is string && request.resource.data.imageUrl.matches('^https://firebasestorage\\.googleapis\\.com/.*')))
    && (!('businessId' in request.resource.data) || isValidBusinessId(request.resource.data.businessId))
    && (!('category' in request.resource.data) || (request.resource.data.category is string && request.resource.data.category.size() <= 30))
    && (!('active' in request.resource.data) || request.resource.data.active is bool)
    && (!('order' in request.resource.data) || (request.resource.data.order is int && request.resource.data.order >= 0))
    && request.resource.data.updatedAt == request.time;
  allow delete: if isAdmin();
}

// Achievements — definiciones de logros.
// Cualquier usuario autenticado puede leer. Solo admin puede escribir.
// Admin writes validados con hasOnly() como defense-in-depth.
match /achievements/{docId} {
  allow read: if request.auth != null;
  allow create: if isAdmin()
    && request.resource.data.keys().hasOnly(['id', 'title', 'description', 'icon', 'category', 'threshold', 'createdAt', 'updatedAt'])
    && request.resource.data.id is string
    && request.resource.data.id.size() > 0
    && request.resource.data.id.size() <= 50
    && request.resource.data.title is string
    && request.resource.data.title.size() > 0
    && request.resource.data.title.size() <= 60
    && request.resource.data.description is string
    && request.resource.data.description.size() > 0
    && request.resource.data.description.size() <= 200
    && request.resource.data.icon is string
    && request.resource.data.icon.size() > 0
    && request.resource.data.icon.size() <= 50
    && request.resource.data.category is string
    && request.resource.data.category.size() > 0
    && request.resource.data.category.size() <= 30
    && request.resource.data.threshold is int
    && request.resource.data.threshold >= 1
    && request.resource.data.createdAt == request.time;
  allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['title', 'description', 'icon', 'category', 'threshold', 'updatedAt'])
    && (!('title' in request.resource.data.diff(resource.data).affectedKeys()) || (request.resource.data.title is string && request.resource.data.title.size() > 0 && request.resource.data.title.size() <= 60))
    && (!('description' in request.resource.data.diff(resource.data).affectedKeys()) || (request.resource.data.description is string && request.resource.data.description.size() > 0 && request.resource.data.description.size() <= 200))
    && (!('icon' in request.resource.data) || (request.resource.data.icon is string && request.resource.data.icon.size() > 0 && request.resource.data.icon.size() <= 50))
    && (!('category' in request.resource.data) || (request.resource.data.category is string && request.resource.data.category.size() > 0 && request.resource.data.category.size() <= 30))
    && (!('threshold' in request.resource.data) || (request.resource.data.threshold is int && request.resource.data.threshold >= 1));
  allow delete: if isAdmin();
}
```

---

## #264: likeCount negativo / menuPhotos rate limit gap / field length limits

### 264a: likeCount puede quedar negativo

**Estado actual** (`functions/src/triggers/commentLikes.ts` lineas 78-79):

```typescript
await db.doc(`comments/${commentId}`).update({
  likeCount: FieldValue.increment(-1),
});
```

Si por alguna razon el `likeCount` ya es 0 (doc corrupto, delete duplicado, race condition), el decremento lo deja en -1. Esto causa inconsistencia de datos visible en UI.

**Solucion — transaccion con floor en 0:**

```typescript
export const onCommentLikeDeleted = onDocumentDeleted(
  'commentLikes/{docId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const commentId = data.commentId as string;

    // Use transaction to floor likeCount at 0 (prevent negative counters)
    const commentRef = db.doc(`comments/${commentId}`);
    await db.runTransaction(async (tx) => {
      const commentSnap = await tx.get(commentRef);
      if (!commentSnap.exists) return;
      const current = (commentSnap.data()!.likeCount as number) ?? 0;
      tx.update(commentRef, { likeCount: Math.max(0, current - 1) });
    });

    await incrementCounter(db, 'commentLikes', -1);
    await trackDelete(db, 'commentLikes');
  },
);
```

**Nota:** `incrementCounter` ya usa `Math.max(0, ...)` internamente (verificar). El cambio principal es el `likeCount` en el doc `comments/{commentId}`.

### 264b: menuPhotos rate limit no elimina el doc

**Estado actual** (`functions/src/triggers/menuPhotos.ts` lineas 47-62):

```typescript
// Rate limit: 10 menuPhotos per day per user
// Don't delete doc (allow delete: if false in rules), just skip processing
const exceeded = await checkRateLimit(...);

if (exceeded) {
  await logAbuse(db, { ... });
  return;   // <-- el doc queda en pending indefinidamente, sin thumbnail
}
```

El comentario dice "Don't delete doc (allow delete: if false in rules)" — pero las rules de `menuPhotos` son `allow delete: if false` para el **cliente**, no para el admin SDK. El trigger corre con admin SDK que bypasea las rules. El doc debe eliminarse para que el rate limit sea efectivo (igual que commentLikes, listItems, etc.).

**Solucion:**

```typescript
if (exceeded) {
  await snap.ref.delete();   // admin SDK bypasea rules — esto es correcto
  await logAbuse(db, {
    userId,
    type: 'rate_limit',
    collection: 'menuPhotos',
    detail: 'Exceeded 10 menuPhotos/day',
  });
  return;
}
```

**Nota:** Tambien actualizar el comentario que describe las rules para aclarar que el delete del trigger es via admin SDK.

### 264c: field length limits faltantes en userSettings

**Estado actual** en `firestore.rules` linea 343-340:

```javascript
&& (!('locality' in request.resource.data) || request.resource.data.locality is string)
// sin .size() <= N

&& (!('followedTags' in request.resource.data) || (request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20))
// followedTags.size() ya esta limitado a 20
// pero los items individuales dentro de la lista no tienen validacion de longitud
```

**Problema 1:** `locality` es un string sin limite de longitud. Un cliente malicioso puede escribir un string arbitrariamente largo.

**Problema 2:** Los items de `followedTags` (lista de strings) no tienen validacion de longitud por item.

**Solucion** — agregar `.size()` en las reglas de `userSettings`:

```javascript
// locality: max 100 chars (nombre de ciudad)
&& (!('locality' in request.resource.data) || (request.resource.data.locality is string && request.resource.data.locality.size() <= 100))

// followedTags: lista de max 20 items, cada item max 50 chars
// Nota: Firestore rules no permiten iterar listas para validar cada item
// La validacion de longitud por item se hace en el cliente y el trigger
// La regla solo limita el total de items
&& (!('followedTags' in request.resource.data) || (request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20))
```

**Nota sobre followedTags items:** Las Firestore Security Rules no soportan iterar sobre listas para validar cada elemento. La validacion de longitud por item debe manejarse en el cliente (validacion pre-write) y opcionalmente en un trigger.

---

## #265: userSettings write rule / feedback precedence / checkin delete cooldown

### 265a: userSettings usa `write` en vez de `create`/`update`

**Estado actual** (`firestore.rules` linea 325):

```javascript
allow write: if request.auth != null && request.auth.uid == userId
  && request.resource.data.keys().hasOnly([...])
  ...
```

`write` = `create` + `update` + `delete`. Usar `write` tiene dos problemas:

1. Permite `delete` de userSettings por el owner (no deseado — deberia ser permanente).
2. `keys().hasOnly()` no es la validacion correcta para updates — deberia ser `affectedKeys().hasOnly()`.

**Solucion — split en `create` y `update` separados:**

```javascript
match /userSettings/{userId} {
  allow read: if (request.auth != null && request.auth.uid == userId)
              || isAdmin();

  allow create: if request.auth != null && request.auth.uid == userId
    && request.resource.data.keys().hasOnly([
        'profilePublic', 'notificationsEnabled', 'notifyLikes', 'notifyPhotos',
        'notifyRankings', 'notifyFeedback', 'notifyReplies', 'notifyFollowers',
        'notifyRecommendations', 'notificationDigest', 'analyticsEnabled',
        'locality', 'localityLat', 'localityLng',
        'followedTags', 'followedTagsUpdatedAt', 'followedTagsLastSeenAt', 'updatedAt'
      ])
    && request.resource.data.profilePublic is bool
    && request.resource.data.notificationsEnabled is bool
    && request.resource.data.notifyLikes is bool
    && request.resource.data.notifyPhotos is bool
    && request.resource.data.notifyRankings is bool
    && request.resource.data.notifyFeedback is bool
    && request.resource.data.notifyReplies is bool
    && request.resource.data.analyticsEnabled is bool
    && (!('notifyFollowers' in request.resource.data) || request.resource.data.notifyFollowers is bool)
    && (!('notifyRecommendations' in request.resource.data) || request.resource.data.notifyRecommendations is bool)
    && (!('notificationDigest' in request.resource.data) || (request.resource.data.notificationDigest is string && request.resource.data.notificationDigest.size() <= 10))
    && (!('followedTags' in request.resource.data) || (request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20))
    && (!('followedTagsUpdatedAt' in request.resource.data) || request.resource.data.followedTagsUpdatedAt is timestamp)
    && (!('followedTagsLastSeenAt' in request.resource.data) || request.resource.data.followedTagsLastSeenAt is timestamp)
    && (!('locality' in request.resource.data) || (request.resource.data.locality is string && request.resource.data.locality.size() <= 100))
    && (!('localityLat' in request.resource.data) || request.resource.data.localityLat is number)
    && (!('localityLng' in request.resource.data) || request.resource.data.localityLng is number)
    && request.resource.data.updatedAt == request.time;

  allow update: if request.auth != null && request.auth.uid == userId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
        'profilePublic', 'notificationsEnabled', 'notifyLikes', 'notifyPhotos',
        'notifyRankings', 'notifyFeedback', 'notifyReplies', 'notifyFollowers',
        'notifyRecommendations', 'notificationDigest', 'analyticsEnabled',
        'locality', 'localityLat', 'localityLng',
        'followedTags', 'followedTagsUpdatedAt', 'followedTagsLastSeenAt', 'updatedAt'
      ])
    && (!('profilePublic' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.profilePublic is bool)
    && (!('notificationsEnabled' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.notificationsEnabled is bool)
    && (!('notifyLikes' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.notifyLikes is bool)
    && (!('notifyPhotos' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.notifyPhotos is bool)
    && (!('notifyRankings' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.notifyRankings is bool)
    && (!('notifyFeedback' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.notifyFeedback is bool)
    && (!('notifyReplies' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.notifyReplies is bool)
    && (!('notifyFollowers' in request.resource.data) || request.resource.data.notifyFollowers is bool)
    && (!('notifyRecommendations' in request.resource.data) || request.resource.data.notifyRecommendations is bool)
    && (!('notificationDigest' in request.resource.data) || (request.resource.data.notificationDigest is string && request.resource.data.notificationDigest.size() <= 10))
    && (!('analyticsEnabled' in request.resource.data.diff(resource.data).affectedKeys()) || request.resource.data.analyticsEnabled is bool)
    && (!('followedTags' in request.resource.data) || (request.resource.data.followedTags is list && request.resource.data.followedTags.size() <= 20))
    && (!('followedTagsUpdatedAt' in request.resource.data) || request.resource.data.followedTagsUpdatedAt is timestamp)
    && (!('followedTagsLastSeenAt' in request.resource.data) || request.resource.data.followedTagsLastSeenAt is timestamp)
    && (!('locality' in request.resource.data) || (request.resource.data.locality is string && request.resource.data.locality.size() <= 100))
    && (!('localityLat' in request.resource.data) || request.resource.data.localityLat is number)
    && (!('localityLng' in request.resource.data) || request.resource.data.localityLng is number)
    && request.resource.data.updatedAt == request.time;
  // No delete — userSettings es permanente
}
```

### 265b: feedback update rule sin parentesis

**Estado actual** (`firestore.rules` lineas 177-188):

```javascript
allow update: if isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'adminResponse', 'respondedAt', 'respondedBy', 'githubIssueUrl'])
  || (request.auth != null
    && resource.data.userId == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewedByUser'])
    && request.resource.data.viewedByUser == true)
  || (request.auth != null
    ...
```

El operador `||` tiene menor precedencia que `&&`. La regla actual se evalua como:

```
(isAdmin() && hasOnly([admin-fields])) || (owner && hasOnly([viewedByUser])) || (owner && hasOnly([media]))
```

Esto es **correcto por casualidad** dado que los `||` son top-level. Pero la primera clausula `isAdmin() && hasOnly(...)` es ambigua porque `isAdmin()` podria fallar y el `&&` con `hasOnly()` seguiria siendo la unica condicion que falta. Agregar parentesis explicitos mejora la legibilidad y previene bugs futuros:

```javascript
allow update: if (
    isAdmin()
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['status', 'adminResponse', 'respondedAt', 'respondedBy', 'githubIssueUrl'])
  ) || (
    request.auth != null
    && resource.data.userId == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewedByUser'])
    && request.resource.data.viewedByUser == true
  ) || (
    request.auth != null
    && resource.data.userId == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['mediaUrl', 'mediaType'])
    && request.resource.data.mediaUrl is string
    && request.resource.data.mediaUrl.matches('^https://firebasestorage\\.googleapis\\.com/.*')
    && request.resource.data.mediaType in ['image', 'pdf']
  );
```

### 265c: checkin deletes sin cooldown

**Estado actual** (`functions/src/triggers/checkins.ts` lineas 40-47):

```typescript
export const onCheckInDeleted = onDocumentDeleted(
  'checkins/{checkinId}',
  async () => {
    const db = getDb();
    await incrementCounter(db, 'checkins', -1);
    await trackDelete(db, 'checkins');
  },
);
```

Un usuario podria crear y eliminar check-ins en loop (create → rate limited → pero delete no tiene limite). Esto no es un vector de ataque directo pero puede generar carga innecesaria en el trigger y en los counters.

La Firestore rule actual tiene `allow delete: if request.auth != null && resource.data.userId == request.auth.uid` sin ninguna restriccion de frecuencia.

**Solucion — agregar rate limit en el trigger de delete (no en las rules):**

El trigger de delete debe limitar a N deletes por dia por usuario usando `_rateLimits`:

```typescript
export const onCheckInDeleted = onDocumentDeleted(
  'checkins/{checkinId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit: 20 checkin deletes per day per user
    // Note: we can't "undelete" so we just log abuse — no doc to delete
    const deleteRateLimitRef = db.doc(`_rateLimits/checkin_delete_${userId}`);
    await db.runTransaction(async (tx) => {
      const limitSnap = await tx.get(deleteRateLimitRef);
      const today = new Date().toISOString().slice(0, 10);
      const limitData = limitSnap.data();
      const count = limitData?.date === today ? (limitData.count as number) : 0;
      tx.set(deleteRateLimitRef, { date: today, count: count + 1 }, { merge: true });
      if (count >= 20) {
        // Log abuse but can't undo the delete
        // logAbuse is called outside transaction
      }
    });

    // Check after transaction
    const limitSnap = await deleteRateLimitRef.get();
    const today = new Date().toISOString().slice(0, 10);
    if (limitSnap.data()?.date === today && (limitSnap.data()?.count as number) > 20) {
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'checkins_delete',
        detail: 'Exceeded 20 checkin deletes/day',
      });
    }

    await incrementCounter(db, 'checkins', -1);
    await trackDelete(db, 'checkins');
  },
);
```

**Alternativa mas simple** — usar el helper `checkRateLimit` existente adaptado para deletes con una coleccion sintetica `_rateLimits`. Dado que `checkRateLimit` actual consulta la coleccion de origen (no `_rateLimits`), se necesita un mecanismo diferente o extender `checkRateLimit` para soportar rate limits de deletes.

La implementacion mas pragmatica: dado que checkin deletes son raros en uso normal y el vector de ataque es bajo impacto, la solucion minima es **loguear el patron** en `onCheckInDeleted` sin bloquear, y agregar una regla en Firestore que limite deletes a owner verificado (ya existe). El cooldown completo se puede diferir a un issue separado si el equipo lo prioriza.

---

## Resumen de cambios en Firestore rules

### Field whitelist check

| Coleccion | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|----------------------|----------------------|--------------------------------------|-------------------|
| `specials` | todos los campos | NO (era `write` sin validacion) | NO | YES — agregar create/update/delete separados |
| `achievements` | todos los campos | NO (era `write` sin validacion) | NO | YES — agregar create/update/delete separados |
| `userSettings` | `locality` (size limit) | NO habia limite | NO habia limite | YES — agregar `.size() <= 100` |
| `userSettings` | split write→create/update | N/A (era `write`) | N/A | YES — split en create + update + no delete |
| `feedback` | parentesis en update | N/A (logica, no campos) | N/A | YES — agregar parentesis explicitos |

### Rules impact analysis

| Query / operacion | Coleccion | Auth context | Rule que lo permite | Cambio necesario? |
|-------------------|-----------|-------------|--------------------|--------------------|
| Admin escribe `specials` | specials | Admin token | `isAdmin()` | NO — solo se agrega validacion, mismo acceso |
| Admin escribe `achievements` | achievements | Admin token | `isAdmin()` | NO — solo se agrega validacion, mismo acceso |
| Owner crea `userSettings` | userSettings | Owner | `create` rule nueva | NO — comportamiento igual, mejor validacion |
| Owner actualiza `userSettings` | userSettings | Owner | `update` rule nueva | NO — comportamiento igual, mejor validacion |
| Owner elimina `userSettings` | userSettings | Owner | antes permitido via `write`, ahora bloqueado | YES — delete ya no permitido (intencionalmente) |
| Trigger elimina `menuPhotos` (rate limit) | menuPhotos | Admin SDK | bypasea rules | NO — admin SDK siempre bypasea |

---

## Servicios / Cloud Functions afectados

| Archivo | Cambio |
|---------|--------|
| `functions/src/triggers/commentLikes.ts` | `onCommentLikeDeleted`: reemplazar `FieldValue.increment(-1)` con transaccion `Math.max(0, current - 1)` |
| `functions/src/triggers/menuPhotos.ts` | `onMenuPhotoCreated`: agregar `await snap.ref.delete()` en el bloque rate limit exceeded |
| `functions/src/triggers/checkins.ts` | `onCheckInDeleted`: agregar logging de rate limit de deletes |
| `scripts/seed-staging.ts` | Eliminar bloque de ADC manual (lineas 12-34), reemplazar por validacion de ADC existente |

---

## Seguridad operacional (fuera del repo)

| Accion | Responsable | Urgencia |
|--------|-------------|----------|
| Revocar `sa-key.json` en GCP Console (IAM > Service Accounts > Keys) | Gonzalo | INMEDIATA |
| Ejecutar `gcloud auth application-default login` para reemplazar SA key | Gonzalo | INMEDIATA |
| Mover `ADMIN_EMAIL` a Firebase Secret Manager | Gonzalo | ALTA |
| Purgar `client_secret` del historial git con `git filter-repo` | Gonzalo | ALTA |
| Actualizar GitHub Actions secrets si usan `ADMIN_EMAIL` | Gonzalo | ALTA |

---

## Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| OAuth token forgery via client_secret robado | Eliminar hardcode, purgar historial | `scripts/seed-staging.ts` |
| SA key leak via disco comprometido | Revocar key + usar ADC | operacional |
| Admin impersonation via email exposed in repo | Mover a Secret Manager | `functions/.env` |
| Field injection en specials/achievements via admin token robado | `hasOnly()` + type validation | `firestore.rules` |
| `likeCount` negativo por delete duplicado o race condition | `Math.max(0, current - 1)` en transaccion | `commentLikes.ts` |
| Evasion de rate limit en menuPhotos (doc queda pending) | `snap.ref.delete()` en rate limit exceed | `menuPhotos.ts` |
| String overflow en locality field | `.size() <= 100` | `firestore.rules` |
| Delete no autorizado de userSettings | Eliminar `delete` de la regla `write` | `firestore.rules` |
| Ambiguedad de precedencia en feedback update rule | Agregar parentesis explicitos | `firestore.rules` |
