# Informe de Seguridad

**Fecha:** 2026-03-11
**Versión auditada:** 1.3.0
**Archivos revisados:** 69 archivos (config, contextos, hooks, componentes, reglas, hosting, Cloud Functions, admin)

---

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| Alta | 0 |
| Media | 0 |
| Baja | 0 |

**Nivel de riesgo general:** BAJO — Todos los hallazgos fueron resueltos o mitigados. Sin vulnerabilidades críticas.

---

## Hallazgos resueltos

| # | Hallazgo | Severidad original | Resolución |
|---|----------|-------------------|------------|
| 1 | Headers de seguridad faltantes | Alta | Agregados CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy en `firebase.json` |
| 2 | DisplayName sin validación server-side | Alta | Validación de tipo, largo > 0 y <= 30 en `firestore.rules` + trim client-side |
| 3 | Rate limiting solo client-side en comentarios | Alta | **Server-side**: Cloud Function `onCommentCreated` valida 20/día, elimina doc si excede. Client-side como primera capa |
| 4 | userName en comentarios sin validación | Media | Validación `userName.size() > 0 && <= 30` en `firestore.rules` |
| 5 | Feedback sin reglas de read/delete | Media | Agregado `allow read, delete` con ownership check + admin read |
| 6 | CustomTags sin límite server-side | Media | **Server-side**: Cloud Function `onCustomTagCreated` valida 10/business, elimina doc si excede |
| 7 | Sin validación de env vars | Media | Validación en startup con error claro si faltan vars requeridas |
| 8 | Sin rate limiting server-side en escrituras | Media | **Resuelto**: Cloud Functions con rate limiting en comments (20/día), customTags (10/business), feedback (5/día). Documentos que exceden son eliminados automáticamente |
| 9 | Timestamps controlables por el cliente | Media | Validación `createdAt == request.time` y `updatedAt == request.time` en todas las reglas |
| 10 | Sin moderación de contenido | Media | **Resuelto**: Cloud Functions filtran texto con lista de banned words configurable (`config/moderation`). Documentos flaggeados se marcan y ocultan en frontend |
| 11 | MIME sniffing sin protección | Baja | Resuelto con header `X-Content-Type-Options: nosniff` |
| 12 | Viewport zoom deshabilitado | Baja | Cambiado a `user-scalable=yes` |
| 13 | Auth anónima automática sin control | Baja | Firebase App Check limita bots + rate limiting server-side como capa adicional |
| 14 | Comentarios sin regla de update | Baja | Issue #17 creado para implementar edición como feature futura |
| 15 | Tipado estricto para datos de Firestore | Baja | `withConverter<T>()` en todas las lecturas. Converters centralizados |
| 16 | CSP bloqueaba `apis.google.com` | Media | Agregado `https://apis.google.com` a `script-src` en `firebase.json` |
| 17 | Query a Firestore sin auth guard en `loadTags()` | Media | Guard `if (!user)` que muestra seed tags sin autenticación |
| 18 | Sin monitoreo de abuso | Media | **Resuelto**: `abuseLogs` collection con logs de rate limit excedido, contenido flaggeado y top writers. Visible en admin dashboard |

---

## Hallazgos pendientes

No hay hallazgos pendientes.

---

## Áreas auditadas en v1.3.0

### 1. Content Security Policy (CSP)

**Estado:** SEGURO

- `script-src`: `self`, `*.googleapis.com`, `https://apis.google.com`, `https://www.google.com`, `https://www.gstatic.com`
- `style-src`: `self`, `unsafe-inline`, `fonts.googleapis.com`
- `connect-src`: `self`, `*.firebaseio.com`, `*.googleapis.com`, `*.google.com`, `*.firebaseapp.com`
- `frame-src`: `self`, `*.firebaseapp.com`, `https://www.google.com`
- Sin `unsafe-eval` en ninguna directiva

### 2. Reglas de Firestore

**Estado:** SEGURO

- Auth guard (`request.auth != null`) en todas las operaciones de escritura
- Ownership check (`resource.data.userId == request.auth.uid`) en delete/update
- Validación de timestamps server-side (`createdAt == request.time`)
- Validación de longitud en campos de texto
- Admin-only collections (`config`, `dailyMetrics`, `abuseLogs`) con `isAdmin()` helper
- `isAdmin()` verifica `request.auth.token.email == 'benoffi11@gmail.com'`
- `allow write: if false` en collections que solo escribe el admin SDK

### 3. Autenticación

**Estado:** SEGURO

