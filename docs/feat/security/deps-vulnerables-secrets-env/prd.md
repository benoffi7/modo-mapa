# PRD: Tech debt seguridad — deps vulnerables (react-router) + secrets en functions/.env + isValidStorageUrl prefix-only

**Feature:** deps-vulnerables-secrets-env
**Categoria:** security
**Fecha:** 2026-06-09
**Issue:** #342
**Prioridad:** Alta (HIGH — 3 advisories, 2 con CVSS ~8.0)

---

## Contexto

El reporte `/health-check` detecto 5 hallazgos de seguridad de deuda tecnica en el proyecto (actualmente en v2.52.1): `react-router-dom@^7.13.1` arrastra 3 advisories de seguridad (dos con CVSS ~8.0), el invariante documentado "exit 0 en `npm audit --audit-level=high` en root y functions" esta violado, `functions/.env` (commiteado al repo publico desde 2026-03-15) contiene `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` cuando el invariante #300 exige Secret Manager, y `isValidStorageUrl` valida solo el prefijo del host sin exigir el segmento canonico `/v0/b/<bucket>/o/`.

## Problema

- **Dependencia vulnerable (HIGH):** `react-router-dom` 7.13.1 esta sujeto a GHSA-49rj-9fvp-4h2h (turbo-stream RCE, CVSS 8.1, `>=7.0.0 <=7.14.1`), GHSA-8646-j5j9-6r62 (XSS en RSC redirect, CVSS 8.0, `>=7.7.0 <7.13.2`) y GHSA-2j2x-hqr9-3h42 (open redirect `//`, moderate). El RCE/XSS no son alcanzables con la API declarativa actual (sin loaders/actions/RSC) pero el open-redirect tiene superficie real.
- **Invariante de audit roto:** `npm audit --audit-level=high` falla tanto en root (18 vulns, 8 high — mayormente transitivas via `firebase-tools` dev/CLI) como en functions (2 high via `firebase-admin` → `@google-cloud/firestore` → `google-gax` → `protobufjs`, runtime server-side). Viola el invariante documentado.
- **Secrets commiteados (#300):** `functions/.env` contiene `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT=enabled`. El repo es publico. El codigo de `claims.ts` ya usa `defineString('ADMIN_EMAIL')` (leeria del parameter/secret store), por lo que mover ambos a Secret Manager no requiere cambio de logica de runtime.
- **Validacion debil (defense-in-depth):** `src/utils/media.ts` valida `startsWith('https://firebasestorage.googleapis.com/')`. El control de autorizacion real es la regla de Firestore (que ya exige el path `feedback-media/{uid}/{feedbackId}/`), pero `isValidStorageUrl` deberia endurecerse para exigir tambien el segmento `/v0/b/<bucket>/o/` y cerrar el gap de defense-in-depth en el cliente.

## Solucion

### S1 — Bump `react-router-dom` a `>=7.14.2` (H-1)

- Bump `react-router-dom` de `^7.13.1` a `^7.14.2` (o el ultimo patch 7.x disponible) en `package.json`. Las tres advisories quedan parchadas con `>=7.14.2`.
- Sin cambio de API: el proyecto usa la API declarativa (`BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useParams`, `useSearchParams`) — no usa loaders/actions/RSC. Los 10+ callsites en `src/` (`main.tsx`, `App.tsx`, `AuthContext.tsx`, `BusinessDetailScreen.tsx`, `BusinessSheetCompactContent.tsx`, `BusinessNotFound.tsx`, etc.) no requieren cambios.
- Verificar que la suite de tests de routing (`main.test.ts`, `BusinessDetailScreen.test.tsx`, `AuthContext.test.tsx`, `BusinessSheet.error.test.tsx`) pasa post-bump.

### S2 — Restaurar invariante `npm audit --audit-level=high` (H-2, H-3)

- **Functions (H-3):** bump `firebase-admin` al ultimo patch disponible (cadena `@google-cloud/firestore` → `google-gax` → `protobufjs`). Verificar `cd functions && npm audit --audit-level=high` → exit 0.
- **Root (H-2):** la mayoria de las 18 vulns son transitivas via `firebase-tools` (dev/CLI, no shipean al bundle de produccion). Evaluar:
  - `npm audit fix` sin `--force` para los parches no-breaking.
  - Para las que solo se resuelven con bump mayor de `firebase-tools`: documentar la decision (riesgo dev-only) y, si no se puede llegar a exit 0 limpio, ajustar el invariante en `docs/reference/devops.md` para distinguir vulns de runtime (deben ser 0) de vulns dev/CLI transitivas (documentadas con justificacion).
- **Nota de scope:** #168 (Vite 8 y ESLint 10 bloqueados por peer deps) es un bloqueante conocido de bumps mayores. Este PRD NO desbloquea #168 — se limita a parches que no rompan peer deps.

### S3 — Mover `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` a Secret Manager (M-1)

- Migrar ambos valores de `functions/.env` a Firebase Secret Manager / parameter store.
- `ADMIN_EMAIL`: el codigo ya usa `defineString('ADMIN_EMAIL')` en `claims.ts:9`. Confirmar que el parameter resuelve desde Secret Manager (o convertir a `defineSecret` y declararlo en el array `secrets:` de las funciones consumidoras — patron ya usado en `analyticsReport.ts:160` con `GA4_PROPERTY_ID`) y remover la linea del `.env`.
- `APP_CHECK_ENFORCEMENT`: `helpers/env.ts:17` lo lee via `process.env.APP_CHECK_ENFORCEMENT` (NO es un parameter `defineX` hoy). A diferencia de `ADMIN_EMAIL`, este NO tiene mecanismo de parameter store existente — su migracion **requiere una decision de mecanismo** que debe quedar pinneada en specs:
  - Opcion A: convertir a `defineString('APP_CHECK_ENFORCEMENT')` y leer `.value()` en vez de `process.env`.
  - Opcion B: setearlo como env de runtime via config de deploy (`--set-env-vars`) en lugar del `.env` commiteado.
  - **Invariante a preservar (no negociable):** el comportamiento documentado en `env.ts:9` debe mantenerse exacto — production = `enabled`, staging = unset/`disabled`, emuladores = siempre disabled. `ENFORCE_APP_CHECK` no debe cambiar de valor efectivo en ningun entorno tras la migracion.
- **`GITHUB_OWNER` / `GITHUB_REPO`:** son metadata publica del repo (no secretos). Decision de este PRD: **permanecen en `functions/.env`** (ya consumidos via `defineString` en `feedback.ts:9`). El `.env` sigue siendo un archivo valido commiteado para valores NO sensibles — el invariante #300 prohibe *secretos* en el `.env`, no toda configuracion. Actualizar el comentario de cabecera de `functions/.env` para reflejar que solo contiene valores no-sensibles.
- **No re-ignorar `functions/.env`:** el archivo esta deliberadamente un-ignored en `.gitignore:29` (`!functions/.env`) y debe seguir asi para que `GITHUB_OWNER`/`GITHUB_REPO` viajen en el repo. La mitigacion es remover los *secretos* del archivo, NO re-ignorar el archivo. No tocar `.gitignore`.
- Actualizar `docs/reference/devops.md` y `docs/reference/security.md` con el nuevo origen de cada valor.
- **Consideracion de seguridad (#300):** este es exactamente el invariante "Secretos sensibles en Secret Manager" de `security.md` L170. El repo es publico — un `ADMIN_EMAIL` expuesto facilita phishing dirigido a la cuenta admin (mitigado parcialmente por el bootstrap gate #322 R14, pero defense-in-depth exige no exponerlo).
- **Nota sobre `ADMIN_EMAIL` y rotacion:** `ADMIN_EMAIL` es una *identidad* (un email), no un token rotatable. Removerlo del `.env` reduce su exposicion en el HEAD del repo, pero el valor sigue en el historial de commits (el repo es publico desde 2026-03-15). No es "rotable" como un secreto: la mitigacion efectiva contra su exposicion historica es el bootstrap gate #322 R14 (ya desplegado) + Email Enumeration Protection. Este PRD no intenta purgar historial (fuera de scope, costo alto, beneficio marginal dado que el gate ya cierra el vector de hijack).

### S4 — Endurecer `isValidStorageUrl` (M-2)

- Cambiar la validacion en `src/utils/media.ts` de prefix-only a un check que exija el segmento canonico `/v0/b/<bucket>/o/` despues del host.
- Patron de validacion: anclar host exacto + segmento `/v0/b/` + bucket + `/o/`. Reusar el estilo de las rules de Firestore (`^https://firebasestorage.googleapis.com/...`) para consistencia. El bucket puede validarse contra `VITE_FIREBASE_STORAGE_BUCKET` o aceptarse generico (`/v0/b/[^/]+/o/`) — definir en specs.
- Mantener el `typeof url === 'string'` guard y los regression guards existentes (prefix-bypass con dominio similar, scheme-confusion `http://`, contenido arbitrario antes del prefijo).
- **UX:** sin impacto visual. `isValidStorageUrl` se usa en `FeedbackMediaPreview.tsx` y `MyFeedbackList.tsx` para decidir si renderizar la media; un endurecimiento solo afecta URLs malformadas (que ya deberian estar bloqueadas por las rules en escritura).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — bump react-router-dom >=7.14.2 + verificar tests routing | Alta | S |
| S2 — bump firebase-admin + audit fix root + actualizar invariante devops | Alta | M |
| S3 — migrar ADMIN_EMAIL + APP_CHECK_ENFORCEMENT a Secret Manager, remover del .env | Alta | M |
| S4 — endurecer isValidStorageUrl con `/v0/b/<bucket>/o/` + tests | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Bump mayor de `firebase-tools`, Vite 8 o ESLint 10 — bloqueados por peer deps (#168), seguimiento separado.
- Migrar `GITHUB_TOKEN` (ya en Secret Manager) o cualquier otro secreto ya gestionado correctamente.
- Cambiar la API de routing (migrar a data router / loaders) — el bump es drop-in sobre la API declarativa.
- Endurecer las Storage rules o Firestore rules de `feedback`/`specials` (la regla ya valida el path canonico) — solo se toca el helper client-side `isValidStorageUrl`.

---

## Tests

Politica del proyecto: >=80% cobertura para codigo nuevo/modificado (enforced en CI via `deploy.yml`). `src/utils/media.ts` ya esta al 100% con regression guards — el endurecimiento DEBE conservar y ampliar esos guards.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/media.test.ts` | Util (existente, ampliar) | Aceptar URL canonica con `/v0/b/<bucket>/o/`; rechazar URL con host valido pero sin segmento `/v0/b/.../o/`; mantener guards de prefix-bypass, scheme-confusion (`http://`), contenido arbitrario antes del prefijo, host similar (`...googleapis.com.evil.com`); rechazar bucket de otro proyecto si se valida bucket exacto |
| `src/main.test.ts` | Integracion routing (existente) | Verde post-bump react-router (smoke de montaje de router) |
| `functions/src/__tests__/admin/claims.test.ts` | Cloud Function (existente) | Verde post-cambio de origen de `ADMIN_EMAIL` (el mock de `defineString` ya devuelve `{ value: () => 'admin@test.com' }`) |
| `functions/src/helpers/env.ts` | Helper (sin test hoy) | Si se cambia el mecanismo de lectura de `APP_CHECK_ENFORCEMENT`, agregar test de la rama enabled/disabled (hoy es constante simple sin test) |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo/modificado.
- `media.test.ts` cubre todos los paths condicionales del nuevo regex (host valido + segmento valido, host valido + segmento ausente, host invalido).
- Suites de routing existentes verdes post-bump (regresion).
- No se introducen side effects nuevos (la funcion sigue siendo pura).

---

## Seguridad

Items relevantes del checklist de `security.md`:

- [ ] **Sin secretos en codigo (S3):** `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` salen de `functions/.env` (repo publico) hacia Secret Manager — invariante #300 / `security.md` L170.
- [ ] **Revisar diffs por exposicion de secretos:** confirmar que el `.env` ya no contiene valores sensibles tras la migracion; verificar que ningun valor quedo en historial de commits relevante para rotacion.
- [ ] **Validacion de input endurecida (S4):** `isValidStorageUrl` exige segmento canonico — defense-in-depth client-side.
- [ ] **Dependencias sin vulnerabilidades HIGH (S1, S2):** `react-router-dom >=7.14.2`; `npm audit --audit-level=high` exit 0 en functions (runtime) y root (o invariante actualizado con justificacion para dev-only).

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Open redirect (react-router GHSA-2j2x-hqr9-3h42) | Bot inyecta URL `//evil.com` en parametro de navegacion para phishing | Bump a `>=7.14.2` (S1) |
| `ADMIN_EMAIL` expuesto en repo publico | Script scrapea el repo, identifica la cuenta admin para phishing/credential stuffing | Mover a Secret Manager (S3); bootstrap gate #322 R14 ya mitiga hijack post-compromiso |
| Media URL falsificada en `mediaUrl` (feedback) | Cliente o script envia URL que pasa el prefix-check pero apunta a recurso no-Storage | Endurecer `isValidStorageUrl` (S4) + rule de Firestore ya valida path canonico (defense-in-depth) |
| Dependencia transitiva vulnerable (protobufjs, turbo-stream) | Explotacion de RCE/parsing en runtime server-side | Bump `firebase-admin` (S2) |

**Este feature NO escribe a Firestore ni agrega colecciones.** No aplican los checklists de `hasOnly()`, rate limit de triggers, ni `userSettings`. El cambio en `isValidStorageUrl` afecta lectura/render de media, no escritura — la rule de `feedback` (firestore.rules L222) ya valida el path en write.

---

## Deuda tecnica y seguridad

Issues abiertos consultados (`gh issue list`): no hay labels `security` ni `tech debt` formales; el backlog actual tiene una tanda de items `Tech debt:` (#341-#349) generados por `/health-check`, mas #168.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #300 (invariante secrets en Secret Manager) | mitiga | S3 cierra el gap exacto de `ADMIN_EMAIL` / `APP_CHECK_ENFORCEMENT` en el `.env` commiteado |
| #322 R14 (bootstrap admin gate) | refuerza | Ya mitiga el hijack del rol admin si `ADMIN_EMAIL` se compromete; S3 reduce la superficie de exposicion del email |
| #168 (Vite 8 / ESLint 10 bloqueados por peer deps) | empeora si no se considera | S2 NO debe forzar bumps mayores que rompan peer deps; limitarse a patches |
| #342 (este) | — | Cierra los 5 hallazgos H-1, H-2, H-3, M-1, M-2 |

### Mitigacion incorporada

- M-1: `ADMIN_EMAIL` + `APP_CHECK_ENFORCEMENT` fuera del repo publico → Secret Manager (S3, invariante #300).
- M-2: `isValidStorageUrl` endurecido a segmento canonico (S4).
- Invariante de audit restaurado o redefinido explicitamente con criterio runtime-vs-dev (S2).

---

## Robustez del codigo

Este feature NO agrega hooks ni componentes async. S4 modifica una funcion pura existente; S1/S2 son bumps de dependencias; S3 es config de deploy + remocion de lineas del `.env`.

### Checklist de hooks async

- [x] No aplica — sin hooks/componentes nuevos. `isValidStorageUrl` es una funcion pura sin async.
- [ ] Funciones exportadas que no se usan fuera del archivo y tests: `isValidStorageUrl` sigue exportado y consumido por `FeedbackMediaPreview.tsx` y `MyFeedbackList.tsx`.
- [ ] `src/utils/media.ts` se mantiene como util pura (sin hooks) — ubicacion correcta.
- [ ] Archivos modificados no superan 400 lineas (`media.ts` tiene ~6 lineas; `env.ts` ~42).
- [x] No hay `logger.error` envuelto en `if (import.meta.env.DEV)` — no se toca logging.

### Checklist de observabilidad

- [x] No hay Cloud Function trigger nuevo (no aplica `trackFunctionTiming`).
- [x] No hay service nuevo con queries Firestore (no aplica `measureAsync`).
- [x] No hay `trackEvent` nuevo.

### Checklist offline

- [x] No hay formularios/dialogs nuevos que escriban a Firestore.
- [x] `isValidStorageUrl` no toca catch blocks de toast.

### Checklist de documentacion

- [ ] `docs/reference/security.md` actualizado: origen de `ADMIN_EMAIL`/`APP_CHECK_ENFORCEMENT` (Secret Manager), endurecimiento de `isValidStorageUrl`.
- [ ] `docs/reference/devops.md` actualizado: variables de entorno + invariante `npm audit` (runtime vs dev-only).
- [ ] `docs/reference/project-reference.md`: bump de version si corresponde tras el cambio de dependencias.
- [x] No hay colecciones/campos Firestore nuevos (no aplica `firestore.md`).
- [x] No hay patrones nuevos (no aplica `patterns.md`), salvo documentar el criterio audit runtime-vs-dev si se redefine el invariante.

---

## Offline

Ningun cambio afecta flujos de datos online/offline. S1/S2 son bumps de deps; S3 es config server-side; S4 endurece una validacion de URL sincrona usada en render.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Render de media de feedback (validada por `isValidStorageUrl`) | read (validacion sincrona, no I/O) | Sin cambio — la validacion no hace fetch | Sin cambio — si la URL es invalida, no se renderiza el preview (comportamiento actual) |

### Checklist offline

- [x] Reads de Firestore: sin cambios.
- [x] Writes: sin cambios.
- [x] APIs externas: sin cambios.
- [x] UI: sin indicador offline nuevo necesario.
- [x] Datos criticos: sin cambios de cache.

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

El proyecto esta en ~30% monolitico. Este feature NO agrega componentes, hooks ni estado global. Modifica una util pura (`media.ts`), bumps de `package.json`, config de deploy y `functions/.env`.

### Checklist modularizacion

- [x] Logica de negocio en util pura (no inline en layout).
- [x] No se agregan componentes nuevos.
- [x] No se agregan useState a AppShell/SideMenu.
- [x] `isValidStorageUrl` ya recibe la URL como argumento (sin dependencias implicitas).
- [x] Ningun componente nuevo importa de `firebase/firestore|functions|storage`.
- [x] `src/utils/media.ts` se mantiene como util (no es hook).
- [x] Ningun archivo modificado supera 400 lineas.
- [x] No hay converters nuevos.
- [x] No hay archivos nuevos en `components/menu/` (cajon legacy).
- [x] No se crea contexto global nuevo.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se agregan/quitan imports cruzados |
| Estado global | = | Sin estado nuevo |
| Firebase coupling | - | S3 reduce config sensible en `.env` |
| Organizacion por dominio | = | `media.ts` y `env.ts` permanecen en su capa |

---

## Accesibilidad y UI mobile

Este feature no agrega ni modifica componentes interactivos. S4 solo cambia la condicion bajo la cual se renderiza un preview de media ya existente.

### Checklist de accesibilidad

- [x] No hay `<IconButton>` nuevos.
- [x] No se agregan elementos interactivos.
- [x] Sin touch targets nuevos.
- [x] Sin estados de carga nuevos.
- [x] `FeedbackMediaPreview` ya maneja URLs invalidas (no renderiza); el endurecimiento mantiene el comportamiento.
- [x] Sin formularios nuevos.

### Checklist de copy

- [x] No hay copy user-facing nuevo (el cambio es de validacion/config, sin texto visible).
- [x] Sin cambios de terminologia.
- [x] Sin mensajes de error nuevos.

---

## Success Criteria

1. `react-router-dom >=7.14.2` instalado; las 3 advisories (GHSA-49rj-9fvp-4h2h, GHSA-8646-j5j9-6r62, GHSA-2j2x-hqr9-3h42) ya no aparecen en `npm audit`; suites de routing verdes.
2. `cd functions && npm audit --audit-level=high` retorna exit 0 (sin vulns HIGH de runtime).
3. `npm audit --audit-level=high` en root retorna exit 0, o el invariante de `docs/reference/devops.md` queda redefinido distinguiendo runtime (0 vulns) de dev/CLI transitivas (documentadas con justificacion).
4. `ADMIN_EMAIL` y `APP_CHECK_ENFORCEMENT` no estan en `functions/.env` (verificable por inspeccion del archivo commiteado); el runtime los lee desde Secret Manager / parameter store; deploy de functions funciona en prod y staging.
5. `isValidStorageUrl` exige el segmento canonico `/v0/b/<bucket>/o/`; `media.test.ts` cubre el nuevo path al 100% manteniendo los regression guards existentes (prefix-bypass, scheme-confusion, contenido arbitrario).

---

## Validacion Funcional

**Analista**: Sofia
**Fecha**: 2026-06-09
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos cerrados en esta iteracion

- IMPORTANTE: "Decision de re-ignorar `functions/.env` no especificada" → resuelto en S3. El archivo esta deliberadamente un-ignored (`.gitignore:29 !functions/.env`) para que `GITHUB_OWNER`/`GITHUB_REPO` (no-secretos) viajen en el repo. La mitigacion es remover los secretos del archivo, NO re-ignorarlo ni tocar `.gitignore`.
- IMPORTANTE: "Mecanismo de migracion de `APP_CHECK_ENFORCEMENT` ambiguo" → resuelto en S3. Se documentan Opcion A (`defineString` + `.value()`) y Opcion B (`--set-env-vars` de deploy), con la decision final delegada a specs, y se fija como invariante no-negociable el comportamiento por entorno de `env.ts:9` (prod=enabled, staging=unset, emuladores=disabled) que no debe cambiar de valor efectivo.
- OBSERVACION: "`ADMIN_EMAIL` no es rotable" → resuelto en S3. Se aclara que es una identidad (no token), que el valor persiste en historial de commits, que la purga de historial queda fuera de scope, y que el vector de hijack ya esta cerrado por el bootstrap gate #322 R14.

### Observaciones abiertas para el implementador

- Al armar el plan, validar empiricamente que el deploy de functions a staging (donde `APP_CHECK_ENFORCEMENT` debe quedar unset/disabled) sigue resolviendo `ENFORCE_APP_CHECK === false` tras la migracion — riesgo bajo pero es el unico punto donde un error de mecanismo (Opcion A vs B) podria activar App Check en staging por accidente.


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** npm audit corre con continue-on-error (no es gate duro hoy) — aclarar SC. La rule usa %2F y .*, NO /v0/b/: tratar cliente y rule como validaciones independientes. Confirmar que no hay mediaUrl legacy con otro bucket. Validar en staging que ENFORCE_APP_CHECK sigue false tras migrar APP_CHECK_ENFORCEMENT.
