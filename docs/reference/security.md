# Seguridad

Guía unificada de seguridad del proyecto: políticas, Firestore rules, Cloud Functions, CSP, Storage, y checklist de desarrollo.

---

## Repositorio publico

El repositorio es publico desde 2026-03-15. Todo el codigo, PRs, commits e historial son visibles.

### Checklist para PRs y commits

- [ ] No incluir secretos, API keys, credenciales ni emails hardcodeados
- [ ] PR descriptions profesionales, sin exponer detalles de infraestructura interna
- [ ] Commit messages limpios e informativos
- [ ] Revisar diffs para exposicion accidental de secretos antes de commitear
- [ ] Valores especificos de entorno van por env vars, nunca hardcodeados

---

## Checklist de seguridad por commit

Antes de cada commit, verificar:

- [ ] **Firestore rules:** Si se agrega/modifica una colección, las reglas validan:
  - Autenticación (`request.auth != null`)
  - Ownership (`request.resource.data.userId == request.auth.uid`)
  - Longitud de strings (máximo razonable, ej: `<= 30` para nombres, `<= 500` para textos)
  - Rango de valores numéricos (ej: `score >= 1 && score <= 5`)
  - Timestamps del servidor (`request.resource.data.createdAt == request.time`)
- [ ] **Sin strings mágicos:** Nombres de colecciones usan `COLLECTIONS` de `src/config/collections.ts`
- [ ] **Sin secretos en código:** No hay API keys, tokens ni credenciales hardcodeadas
- [ ] **Error handling:** Toda operación async tiene `try/catch` con estado de error visible al usuario
- [ ] **Validación de input:** Inputs del usuario se validan tanto client-side como en Firestore rules
- [ ] **Sin `dangerouslySetInnerHTML`:** Nunca renderizar HTML sin sanitizar
- [ ] **Sin eval/Function:** No ejecutar código dinámico
- [ ] **Links externos:** URLs generadas por el usuario se abren con `target="_blank"` y `rel="noopener"`

---

## App Check

- **Obligatorio en Cloud Functions (prod)**: todas las funciones callable usan `enforceAppCheck: !IS_EMULATOR` — habilitado en prod, deshabilitado en emuladores.
- **Frontend**: se inicializa con `ReCaptchaEnterpriseProvider` solo en producción (`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`).
- **Emuladores**: no requieren App Check (`IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true'`).

**Configuración:**

1. Google Cloud Console > reCAPTCHA Enterprise > crear site key para el dominio de producción
2. Firebase Console > App Check > Registrar app con proveedor reCAPTCHA Enterprise
3. Agregar `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` a `.env` y GitHub Secrets
4. Firebase Console > Firestore > App Check > Enforce (activar enforcement)

En desarrollo se usa un debug token automático (`FIREBASE_APPCHECK_DEBUG_TOKEN = true` en `src/config/firebase.ts`). Si `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` no está configurada, App Check no se inicializa.

---

## Autenticación email/password (#80)

- **Providers**: Anonymous (default) + Email/Password (opcional, vía `linkWithCredential`). Google solo para admin.
- **UID preservado**: `linkWithCredential` mantiene el UID anónimo, todos los datos del usuario se preservan.
- **Passwords**: hasheados por Firebase Auth, nunca accesibles desde la app. Campos de password limpios al cerrar dialogs.
- **Email enumeration prevention**: `auth/email-already-in-use` mapeado a mensaje genérico. Habilitar "Email Enumeration Protection" en Firebase Console.
- **Re-auth obligatoria**: cambio de contraseña requiere `reauthenticateWithCredential()` con contraseña actual.
- **Verificación de email**: no bloqueante. Badge visual. Re-envío con cooldown 60s para prevenir abuso.
- **Error handling**: todos los errores de Firebase Auth mapeados a mensajes en español vía `getAuthErrorMessage()`. Mensajes de login/password genéricos para evitar info leakage.
- **Logout**: `signOut()` + limpieza de `STORAGE_KEY_VISITS`. Color mode y analytics consent se preservan (preferencias de dispositivo).
- **Firestore rules**: no requieren cambios. `request.auth.uid` funciona idénticamente para anónimos y email/password.
- **Sin XSS**: email del usuario renderizado vía JSX escaping (`{user?.email}`), sin `dangerouslySetInnerHTML`.

---

## Firestore rules

- **Auth requerida**: todas las colecciones requieren `request.auth != null`.
- **Ownership**: escrituras validan `request.resource.data.userId == request.auth.uid`.
- **Timestamps server-side**: todas las reglas de `create` validan `createdAt == request.time`.
- **Validación de campos**: longitudes máximas (displayName 30, text 500, message 1000, label 30), score 1-5, `isValidCriteria` para multi-criterio ratings (each 1-5 int).
- **Admin check**: `isAdmin()` verifica `request.auth.token.email == 'benoffi11@gmail.com'`. Tolerante a campos faltantes en `request.auth.token`.
- **Métricas públicas**: `dailyMetrics` es legible por cualquier usuario autenticado (estadísticas públicas).

