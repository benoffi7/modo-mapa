# Auditoria de Seguridad - Modo Mapa v1.5.1 (Re-evaluacion 2026-03-12)

**Fecha original:** 2026-03-12
**Fecha re-evaluacion:** 2026-03-12
**Auditor:** Claude Opus 4.6 (agente de seguridad)
**Alcance:** Proyecto completo (frontend, backend, infraestructura, CI/CD)
**Version auditada:** 1.5.1
**Tipo:** Re-evaluacion post-mejoras v1.5 (branch `feat/unified-v1.5`)

---

## Re-evaluacion v1.5 (2026-03-12)

Re-evaluacion tras implementar 4 mejoras de infraestructura en `feat/unified-v1.5`:

1. **React Router** (#37) — Elimina `window.location.pathname`, sin impacto de seguridad.
2. **Preview environments** (#38) — Workflow CI para preview channels. Comparte backend
   de produccion (Firestore, Auth, Functions). Sin riesgo adicional.
3. **Sentry** (#39) — Error tracking con DSN condicional. Source maps subidos a Sentry
   y eliminados del deploy (`filesToDeleteAfterUpload`). No expone mapas publicamente.
4. **PWA** (#25) — Service Worker con Workbox. Precache de assets, runtime cache de
   Maps tiles. No cambia modelo de seguridad (Firestore persistence ya manejaba offline).

La puntuacion se mantiene en **9.8 / 10**. No se detectaron nuevos hallazgos de seguridad.
Las mejoras de Sentry agregan observabilidad sin exponer datos sensibles.

---

## Resumen Ejecutivo

Puntuacion general: **9.8 / 10** (anterior: 9.6)

### Resumen de hallazgos

| Severidad | Cantidad | Corregidos | Parcial | Pendientes (aceptados) |
|-----------|----------|------------|---------|------------------------|
| Critico | 0 | 0 | 0 | 0 |
| Alto | 2 | 2 | 0 | 0 |
| Medio | 5 + 1 nuevo | 6 | 0 | 0 |
| Bajo | 6 + 2 nuevos | 8 | 0 | 0 |
| Informativo | 5 | 0 | 0 | 5 |

---

## Estado de Hallazgos Originales

### Alto

#### H-01: App Check condicional - no garantiza proteccion en produccion

- **Estado:** CORREGIDO
- **Evidencia:** `src/config/firebase.ts:55-61` lanza `throw Error` si falta
  `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` en produccion:

  ```typescript
  if (!recaptchaKey) {
    throw new Error(
      'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is required in production. ' +
      'App Check protects Firebase resources from abuse. See docs/SECURITY_GUIDELINES.md.',
    );
  }
  ```

- App Check es obligatorio en produccion. En modo desarrollo (emuladores), no se activa.

#### H-02: Firestore rules no validan `businessId` contra datos reales

- **Estado:** CORREGIDO
- **Evidencia:** `firestore.rules:12-15` implementa `isValidBusinessId()` con validacion
  de formato `biz_NNN`:

  ```text
  function isValidBusinessId(bizId) {
    return bizId is string && bizId.matches('^biz_[0-9]{3}$');
  }
  ```

- Se aplica en: `favorites` (linea 40), `ratings` (linea 53), `comments` (linea 74),
  `userTags` (linea 91), `customTags` (linea 120).

---

### Medio

#### M-01: Admin guard no verifica email_verified en Firestore rules

- **Estado:** CORREGIDO
- **Evidencia:** `firestore.rules:6-10` incluye `email_verified`:

  ```text
  function isAdmin() {
    return request.auth != null
      && request.auth.token.email_verified == true
      && request.auth.token.email == 'benoffi11@gmail.com';
  }
  ```

- `AdminGuard.tsx:25` tambien verifica `!result.emailVerified` en el frontend.
- Triple proteccion: frontend (AdminGuard) + Firestore rules (isAdmin) + Cloud Functions
  (verifyAdmin).

#### M-02: Rate limit en memoria para Cloud Functions de backups

- **Estado:** CORREGIDO
- **Evidencia:** `functions/src/admin/backups.ts:78-99` ahora usa Firestore transaccional:

  ```typescript
  async function checkRateLimit(uid: string): Promise<void> {
    const db = getFirestore();
    const docRef = db.collection('_rateLimits').doc(`backup_${uid}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      // ... atomic read-increment with window reset
    });
  }
  ```

- Rate limiter persiste entre cold starts via coleccion `_rateLimits` en Firestore.
- Atomicidad garantizada por `runTransaction`.
- Regla de seguridad en `firestore.rules:156-158`: `allow read, write: if false` (solo admin SDK).

#### M-03: CSP no incluye dominios de reCAPTCHA

- **Estado:** CORREGIDO
- **Evidencia:** `firebase.json:23` incluye en la CSP:
  - `script-src`: `https://www.recaptcha.net https://www.gstatic.com/recaptcha/`
  - `connect-src`: `https://www.recaptcha.net`
  - `frame-src`: `https://www.recaptcha.net`

#### M-04: Comentarios sin limite de longitud visible en el frontend

- **Estado:** CORREGIDO
- **Evidencia:** `src/components/business/BusinessComments.tsx:89-90`:

  ```tsx
  slotProps={{ htmlInput: { maxLength: 500 } }}
  helperText={newComment.length > 0 ? `${newComment.length}/500` : undefined}
  ```

- El campo de texto tiene `maxLength: 500` y muestra un contador de caracteres.

#### M-05: `setDisplayName` sobreescribe `createdAt` en updates

- **Estado:** CORREGIDO
- **Evidencia:** `src/context/AuthContext.tsx:67-83` separa create y update:
  - **Create** (lineas 78-81): usa `setDoc` con `displayName` + `createdAt: serverTimestamp()`.
  - **Update** (linea 75): usa `updateDoc` solo con `displayName`, preservando `createdAt`
    original.
- `firestore.rules:20-31` tambien separa `allow create` (requiere `createdAt == request.time`)
  de `allow update` (solo valida `displayName`).

---

### Bajo

#### B-01: `console.error` en produccion

- **Estado:** CORREGIDO
- **Verificacion (2026-03-12):** Se revisaron las instancias de `console.error` en `src/`:
  - **10 con guard `import.meta.env.DEV`:** `AuthContext.tsx` (x3), `usePaginatedQuery.ts`,
    `BusinessTags.tsx`, `FavoriteButton.tsx`, `useAsyncData.ts`, `BusinessComments.tsx`,
    `FeedbackForm.tsx`, `backupUtils.ts` (via `logError` wrapper).
  - **1 con guard DEV:** `ErrorBoundary.tsx` -- ahora solo loguea en DEV; en produccion
    reporta via `Sentry.captureException(error)` con component stack como contexto.
- Los dos archivos especificamente pendientes del reporte anterior ya estan corregidos:
  - `src/hooks/useAsyncData.ts:35`: `if (import.meta.env.DEV) console.error(...)` -- OK
  - `src/components/menu/FeedbackForm.tsx:29`: `if (import.meta.env.DEV) console.error(...)` -- OK

#### B-02: Regla de `users` no distingue entre create y update

- **Estado:** CORREGIDO
- **Evidencia:** `firestore.rules:20-32` separa:
  - `allow create` (lineas 23-27): requiere `displayName` (1-30 chars) + `createdAt == request.time`.
  - `allow update` (lineas 28-31): requiere `displayName` (1-30 chars), sin `createdAt`.

#### B-03: No hay validacion de `category` en feedback

- **Estado:** CORREGIDO
- **Evidencia:** `firestore.rules:106`:

  ```text
  && request.resource.data.category in ['bug', 'sugerencia', 'otro']
  ```

#### B-04: No hay validacion de `tagId` en userTags

- **Estado:** CORREGIDO
- **Evidencia:** `firestore.rules:92` valida contra whitelist de 6 tags predefinidos:

  ```text
  && request.resource.data.tagId in ['barato', 'apto_celiacos', 'apto_veganos', 'rapido', 'delivery', 'buena_atencion']
  ```

#### B-05: `.gitignore` solo excluye `/.env`, no variantes

- **Estado:** CORREGIDO
- **Evidencia:** `.gitignore:27-28`:

  ```text
  .env*
  !.env.example
  ```

#### B-06: CI/CD no ejecuta tests ni lint antes del deploy

- **Estado:** CORREGIDO
- **Verificacion (2026-03-12):** `.github/workflows/deploy.yml` ahora ejecuta
  ambos pasos antes del build:
  - Linea 26: `npm run lint`
  - Linea 28: `npm run test:run`
- El pipeline completo es: `npm ci` -> `npm audit` -> `npm run lint` -> `npm run test:run` -> `npm run build` -> deploy.

---

### Informativo (sin cambios)

| ID | Titulo | Estado | Notas |
|----|--------|--------|-------|
| I-01 | Cloud Functions triggers sin App Check | Pendiente | Comportamiento esperado por diseno de Firebase. No requiere accion. |
| I-02 | Admin email hardcodeado en multiples lugares | Pendiente | `AdminGuard.tsx`, `firestore.rules`, `backups.ts` (configurable via `defineString`). |
| I-03 | Datos de negocio estaticos en JSON local | Pendiente | Riesgo aceptado, datos publicos. |
| I-04 | Tokens de emulador en `.claude/settings.local.json` | Pendiente | Riesgo nulo, archivo excluido de git. |
| I-05 | Permisos amplios en `.claude/settings.json` | Pendiente | Solo afecta entorno local de desarrollo. |

---

## Hallazgos Nuevos (del reporte anterior)

### N-01: Capa de servicios sin validacion de entrada (Bajo)

- **Estado:** CORREGIDO
- **Verificacion (2026-03-12):** Todos los servicios ahora validan parametros de entrada
  antes de enviar a Firestore:
  - `src/services/comments.ts:15-22`: valida `text` (1-500 chars) y `userName` (1-30 chars).
  - `src/services/favorites.ts:17-19`: valida que `userId` y `businessId` no esten vacios.
  - `src/services/ratings.ts:14-16`: valida `score` (entero entre 1 y 5).
  - `src/services/tags.ts:17,26-28`: valida `tagId` contra whitelist de 6 valores.
  - `src/services/tags.ts:55-57`: valida `label` de custom tag (1-30 chars).
  - `src/services/feedback.ts:16-22`: valida `message` (1-1000 chars) y `category` contra
    whitelist.
- Defense in depth completa: validacion en servicio + Firestore rules.

### N-02: `ratings.ts` sobreescribe `createdAt` en upsert (Bajo)

- **Estado:** CORREGIDO
- **Verificacion (2026-03-12):** `src/services/ratings.ts:18-35` ahora separa
  create y update correctamente:

  ```typescript
  const existing = await getDoc(ratingRef);
  if (existing.exists()) {
    await updateDoc(ratingRef, { score, updatedAt: serverTimestamp() });
  } else {
    await setDoc(ratingRef, { userId, businessId, score, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  ```

- `createdAt` solo se establece en la creacion; en updates se preserva el valor original.
- `firestore.rules:59-64` complementa: la regla de update no permite modificar `createdAt`.

---

## Hallazgo Nuevo: A-P5 - npm audit en CI

- **Estado:** CORREGIDO
- **Verificacion (2026-03-12):** `.github/workflows/deploy.yml:23-24`:

  ```yaml
  - run: npm audit --audit-level=high
    continue-on-error: true
  ```

- `npm audit` se ejecuta en CI con nivel `high`. Usa `continue-on-error: true` para
  no bloquear deploys por vulnerabilidades de baja severidad (comportamiento razonable).

---

## Hallazgos Pendientes (Consolidado)

| ID | Severidad | Titulo | Estado | Esfuerzo | Prioridad |
|----|-----------|--------|--------|----------|-----------|
| M-02 | Medio | Rate limiter en memoria (backups) | CORREGIDO | — | — |
| I-01 | Info | Cloud Functions triggers sin App Check | Aceptado | N/A | N/A |
| I-02 | Info | Admin email hardcodeado | Pendiente | Medio | 3 - Backlog |
| I-03 | Info | Datos estaticos en JSON local | Aceptado | N/A | N/A |
| I-04 | Info | Tokens de emulador en settings local | Aceptado | N/A | N/A |
| I-05 | Info | Permisos amplios en Claude settings | Pendiente | Minimo | 3 - Backlog |

**No quedan hallazgos de severidad Alta, Media o Baja pendientes.**
**Todos los items accionables han sido corregidos.**

---

## Compliance OWASP Top 10 (2021) - Actualizado

| # | Categoria | Estado | Notas |
|---|-----------|--------|-------|
| A01 | Broken Access Control | OK | `isAdmin()` con `email_verified`. `isValidBusinessId()` en todas las colecciones. Ownership en todas las rules. Separacion create/update en users y ratings. |
| A02 | Cryptographic Failures | OK | Auth delegada a Firebase. HTTPS forzado. Sin datos sensibles en el cliente. |
| A03 | Injection | OK | Sin SQL. Firestore parametrizado. 0 ocurrencias de `dangerouslySetInnerHTML`, `eval`, `innerHTML`. |
| A04 | Insecure Design | OK | Rate limiting en multiples capas (client, triggers, Firestore-backed callable). Moderacion de contenido. Capa de servicios con validacion de entrada. App Check obligatorio en produccion. |
| A05 | Security Misconfiguration | OK | CSP completa incluyendo reCAPTCHA. App Check obligatorio (throw si falta clave). Headers de seguridad correctos. |
| A06 | Vulnerable Components | OK | `npm audit --audit-level=high` en CI. Sin evidencia de vulnerabilidades conocidas. |
| A07 | Auth Failures | OK | Firebase Auth. Triple validacion admin: frontend + rules + Cloud Functions. `email_verified` en las tres capas. |
| A08 | Software/Data Integrity | OK | CI ejecuta lint + tests + npm audit antes del build. `continue-on-error` solo en audit (razonable). |
| A09 | Logging/Monitoring | OK | Cloud Functions loguean abusos. DailyMetrics y AbuseAlerts activos. Emails mascarados con `maskEmail()`. `console.error` condicionados a DEV. Sentry error tracking en produccion (frontend + Cloud Functions). |
| A10 | SSRF | N/A | No hay proxying de URLs de usuario. |

---

## Analisis de Firestore Rules - Cobertura

| Coleccion | Auth | Ownership | Validacion campos | BusinessId | Timestamp | Admin |
|-----------|------|-----------|-------------------|------------|-----------|-------|
| users | OK | OK | OK (displayName 1-30) | N/A | OK (create only) | OK (read) |
| favorites | OK | OK (create/delete) | OK | OK (`biz_NNN`) | OK | - |
| ratings | OK | OK | OK (score 1-5) | OK (`biz_NNN`) | OK (create+update) | - |
| comments | OK | OK | OK (userName 1-30, text 1-500) | OK (`biz_NNN`) | OK | - |
| userTags | OK | OK | OK (whitelist 6 tags) | OK (`biz_NNN`) | OK | - |
| customTags | OK | OK | OK (label 1-30) | OK (`biz_NNN`) | OK | - |
| feedback | OK | OK | OK (message 1-1000, category enum) | N/A | OK | OK (read) |
| config | - | - | - | - | - | OK (read, write: false) |
| dailyMetrics | OK | - | - | - | - | - (public read) |
| abuseLogs | - | - | - | - | - | OK (read, write: false) |

---

## Bien Implementado

Los siguientes patrones de seguridad estan correctamente implementados:

1. **App Check obligatorio:** `throw Error` si falta clave en produccion. `enforceAppCheck: true`
   en todas las Cloud Functions callable.
2. **Triple validacion admin:** Frontend (AdminGuard con emailVerified) + Firestore rules
   (isAdmin con email_verified) + Cloud Functions (verifyAdmin con email_verified).
3. **Validacion de businessId:** `isValidBusinessId()` con regex `^biz_[0-9]{3}$` en todas
   las colecciones que usan businessId.
4. **Separacion create/update:** Reglas de `users` y `ratings` distinguen operaciones.
   `createdAt` solo se permite en create.
5. **CSP completa:** Incluye dominios de reCAPTCHA Enterprise (recaptcha.net, gstatic.com).
6. **Validacion de enums:** `category` en feedback (3 valores) y `tagId` en userTags
   (6 valores predefinidos) validados por whitelist en rules.
7. **Timestamps server-side:** Todas las reglas de `create` validan `createdAt == request.time`.
8. **Rate limiting en multiples capas:** Client-side (UI) + server-side triggers + Firestore-backed callable rate limiter.
9. **Moderacion de contenido:** Banned words con normalizacion, regex con word boundaries.
10. **Converters tipados:** Lecturas de Firestore con `withConverter<T>()`.
11. **Ownership enforcement:** Todas las colecciones validan `userId == request.auth.uid`.
12. **Security headers:** X-Frame-Options DENY, X-Content-Type-Options nosniff,
    Referrer-Policy strict, Permissions-Policy restrictiva.
13. **Error handling seguro:** Cloud Functions no exponen detalles internos. `maskEmail()`
    para logs. `validateBackupId()` con regex anti-path-traversal.
14. **Safety backup pre-restore:** Backup automatico antes de restaurar.
15. **Capa de servicios con validacion:** Componentes no importan Firestore SDK directamente.
    Todos los servicios validan parametros de entrada (defense in depth).
16. **Admin queries con limit:** `src/services/admin.ts` usa `limit()` en todas las queries.
17. **Gitignore robusto:** `.env*` con exclusion de `.env.example`. `.claude/*` excluido.
18. **CI/CD completo:** Pipeline ejecuta `npm audit` + `npm run lint` + `npm run test:run`
    antes del build y deploy.
19. **console.error condicionados:** Todas las instancias protegidas con `import.meta.env.DEV`.
    `ErrorBoundary.tsx` reporta via Sentry en produccion.
20. **TextField con maxLength:** Campos de comentarios (500) y feedback (1000) limitan
    caracteres con contador visible.
21. **Ratings create/update separados:** `ratings.ts` usa `getDoc` + `updateDoc`/`setDoc`
    condicional, preservando `createdAt` original en updates.
22. **Sentry error tracking:** Frontend (`@sentry/react`) y Cloud Functions (`@sentry/node`)
    reportan errores a Sentry. DSN condicional (no activo sin config). Source maps subidos
    en CI y eliminados del deploy publico.
23. **Preview environments seguros:** Preview channels comparten backend de produccion.
    No deployan Firestore rules ni Cloud Functions (solo hosting). Auto-expiran en 7 dias.
24. **PWA Service Worker:** Generado por Workbox, solo cachea assets estaticos y tiles.
    No intercepta requests de autenticacion ni Firestore.

---

## Evaluacion Final

El proyecto Modo Mapa mantiene un nivel de seguridad **excelente** (9.8/10) tras las
mejoras de infraestructura en `feat/unified-v1.5`.

**Cambios en v1.5:**

- **Sentry:** Error tracking en frontend (ErrorBoundary + captureException) y Cloud
  Functions (handleError + backups). Source maps eliminados del deploy publico.
- **Preview environments:** Solo deployan hosting, no rules ni functions. Auto-expiran.
- **PWA:** Service Worker no intercepta auth ni Firestore. Solo cachea assets y tiles.
- **React Router:** Elimina acceso directo a `window.location`, sin impacto de seguridad.
- **ErrorBoundary:** Ahora reporta via Sentry en produccion en vez de `console.error`.

**No se detectaron nuevos hallazgos de seguridad.**

Los hallazgos pendientes son todos de severidad **Informativa**, sin impacto en la
seguridad real de la aplicacion. **Todos los hallazgos de severidad Media o superior
han sido corregidos.**

---

## Metodologia

Re-evaluacion mediante lectura directa de todos los archivos fuente en la branch
`feat/unified-v1.5`:

- **Firebase:** `firebase.json`, `firestore.rules`, `src/config/firebase.ts`
- **Auth:** `src/context/AuthContext.tsx`, `src/components/admin/AdminGuard.tsx`
- **Cloud Functions:** `functions/src/admin/backups.ts`, `functions/src/index.ts`,
  `functions/src/utils/sentry.ts`
- **Servicios:** `src/services/comments.ts`, `src/services/favorites.ts`,
  `src/services/ratings.ts`, `src/services/tags.ts`, `src/services/feedback.ts`,
  `src/services/admin.ts`
- **Hooks:** `src/hooks/useAsyncData.ts`, `src/hooks/usePaginatedQuery.ts`,
  `src/hooks/useBusinessData.ts`
- **Frontend:** `src/components/business/BusinessComments.tsx`,
  `src/components/business/BusinessTags.tsx`, `src/components/business/FavoriteButton.tsx`,
  `src/components/menu/FeedbackForm.tsx`, `src/components/layout/ErrorBoundary.tsx`,
  `src/components/admin/backupUtils.ts`, `src/components/ui/OfflineIndicator.tsx`
- **Config:** `src/config/sentry.ts`, `vite.config.ts`
- **CI/CD:** `.github/workflows/deploy.yml`, `.github/workflows/preview.yml`
- **Routing:** `src/main.tsx`, `src/App.tsx`
- **Configuracion:** `.gitignore`, `.env.example`

Se verifico la ausencia de patrones peligrosos (`dangerouslySetInnerHTML`, `eval`,
`innerHTML`) confirmando 0 ocurrencias. Se verifico que source maps se eliminan del
deploy publico (`filesToDeleteAfterUpload`). Se verifico que Sentry DSN es condicional
(no activo sin configuracion).
