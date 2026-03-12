# Auditoria de Seguridad - Modo Mapa v1.4.0

**Fecha:** 2026-03-12
**Auditor:** Claude Opus 4.6 (agente de seguridad)
**Alcance:** Proyecto completo (frontend, backend, infraestructura, CI/CD)
**Version auditada:** 1.4.0

---

## Resumen Ejecutivo

Puntuacion general: **7.5 / 10**

El proyecto Modo Mapa presenta una postura de seguridad solida para su escala y proposito.
Se identificaron buenas practicas implementadas (validacion server-side en Firestore rules,
rate limiting en dos capas, moderacion de contenido, converters tipados, timestamps
server-side) junto con hallazgos que requieren atencion, siendo el mas relevante la
dependencia condicional de App Check y la falta de validacion de `businessId` contra datos
validos en Firestore rules.

### Resumen de hallazgos

| Severidad | Cantidad |
|-----------|----------|
| Critico | 0 |
| Alto | 2 |
| Medio | 5 |
| Bajo | 6 |
| Informativo | 5 |

---

## Hallazgos por Severidad

### Alto

#### H-01: App Check condicional - no garantiza proteccion en produccion

- **Descripcion:** La inicializacion de Firebase App Check depende de que la variable
  `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` este presente. Si no esta configurada, App Check
  no se activa. Sin embargo, las Cloud Functions de backups tienen `enforceAppCheck: true`,
  lo que fallaria si el cliente no tiene App Check activo. Mas critico aun: los triggers
  de Firestore (comments, ratings, favorites, etc.) NO tienen App Check porque son triggers,
  no callables, asi que no hay verificacion de que las escrituras vengan de la app legitima.
- **Ubicacion:** `src/config/firebase.ts:55-61`, `functions/src/admin/backups.ts:153`
- **Impacto:** Sin App Check activo, un atacante podria usar las API keys publicas de
  Firebase (visibles en el bundle de JS) para hacer escrituras directas a Firestore desde
  scripts externos, bypasseando la UI y los rate limits client-side. Solo los rate limits
  server-side (Cloud Functions triggers) protegerian, pero despues de que el documento ya
  fue creado.
- **Recomendacion:**
  1. Verificar que `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` este configurada en produccion
     (GitHub Secrets y el build).
  2. Activar App Check en modo "enforce" en Firebase Console para Firestore y Auth.
  3. Documentar que App Check es **obligatorio** en produccion, no opcional.
- **Esfuerzo:** Bajo (configuracion)

#### H-02: Firestore rules no validan `businessId` contra datos reales

- **Descripcion:** En ninguna regla de Firestore se valida que el campo `businessId`
  corresponda a un comercio real. Un usuario podria crear favoritos, ratings, comentarios
  y tags asociados a un `businessId` inexistente o arbitrario.
- **Ubicacion:** `firestore.rules:26-33` (favorites), `firestore.rules:38-53` (ratings),
  `firestore.rules:58-69` (comments), `firestore.rules:73-80` (userTags),
  `firestore.rules:98-113` (customTags)
- **Impacto:** Contaminacion de datos. Los contadores y metricas se inflarian con datos
  asociados a comercios inexistentes. Los tops de favoritos/comentarios/ratings podrian
  mostrar IDs invalidos.
- **Recomendacion:** Validar que `businessId` sea un string no vacio y que coincida con
  un patron esperado (ej: `businessId.matches('biz_[0-9]+')`) o, idealmente, verificar
  contra una coleccion de negocios validos. Dado que los negocios estan en un JSON
  estatico y no en Firestore, la validacion por patron es la opcion viable.
- **Esfuerzo:** Bajo (agregar regex en rules)

---

### Medio

#### M-01: Admin guard frontend solo verifica email, no verifica email_verified

- **Descripcion:** El `AdminGuard.tsx` compara `user.email` con el email admin pero no
  verifica que `user.emailVerified` sea `true`. La verificacion si ocurre en las Cloud
  Functions de backups (`emailVerified` check en `verifyAdmin`), pero no en las Firestore
  rules para colecciones admin. Las Firestore rules usan `request.auth.token.email` pero
  no `request.auth.token.email_verified`.