- Firebase Anonymous Auth para usuarios normales
- Google Sign-In para admin (`/admin`)
- Admin guard en 2 capas: frontend (`AdminGuard` verifica email) + server-side (Firestore rules `isAdmin()`)
- Auto sign-out si el email no coincide con el admin autorizado

### 4. Rate Limiting (2 capas)

**Estado:** SEGURO

- **Client-side**: UI previene envío si se excede el límite (primera capa rápida)
- **Server-side**: Cloud Functions `onDocumentCreated` triggers validan límites y eliminan documentos que exceden:
  - Comments: 20/día por usuario
  - CustomTags: 10 por business por usuario
  - Feedback: 5/día por usuario
- Excesos se logean en `abuseLogs` collection
- Rate limiter usa `.count().get()` para conteo eficiente

### 5. Moderación de contenido

**Estado:** SEGURO

- Cloud Functions filtran texto en comments (`text`), customTags (`label`), feedback (`message`)
- Lista de banned words configurable en `config/moderation` (actualizable sin deploy)
- Normalización: lowercase + strip acentos (NFD + remove combining chars)
- Word boundary matching con `escapeRegex()` para seguridad
- Caché en memoria de 5 min para lista de palabras (evita reads excesivos)
- Documentos flaggeados: comments/feedback marcados con `flagged: true`, customTags eliminados
- Frontend filtra comments flaggeados (`!c.flagged`)

### 6. Admin Dashboard

**Estado:** SEGURO

- Acceso restringido a `benoffi11@gmail.com` (hardcoded, no configurable por usuarios)
- Lazy loaded (`/admin`) — no se carga en la app normal
- Solo lectura: admin no puede modificar datos desde el dashboard
- Collections admin-only protegidas por Firestore rules

### 7. Cloud Functions

**Estado:** SEGURO

- `firebase-admin` SDK bypasea reglas (escribe counters, métricas, abuse logs)
- Triggers `onDocumentCreated/Written/Deleted` — no endpoints HTTP expuestos
- Scheduled function solo ejecuta a las 3AM (no invocable externamente)
- No hay Cloud Functions HTTP endpoints (superficie de ataque mínima)

### 8. Caché y persistencia

**Estado:** SEGURO

- Firestore persistent cache (IndexedDB) solo en producción
- Caché client-side module-level con TTL (5 min business data, 2 min listas)
- Sin localStorage/sessionStorage para datos sensibles
- Cache invalidation en cada write

### 9. Input de usuario

**Estado:** SEGURO

- React escapa automáticamente todo el output (sin `dangerouslySetInnerHTML`)
- Sin `eval()`, `Function()`, `innerHTML` en toda la codebase
- Comentarios: texto limitado, userName validado, moderado server-side
- Custom tags: label limitado a 30 chars, moderado server-side
- Feedback: mensaje limitado a 1000 chars, moderado server-side
- Ratings: valores 1-5 validados en rules
- SearchBar: búsqueda client-side sobre datos estáticos

### 10. Dependencias

**Estado:** SEGURO

- `npm audit`: 0 vulnerabilidades
- React 19.2, Firebase 12.10, MUI 7.3, Vite 7.3, TypeScript 5.9
- Cloud Functions: firebase-admin 13, firebase-functions 6.3, Node 22

---

## Aspectos positivos

- Rate limiting server-side en 3 colecciones de escritura
- Moderación de contenido automática con banned words configurable
- Admin dashboard restringido con verificación en 2 capas (frontend + rules)
- Abuse logging para monitoreo de actividad sospechosa
- Counters atómicos con `FieldValue.increment` (sin race conditions)
- Métricas diarias automatizadas (cron)
- Sin endpoints HTTP expuestos (solo triggers de Firestore)
- Firestore rules con `isAdmin()` helper centralizado
- Persistent cache con IndexedDB para resiliencia offline
- Pre-commit hooks con ESLint
- `exactOptionalPropertyTypes` habilitado
- 95 tests (82 frontend + 13 functions)

---

## Recomendaciones para hardening futuro

1. **Rotación de API keys**: Rotar keys periódicamente como práctica estándar
2. **Budget alerts**: Configurar alertas de presupuesto en Firebase para detectar picos de uso inesperados
3. **Cloud Logging**: Integrar con Cloud Logging para alertas en tiempo real de abuse patterns
4. **IP-based rate limiting**: Agregar rate limiting por IP (requiere Cloud Functions HTTP o middleware)
5. **Admin email configurable**: Mover el email admin a Remote Config o env var para no hardcodear
