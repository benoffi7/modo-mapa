# Specs: Tech debt seguridad — deps vulnerables + secrets en .env + isValidStorageUrl prefix-only

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #342

---

## Resumen

Cuatro cambios independientes de deuda tecnica de seguridad, sin colecciones nuevas ni componentes nuevos:

- **S1** — bump `react-router-dom@^7.13.1` → `^7.14.2` (parcha 3 advisories).
- **S2** — bump `firebase-admin` (cadena `protobufjs`) + `npm audit fix` no-force en root; redefinir el **texto** del invariante de audit en `devops.md` distinguiendo runtime (0 vulns) de dev/CLI transitivas.
- **S3** — migrar `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` fuera del `functions/.env` commiteado (repo publico); dejar `GITHUB_OWNER`/`GITHUB_REPO` (metadata publica) en el `.env`.
- **S4** — endurecer `isValidStorageUrl` para exigir el segmento canonico `/v0/b/<bucket>/o/`, como validacion **independiente** de la rule de Firestore.

No hay modelo de datos nuevo, ni Cloud Functions nuevas, ni seed data (no hay colecciones/campos Firestore nuevos).

---

## Modelo de datos

Sin cambios. Este feature no agrega ni modifica colecciones, documentos, indices ni tipos de Firestore.

`feedback.mediaUrl` (string) ya existe y su contrato no cambia. S4 endurece solo la **validacion client-side de render**, no el shape del dato.

## Firestore Rules

**Sin cambios.** La rule de `feedback` (`firestore.rules:222`) ya valida `mediaUrl` en write y NO se toca (explicitamente fuera de scope, PRD "Out of Scope").

### Aclaracion critica (observacion Sofia) — rule y cliente son validaciones INDEPENDIENTES, no espejo

La rule real en `firestore.rules:222` (create) y `:242` (update) valida:

```
request.resource.data.mediaUrl.matches(
  '^https://firebasestorage\\.googleapis\\.com/.*/feedback-media%2F' + request.auth.uid + '%2F' + docId + '%2F.*'
)
```

Caracteristicas de la rule que **NO** debe replicar `isValidStorageUrl`:

- Usa el path **URL-encoded** (`%2F`, no `/`).
- Usa `.*` comodin entre el host y `feedback-media%2F` — **NO** ancla el segmento `/v0/b/<bucket>/o/`.
- Ata el path a `request.auth.uid` y `docId` (ownership server-side), datos que el cliente no tiene en `isValidStorageUrl`.

Por lo tanto, S4 endurece el cliente con un criterio **distinto y complementario** (segmento `/v0/b/<bucket>/o/` decodificado), no un mirror de la rule. Son dos capas de defense-in-depth con responsabilidades separadas:

| Capa | Que valida | Donde |
|------|-----------|-------|
| Rule (write, server) | Path canonico encoded + ownership (`uid`/`docId`) | `firestore.rules:222,242` (no se toca) |
| `isValidStorageUrl` (read/render, client) | Host exacto + segmento `/v0/b/<bucket>/o/` | `src/utils/media.ts` (S4) |

No hay que cambiar la rule para que ambas convivan: la URL real de Firebase Storage contiene tanto `/v0/b/<bucket>/o/` (lo que valida el cliente) como `feedback-media%2F<uid>%2F<docId>%2F` (lo que valida la rule, como parte del path encodeado dentro del segmento `/o/`).

### Rules impact analysis

No hay queries Firestore nuevas. S4 afecta render client-side; S3 afecta lectura de config server-side via parameter/secret store, no Firestore.

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|---------------------|------------|-------------|--------------------|---------|
| (ninguna nueva) | — | — | — | No |

### Field whitelist check

No se agregan ni modifican campos de Firestore. No aplica.

## Cloud Functions

**Sin funciones nuevas.** S3 cambia el **origen de configuracion** (de `.env` commiteado a Secret Manager / runtime env) de dos funciones existentes, sin cambiar su logica:

- `setAdminClaim` (`functions/src/admin/claims.ts`) — consume `ADMIN_EMAIL`.
- Todas las callables user-facing que importan `ENFORCE_APP_CHECK` de `helpers/env.ts` — consumen `APP_CHECK_ENFORCEMENT` indirectamente.

### Inventario de consumidores (verificado en codigo)

`ENFORCE_APP_CHECK` (derivado de `APP_CHECK_ENFORCEMENT`) se importa de `functions/src/helpers/env.ts` en:

- `functions/src/admin/menuPhotos.ts`
- `functions/src/admin/featuredLists.ts`
- `functions/src/admin/perfMetrics.ts`
- `functions/src/callable/cleanAnonymousData.ts`
- `functions/src/callable/deleteUserAccount.ts`
- `functions/src/callable/removeListEditor.ts`
- `functions/src/callable/inviteListEditor.ts`

`env.ts:17` es el **unico lector** de `process.env.APP_CHECK_ENFORCEMENT` (verificado por grep). Esto acota el blast radius de la migracion a un solo punto.

## Seed Data

No aplica. El feature no introduce colecciones nuevas ni campos requeridos. No se modifica `scripts/seed-admin-data.mjs` ni `scripts/seed-staging.ts`.

## Componentes

Sin componentes nuevos ni modificados. `FeedbackMediaPreview.tsx` y `MyFeedbackList.tsx` consumen `isValidStorageUrl` sin cambios en su codigo — el endurecimiento es transparente para ellos (solo rechaza URLs malformadas que ya deberian estar bloqueadas por la rule de write).

### Mutable prop audit

No aplica — sin pantallas de detalle/formularios editables nuevos.

## Textos de usuario

No hay copy user-facing nuevo. El cambio en `isValidStorageUrl` solo decide si renderizar un preview ya existente; no agrega toasts, labels ni mensajes.

## Hooks

Sin hooks nuevos ni modificados.

## Servicios

Sin servicios nuevos. Detalle por sub-tarea:

### S4 — `isValidStorageUrl` (`src/utils/media.ts`)

Funcion pura existente. Firma actual:

```ts
const STORAGE_URL_PREFIX = 'https://firebasestorage.googleapis.com/';
export const isValidStorageUrl = (url: string | undefined): url is string =>
  typeof url === 'string' && url.startsWith(STORAGE_URL_PREFIX);
```

Endurecimiento propuesto: mantener el `typeof` guard + anclar host exacto + exigir segmento `/v0/b/<bucket>/o/`. Firma de salida (sin cambio de tipo, sigue siendo pura, sigue siendo type guard `url is string`):

```ts
// Host exacto + segmento canonico /v0/b/<bucket>/o/.
// El ^ ancla el inicio (cierra prefix-bypass y arbitrary-content-before-prefix).
const STORAGE_URL_RE =
  /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\//;

export const isValidStorageUrl = (url: string | undefined): url is string =>
  typeof url === 'string' && STORAGE_URL_RE.test(url);
```

#### Decision: bucket generico `[^/]+` vs bucket exacto — PENDIENTE de verificacion empirica

El PRD deja la decision a specs entre validar el bucket exacto (contra `VITE_FIREBASE_STORAGE_BUCKET`) o generico (`/v0/b/[^/]+/o/`).

**Decision: bucket generico `/v0/b/[^/]+/o/`**, condicionada a la verificacion del paso de plan "confirmar no-legacy-bucket". Rationale:

1. **Riesgo de legacy mediaUrl (observacion Sofia):** existe `feedback.mediaUrl` historico en Firestore. Si algun doc antiguo apunta a un bucket distinto del actual `VITE_FIREBASE_STORAGE_BUCKET` (ej. `*.appspot.com` vs `*.firebasestorage.app`, o un bucket de un proyecto anterior), un check de bucket exacto **rompe el render** de esa media para el usuario y el admin. El plan incluye un paso de verificacion (query a Firestore) ANTES de elegir; si la query confirma que todos los `mediaUrl` usan el bucket actual, se puede endurecer a bucket exacto en un followup, pero el default seguro para este PRD es generico.
2. El bucket exacto requiere que `media.ts` (util pura, sin acceso a `import.meta.env` deseable) lea config de entorno — acopla la util a la config de Vite. El generico la mantiene pura y sin dependencias.
3. La autorizacion real (que la media pertenezca al feedback del owner) la da la rule de write, no este check. El cliente solo necesita garantizar "es una URL de Firebase Storage bien formada", para lo cual `[^/]+` es suficiente.