- **Ubicacion:** `src/components/admin/AdminGuard.tsx:25`,
  `firestore.rules:6-9` (funcion `isAdmin`)
- **Impacto:** Un atacante que logre asociar el email admin a una cuenta Firebase sin
  verificar el email podria acceder a colecciones protegidas por `isAdmin()` en Firestore
  rules. El riesgo es bajo porque Google Sign-In implica verificacion, pero es una buena
  practica de defensa en profundidad.
- **Recomendacion:** Agregar `&& request.auth.token.email_verified == true` a la funcion
  `isAdmin()` en Firestore rules.
- **Esfuerzo:** Minimo (1 linea)

#### M-02: Rate limit en memoria para Cloud Functions de backups

- **Descripcion:** El rate limiter de `backups.ts` usa un `Map` en memoria
  (`rateLimitMap`). En Cloud Functions, las instancias pueden reciclarse o escalar
  horizontalmente, lo que significa que el rate limit se reinicia con cada nueva instancia
  y no se comparte entre instancias.
- **Ubicacion:** `functions/src/admin/backups.ts:74-91`
- **Impacto:** El rate limit no es fiable a escala. Un atacante con credenciales admin
  podria hacer mas de 5 llamadas/minuto si las requests caen en distintas instancias.
  El impacto real es bajo porque solo el admin puede ejecutar estas funciones.
- **Recomendacion:** Para un rate limit fiable, usar Firestore o Redis como backing store.
  Dado que solo el admin usa estas funciones, el riesgo actual es aceptable.
- **Esfuerzo:** Medio

#### M-03: CSP no incluye `recaptcha.net` ni `www.recaptcha.net`

- **Descripcion:** La Content Security Policy en `firebase.json` no incluye dominios de
  reCAPTCHA que son necesarios para App Check con reCAPTCHA Enterprise. Si App Check se
  activa, podria fallar en cargar scripts de reCAPTCHA.
- **Ubicacion:** `firebase.json:23` (header CSP)
- **Impacto:** App Check podria no funcionar correctamente en produccion si los scripts
  de reCAPTCHA son bloqueados por CSP.
- **Recomendacion:** Agregar a `script-src`: `https://www.recaptcha.net
  https://www.gstatic.com/recaptcha/`. Agregar a `frame-src`:
  `https://www.recaptcha.net`. Agregar a `connect-src`:
  `https://www.recaptcha.net`.
- **Esfuerzo:** Bajo

#### M-04: Comentarios - sin limite de longitud de `text` en el frontend input

- **Descripcion:** El campo de texto de comentarios (`BusinessComments.tsx`) no tiene
  `maxLength` en el `TextField`. El limite de 500 caracteres se valida en Firestore rules
  (`text.size() <= 500`), pero el usuario no tiene feedback visual del limite hasta que
  la escritura falla.
- **Ubicacion:** `src/components/business/BusinessComments.tsx:96-111`
- **Impacto:** UX deficiente. El usuario podria escribir un comentario largo y recibir
  un error silencioso. No es una vulnerabilidad de seguridad directa porque las Firestore
  rules protegen, pero la experiencia es mala.
- **Recomendacion:** Agregar `inputProps={{ maxLength: 500 }}` al `TextField` y un helper
  text con el contador, como se hace en FeedbackForm y BusinessTags.
- **Esfuerzo:** Minimo

#### M-05: `setDoc` con `merge: true` en `setDisplayName` reescribe `createdAt`

- **Descripcion:** En `AuthContext.tsx`, la funcion `setDisplayName` siempre envia
  `createdAt: serverTimestamp()` con `merge: true`. Esto significa que cada vez que el
  usuario cambia su nombre, se sobreescribe el `createdAt` original. La regla de
  Firestore para `users` valida `createdAt == request.time` en writes, lo cual es
  correcto para creates pero en updates tambien fuerza la reescritura del timestamp.
