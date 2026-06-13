# Plan de implementación: Deps vulnerables + secrets en .env + isValidStorageUrl (#342)

> Basado en `specs.md` (VALIDADO CON OBSERVACIONES por Diego, 2026-06-10) y `prd.md` (VALIDADO CON OBSERVACIONES por Sofia).

## Estrategia y staging de riesgo

| Fase | Sub-tarea | Riesgo | Esfuerzo | Owner | Notas |
|------|-----------|--------|----------|-------|-------|
| F1 — Bump react-router-dom | S1 | Bajo | S | luna (frontend) | API declarativa, sin breaking |
| F2 — Bump firebase-admin | S2 | Medio | M | nico (backend) | functions runtime; correr tests; redefinir invariante audit |
| F3 — Secrets a Secret Manager | S3 | Alto | M | nico (backend) | requiere deploy + smoke a instancia compartida prod/staging |
| F4 — Hardening isValidStorageUrl | S4 | Bajo | S | luna (frontend) | validación cliente independiente de la rule |
| F5 — Documentación | (transversal) | Bajo | S | owner de la fase que mergea último | security.md + devops.md + project-reference.md |

**Esfuerzo total:** M (consistente con el PRD: S1=S, S2=M, S3=M, S4=S).

### Merge strategy (declarada — hallazgo Pablo #4)

**Dos PRs:**

- **PR-A (F1 + F2 + F4 + F5-parcial):** cambios de bajo/medio riesgo que se mergean por gate de CI estándar (build + tests + audit). F5 docs de S1/S2/S4 viajan en este PR.
- **PR-B (F3 + F5-parcial):** aislado por su gate de **deploy + smoke a la instancia compartida prod/staging**. F3 toca código (`claims.ts`, `env.ts`) + Secret Manager + provisioning, y su validación NO es CI-only sino verificación empírica de runtime post-deploy. Las docs de S3 (origen de `ADMIN_EMAIL`/`APP_CHECK_ENFORCEMENT` en security.md y devops.md) viajan en este PR para que el doc no quede stale respecto del estado real desplegado.

**Rationale del split:** F3 tiene un perfil de riesgo y un gate de validación distintos (deploy real + smoke) de F1/F4 (revert de lockfile/util, gate CI). Mantenerlos juntos obligaría a bloquear el merge de bumps de seguridad de bajo riesgo detrás del gate de deploy de F3.

### Dependencia de orden entre PRs (hallazgo Pablo #5)

- **F2 antes de F3.** Ambas tocan el árbol de `functions/`: F2 modifica `functions/package.json` + lockfile; F3 modifica `functions/src/admin/claims.ts`, `functions/src/helpers/env.ts` y `functions/.env`. No hay overlap de archivos, pero F3 hace `firebase deploy --only functions` — el lockfile de functions debe estar estable (post-F2) antes del deploy de F3 para que el deploy use las deps parcheadas. **Por lo tanto: PR-A se mergea antes que PR-B.**
- F1 (`package.json` root) y F4 (`src/utils/media.ts`) no se solapan con functions ni entre sí; pueden ir en cualquier orden dentro de PR-A.

### Confirmación de no-overlap de archivos

| Fase | Archivos | Overlap con otra fase |
|------|----------|----------------------|
| F1 | `package.json`, `package-lock.json` (root) | Ninguno |
| F2 | `functions/package.json`, `functions/package-lock.json` | Comparte árbol `functions/` con F3 (lockfile vs código) → orden F2→F3 |
| F3 | `functions/.env`, `functions/src/admin/claims.ts`, `functions/src/helpers/env.ts`, `functions/src/__tests__/admin/claims.test.ts`, `functions/src/__tests__/helpers/env.test.ts` | Comparte árbol `functions/` con F2 |
| F4 | `src/utils/media.ts`, `src/utils/media.test.ts` | Ninguno |
| F5 | `docs/reference/*`, `functions/.env` (comentario cabecera) | Ninguno de código |

## Fase 1 — Bump `react-router-dom >= 7.14.2` (S1)

- **Archivo:** `package.json` / `package-lock.json`.
- **Cambio:** `npm i react-router-dom@^7.14.2`; verificar `npm audit` que limpia GHSA-49rj/8646/2j2x.
- **Test:** build + smoke de rutas (`src/main.tsx`, `src/App.tsx` usan API declarativa, sin loaders/RSC → sin cambio de API).
- **Commit:** `fix(#342): bump react-router-dom a >=7.14.2 (RCE/XSS/open-redirect)`
- **Rollback:** revert del lockfile.

## Fase 2 — Bump `firebase-admin` (S2)

- **Archivo:** `functions/package.json` / lockfile.
- **Cambio:** subir `firebase-admin` al patch que trae `google-gax`/`protobufjs` parcheados; `cd functions && npm audit`.
- **Test:** `cd functions && npm run test:run` verde; build de functions.
- **Commit:** `fix(#342): bump firebase-admin para limpiar protobufjs/google-gax (functions)`
- **Rollback:** revert del lockfile de functions.