El segmento `[^/]+` (un solo segmento de path, sin `/`) ya impide que un atacante meta `firebasestorage.googleapis.com/v0/b/evil.com/x/o/` con sub-paths inyectados en la posicion del bucket.

#### Regression guards a preservar (verificados en `media.test.ts` actual)

El nuevo regex DEBE seguir rechazando, y los tests existentes deben quedar verdes:

- prefix-bypass con dominio similar (`...googleapis.com.evil.com`) — el `^...com\/v0\/b\/` lo bloquea.
- scheme-confusion (`http://...`) — el `^https://` lo bloquea.
- contenido arbitrario antes del prefijo (`evil-https://...`) — el `^` lo bloquea.
- `typeof` no-string (undefined, null, number, object, boolean) — guard preservado.
- empty string — no matchea el regex.

Nuevos guards a agregar (cubren el path nuevo):

- host valido **sin** segmento `/v0/b/.../o/` (ej. `https://firebasestorage.googleapis.com/some/other/path`) → debe rechazar.
- URL canonica con `/v0/b/<bucket>/o/<encoded-path>?alt=media` → debe aceptar (es el formato real que ya testea el caso "canonical" actual; verificar que sigue verde).

### S3 — origen de `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT`

#### `ADMIN_EMAIL` (decision: convertir a `defineSecret`)

Estado actual: `claims.ts:9` usa `defineString('ADMIN_EMAIL')`, que resuelve desde `functions/.env` (committeado). Para sacarlo del `.env` publico hay que cambiar el mecanismo, porque `defineString` lee del `.env` o del parameter store, pero el valor hoy vive en el `.env`.

Decision: **convertir a `defineSecret('ADMIN_EMAIL')`** y agregarlo al array `secrets:` de `setAdminClaim` (patron ya usado en `analyticsReport.ts:160` con `GA4_PROPERTY_ID` via `secrets: ['GA4_PROPERTY_ID']` + `process.env`). El cambio de codigo en `claims.ts`:

- `import { defineSecret } from 'firebase-functions/params'` (en vez de `defineString`).
- `const ADMIN_EMAIL_PARAM = defineSecret('ADMIN_EMAIL');`
- `ADMIN_EMAIL_PARAM.value()` sigue funcionando igual en el handler (la API `.value()` es identica entre `defineString` y `defineSecret`).
- Agregar `secrets: ['ADMIN_EMAIL']` al config de `onCall` de `setAdminClaim` (donde ya esta `enforceAppCheck: ENFORCE_APP_CHECK_ADMIN`).
- Provisionar el secret en Secret Manager: `firebase functions:secrets:set ADMIN_EMAIL`.
- Remover la linea `ADMIN_EMAIL=...` de `functions/.env`.

El test `claims.test.ts` ya mockea `defineString` devolviendo `{ value: () => 'admin@test.com' }`; el mock debe ampliarse para cubrir `defineSecret` con la misma forma (ambos exportados de `firebase-functions/params`).

#### `APP_CHECK_ENFORCEMENT` (decision: Opcion A — `defineString` + `.value()`) — con caveat operativo decisivo

El PRD ofrece Opcion A (`defineString('APP_CHECK_ENFORCEMENT')` + `.value()`) y Opcion B (`--set-env-vars` en deploy).