- **Ubicacion:** `src/context/AuthContext.tsx:71-74`, `firestore.rules:17-21`
- **Impacto:** Perdida de la fecha real de creacion del usuario. No es critico pero
  afecta la integridad de los datos historicos.
- **Recomendacion:** Separar la logica de create y update. En el update, solo enviar
  `displayName`. En la regla, permitir `update` que solo modifique `displayName`.
- **Esfuerzo:** Bajo

---

### Bajo

#### B-01: `console.error` en produccion expone detalles de errores

- **Descripcion:** Multiples componentes usan `console.error` para loguear errores en
  produccion. Esto podria exponer detalles de implementacion en la consola del navegador.
- **Ubicacion:** `src/context/AuthContext.tsx:58,87,96`,
  `src/hooks/useBusinessData.ts:104`, `src/components/business/BusinessComments.tsx:66`,
  y otros (13 ocurrencias en total)
- **Impacto:** Fuga de informacion menor. Un usuario tecnico podria ver mensajes de error
  con detalles internos.
- **Recomendacion:** Condicionar `console.error` a `import.meta.env.DEV` como ya se hace
  en `BackupsPanel.tsx:119-122`.
- **Esfuerzo:** Bajo

#### B-02: Regla de `users` no distingue entre create y update

- **Descripcion:** La regla de `users/{userId}` usa una sola regla de `write` que aplica
  tanto a `create` como a `update`. Esto fuerza que `createdAt == request.time` en
  updates, lo que se relaciona con M-05.
- **Ubicacion:** `firestore.rules:14-22`
- **Impacto:** Si se cambia el frontend para no enviar `createdAt` en updates, la regla
  actual bloquearia la escritura.
- **Recomendacion:** Separar en `allow create` y `allow update` con validaciones
  apropiadas para cada operacion.
- **Esfuerzo:** Bajo

#### B-03: No hay validacion de `category` en Firestore rules para feedback

- **Descripcion:** La regla de `feedback` valida `message` pero no valida que `category`
  sea uno de los valores esperados (`bug`, `sugerencia`, `otro`).
- **Ubicacion:** `firestore.rules:84-94`
- **Impacto:** Un usuario podria enviar feedback con una categoria arbitraria.
- **Recomendacion:** Agregar `&& request.resource.data.category in ['bug', 'sugerencia',
  'otro']` a la regla de create.
- **Esfuerzo:** Minimo

#### B-04: No hay validacion de `tagId` en Firestore rules para userTags

- **Descripcion:** La regla de `userTags` no valida que `tagId` sea uno de los 6 tags
  predefinidos validos.
- **Ubicacion:** `firestore.rules:73-80`
- **Impacto:** Un usuario podria crear votos para tags inexistentes.
- **Recomendacion:** Agregar validacion de `tagId` contra la lista de tags validos.
- **Esfuerzo:** Bajo

#### B-05: `.gitignore` solo excluye `/.env`, no variantes

- **Descripcion:** El `.gitignore` excluye `/.env` pero no `.env.local`,
  `.env.production`, `.env.staging`, etc. La regla `*.local` cubre `.env.local` pero
  no otras variantes como `.env.production.local`.
- **Ubicacion:** `.gitignore:27-28`
- **Impacto:** Riesgo de commit accidental de archivos de entorno con secretos.
- **Recomendacion:** Agregar `.env*` (con excepcion de `.env.example`) al `.gitignore`:

  ```text
  .env*
  !.env.example
  ```

- **Esfuerzo:** Minimo

#### B-06: CI/CD no ejecuta tests antes del deploy

- **Descripcion:** El workflow de deploy (`deploy.yml`) ejecuta `npm run build` pero no
  `npm run test:run` ni `npm run lint`. Cambios con tests rotos o errores de lint pueden
  deployarse a produccion.
- **Ubicacion:** `.github/workflows/deploy.yml`
- **Impacto:** Codigo con bugs o regresiones podria llegar a produccion sin validacion.
- **Recomendacion:** Agregar steps de `npm run lint` y `npm run test:run` antes del build.
- **Esfuerzo:** Minimo

