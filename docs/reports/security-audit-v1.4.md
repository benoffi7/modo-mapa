# Auditoria de Seguridad - Modo Mapa v1.4.0 (Re-evaluacion)

**Fecha:** 2026-03-12
**Auditor:** Claude Opus 4.6 (agente de seguridad)
**Alcance:** Proyecto completo (frontend, backend, infraestructura, CI/CD)
**Version auditada:** 1.4.0
**Tipo:** Re-evaluacion posterior a correcciones de arquitectura (branch `feat/audit-fixes`)

---

## Resumen Ejecutivo

Puntuacion general: **7.8 / 10** (anterior: 7.5)

Esta re-evaluacion analiza el estado actual del codigo en la branch `feat/audit-fixes`,
que incluye mejoras de arquitectura significativas. Se detectaron **3 hallazgos corregidos
indirectamente** por la refactorizacion de la capa de servicios, y se verifico que la
funcion `verifyAdmin` en Cloud Functions ya incluia `email_verified` desde antes. Sin
embargo, **los hallazgos de severidad Alta y la mayoria de los de severidad Media siguen
pendientes** en los archivos de infraestructura (`firestore.rules`, `firebase.json`,
`firebase.ts`).

### Resumen de hallazgos

| Severidad | Cantidad | Corregidos | Parcial | Pendientes |
|-----------|----------|------------|---------|------------|
| Critico | 0 | 0 | 0 | 0 |
| Alto | 2 | 0 | 0 | 2 |
| Medio | 5 | 0 | 1 | 4 |
| Bajo | 6 | 1 | 2 | 3 |
| Informativo | 5 | 0 | 0 | 5 |

---

## Resumen de Cambios desde la Auditoria Inicial

Los cambios en esta branch son predominantemente de **arquitectura** (extraccion de capa
de servicios, hook generico `useAsyncData`, utilidad `formatDate`). No se modificaron los
archivos de infraestructura de seguridad (`firestore.rules`, `firebase.json`,
`src/config/firebase.ts`, `.gitignore`, `.github/workflows/deploy.yml`).

### Archivos modificados con impacto en seguridad

| Archivo | Cambio | Impacto en seguridad |
|---------|--------|----------------------|
| `src/services/comments.ts` | Nuevo: capa de servicio para comentarios | Encapsula acceso a Firestore, reduce superficie de error |
| `src/services/favorites.ts` | Nuevo: capa de servicio para favoritos | Misma mejora de encapsulacion |
| `src/services/ratings.ts` | Nuevo: capa de servicio para ratings | Misma mejora de encapsulacion |
| `src/services/tags.ts` | Nuevo: capa de servicio para tags | Misma mejora de encapsulacion |
| `src/services/feedback.ts` | Nuevo: capa de servicio para feedback | Misma mejora de encapsulacion |
| `src/services/admin.ts` | Nuevo: queries admin centralizadas | Limita reads con `limit()`, mejora control |
| `src/hooks/useAsyncData.ts` | Nuevo: hook generico para datos async | Elimina duplicacion de manejo de errores |
| `src/components/business/*` | Refactorizados para usar servicios | Ya no importan Firestore SDK directamente |
| `src/components/menu/*` | Refactorizados para usar servicios | Ya no importan Firestore SDK directamente |
| `src/components/admin/*` | Refactorizados con `useAsyncData` | Patron uniforme, menos codigo duplicado |

### Archivos de seguridad SIN cambios

- `firestore.rules` - sin cambios
- `src/config/firebase.ts` - sin cambios
- `firebase.json` - sin cambios
- `.gitignore` - sin cambios
- `.github/workflows/deploy.yml` - sin cambios
- `src/context/AuthContext.tsx` - sin cambios
- `src/components/admin/AdminGuard.tsx` - sin cambios

---

## Re-evaluacion de Hallazgos Originales

### Alto

#### H-01: App Check condicional - no garantiza proteccion en produccion

