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
- **Validacion de campos**: longitudes maximas (displayName 30, text 500, message 1000, label 30), score 1-5.
- **Admin check**: `isAdmin()` verifica `request.auth.token.email == 'benoffi11@gmail.com'`.
- **Metricas publicas**: `dailyMetrics` es legible por cualquier usuario autenticado (estadisticas publicas).

### Reglas por coleccion

| Coleccion | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `users` | owner + admin | owner | owner (displayName only) | — |
| `favorites` | auth | owner | — | owner |
| `ratings` | auth | owner (score 1-5) | owner (score + updatedAt) | — |
| `comments` | auth | owner (text 1-500) | owner (text + updatedAt only) | owner |
| `commentLikes` | auth | owner | — | owner |
| `userTags` | auth | owner | — | owner |
| `customTags` | auth | owner (label 1-30) | owner | owner |
| `feedback` | owner + admin | owner (message 1-1000) | — | owner |
| `menuPhotos` | auth | owner (pending only) | Functions only | Functions only |
| `priceLevels` | auth | owner (level 1-3) | owner (level + updatedAt) | — |
| `config` | admin | Functions | Functions | — |
| `dailyMetrics` | auth | Functions | Functions | — |
| `abuseLogs` | admin | Functions | — | — |

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

### Moderacion de contenido

- Lista de banned words en `config/moderation` (Firestore).
- Normalizacion de acentos antes de comparar.
- Word boundary matching para evitar falsos positivos.
- Cache de 5 minutos para la lista de palabras.
- Contenido flaggeado se marca pero no se elimina automaticamente.

---

## Content Security Policy (CSP)

Configurado en `firebase.json` headers:

- `connect-src`: incluye `*.cloudfunctions.net` para llamadas a Cloud Functions
- `script-src`: incluye `*.googleapis.com`, `apis.google.com`, `www.google.com`, `www.gstatic.com`
- `frame-src`: incluye `*.firebaseapp.com`, `www.google.com`

---

## Storage rules (`storage.rules`)

```text
menu-photos/{userId}/{fileName}:
  read:   auth != null
  create: auth.uid == userId && size < 5MB && contentType.matches('image/.*')
  delete: (nunca desde client — solo admin SDK desde Cloud Functions)
```