---

### Informativo

#### I-01: Cloud Functions de triggers no tienen App Check

- **Descripcion:** Los triggers de Firestore (`onDocumentCreated`, `onDocumentWritten`,
  etc.) no verifican App Check porque se ejecutan como reaccion a escrituras en Firestore,
  no como funciones invocadas directamente. Esto es comportamiento esperado y correcto.
- **Ubicacion:** `functions/src/triggers/*.ts`
- **Impacto:** Ninguno adicional; la proteccion depende de las Firestore rules y App Check
  en el cliente.

#### I-02: Admin email hardcodeado en dos lugares

- **Descripcion:** El email admin (`benoffi11@gmail.com`) esta hardcodeado en
  `AdminGuard.tsx` y en `firestore.rules`. En Cloud Functions se usa un parametro
  configurable (`defineString('ADMIN_EMAIL')`).
- **Ubicacion:** `src/components/admin/AdminGuard.tsx:10`,
  `firestore.rules:8`
- **Impacto:** Para cambiar el admin, hay que modificar 3 archivos. No es un riesgo de
  seguridad pero dificulta la mantenibilidad.
- **Recomendacion:** Considerar usar una variable de entorno para el frontend y un
  documento de Firestore o Remote Config para centralizar.

#### I-03: Datos de negocio estaticos en JSON local

- **Descripcion:** Los 40 comercios estan en `src/data/businesses.json` como import
  estatico. Esto significa que los datos estan en el bundle de JS y son visibles para
  cualquier usuario.
- **Ubicacion:** `src/data/businesses.json`
- **Impacto:** Ninguno significativo para este caso de uso. Los datos de comercios son
  publicos por naturaleza.

#### I-04: `claude/settings.local.json` contiene tokens de emulador

- **Descripcion:** El archivo `.claude/settings.local.json` contiene comandos con tokens
  JWT de emulador. Estos tokens son solo para desarrollo local y no representan un riesgo
  en produccion. El archivo esta excluido de git por la regla `.claude/*`.
- **Ubicacion:** `.claude/settings.local.json:43`
- **Impacto:** Ninguno. El archivo es local y los tokens son de emulador.

#### I-05: Permisos amplios en `.claude/settings.json`

- **Descripcion:** El archivo `.claude/settings.json` (trackeado en git) incluye
  permiso para `firebase firestore:delete --all-collections --force`. Este es un
  comando destructivo permitido para el agente de Claude.
- **Ubicacion:** `.claude/settings.json:6`
- **Impacto:** Riesgo de ejecucion accidental por el agente. Sin embargo, requiere
  autenticacion Firebase activa y el proyecto correcto.
- **Recomendacion:** Considerar si este permiso es necesario en la configuracion
  compartida (trackeada).

---

## Analisis de Firestore Rules

### Cobertura

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

### Fortalezas

- Todas las reglas de `create` validan `createdAt == request.time`
- Ownership verificado consistentemente con `request.auth.uid == userId`
- Colecciones admin protegidas correctamente
- `write: if false` para colecciones de solo escritura por admin SDK

### Debilidades

- No hay validacion de `businessId` (ver H-02)
- No hay validacion de `category` en feedback (ver B-03)
- No hay validacion de `tagId` en userTags (ver B-04)
- La funcion `isAdmin()` no verifica `email_verified` (ver M-01)
- La regla de `users` no separa create/update (ver B-02)
- No hay regla catch-all para denegar acceso a colecciones no listadas (Firestore
  deniega por defecto, asi que esto es correcto pero conviene documentarlo)

---

## Analisis de Cloud Functions

### Seguridad de Backups (Callable Functions)

| Control | Estado |
|---------|--------|
| Auth requerida | OK |
| Email verificado | OK |
| Admin email check | OK (via parametro) |
| App Check enforced | OK |
| Rate limiting | Parcial (en memoria, ver M-02) |
| Input validation | OK (backupId validado con regex) |
| Error handling | OK (no expone detalles internos) |
| Logging | OK (email mascarado) |
| Safety backup pre-restore | OK |