### Reglas por colección

| Colección | Read | Create | Update | Delete |
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

- **`keys().hasOnly()`**: todas las reglas de `create` (y `write` en userSettings) restringen los campos permitidos para prevenir inyección de datos arbitrarios.
- **`affectedKeys().hasOnly()`**: comments update y notifications update restringen qué campos pueden cambiar, previniendo que el cliente manipule campos server-side como `replyCount`, `flagged`, `likeCount`.
- **userId inmutabilidad**: ratings, customTags y priceLevels update verifican `request.resource.data.userId == resource.data.userId`.
- **Ownership en update/delete**: siempre se chequea `resource.data.userId == request.auth.uid` (no el request data).
- **replyCount server-only**: gestionado exclusivamente por Cloud Functions (`onCommentCreated`/`onCommentDeleted`). El cliente no puede modificar este campo.

---

## Consideraciones por tipo de funcionalidad

### Escritura a Firestore (create/update)

1. **Firestore rules obligatorias:** Toda colección nueva debe tener reglas que validen auth, ownership, tipo/longitud de cada campo, rangos numéricos, y timestamps del servidor.
2. **Rate limiting client-side:** Limitar cantidad de escrituras por usuario/día.
3. **Optimistic updates:** Actualizar UI inmediatamente pero manejar el rollback si falla.
4. **Loading state:** Deshabilitar el botón/control durante la operación.
5. **Tipado con converters:** Usar `withConverter<T>()` de `src/config/converters.ts`.

### Lectura de Firestore (read/query)

1. **Auth requerida:** Toda lectura debe requerir autenticación.
2. **No exponer datos de otros usuarios:** Queries filtradas por `userId` cuando es data privada.
3. **Paginación:** Para colecciones que pueden crecer, usar `limit()` + `startAfter()`.
4. **Error state:** Mostrar mensaje de error con botón de reintentar.

### Formularios y inputs de usuario

1. **Validación client-side:** Trim de whitespace, longitud máxima, caracteres válidos.
2. **Validación server-side:** Duplicar validaciones en Firestore rules.
3. **Feedback visual:** Conteo de caracteres, estados de error inline.
4. **Sanitización:** React escapa por defecto, pero evitar pasar user input a `href`, `src`, etc.

### Autenticación y autorización

1. **Auth anónima:** El proyecto usa Firebase Anonymous Auth. Toda funcionalidad debe funcionar con usuarios anónimos.
2. **Ownership:** Solo el creador de un documento puede modificarlo/eliminarlo.
3. **DisplayName:** Validar longitud (<= 30) tanto en client como en rules.
4. **No confiar en datos del cliente:** El `userId` en documentos debe ser `request.auth.uid`, no un valor enviado por el cliente.

### Variables de entorno

1. **Prefijo `VITE_`:** Todas las env vars client-side deben tener prefijo `VITE_`.
2. **Validación al iniciar:** Nuevas vars requeridas deben agregarse a la validación en `src/config/firebase.ts`.
3. **No commitear `.env`:** Verificar que `.env` esté en `.gitignore`.
4. **GitHub Secrets:** Para CI/CD, agregar en GitHub repo Settings.

---

## Cloud Functions — seguridad

- **Verificación de admin**: email + `email_verified` + comparación con `ADMIN_EMAIL` parametrizado.
- **Rate limiting callable**: 5 llamadas por minuto por usuario (Firestore-backed vía `_rateLimits` collection, persiste entre cold starts).
- **Validación de input**: `validateBackupId` rechaza caracteres inválidos con regex `^[\w.-]+$`.
- **Logging seguro**: `maskEmail()` enmascara emails en logs (`ben***@gmail.com`).
- **Manejo de errores**: errores de permisos y not-found se mapean a `HttpsError` apropiados.
- **Duplicate report prevention**: subcollection `reports` bajo `menuPhotos/{photoId}`, doc ID = userId. Si ya existe, se rechaza.

### Rate limiting server-side (triggers)

| Colección | Límite |
|-----------|--------|
| `comments` | 20/día por usuario |
| `commentLikes` | 50/día por usuario |
| `customTags` | 10/business por usuario |
| `feedback` | 5/día por usuario |

### Server-side data integrity (Cloud Functions)

- **replyCount**: `onCommentCreated` incrementa el `replyCount` del padre cuando se crea una respuesta (vía `FieldValue.increment(1)`). `onCommentDeleted` decrementa con floor en 0.
- **Cascade delete**: `onCommentDeleted` busca y elimina todas las replies huérfanas (`parentId == deletedDocId`) en batch.
- **likeCount**: `onCommentLikeCreated`/`onCommentLikeDeleted` gestionan el contador de likes.