**Hallazgo decisivo (verificado en CI):** `deploy.yml:88` y `deploy-staging.yml:97` despliegan funciones al **mismo proyecto** `modo-mapa-app` con `firebase deploy --only functions`. No hay un proyecto/entorno de functions separado para staging — staging y prod comparten la misma instancia de Cloud Functions, que hoy lee `APP_CHECK_ENFORCEMENT=enabled` del `.env` commiteado en **ambos** pipelines. La distincion "production=enabled / staging=unset" descrita en `env.ts:9` y `security.md:44` es la **intencion documentada del mecanismo**, pero operativamente hoy el deploy es unico y el valor efectivo es `enabled` en la unica instancia desplegada.

Implicancia para la decision:

- **Opcion B (`--set-env-vars`)** requeriria dos pipelines de deploy de functions con distinto `--set-env-vars` (uno por entorno). Como hoy hay un solo deploy compartido, B no aporta la separacion staging/prod sin un rework de CI que esta fuera de scope (#168-adjacent infra).
- **Opcion A (`defineString` + `.value()`)** es drop-in: `defineString` resuelve desde un parameter (que puede setearse por entorno cuando exista separacion) o desde el `.env`. Para sacar el valor del `.env` commiteado y mantener el comportamiento actual, se provisiona el parameter `APP_CHECK_ENFORCEMENT` (no es secreto sensible — es un flag operativo, pero se mueve igual para no dejar config de seguridad en el repo publico).

Decision: **Opcion A**. Cambios:

- En `helpers/env.ts`: `import { defineString } from 'firebase-functions/params'`; `const APP_CHECK_ENFORCEMENT_PARAM = defineString('APP_CHECK_ENFORCEMENT', { default: 'disabled' });` y `export const ENFORCE_APP_CHECK = !IS_EMULATOR && APP_CHECK_ENFORCEMENT_PARAM.value() === 'enabled';`.
- `default: 'disabled'` preserva el invariante "ausente → disabled" (staging/emulador no rompen si el parameter no esta seteado).
- Provisionar el parameter para la instancia actual con valor `enabled` (mantiene prod=enabled exacto): via `.env` de deploy NO (se quita del `.env`), sino via parameter config de Firebase (`firebase functions:params:set` / archivo `.env.<project>` no commiteado, o config de runtime). El plan fija el mecanismo exacto de provisioning y lo valida empiricamente.

**Invariante NO-negociable (PRD S3, preservar exacto):**

- production = `enabled`
- staging = unset/`disabled`
- emuladores = siempre disabled (via `!IS_EMULATOR`, que no cambia)

`ENFORCE_APP_CHECK` NO debe cambiar de valor efectivo en ningun entorno tras la migracion. Dado el caveat de deploy unico arriba, el valor efectivo en la instancia desplegada hoy es `enabled` y debe seguir siendo `enabled` post-migracion (el plan lo verifica con `firebase functions:config`/inspeccion del parameter desplegado + smoke de una callable user-facing).

#### `GITHUB_OWNER` / `GITHUB_REPO` (decision PRD: permanecen en `.env`)

No son secretos (metadata publica del repo). Ya consumidos via `defineString` en `feedback.ts:9,12`. **Permanecen en `functions/.env`**. No se toca `.gitignore` (la linea `!functions/.env` en `.gitignore:29` se mantiene). Solo se actualiza el comentario de cabecera del `.env` para reflejar que ya no contiene valores sensibles.

### S1 / S2 — bumps de dependencias

Sin cambios de codigo de runtime (verificado: la API declarativa de react-router no cambia entre 7.13 y 7.14). `firebase-admin` bump: `.value()`/API sin cambios para el codigo del proyecto.

## Integracion

S4 es transparente: `FeedbackMediaPreview.tsx` y `MyFeedbackList.tsx` siguen llamando `isValidStorageUrl(url)` sin cambios. S3 es config server-side. S1/S2 son `package.json`/`package-lock.json`.

### Preventive checklist

- [x] **Service layer**: ningun componente importa `firebase/firestore` para writes. No aplica.
- [x] **Duplicated constants**: el regex de S4 vive solo en `media.ts`. No se duplica.
- [x] **Context-first data**: sin `getDoc` nuevos.
- [x] **Silent .catch**: no se introduce ningun `.catch(() => {})`.
- [x] **Stale props**: sin componentes que muten props.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/media.test.ts` (ampliar) | Aceptar URL canonica con `/v0/b/<bucket>/o/`; rechazar host valido sin segmento `/v0/b/.../o/`; preservar guards prefix-bypass, scheme-confusion (`http://`), arbitrary-content-before-prefix, typeof no-string, empty string; bucket generico `[^/]+` acepta cualquier bucket bien formado | Util (existente) |
| `src/main.test.ts` (regresion) | Verde post-bump react-router (smoke de montaje del router) | Integracion routing |
| `functions/src/__tests__/admin/claims.test.ts` (ajustar mock) | Verde post-cambio `defineString`→`defineSecret` de `ADMIN_EMAIL`; ampliar el mock de `firebase-functions/params` para exportar `defineSecret` con `{ value: () => 'admin@test.com' }` | Cloud Function (existente) |
| `functions/src/__tests__/helpers/env.test.ts` (crear) | Rama `ENFORCE_APP_CHECK` enabled/disabled con el nuevo mecanismo `defineString('APP_CHECK_ENFORCEMENT').value()`; verificar `default: 'disabled'` → `false`; `'enabled'` → `true`; `IS_EMULATOR=true` → siempre `false` | Helper (nuevo) |

### Mock strategy

- `media.test.ts`: sin mocks (funcion pura).
- `claims.test.ts`: ya mockea `firebase-functions/params`; extender el factory mock para incluir `defineSecret`.
- `env.test.ts`: mockear `firebase-functions/params` (`defineString`) + setear/limpiar `process.env.FUNCTIONS_EMULATOR`. Reset de modulo entre casos (`vi.resetModules()`) porque `ENFORCE_APP_CHECK` se evalua al import.

### Criterios

- Cobertura >= 80% del codigo modificado. `media.ts` debe cubrir las 3 ramas del nuevo check (host+segmento ok / host ok sin segmento / no-string).
- Suites de routing verdes post-bump (regresion S1).
- `npm audit` post-bump no lista las 3 advisories de react-router (S1) ni las HIGH de runtime de functions (S2).

## Analytics

Sin `logEvent`/`trackEvent` nuevos.

---

## Offline

Ningun cambio afecta flujos online/offline. `isValidStorageUrl` es sincrona y no hace I/O.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| (sin cambios) | — | — | — |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| (sin cambios) | — | — |

### Fallback UI

Sin cambios. Si `isValidStorageUrl` rechaza una URL, el preview no se renderiza (comportamiento actual de `FeedbackMediaPreview`).

---

## Accesibilidad y UI mobile

Sin componentes interactivos nuevos. No aplica la tabla de aria-labels / touch targets.

### Reglas

No hay `<IconButton>`, `<Typography onClick>`, ni `<img>` con URL dinamica nuevos. El render de media existente no cambia su markup.

## Textos y copy

Sin textos user-facing nuevos. No aplica voseo/tildes (no hay strings nuevos).

---

## Decisiones tecnicas

1. **S2 — el invariante de audit se redefine en TEXTO, NO se convierte en gate duro de CI (observacion Sofia).** Verificado: `deploy.yml:20-21` y `deploy-staging.yml:22-23` corren `npm audit --audit-level=high` con `continue-on-error: true` — ya es un soft-gate documentado (`devops.md:98`). Este PRD NO convierte el audit en gate duro (romperia el pipeline ante cualquier vuln dev/CLI transitiva, fuera de scope y riesgo alto dado #168). S2 actualiza el **texto del invariante documentado** en `devops.md` para distinguir: runtime (functions: debe ser 0 vulns HIGH, verificable con `cd functions && npm audit --audit-level=high` exit 0) vs dev/CLI transitivas en root (documentadas con justificacion, el `continue-on-error` se mantiene). El Success Criteria #3 del PRD ya contempla esta salida ("o el invariante queda redefinido").

2. **S4 — bucket generico `[^/]+`, no exacto.** Mantiene `media.ts` pura (sin leer `import.meta.env`), evita romper render de `mediaUrl` legacy que pudiera apuntar a otro bucket, y delega la autorizacion real a la rule de write. Condicionado a la verificacion de plan "no-legacy-bucket"; si la verificacion sale limpia, endurecer a exacto queda como followup opcional.

3. **S4 — cliente y rule son validaciones independientes (observacion Sofia).** La rule (`firestore.rules:222`) valida path encoded (`%2F`) + ownership con `.*` y NO ancla `/v0/b/`. El cliente valida host + `/v0/b/<bucket>/o/` decodificado. No se replica ni se cambia la rule. Dos capas complementarias.

4. **S3 `ADMIN_EMAIL` → `defineSecret`.** Reusa el patron `secrets:` array de `analyticsReport.ts`. La API `.value()` es identica a `defineString`, cambio minimo en `claims.ts`.

5. **S3 `APP_CHECK_ENFORCEMENT` → Opcion A (`defineString` + `.value()`), no Opcion B.** Verificado que staging y prod despliegan functions al MISMO proyecto `modo-mapa-app` con un unico deploy — Opcion B (`--set-env-vars` por entorno) no aporta separacion sin rework de CI fuera de scope. Opcion A es drop-in y `env.ts:17` es el unico lector. `default: 'disabled'` preserva el invariante "unset → disabled".

6. **`ADMIN_EMAIL` no es rotable (observacion Sofia).** Es una identidad (email), no un token. Removerlo del `.env` reduce exposicion en HEAD pero el valor persiste en historial (repo publico desde 2026-03-15). Purga de historial fuera de scope. El vector de hijack ya esta cerrado por el bootstrap gate #322 R14 (`claims.ts:36-48`, verificado).

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna rule nueva ni modificada. La rule de `feedback` (`firestore.rules:206-244`) ya tiene `hasOnly()` en create, `affectedKeys().hasOnly()` en update, type guards y validacion de `mediaUrl` por ownership. No se toca.

### Rate limiting

Sin colecciones nuevas escribibles. No aplica rate limit nuevo. `setAdminClaim` deliberadamente no tiene rate limit (documentado en `claims.ts:13-17`, threat model #322 S5) — no cambia.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Open redirect (`//evil.com`, GHSA-2j2x-hqr9-3h42) | Bump react-router `>=7.14.2` (S1) | `package.json` |
| turbo-stream RCE / RSC XSS (GHSA-49rj-9fvp-4h2h, GHSA-8646-j5j9-6r62) | Bump react-router `>=7.14.2` (S1); no alcanzables con API declarativa pero parchados | `package.json` |
| `ADMIN_EMAIL` scrapeado del repo publico → phishing dirigido | Mover a Secret Manager (S3, `defineSecret`); hijack ya cerrado por bootstrap gate #322 R14 | `functions/.env`, `claims.ts` |
| `mediaUrl` falsificada que pasa el prefix-check pero no apunta a un objeto de Storage | Endurecer `isValidStorageUrl` a `/v0/b/<bucket>/o/` (S4) + rule de write valida path canonico (defense-in-depth) | `src/utils/media.ts`, `firestore.rules:222` |
| RCE/parsing en dependencia transitiva runtime (protobufjs via firebase-admin) | Bump `firebase-admin` (S2), verificar `cd functions && npm audit --audit-level=high` exit 0 | `functions/package.json` |

---

## Deuda tecnica: mitigacion incorporada

`gh issue list --label security/tech debt`: el PRD documenta que no hay labels formales `security`/`tech debt`; el backlog tiene `Tech debt:` #341-#349 (de `/health-check`) + #168.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #300 (secrets en Secret Manager) | `ADMIN_EMAIL` + `APP_CHECK_ENFORCEMENT` fuera del `.env` publico | Fase 3 |
| #322 R14 (bootstrap gate) | Ya mitiga hijack si `ADMIN_EMAIL` se compromete; S3 reduce superficie de exposicion. No se toca | (refuerzo, sin paso) |
| #168 (Vite 8 / ESLint 10 por peer deps) | NO se desbloquea — S2 se limita a patches que no rompan peer deps | Fase 2 (constraint) |
| #342 (este) | Cierra H-1, H-2, H-3, M-1, M-2 | Todas las fases |

Nota: `devops.md:34` tiene una referencia stale (`defineString ... en backups.ts`) — el codigo real esta en `claims.ts`. Corregir esta linea como parte de la Fase de documentacion (no agravar deuda de doc en un archivo que ya tocamos).

---

## Validacion Tecnica

**Arquitecto**: Diego
**Fecha**: 2026-06-10
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos cerrados en esta iteracion

- BLOQUEANTE: "`defineSecret('ADMIN_EMAIL').value()` solo resuelve en runtime si el secret esta en el array `secrets:` de la funcion" → resuelto. Verificado en codigo: `claims.ts:34` llama `ADMIN_EMAIL_PARAM.value()` DENTRO del handler de `setAdminClaim` (no a nivel modulo). La Fase 3 del plan exige agregar `secrets: ['ADMIN_EMAIL']` al config de `onCall` ANTES de cambiar `defineString`→`defineSecret`, y que `.value()` NO se invoque a top-level. Patron identico a `analyticsReport.ts:160` (`secrets: ['GA4_PROPERTY_ID']` + lectura dentro del handler).
- IMPORTANTE: "`defineString('APP_CHECK_ENFORCEMENT')` migra de `process.env` a `.value()` — verificar que `env.ts:17` evalua a top-level del modulo, no en handler" → resuelto. `ENFORCE_APP_CHECK` se evalua al import del modulo (top-level). `defineString.value()` (a diferencia de `defineSecret`) SI resuelve a top-level desde el parameter/`.env`, por lo que la migracion es drop-in. Esto es la razon tecnica adicional por la que `APP_CHECK_ENFORCEMENT` debe ser `defineString` y NO `defineSecret` (un secret no resolveria a top-level y romperia el modulo). Documentado en la decision tecnica #5 y reforzado en la Fase 3 del plan.
- IMPORTANTE: "Riesgo de activar App Check en staging por error de mecanismo (observacion Sofia)" → resuelto. Verificado: ambos pipelines (`deploy.yml:88`, `deploy-staging.yml:97`) despliegan al MISMO proyecto `modo-mapa-app`. No hay separacion de instancia. El valor efectivo post-migracion debe seguir siendo `enabled` (la unica instancia). El `default: 'disabled'` solo aplica si el parameter no esta provisionado. La Fase 3 incluye un paso de smoke empirico (`validar ENFORCE_APP_CHECK === false en emulador con FUNCTIONS_EMULATOR=true` + inspeccion del parameter desplegado) como red de seguridad. El invariante `!IS_EMULATOR` no se toca, garantizando emuladores=disabled siempre.
- OBSERVACION: "S4 bucket generico vs exacto depende de no-legacy-bucket" → resuelto. La decision (generico `[^/]+`) ya esta condicionada al paso de verificacion empirica de la Fase 4 (query a `feedback` para confirmar que no hay `mediaUrl` con bucket distinto). El generico es el default seguro independiente del resultado; el exacto queda como followup opcional solo si la query sale limpia.
- OBSERVACION: "`devops.md:34` referencia stale `backups.ts`" → confirmado el stale (`ADMIN_EMAIL ... defineString en backups.ts`; el codigo real esta en `claims.ts`). Fix incluido en la Fase de documentacion (Fase 5).

### Observaciones tecnicas abiertas para el plan

- El orden de la Fase 3 es critico: (1) provisionar secret/parameter en Secret Manager ANTES de remover del `.env`; (2) agregar `secrets:` array ANTES de cambiar a `defineSecret`; (3) deploy + smoke ANTES de mergear. Pablo debe verificar que el plan respeta esta secuencia (un orden invertido deja la funcion sin valor en runtime).
- S2: el invariante de audit se redefine en TEXTO (no gate duro). Confirmado que `continue-on-error: true` se mantiene. Pablo debe verificar que la Fase 2 no introduce un cambio de `deploy.yml` que rompa el pipeline.