- **Estado:** Pendiente
- **Evidencia:** `src/config/firebase.ts:55-61` sigue inicializando App Check de forma
  condicional, dependiendo de `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Si la variable no
  existe, App Check no se activa silenciosamente.
- **Nota:** Las Cloud Functions de backups ya tienen `enforceAppCheck: true`
  (`functions/src/admin/backups.ts:153,185,238,282`), lo que significa que si App Check
  no se activa en el frontend, las llamadas a backups fallaran en produccion. Esto es
  correcto pero confirma la necesidad de que App Check este siempre activo.
- **Accion requerida:** Agregar `throw` si falta la clave en modo produccion:

  ```typescript
  if (!recaptchaKey) {
    throw new Error('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is required in production');
  }
  ```

#### H-02: Firestore rules no validan `businessId` contra datos reales

- **Estado:** Pendiente
- **Evidencia:** `firestore.rules` no contiene validacion de `businessId` en las reglas
  de favorites (linea 26-33), ratings (38-53), comments (58-69), userTags (73-80) ni
  customTags (98-113).
- **Nota positiva:** La capa de servicios (`src/services/*.ts`) ahora centraliza la
  creacion de documentos, lo que reduce la probabilidad de que un componente envie un
  `businessId` invalido accidentalmente. Sin embargo, un atacante aun puede escribir
  directamente a Firestore con un `businessId` arbitrario.
- **Accion requerida:** Agregar funcion helper en `firestore.rules`:

  ```text
  function isValidBusinessId(id) {
    return id is string && id.size() > 0 && id.size() <= 100;
  }
  ```

---

### Medio

#### M-01: Admin guard no verifica email_verified en Firestore rules

- **Estado:** Pendiente
- **Evidencia:** La funcion `isAdmin()` en `firestore.rules:6-9` sigue siendo:

  ```text
  function isAdmin() {
    return request.auth != null
      && request.auth.token.email == 'benoffi11@gmail.com';
  }
  ```

  No incluye `request.auth.token.email_verified == true`.
- **Nota positiva:** La funcion `verifyAdmin()` en Cloud Functions
  (`backups.ts:93-106`) SI verifica `email_verified` correctamente. La brecha existe
  solo en Firestore rules (colecciones `users`, `config`, `feedback`, `abuseLogs`).
- **Accion requerida:** Agregar `&& request.auth.token.email_verified == true` a
  `isAdmin()`.

#### M-02: Rate limit en memoria para Cloud Functions de backups

- **Estado:** Pendiente (riesgo aceptado)
- **Evidencia:** `functions/src/admin/backups.ts:74` sigue usando `Map` en memoria para
  rate limiting. El riesgo real es bajo dado que solo el admin invoca estas funciones y
  `verifyAdmin` valida email + email_verified + App Check.
- **Accion requerida:** Aceptable a corto y mediano plazo. Evaluar Firestore-backed rate
  limiter solo si la app escala a multiples admins.

#### M-03: CSP no incluye dominios de reCAPTCHA

- **Estado:** Pendiente
- **Evidencia:** `firebase.json:23` no incluye `recaptcha.net` ni
  `www.gstatic.com/recaptcha/` en las directivas de CSP. Si App Check con reCAPTCHA
  Enterprise se activa, los scripts serian bloqueados por la politica actual.
- **Accion requerida:** Agregar a la CSP:
  - `script-src`: `https://www.recaptcha.net`
  - `frame-src`: `https://www.recaptcha.net`
  - `connect-src`: `https://www.recaptcha.net`

#### M-04: Comentarios sin limite de longitud visible en el frontend

- **Estado:** Pendiente
- **Evidencia:** `src/components/business/BusinessComments.tsx:77-94` no tiene
  `inputProps={{ maxLength: 500 }}` ni contador de caracteres en el TextField. El limite
  de 500 se valida solo en Firestore rules.
- **Nota:** La capa de servicios (`services/comments.ts`) tampoco valida longitud antes
  de enviar a Firestore; delega la validacion completamente a las rules.
- **Accion requerida:** Agregar `inputProps={{ maxLength: 500 }}` y helper text con
  contador al campo de texto.

#### M-05: `setDoc` con `merge: true` sobreescribe `createdAt` en updates

- **Estado:** Pendiente
- **Evidencia:** `src/context/AuthContext.tsx:71-74` sigue enviando
  `createdAt: serverTimestamp()` en cada invocacion de `setDisplayName`, y
  `firestore.rules:14-22` usa una sola regla `write` sin distinguir create de update.
- **Nota adicional:** `src/services/ratings.ts:15-25` tiene el mismo patron:
  `setDoc` con `merge: true` que envuelve `createdAt: serverTimestamp()`. En updates,
  esto sobreescribe el timestamp original de creacion.
- **Accion requerida:** Separar en `create` y `update` tanto en el frontend como en las
  rules. En update, solo enviar campos modificables (`displayName`, `score`,
  `updatedAt`).

---

### Bajo

#### B-01: `console.error` en produccion

- **Estado:** Pendiente
- **Evidencia:** Se encontraron 12 ocurrencias de `console.error` en el codigo fuente
  (excluyendo tests): AuthContext (3), ErrorBoundary (1), FavoriteButton (1),
  usePaginatedQuery (1), BusinessComments (1), BusinessTags (1), FeedbackForm (1),
  useAsyncData (1), useBusinessData (1), BackupsPanel (1).
- **Nota:** La refactorizacion agrego `useAsyncData.ts` con 1 `console.error` nuevo,
  pero elimino duplicaciones en paneles admin. El conteo neto se mantuvo en 12.
- **Accion requerida:** Condicionar a `import.meta.env.DEV` o usar un logger
  configurable.

#### B-02: Regla de `users` no distingue entre create y update

- **Estado:** Pendiente
- **Evidencia:** `firestore.rules:14-22` usa `allow write` para ambas operaciones.
  Esto permite que un update envie `createdAt`, sobreescribiendolo.
- **Accion requerida:** Separar en `allow create` (con `createdAt == request.time`) y
  `allow update` (sin `createdAt`, solo `displayName`).

#### B-03: No hay validacion de `category` en feedback

- **Estado:** Pendiente
- **Evidencia:** `firestore.rules:84-94` valida `message` pero no `category`. La capa
  de servicios (`services/feedback.ts`) acepta `category: string` sin restriccion.
- **Accion requerida:** Agregar en rules:
  `request.resource.data.category in ['bug', 'sugerencia', 'otro']`.

#### B-04: No hay validacion de `tagId` en userTags

- **Estado:** Parcial
- **Evidencia:** `firestore.rules:73-80` no valida `tagId`. Sin embargo, la capa de
  servicios (`services/tags.ts:18-30`) ahora centraliza la creacion de userTags,
  recibiendo `tagId` como parametro tipado desde el componente que solo ofrece tags
  predefinidos (`PREDEFINED_TAGS`). Un atacante aun podria escribir directamente.
- **Accion requerida:** Agregar validacion en rules:
  `request.resource.data.tagId is string && request.resource.data.tagId.size() > 0`.

#### B-05: `.gitignore` solo excluye `/.env`, no variantes

- **Estado:** Parcial
- **Evidencia:** `.gitignore:27` solo contiene `/.env`. La regla `*.local` (linea 13)
  cubre `.env.local` pero no `.env.production`, `.env.staging`, etc.
- **Nota:** La regla `.claude/*` (linea 35) fue agregada correctamente para excluir
  configuracion local de Claude.
- **Accion requerida:** Reemplazar `/.env` con `.env*` y agregar `!.env.example`.

#### B-06: CI/CD no ejecuta tests ni lint antes del deploy

- **Estado:** Parcial
- **Evidencia:** `.github/workflows/deploy.yml` ejecuta `npm run build` directamente sin
  pasos previos de lint ni test. Sin embargo, el workflow si incluye `npm ci` para
  instalar dependencias y despliega Firestore rules automaticamente.
- **Accion requerida:** Agregar steps de `npm run lint` y `npm run test:run` antes del
  build.

---

### Informativo

#### I-01: Cloud Functions triggers sin App Check

- **Estado:** Pendiente (comportamiento esperado, no requiere accion)
- **Detalle:** Los triggers de Firestore no pueden verificar App Check por diseno.
  Las funciones callable SI tienen `enforceAppCheck: true`.

#### I-02: Admin email hardcodeado en multiples lugares

- **Estado:** Pendiente
- **Detalle:** `AdminGuard.tsx:10`, `firestore.rules:8` y `backups.ts:10` (parametro
  configurable via `defineString`). Tres fuentes distintas con dos mecanismos diferentes.

#### I-03: Datos de negocio estaticos en JSON local

- **Estado:** Pendiente (riesgo aceptado, datos publicos)

#### I-04: Tokens de emulador en `.claude/settings.local.json`

- **Estado:** Pendiente (riesgo nulo, archivo excluido de git por `.claude/*`)

#### I-05: Permisos amplios en `.claude/settings.json`

- **Estado:** Pendiente
- **Detalle:** El archivo permite `firebase firestore:delete --all-collections --force`.

---

## Hallazgos Nuevos

### N-01: Capa de servicios sin validacion de entrada (Bajo)

- **Descripcion:** Los nuevos archivos en `src/services/` (`comments.ts`, `favorites.ts`,
  `ratings.ts`, `tags.ts`, `feedback.ts`) aceptan parametros sin validar antes de
  enviarlos a Firestore. Por ejemplo, `addComment` acepta cualquier `text: string` sin
  verificar longitud, y `sendFeedback` acepta cualquier `category: string`.
- **Riesgo:** Bajo. Firestore rules validan los campos criticos (longitud de texto,
  rango de score). Sin embargo, un error de programacion en el frontend podria enviar
  datos invalidos que serian rechazados por las rules, causando errores silenciosos.
- **Recomendacion:** Agregar validaciones basicas en la capa de servicios (longitud de
  texto, rango de score, formato de businessId) como primera linea de defensa. Esto
  complementa las rules sin reemplazarlas.

### N-02: `ratings.ts` sobreescribe `createdAt` en upsert (Medio)

- **Descripcion:** `src/services/ratings.ts:15-25` usa `setDoc` con `merge: true`
  enviando siempre `createdAt: serverTimestamp()`. En un update, esto sobreescribe el
  timestamp original de creacion. Este es un caso especifico del hallazgo M-05 que ahora
  afecta tambien a la capa de servicios.
- **Riesgo:** Medio. Pierde informacion de auditoria (cuando se creo el rating
  originalmente).
- **Recomendacion:** Usar logica condicional: enviar `createdAt` solo si el documento
  no existe.

---

## Hallazgos Pendientes

Tabla consolidada de todos los hallazgos que requieren accion:

| ID | Severidad | Titulo | Estado | Esfuerzo | Prioridad |
|----|-----------|--------|--------|----------|-----------|
| H-01 | Alto | App Check condicional en produccion | Pendiente | Bajo | 1 - Inmediata |
| H-02 | Alto | Sin validacion de `businessId` en rules | Pendiente | Bajo | 1 - Inmediata |
| M-01 | Medio | `isAdmin()` sin `email_verified` en rules | Pendiente | Minimo | 1 - Inmediata |
| M-03 | Medio | CSP incompleta para reCAPTCHA | Pendiente | Bajo | 1 - Inmediata |
| M-04 | Medio | TextField sin `maxLength` en comentarios | Pendiente | Minimo | 2 - Este mes |
| M-05 | Medio | `setDisplayName` sobreescribe `createdAt` | Pendiente | Bajo | 2 - Este mes |
| N-02 | Medio | `ratings.ts` sobreescribe `createdAt` | Pendiente | Bajo | 2 - Este mes |
| B-02 | Bajo | Regla `users` sin separar create/update | Pendiente | Bajo | 2 - Este mes |
| B-03 | Bajo | Sin validacion de `category` en feedback | Pendiente | Minimo | 2 - Este mes |
| B-04 | Bajo | Sin validacion de `tagId` en userTags | Parcial | Bajo | 2 - Este mes |
| B-05 | Bajo | `.gitignore` no cubre variantes de `.env` | Parcial | Minimo | 2 - Este mes |
| B-06 | Bajo | CI/CD sin lint ni tests antes del deploy | Parcial | Minimo | 2 - Este mes |
| N-01 | Bajo | Capa de servicios sin validacion de entrada | Pendiente | Bajo | 3 - Backlog |
| B-01 | Bajo | `console.error` en produccion | Pendiente | Bajo | 3 - Backlog |
| M-02 | Medio | Rate limiter en memoria (backups) | Pendiente | Medio | 3 - Backlog |
| I-02 | Info | Admin email hardcodeado | Pendiente | Medio | 3 - Backlog |
| I-05 | Info | Permisos amplios en Claude settings | Pendiente | Minimo | 3 - Backlog |

---

## Compliance OWASP Top 10 (2021) - Actualizado

| # | Categoria | Estado | Notas |
|---|-----------|--------|-------|
| A01 | Broken Access Control | Parcial | Firestore rules cubren auth y ownership. Falta validacion de `businessId` (H-02) y `email_verified` en admin rules (M-01). Cloud Functions backups SI verifican `email_verified`. |
| A02 | Cryptographic Failures | OK | Auth delegada a Firebase. HTTPS forzado. Sin datos sensibles en el cliente. |
| A03 | Injection | OK | Sin SQL. Firestore parametrizado. Sin `dangerouslySetInnerHTML`, `eval`, ni `innerHTML` (verificado, 0 ocurrencias). |
| A04 | Insecure Design | OK | Rate limiting en dos capas. Moderacion de contenido. Capa de servicios centraliza acceso a datos. |
| A05 | Security Misconfiguration | Parcial | CSP incompleta para reCAPTCHA (M-03). App Check condicional (H-01). Headers de seguridad bien configurados. |
| A06 | Vulnerable Components | Pendiente | Recomendable ejecutar `npm audit` periodicamente. Sin evidencia de vulnerabilidades conocidas. |
| A07 | Auth Failures | OK | Firebase Auth maneja sesiones y tokens. Admin guard en dos capas (frontend + rules). Cloud Functions verifican `email_verified`. |
| A08 | Software/Data Integrity | Parcial | CI/CD no ejecuta tests (B-06). No hay pinning de versiones en Actions. Sin cambios. |
| A09 | Logging/Monitoring | OK | Cloud Functions loguean abusos. DailyMetrics y AbuseAlerts activos. Emails mascarados en logs. |
| A10 | SSRF | N/A | No hay proxying de URLs de usuario. |

---

## Analisis de Firestore Rules - Cobertura

| Coleccion | Auth | Ownership | Validacion campos | Timestamp | Admin |
|-----------|------|-----------|-------------------|-----------|-------|
| users | OK | OK | OK (displayName 1-30) | OK | OK (read) |
| favorites | OK | OK (create/delete) | Parcial (falta businessId) | OK | - |
| ratings | OK | OK | OK (score 1-5) | OK | - |
| comments | OK | OK | OK (userName 1-30, text 1-500) | OK | - |
| userTags | OK | OK | Parcial (falta tagId) | OK | - |
| customTags | OK | OK | OK (label 1-30) | OK | - |
| feedback | OK | OK | Parcial (falta category) | OK | OK (read) |
| config | - | - | - | - | OK (read only) |
| dailyMetrics | OK | - | - | - | - (public read) |
| abuseLogs | - | - | - | - | OK (read only) |

---

## Bien Implementado

Los siguientes patrones de seguridad estan correctamente implementados:

1. **Timestamps server-side:** Todas las reglas de `create` validan
   `createdAt == request.time`.
2. **Rate limiting en dos capas:** Client-side (UI) + server-side (Cloud Functions
   triggers que eliminan documentos excedentes).
3. **Moderacion de contenido:** Banned words con normalizacion de acentos, regex con
   word boundaries, cache configurable.
4. **Converters tipados:** Lecturas de Firestore con `withConverter<T>()`.
5. **Ownership enforcement:** Todas las colecciones validan `userId == request.auth.uid`.
6. **Security headers:** X-Frame-Options DENY, X-Content-Type-Options nosniff,
   Referrer-Policy strict, Permissions-Policy restrictiva.
7. **Error handling seguro:** Cloud Functions callable no exponen detalles internos.
   Emails mascarados en logs.
8. **Lazy loading de admin:** Codigo admin cargado solo en `/admin`.
9. **Safety backup pre-restore:** Backup automatico antes de restaurar.
10. **Input validation en backups:** `validateBackupId` con regex anti-path-traversal.
11. **App Check enforced en Cloud Functions:** Todas las funciones callable tienen
    `enforceAppCheck: true`.
12. **Email verified en Cloud Functions:** `verifyAdmin` valida
    `request.auth.token.email_verified`.
13. **Capa de servicios:** Componentes ya no importan Firestore SDK directamente.
    Toda escritura pasa por `src/services/`, reduciendo superficie de error.
14. **Admin queries con limit:** `src/services/admin.ts` usa `limit()` en todas las
    queries para controlar reads.

---

## Metodologia

Re-evaluacion mediante revision de codigo de los archivos modificados en la branch
`feat/audit-fixes` y todos los archivos de seguridad originales:

- **Firebase:** `firebase.json`, `firestore.rules`, `src/config/firebase.ts`
- **Auth:** `src/context/AuthContext.tsx`, `src/components/admin/AdminGuard.tsx`
- **Cloud Functions:** `functions/src/admin/backups.ts`
- **Servicios:** `src/services/comments.ts`, `src/services/favorites.ts`,
  `src/services/ratings.ts`, `src/services/tags.ts`, `src/services/feedback.ts`,
  `src/services/admin.ts`
- **Hooks:** `src/hooks/useAsyncData.ts`
- **Frontend:** `src/components/business/BusinessComments.tsx`,
  `src/components/business/BusinessTags.tsx`, `src/components/business/FavoriteButton.tsx`,
  `src/components/menu/FeedbackForm.tsx`
- **CI/CD:** `.github/workflows/deploy.yml`
- **Configuracion:** `.gitignore`

Se verifico la ausencia de patrones peligrosos (`dangerouslySetInnerHTML`, `eval`,
`innerHTML`) confirmando 0 ocurrencias. Se contabilizaron las instancias de
`console.error` (12 en produccion, excluyendo tests).

Se compararon los commits de la branch con `main` usando `git diff main..HEAD` para
identificar todos los cambios con impacto en seguridad.