### Moderación de contenido

- Lista de banned words en `config/moderation` (Firestore).
- Normalización de acentos antes de comparar.
- Word boundary matching para evitar falsos positivos.
- Cache de 5 minutos para la lista de palabras.
- Contenido flaggeado se marca pero no se elimina automáticamente.
- Re-moderación automática al editar texto (`onCommentUpdated`).

### Checklist para nuevos triggers

- Agregar rate limiting vía `checkRateLimit()` si es user-facing
- Agregar moderación vía `checkModeration()` para campos de texto
- Actualizar counters vía `incrementCounter()` / `trackWrite()` / `trackDelete()`
- Usar `FieldValue.increment()` para atomic counter updates
- Implementar cascade deletes si el doc tiene relaciones hijo

### Campos server-only (nunca escribibles por clientes)

| Campo | Colección | Gestionado por |
|-------|-----------|---------------|
| `replyCount` | `comments` | `onCommentCreated` / `onCommentDeleted` |
| `likeCount` | `comments` | `onCommentLikeCreated` / `onCommentLikeDeleted` |
| `flagged` | `comments` | `onCommentCreated` / `onCommentUpdated` (moderation) |
| `reportCount` | `menuPhotos` | `reportMenuPhoto` callable |
| `thumbnailPath` | `menuPhotos` | `onMenuPhotoCreated` |

---

## Content Security Policy (CSP)

Configurado en `firebase.json` headers:

- `connect-src`: incluye `*.cloudfunctions.net` para llamadas a Cloud Functions
- `script-src`: incluye `*.googleapis.com`, `apis.google.com`, `www.google.com`, `www.gstatic.com`
- `frame-src`: incluye `*.firebaseapp.com`, `www.google.com`

### Headers de seguridad

- `Content-Security-Policy`: Si se agrega un nuevo origen (CDN, API, etc.), actualizar la CSP
- `X-Frame-Options: DENY`: No permitir embedding en iframes
- `X-Content-Type-Options: nosniff`: Prevenir MIME sniffing

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

---

## Límites de validación

| Recurso | Límite | Tipo |
|---------|--------|------|
| displayName | 30 chars | Client + Server |
| userName (comments) | 30 chars | Server |
| Comment text | 500 chars | Server |
| Custom tag label | 30 chars | Client + Server |
| Feedback message | 1000 chars | Server |
| Rating score | 1-5 | Server |
| Custom tags por comercio | 10 | Client |
| Comentarios por usuario/día | 20 | Client |

---

## Patrones seguros del proyecto

### Colecciones de Firestore

```text
COLLECTIONS.USERS        → solo el owner lee/escribe, timestamp validado
COLLECTIONS.FAVORITES    → auth para leer, ownership + timestamp para crear/eliminar
COLLECTIONS.RATINGS      → auth para leer, ownership + rango 1-5 + timestamps para crear/actualizar
COLLECTIONS.COMMENTS     → auth para leer, ownership + validación de texto + timestamp para crear
COLLECTIONS.USER_TAGS    → auth para leer, ownership + timestamp para crear/eliminar
COLLECTIONS.FEEDBACK     → ownership para crear/leer/eliminar, validación de mensaje + timestamp
COLLECTIONS.CUSTOM_TAGS  → auth para leer, ownership + validación de label + timestamp para crear
```

### Converters tipados

Todas las lecturas de Firestore usan `withConverter<T>()` desde `src/config/converters.ts`:

```typescript
// Lectura tipada (sin d.data() as any)
const q = query(collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter), where(...));
const snapshot = await getDocs(q);
const items: Comment[] = snapshot.docs.map((d) => d.data()); // tipado automático

// Escritura sin converter (usa serverTimestamp() directamente)
await addDoc(collection(db, COLLECTIONS.COMMENTS), { userId, text, createdAt: serverTimestamp() });
```

Converters disponibles: `userProfileConverter`, `ratingConverter`, `commentConverter`, `userTagConverter`, `customTagConverter`, `favoriteConverter`.

---

## Componentes y UI (seguridad)

1. **Error Boundary:** Componentes que pueden fallar deben estar dentro del Error Boundary global.
2. **ARIA labels:** Todo botón de ícono y elemento interactivo sin texto visible debe tener `aria-label`.
3. **No deshabilitar zoom:** Mantener `user-scalable=yes` en el viewport.

---

## Cuándo actualizar este documento

- Al agregar una nueva colección de Firestore
- Al agregar un nuevo tipo de input de usuario
- Al integrar un servicio externo (API, CDN, etc.)
- Al cambiar la política de autenticación
- Al descubrir un nuevo vector de ataque o patrón inseguro
