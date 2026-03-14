# Seguridad

## App Check

- **Obligatorio en Cloud Functions (prod)**: todas las funciones callable usan `enforceAppCheck: !IS_EMULATOR` — habilitado en prod, deshabilitado en emuladores.
- **Frontend**: se inicializa con `ReCaptchaEnterpriseProvider` solo en produccion (`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`).
- **Emuladores**: no requieren App Check (`IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true'`).

---

## Firestore rules

- **Auth requerida**: todas las colecciones requieren `request.auth != null`.
- **Ownership**: escrituras validan `request.resource.data.userId == request.auth.uid`.
- **Timestamps server-side**: todas las reglas de `create` validan `createdAt == request.time`.
- **Validacion de campos**: longitudes maximas (displayName 30, text 500, message 1000, label 30), score 1-5, `isValidCriteria` para multi-criterio ratings (each 1-5 int).
- **Admin check**: `isAdmin()` verifica `request.auth.token.email == 'benoffi11@gmail.com'`. Tolerante a campos faltantes en `request.auth.token`.
- **Metricas publicas**: `dailyMetrics` es legible por cualquier usuario autenticado (estadisticas publicas).

### Reglas por coleccion

| Coleccion | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `users` | owner + admin | owner | owner (displayName only) | — |
| `favorites` | auth | owner, `keys().hasOnly()` | — | owner |
| `ratings` | auth | owner, `keys().hasOnly()`, score 1-5, isValidCriteria | owner (userId immutability, score + updatedAt + criteria) | owner |
| `comments` | auth | owner, `keys().hasOnly()`, text 1-500 | owner, `affectedKeys().hasOnly(['text','updatedAt'])` | owner |
| `commentLikes` | auth | owner, `keys().hasOnly()` | — | owner |
| `userTags` | auth | owner, `keys().hasOnly()` | — | owner |
| `customTags` | auth | owner, `keys().hasOnly()`, label 1-30 | owner (userId immutability) | owner |
| `feedback` | owner + admin | owner, `keys().hasOnly()`, message 1-1000 | admin (respond: status/adminResponse/respondedAt/respondedBy) + owner (viewedByUser only) | owner |
| `menuPhotos` | auth | owner, `keys().hasOnly()`, pending only | Functions only | Functions only |
| `priceLevels` | auth | owner, `keys().hasOnly()`, level 1-3 | owner (userId immutability, level + updatedAt) | owner |
| `config` | admin | Functions | Functions | — |
| `dailyMetrics` | auth | Functions | Functions | — |
| `abuseLogs` | admin | Functions | — | — |
| `userSettings` | auth | owner, `keys().hasOnly()` | owner, `keys().hasOnly()` | — |
| `userRankings` | auth | Functions | Functions | — |
| `notifications` | owner | — | owner (`affectedKeys().hasOnly(['read'])`) | — |
| `_rateLimits` | — | Functions | Functions | — |

### Patrones de seguridad en rules

- **`keys().hasOnly()`**: todas las reglas de `create` (y `write` en userSettings) restringen los campos permitidos para prevenir inyeccion de datos arbitrarios.
- **`affectedKeys().hasOnly()`**: comments update y notifications update restringen que campos pueden cambiar, previniendo que el cliente manipule campos server-side como `replyCount`, `flagged`, `likeCount`.
- **userId inmutabilidad**: ratings, customTags y priceLevels update verifican `request.resource.data.userId == resource.data.userId`.
- **Ownership en update/delete**: siempre se chequea `resource.data.userId == request.auth.uid` (no el request data).
- **replyCount server-only**: gestionado exclusivamente por Cloud Functions (`onCommentCreated`/`onCommentDeleted`). El cliente no puede modificar este campo.

---

## Cloud Functions — seguridad

- **Verificacion de admin**: email + `email_verified` + comparacion con `ADMIN_EMAIL` parametrizado.
- **Rate limiting callable**: 5 llamadas por minuto por usuario (Firestore-backed via `_rateLimits` collection, persiste entre cold starts).
- **Validacion de input**: `validateBackupId` rechaza caracteres invalidos con regex `^[\w.-]+$`.
- **Logging seguro**: `maskEmail()` enmascara emails en logs (`ben***@gmail.com`).
- **Manejo de errores**: errores de permisos y not-found se mapean a `HttpsError` apropiados.
- **Duplicate report prevention**: subcollection `reports` bajo `menuPhotos/{photoId}`, doc ID = userId. Si ya existe, se rechaza.

### Rate limiting server-side (triggers)

| Coleccion | Limite |
|-----------|--------|
| `comments` | 20/dia por usuario |
| `commentLikes` | 50/dia por usuario |
| `customTags` | 10/business por usuario |
| `feedback` | 5/dia por usuario |

### Server-side data integrity (Cloud Functions)

- **replyCount**: `onCommentCreated` incrementa el `replyCount` del padre cuando se crea una respuesta (vía `FieldValue.increment(1)`). `onCommentDeleted` decrementa con floor en 0.
- **Cascade delete**: `onCommentDeleted` busca y elimina todas las replies huérfanas (`parentId == deletedDocId`) en batch.
- **likeCount**: `onCommentLikeCreated`/`onCommentLikeDeleted` gestionan el contador de likes.

### Moderacion de contenido

- Lista de banned words en `config/moderation` (Firestore).
- Normalizacion de acentos antes de comparar.
- Word boundary matching para evitar falsos positivos.
- Cache de 5 minutos para la lista de palabras.
- Contenido flaggeado se marca pero no se elimina automaticamente.
- Re-moderación automática al editar texto (`onCommentUpdated`).

---

## Content Security Policy (CSP)

Configurado en `firebase.json` headers:

- `connect-src`: incluye `*.cloudfunctions.net` para llamadas a Cloud Functions
- `script-src`: incluye `*.googleapis.com`, `apis.google.com`, `www.google.com`, `www.gstatic.com`
- `frame-src`: incluye `*.firebaseapp.com`, `www.google.com`

---

## Storage rules (`storage.rules`)

```text
menus/{businessId}/{fileName}:
  read:   auth != null
  create: auth != null && size < 5MB && contentType.matches('image/(jpeg|png|webp)')
  delete: false (solo admin SDK desde Cloud Functions)

feedback-media/{feedbackId}/{fileName}:
  read:   auth != null
  create: auth != null && size < 10MB && contentType.matches('image/(jpeg|png|webp)')
  delete: auth != null
```