### Seguridad de Triggers

| Control | Estado |
|---------|--------|
| Rate limiting server-side | OK (comments 20/dia, customTags 10/business, feedback 5/dia) |
| Moderacion de contenido | OK (banned words con normalizacion) |
| Contadores atomicos | OK (FieldValue.increment) |
| Logging de abuso | OK |
| Error handling | OK |

### Scheduled Functions

| Control | Estado |
|---------|--------|
| Privilegios minimos | OK (solo lee y escribe metricas) |
| Top writers monitoring | OK (detecta usuarios con muchas escrituras) |
| Reset de contadores | OK |

---

## Analisis de Seguridad Frontend

### XSS / Injection

- **dangerouslySetInnerHTML:** No encontrado en ningun componente.
- **eval / Function():** No encontrado.
- **innerHTML / document.write:** No encontrado.
- **Renderizado de texto de usuario:** Se usa exclusivamente a traves de componentes MUI
  (`Typography`, `ListItemText`, `Chip`, `TextField`) que escapan HTML automaticamente.
  Los comentarios y tags de usuario se renderizan como texto plano via `secondary` prop
  de `ListItemText` o `label` prop de `Chip`.
- **URLs dinamicas:** No se construyen URLs con input de usuario de forma insegura.
  `DirectionsButton` usa coordenadas fijas del JSON de negocios.

**Resultado: Sin vulnerabilidades XSS detectadas.**

### Manejo de Secretos

- API keys de Firebase y Google Maps se manejan via variables de entorno (`VITE_*`).
- Las claves se inyectan en build-time por Vite y terminan en el bundle JS. Esto es
  esperado y aceptable para claves de Firebase (protegidas por rules y App Check).
- No se encontraron secretos hardcodeados en el codigo fuente.
- `.env` excluido de git (con la salvedad de B-05).
- `.env.example` no contiene valores reales.

### Proteccion de Rutas

- La ruta `/admin` esta protegida por `AdminGuard` que requiere Google Sign-In con el
  email correcto.
- El routing se hace via `window.location.pathname` en lugar de React Router, lo que
  simplifica el modelo pero no soporta deep linking avanzado.
- No hay rutas sensibles expuestas sin auth.

---

## Compliance OWASP Top 10 (2021)

| # | Categoria | Estado | Notas |
|---|-----------|--------|-------|
| A01 | Broken Access Control | Parcial | Firestore rules cubren auth y ownership. Falta validacion de businessId (H-02) y email_verified en admin (M-01). |
| A02 | Cryptographic Failures | OK | No se manejan datos sensibles. Auth delegada a Firebase. HTTPS forzado por Firebase Hosting. |
| A03 | Injection | OK | Sin SQL. Firestore parametrizado. Sin dangerouslySetInnerHTML. Sin eval. |
| A04 | Insecure Design | OK | Arquitectura con separacion de responsabilidades. Rate limiting en dos capas. |
| A05 | Security Misconfiguration | Parcial | CSP incompleta para reCAPTCHA (M-03). App Check condicional (H-01). Headers de seguridad bien configurados. |
| A06 | Vulnerable Components | Pendiente | Dependencias modernas y actualizadas. Recomendable ejecutar `npm audit` periodicamente. |
| A07 | Auth Failures | OK | Firebase Auth maneja sesiones, tokens y credentials. Admin guard en dos capas (frontend + rules). |
| A08 | Software/Data Integrity | Parcial | CI/CD no ejecuta tests (B-06). No hay pinning de versiones en Actions. Pre-commit hooks con husky. |
| A09 | Logging/Monitoring | OK | Cloud Functions loguean abusos. DailyMetrics trackea actividad. AbuseAlerts visible en admin. |
| A10 | SSRF | N/A | No hay proxying de URLs de usuario. No aplica. |

---

## Bien Implementado

Los siguientes patrones de seguridad estan correctamente implementados:

1. **Timestamps server-side:** Todas las reglas de `create` validan
   `createdAt == request.time`, previniendo manipulacion de fechas.