## Fase 3 — `ADMIN_EMAIL` + `APP_CHECK_ENFORCEMENT` a Secret Manager (S3)

> **Orden interno NO negociable (observacion abierta de Diego, specs L356-357).** Invertir estos pasos deja la funcion sin valor en runtime.

- **Archivos:** `functions/.env`, `functions/src/admin/claims.ts`, `functions/src/helpers/env.ts`, `functions/src/__tests__/admin/claims.test.ts`, `functions/src/__tests__/helpers/env.test.ts` (nuevo).

**Paso 3.0 — Provisionar antes de remover.** Provisionar `ADMIN_EMAIL` (secret) y `APP_CHECK_ENFORCEMENT` (parameter) en Secret Manager / parameter store ANTES de tocar el `.env`. Valor de `APP_CHECK_ENFORCEMENT` = `enabled` en la instancia desplegada (preserva prod=enabled exacto).

**Paso 3.1 — `secrets:` array antes del cambio de tipo.** Agregar `secrets: ['ADMIN_EMAIL']` al config de `onCall` de `setAdminClaim` ANTES de cambiar `defineString`→`defineSecret` (sin el array, `.value()` no resuelve en runtime). Patron de `analyticsReport.ts:160`.

**Paso 3.2 — Cambio de codigo.** En `claims.ts`: `defineString('ADMIN_EMAIL')` → `defineSecret('ADMIN_EMAIL')` (decision tecnica #4 de specs; `.value()` se invoca DENTRO del handler, no a top-level). En `helpers/env.ts`: `process.env.APP_CHECK_ENFORCEMENT` → `defineString('APP_CHECK_ENFORCEMENT', { default: 'disabled' }).value()` (Opcion A, decision #5; evalua a top-level, drop-in). Remover ambas lineas del `.env`; actualizar comentario de cabecera del `.env`.

**Paso 3.3 — Tests EN esta fase (no en un paso final).**
- `functions/src/__tests__/helpers/env.test.ts` (CREAR): ramas `ENFORCE_APP_CHECK` enabled/disabled, `default:'disabled'`→false, `IS_EMULATOR=true`→false. `vi.resetModules()` por caso (se evalua al import).
- `functions/src/__tests__/admin/claims.test.ts` (AJUSTAR mock): ampliar el factory de `firebase-functions/params` para exportar `defineSecret` con `{ value: () => 'admin@test.com' }`.

**Paso 3.4 — Deploy + smoke antes de mergear.** `firebase deploy --only functions --project modo-mapa-app`; verificar empiricamente que `ENFORCE_APP_CHECK` sigue resolviendo al valor esperado (smoke de una callable user-facing + inspeccion del parameter desplegado). En emulador, `FUNCTIONS_EMULATOR=true` → siempre false (invariante `!IS_EMULATOR` intacto).

- **Aclaracion SC (Sofia):** `npm audit --audit-level=high` corre en CI con `continue-on-error`. **Decision:** actualizar texto del invariante documentado (Fase 5); gate duro queda fuera de scope.
- **Commit:** `chore(#342): mover ADMIN_EMAIL (defineSecret) y APP_CHECK_ENFORCEMENT (defineString) a Secret Manager + tests`
- **Rollback:** revert del codigo + restaurar parameter/secret; `.env` local para desarrollo (no commitear secrets reales). El parameter desplegado permanece.

## Fase 4 — Hardening `isValidStorageUrl` (S4)

- **Archivo:** `src/utils/media.ts` (+ `media.test.ts`).
- **Cambio:** exigir el segmento `/v0/b/<bucket>/o/` además del host. **Tratar cliente y rule como validaciones INDEPENDIENTES** (la rule `firestore.rules:222` usa `%2F` y `.*`, no `/v0/b/` — no son espejo).
- **Pre-decisión:** bucket exacto (`VITE_FIREBASE_STORAGE_BUCKET`) vs genérico (`/v0/b/[^/]+/o/`). Antes de elegir exacto, confirmar que no hay `mediaUrl` legacy en Firestore con otro bucket (rename/migración). **Default:** genérico (`[^/]+`) para no romper históricos.
- **Test:** `media.test.ts` — URLs válidas, host correcto sin `/v0/b/` (rechaza), bucket distinto (acepta si genérico).
- **Commit:** `fix(#342): endurecer isValidStorageUrl exigiendo /v0/b/<bucket>/o/`
- **Rollback:** revert del util + test.

## Fase 5 — Documentación (S2/S3)

- **`docs/reference/security.md`:** nuevo origen de `ADMIN_EMAIL` (Secret Manager / `defineSecret`) y `APP_CHECK_ENFORCEMENT` (parameter / `defineString`). Invariante #300 satisfecho.
- **`docs/reference/devops.md`:** (a) actualizar tabla de variables de entorno (qué vive en `.env` vs Secret Manager); (b) **redefinir el texto del invariante `npm audit`** distinguiendo runtime functions (0 vulns HIGH, exit 0) de dev/CLI transitivas en root (documentadas, `continue-on-error` se mantiene) — esto es Success Criteria #3 del PRD, sin este paso S2 queda incompleto; (c) corregir el stale `devops.md:34` (`defineString ... en backups.ts` → el codigo real esta en `claims.ts`).
- **`docs/reference/project-reference.md`:** bump de version si corresponde tras el cambio de deps.
- **Owner:** quien mergea PR-B (las docs de S3 viajan con PR-B; las de S1/S2/S4 pueden ir en PR-A).
- **Commit:** `docs(#342): actualizar security.md + devops.md (origen de secrets + invariante audit runtime-vs-dev)`
- **Rollback:** revert del commit de docs (sin impacto de runtime).

## Test plan global

Tests escritos EN la fase que toca el codigo (no en un paso final):

- **F1:** build + smoke de routing (`src/main.test.ts` verde post-bump).
- **F2:** `cd functions && npm run test:run` verde; `npm audit --audit-level=high` functions exit 0.
- **F3:** `functions/src/__tests__/helpers/env.test.ts` (nuevo) + ajuste de mock en `claims.test.ts`; deploy + smoke de `ENFORCE_APP_CHECK`.
- **F4:** `src/utils/media.test.ts` ampliado — acepta `/v0/b/<bucket>/o/`, rechaza host sin segmento, preserva guards prefix-bypass/scheme-confusion/arbitrary-content/typeof/empty.
- Cobertura >=80% branches del codigo modificado (gate del merge skill).
- `npm audit` root y functions → documentar resultado en devops.md (F5).

## Rollback global

Fases independientes y revertibles. F3 es la sensible: mantener los valores en Secret Manager y poder restaurar `.env` local para desarrollo.

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Cerrado en este ciclo:**
- BLOQUEANTE #1 "Tests del specs ausentes en las fases" -> resuelto: `env.test.ts` (crear) + ajuste de mock `defineSecret` en `claims.test.ts` ahora viven en el Paso 3.3 de la Fase 3 (junto al cambio de codigo, no en un paso final). Test plan global desglosado por fase.
- BLOQUEANTE #2 "Orden interno de la Fase 3 no documentado" -> resuelto: pasos 3.0->3.4 con la secuencia no-negociable de Diego (provisionar -> `secrets:` array -> cambio de tipo -> deploy+smoke). Corregido el "ya usa defineString" a la conversion `defineString`->`defineSecret` (decision tecnica #4 de specs).
- BLOQUEANTE #3 "Falta fase de documentacion" -> resuelto: Fase 5 con `security.md`, `devops.md` (incluye redefinicion del invariante audit = Success Criteria #3 del PRD + fix del stale `devops.md:34` backups.ts->claims.ts) y `project-reference.md`.
- IMPORTANTE #4 "Sin estimacion ni merge strategy" -> resuelto: tabla con esfuerzo S/M por fase + merge strategy explicita (PR-A bajo/medio riesgo via gate CI; PR-B aislado por gate deploy+smoke de F3).
- IMPORTANTE #5 "Ownership sin asignar" -> resuelto: owners (luna F1/F4, nico F2/F3), tabla de no-overlap de archivos y dependencia de orden F2->F3 (lockfile estable antes del deploy de F3).

**Observaciones para el implementador:**
1. Dos pre-decisiones quedan correctamente diferidas a tiempo de implementacion y deben resolverse ANTES de codear su fase: (a) F4 bucket generico vs exacto — depende de la query no-legacy-bucket a `feedback.mediaUrl`; el default seguro es generico `[^/]+`; (b) F3 mecanismo exacto de provisioning del parameter `APP_CHECK_ENFORCEMENT` — el plan exige verificarlo empiricamente en el Paso 3.4.
2. F3 (PR-B) NO se mergea hasta completar el Paso 3.4 (deploy + smoke de `ENFORCE_APP_CHECK` en la instancia compartida prod/staging). El gate de F3 no es CI-only; es verificacion de runtime post-deploy. Respetar el orden interno 3.0->3.4 al pie de la letra: invertirlo deja `setAdminClaim` sin valor en runtime.
3. PR-A (F1+F2+F4+docs S1/S2/S4) se mergea antes que PR-B porque F2 estabiliza el lockfile de functions que F3 despliega.
4. El merge skill corre coverage >=80% branches: el test de `env.ts` (Paso 3.3) es lo que evita que ese gate bloquee a F3 por las ramas nuevas del mecanismo `defineString.value()`.
5. S2 mantiene `continue-on-error: true` en el audit de CI; la Fase 5 redefine el invariante en TEXTO, NO introduce un gate duro en `deploy.yml`/`guards.yml`. Verificar que F2 no rompe el pipeline.

**Listo para pasar a implementacion?** Si.