2. **Rate limiting en dos capas:** Client-side (UI limits) + server-side (Cloud Functions
   triggers que eliminan documentos excedentes).
3. **Moderacion de contenido:** Sistema de banned words con normalizacion de acentos,
   regex con word boundaries, y cache configurable.
4. **Converters tipados:** Todas las lecturas de Firestore usan `withConverter<T>()`,
   garantizando type safety y consistencia de datos.
5. **Ownership enforcement:** Todas las colecciones validan que `userId` coincida con
   `request.auth.uid` en operaciones de escritura/eliminacion.
6. **Security headers:** X-Frame-Options DENY, X-Content-Type-Options nosniff,
   Referrer-Policy strict, Permissions-Policy restrictiva.
7. **Error handling seguro:** Las Cloud Functions callable no exponen stack traces ni
   detalles internos al cliente. Emails mascarados en logs.
8. **Lazy loading de admin:** El codigo del dashboard admin se carga solo cuando se
   accede a `/admin`, reduciendo la superficie de ataque del bundle principal.
9. **Safety backup pre-restore:** Antes de restaurar un backup, se crea automaticamente
   un backup de seguridad.
10. **Input validation en backups:** `validateBackupId` verifica con regex que no haya
    path traversal ni caracteres especiales.

---

## Plan de Accion Priorizado

### Prioridad 1 - Implementar esta semana

| ID | Accion | Esfuerzo |
|----|--------|----------|
| H-01 | Verificar y documentar que App Check esta activo en produccion | Bajo |
| H-02 | Agregar validacion de `businessId` pattern en Firestore rules | Bajo |
| M-01 | Agregar `email_verified` a funcion `isAdmin()` en rules | Minimo |

### Prioridad 2 - Implementar este mes

| ID | Accion | Esfuerzo |
|----|--------|----------|
| M-03 | Actualizar CSP para incluir dominios de reCAPTCHA | Bajo |
| M-04 | Agregar `maxLength` y contador al TextField de comentarios | Minimo |
| M-05 | Separar create/update en `setDisplayName` y regla `users` | Bajo |
| B-03 | Validar `category` en regla de feedback | Minimo |
| B-04 | Validar `tagId` en regla de userTags | Bajo |
| B-05 | Mejorar `.gitignore` para cubrir variantes de `.env` | Minimo |
| B-06 | Agregar lint y tests al workflow de CI/CD | Minimo |

### Prioridad 3 - Backlog

| ID | Accion | Esfuerzo |
|----|--------|----------|
| B-01 | Condicionar `console.error` a modo DEV | Bajo |
| B-02 | Separar create/update en regla de users | Bajo |
| M-02 | Evaluar rate limiter persistente para backups (bajo riesgo actual) | Medio |
| I-02 | Centralizar email admin en una sola fuente | Medio |
| I-05 | Revisar permisos de `.claude/settings.json` | Minimo |

---

## Metodologia

Esta auditoria se realizo mediante revision manual de codigo de todos los archivos
relevantes del proyecto, incluyendo:

- **Firebase:** `firebase.json`, `firestore.rules`, `src/config/firebase.ts`
- **Auth:** `src/context/AuthContext.tsx`, `src/components/admin/AdminGuard.tsx`
- **Cloud Functions:** todos los archivos en `functions/src/` (index, triggers, scheduled,
  admin, utils)
- **Frontend:** todos los componentes que manejan input de usuario (BusinessComments,
  BusinessTags, FeedbackForm, NameDialog, BackupsPanel)
- **CI/CD:** `.github/workflows/deploy.yml`
- **Configuracion:** `.gitignore`, `.env.example`, `package.json`, `functions/package.json`
- **Claude:** `.claude/settings.json`, `.claude/agents/security.md`

Se verifico la ausencia de patrones peligrosos (`dangerouslySetInnerHTML`, `eval`,
`innerHTML`, secretos hardcodeados) y se analizo el flujo completo de datos desde el
input del usuario hasta la persistencia en Firestore.
