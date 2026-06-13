# Plan: Firestore rules unit testing — montar @firebase/rules-unit-testing harness

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Fecha:** 2026-05-16
**Issue:** [#332](https://github.com/benoffi7/modo-mapa/issues/332)

---

## Branch

`feat/332-firestore-rules-unit-testing-harness` (a partir de `new-home`).

---

## Fases de implementacion

### Fase 1 — Dependencias y verificacion del entorno

**Branch:** `feat/332-firestore-rules-unit-testing-harness`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1.1 | terminal | `npm install --save-dev @firebase/rules-unit-testing@^3 firebase-tools@^13` |
| 1.2 | `package.json` | Verificar que ambos quedan en `devDependencies` con pins `^3.x` y `^13.x` |
| 1.3 | `package-lock.json` | Verificar que se actualiza correctamente (incluye Java requirements informados como warnings opcionales) |
| 1.4 | terminal | `npx firebase-tools --version` → debe responder con la version 13.x sin crashear (verifica que el bin esta instalado y que Java esta disponible localmente o el comando es no-op para `--version`) |
| 1.5 | terminal | `npm ls @firebase/rules-unit-testing firebase-tools` → confirma instalacion (Success Criteria #1) |

**Notas operacionales**:
- Si `npm install` falla en el Pi por memoria, fragmentarlo: `npm install --save-dev firebase-tools@^13` y luego `npm install --save-dev @firebase/rules-unit-testing@^3`.
- No instalar globalmente. Si `which firebase` reporta una binary global, dejarla — usamos siempre `npx firebase-tools` para invocar la local.

### Fase 2 — Setup factory y constantes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2.1 | `tests/rules/setup.ts` (nuevo) | Crear el archivo con el contrato completo de specs L160-L210: `RULES_TEST_PROJECT_ID`, `createRulesTestEnv`, `authedContext`, `unauthedContext`, `expectAllow`, `expectDeny`, `clearFirestore`, `withAdminContext`. Usar `path.resolve(__dirname, '../../firestore.rules')`. Validar que LOC < 200. |
| 2.2 | `tests/rules/setup.ts` | Verificar que el archivo NO importa codigo de `src/**` (boundary clara). Imports permitidos: `node:fs`, `node:path`, `@firebase/rules-unit-testing`. |

### Fase 3 — Vitest config separado

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3.1 | `vitest.rules.config.ts` (nuevo) | Crear con `environment: 'node'`, `include: ['tests/rules/**/*.test.ts']`, `exclude: ['node_modules/**', 'dist/**', 'functions/**', 'src/**']`, `testTimeout: 10_000`, `coverage: { enabled: false }`. |
| 3.2 | `vitest.config.ts` | NO modificar. Verificar que su `exclude` incluye `tests/rules/**` implicito via no estar en `include` (el principal solo recorre `src/**`). Si el principal no excluye explicitamente, agregar `'tests/**'` a `exclude` para defense-in-depth. |
| 3.3 | terminal | `npx vitest --config vitest.rules.config.ts --list` (sin emulador, debe listar 0 tests si users.rules.test.ts aun no existe; verifica que el config parsea OK). |

### Fase 4 — Scripts en `package.json`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4.1 | `package.json` | Agregar `"test:rules": "firebase emulators:exec --only firestore 'vitest run --config vitest.rules.config.ts'"` en `scripts`. |
| 4.2 | `package.json` | Agregar `"test:rules:ci": "vitest run --config vitest.rules.config.ts"` en `scripts`. |
| 4.3 | terminal | `npm run test:rules:ci` → debe correr y reportar "No test files found" (esperado en este punto; valida que vitest parsea el config). |

### Fase 5 — Suite de referencia `users.rules.test.ts`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5.1 | `tests/rules/users.rules.test.ts` (nuevo) | Crear el archivo siguiendo la estructura de specs L220-L260: `beforeAll`/`afterAll` para env, `beforeEach` con `clearFirestore`. Helper local `seedUser` y `validUserPayload`. |
| 5.2 | `tests/rules/users.rules.test.ts` | Implementar los 16 tests segun la tabla canonica de specs L264-L308. Orden: 4 R6, 5 R7, 5 R12, 2 hasOnly update. |
| 5.3 | `tests/rules/users.rules.test.ts` | Agregar comentario "Regression sentinel" encima del bloque R12 (texto exacto en specs L310-L317). |
| 5.4 | terminal | `npm run test:rules` (local, con emulador automatico) → los 16 tests deben pasar. |
| 5.5 | terminal | Validar LOC: `wc -l tests/rules/users.rules.test.ts` < 400. Si excede, refactorizar helpers a `tests/rules/users.fixtures.ts`. |

**Notas operacionales**:
- Si un test falla, NO modificar `firestore.rules` para hacerlo pasar — el test esta capturando un bug o un misunderstanding del invariante. Re-leer specs y rules antes de cambiar nada.
- Si los 16 tests pasan pero alguno toma > 2s individual, investigar (probablemente el emulador esta cold-starting). Agregar warmup en `beforeAll` si hace falta.

### Fase 6 — Anotaciones en `firestore.rules`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6.1 | `firestore.rules` | En el bloque `match /users/{userId}` create (linea ~39), agregar comentario `// covered by tests/rules/users.rules.test.ts (R12 - bidireccional displayNameLower)` antes de `&& request.resource.data.displayNameLower == request.resource.data.displayName.lower()`. |
| 6.2 | `firestore.rules` | En el mismo bloque update (linea ~61, antes del `&& (...)` ternario de R12), agregar comentario `// covered by tests/rules/users.rules.test.ts (R12 - bidireccional displayNameLower en update)`. |
| 6.3 | terminal | `npm run test:rules` → los 16 tests deben seguir pasando (cambio es comentario, sin semantica). |

### Fase 7 — CI integration (deploy.yml y deploy-staging.yml)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7.1 | `.github/workflows/deploy.yml` | Agregar job `rules-test` (template de specs L425-L445) despues del job `functions-test`. |
| 7.2 | `.github/workflows/deploy.yml` | Modificar `deploy-rules-and-functions.needs` → agregar `rules-test`: `needs: [lint, test, functions-test, rules-test]`. |
| 7.3 | `.github/workflows/deploy-staging.yml` | Agregar el mismo job `rules-test` despues de `functions-test`. |
| 7.4 | `.github/workflows/deploy-staging.yml` | Modificar `deploy-rules-and-functions.needs` → agregar `rules-test`. |
| 7.5 | terminal | Validar YAML syntactically: `cat .github/workflows/deploy.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin)"` (si python esta disponible) o usar `npx yaml-lint`. |
| 7.6 | terminal | NO ejecutar el workflow localmente. La validacion E2E del job pasa al PR. Si falla en CI, fix forward (diagnosticar log del runner). |

**Decision NOT-DOING**: NO agregamos paths filter en este PR. El trigger sigue siendo `push` a `main`/`staging`. Si en el futuro el costo de Actions se vuelve relevante, abrir followup para sumar `on.pull_request.paths`.

### Fase 8 — Cross-refs en PRDs/specs anteriores (OBS Sofia C2 #2)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 8.1 | `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/specs.md` | Agregar nota al final de la seccion correspondiente: "**Update (post #332 merge)**: infra `tests/rules/setup.ts` disponible. Followup tracked para migrar la tabla de verdad R12 (5 casos) a tests parametrizados. R6/R7/R12 ya cubiertos por `tests/rules/users.rules.test.ts`." |
| 8.2 | `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/plan.md` | Idem en la fase relevante (linea 28 y 408 segun PRD #332). |
| 8.3 | `docs/feat/security/251-usersettings-rules-fix/specs.md` | Agregar nota: "**Update (post #332 merge)**: infra disponible. Followup `tests/rules/userSettings.rules.test.ts` queda como issue separado." |
| 8.4 | `docs/feat/security/251-usersettings-rules-fix/plan.md` | Idem. |
| 8.5 | `docs/fix/security/289-firestore-rules-gaps/specs.md` | Agregar nota: "**Update (post #332 merge)**: infra disponible. Followup `tests/rules/sharedLists.rules.test.ts` y `listItems.rules.test.ts` quedan como issues separados (per-item validation de `followedTags` / `businessId`)." |
| 8.6 | `docs/fix/security/289-firestore-rules-gaps/plan.md` | Idem. |
| 8.7 | `docs/feat/security/300-security-critical-deps-appcheck-abuse/specs.md` | Agregar nota: "**Update (post #332 merge)**: R6 (profilePublic gate) y R7 (displayName charset) cubiertos por `tests/rules/users.rules.test.ts`. R14 (bootstrap admin) sigue cubierto por tests de Cloud Function (`functions/src/admin/claims.test.ts`) — no migra a rules tests." |
| 8.8 | `docs/feat/security/300-security-critical-deps-appcheck-abuse/plan.md` | Idem. |

### Fase 9 — Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 9.1 | `docs/reference/tests.md` | Agregar seccion `## Firestore Rules Tests` con: (a) como correr local (`npm run test:rules`), (b) como agregar un test nuevo (importar setup, usar helpers), (c) convencion de naming (`<collection>.rules.test.ts`), (d) snippet del helper `authedContext` y de un caso allow/deny tipico, (e) inventario plantilla minima con todas las colecciones de `firestore.rules` listadas como `[x] users` y `[ ] [ ] <coleccion>` para el resto. |
| 9.2 | `docs/reference/tests.md` | Actualizar el conteo de tests en el header de la pagina: 1829 → 1845 frontend (+16 nuevos tests de rules). |
| 9.3 | `docs/reference/devops.md` | Agregar nota en la seccion CI: "Job `rules-test` corre en `deploy.yml` y `deploy-staging.yml`. Gatea el deploy de rules. Script local: `npm run test:rules`." |
| 9.4 | `docs/reference/security.md` | En la seccion de Firestore rules, agregar pointer: "Tests de rules: ver `docs/reference/tests.md` seccion Firestore Rules Tests. Cobertura actual: users (R6/R7/R12). Inventario de pendientes en el mismo doc." |
| 9.5 | `docs/reference/project-reference.md` | Bump count de tests (1829 → 1845 frontend) y mencionar la suite nueva en el changelog si aplica al version bump. |
| 9.6 | `docs/_sidebar.md` | Agregar entries debajo del #332 PRD (linea ~175): `- [Specs](/feat/infra/332-firestore-rules-unit-testing-harness/specs.md)` y `- [Plan](/feat/infra/332-firestore-rules-unit-testing-harness/plan.md)`. |

### Fase 10 — Validacion final pre-merge

| Paso | Comando | Criterio |
|------|---------|----------|
| 10.1 | `npm run test:rules` | 16 tests pasan local. |
| 10.2 | `npm run test:run` | Frontend tests siguen pasando (no afectados). |
| 10.3 | `cd functions && npm run test:run && cd ..` | Functions tests siguen pasando (no afectados). |
| 10.4 | `npm run lint` | Lint pasa (incluyendo `tests/rules/**`). Si ESLint no incluye `tests/**`, verificar `eslint.config.js` o agregarlo. |
| 10.5 | `npm run build` | Build pasa (no debe afectar al build de Vite). |
| 10.6 | Push a `feat/332-...` | Abrir PR. Esperar que el job `rules-test` corra en GitHub Actions y pase. Si falla, fix forward. |

---

## Orden de implementacion

1. **Fase 1** (deps) — sin esto nada compila.
2. **Fase 2** (setup) — el suite lo necesita.
3. **Fase 3** (vitest config) — sin esto `npm run test:rules:ci` no encuentra los tests.
4. **Fase 4** (scripts) — habilita los comandos.
5. **Fase 5** (suite) — el primer test que valida el setup end-to-end.
6. **Fase 6** (comentarios en `firestore.rules`) — solo despues de que el suite pase, asi el comentario es honesto.
7. **Fase 7** (CI) — solo despues de que el suite pase local, asi sabemos que el job CI tiene chance de pasar.
8. **Fase 8** (cross-refs) — bloqueo de merge pero independiente del codigo.
9. **Fase 9** (docs) — obligatoria pre-merge.
10. **Fase 10** (validacion) — gate final antes de PR.

**Dependencias criticas**:
- Fase 5 requiere 1+2+3+4 completas.
- Fase 7 requiere 5 verde local (no podemos subir un job que falla por logica del suite).
- Fase 8-9 pueden hacerse en paralelo con 7.

---

## Riesgos

### R1 — Java no disponible en el Pi local

**Mitigacion**: si el dev local no tiene Java, `npm run test:rules` falla con mensaje claro. El dev puede correr `npm run test:rules:ci` (que asume emulador ya corriendo) si tiene el emulador levantado de otra forma, o simplemente confiar en el CI. **No bloquea el PR** — el CI tiene Java garantizado via `setup-java@v4`. Documentar en `tests.md` el requerimiento de Java local.

### R2 — Emulador toma >10s para arrancar (cold cache)

**Mitigacion**: `testTimeout: 10_000` en `vitest.rules.config.ts` cubre tests individuales, pero el `beforeAll` puede tomar mas. Si vemos timeouts en CI, bumpear `hookTimeout` a `30_000`. Trade-off aceptable porque la suite corre una vez por PR.

### R3 — Drift de version `@firebase/rules-unit-testing` vs Firebase SDK 12.x

**Mitigacion**: el paquete v3.x es compat con Firebase 12.x segun release notes. Si Firebase bumpea a 13.x en el futuro, validar el changelog del harness y bumpear. **Tracked como followup si surge**.

### R4 — Workflow de staging tiene `bash scripts/deploy-staging-rules.sh` (no `firebase deploy` directo)

**Mitigacion**: el job `rules-test` corre ANTES de ese step y no depende de su contenido. Si el script `.sh` cambia su comportamiento, el gate sigue valido. Solo agregamos `rules-test` a `needs:` del job `deploy-rules-and-functions` — no tocamos el script.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente. Los tests de `tests/rules/` SI importan `firebase/firestore` (es la firma del SDK que valida las rules) — boundary clara, no es runtime.
- [x] Archivos nuevos en carpeta de dominio correcta (`tests/rules/` root, no en `src/__tests__/`, no en `components/menu/`).
- [x] Logica de negocio en hooks/services, no en componentes — no aplica (no hay codigo runtime).
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — no aplica (`firestore.rules` solo recibe comentarios).
- [x] Ningun archivo resultante supera 400 lineas (validado en Fase 5.5).

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` en create + `affectedKeys().hasOnly()` en update — no aplica (no agregamos colecciones).
- [x] Todo campo string tiene `.size() <= N` en rules — no aplica.
- [x] Todo campo list tiene `.size() <= N` en rules — no aplica.
- [x] Admin writes tambien tienen validacion de campos — no aplica.
- [x] Counter decrements en triggers usan `Math.max(0, ...)` — no aplica.
- [x] Rate limits llaman `snap.ref.delete()` cuando exceden — no aplica.
- [x] Toda coleccion nueva escribible por usuarios tiene Cloud Function trigger con rate limit — no aplica.
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificar que `setup.ts` no tiene env vars hardcoded.
- [x] `getCountFromServer` → `getCountOfflineSafe` — no aplica.

### Defense-in-depth del harness (OBS Sofia C2 #1)

- [x] `RULES_TEST_PROJECT_ID = 'modo-mapa-rules-test'` es constante exportada, no se redeclara en suites.
- [x] El harness siempre pinea `host: 'localhost'` y `port: 8080` — nunca alcanza Firestore real.
- [x] Verificar pre-merge: `grep -rn 'modo-mapa-rules-test' .firebaserc package.json` → solo en setup.ts.

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — no aplica (no agregamos triggers).
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — no aplica.
- [x] Todo `trackEvent` nuevo esta registrado — no aplica.
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — no aplica.

## Guardrails de accesibilidad y UI

No aplica — la feature no toca UI.

## Guardrails de copy

No aplica — la feature no agrega strings user-facing.

---

## Fase final: Documentacion (OBLIGATORIA)

Ya cubierto en Fase 9. Lista explicita:

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/tests.md` | Nueva seccion `## Firestore Rules Tests` + inventario plantilla minima + bump count tests |
| 2 | `docs/reference/devops.md` | Nota sobre nuevo job CI y script local |
| 3 | `docs/reference/security.md` | Pointer a tests de rules en la seccion Firestore |
| 4 | `docs/reference/project-reference.md` | Bump count tests + mencion suite nueva |
| 5 | `docs/_sidebar.md` | Entries Specs + Plan debajo del PRD #332 |
| 6 | `docs/feat/security/322-.../plan.md` y `specs.md` | Cross-ref a infra disponible |
| 7 | `docs/feat/security/251-.../plan.md` y `specs.md` | Cross-ref |
| 8 | `docs/fix/security/289-.../plan.md` y `specs.md` | Cross-ref |
| 9 | `docs/feat/security/300-.../plan.md` y `specs.md` | Cross-ref |

NO aplican: `docs/reference/firestore.md` (no agregamos colecciones), `docs/reference/features.md` (no es feature user-facing), `docs/reference/patterns.md` (no agregamos hook/service/patron de UI), `src/components/menu/HelpSection.tsx` (no cambia comportamiento visible al usuario).

---

## Criterios de done

- [ ] `npm ls @firebase/rules-unit-testing firebase-tools` → ambos instalados con pins correctos (Success Criteria #1)
- [ ] `tests/rules/setup.ts` existe y exporta el contrato completo (Success Criteria #2)
- [ ] `tests/rules/users.rules.test.ts` tiene >= 16 tests pasando (Success Criteria #3)
- [ ] `npm run test:rules` corre local con emulador automatico y pasa (Success Criteria #4)
- [ ] Job `rules-test` agregado a `deploy.yml` Y `deploy-staging.yml` como `needs:` (Success Criteria #5)
- [ ] `docs/reference/tests.md` tiene seccion `## Firestore Rules Tests` con inventario plantilla minima (Success Criteria #6)
- [ ] Regression sentinel automatizado documentado en `users.rules.test.ts` (Success Criteria #7)
- [ ] Cross-refs aplicadas en specs/plans de #322, #251, #289, #300 (OBS Sofia C2 #2)
- [ ] Comentario `// covered by ...` adyacente a R12 en `firestore.rules` (OBS Sofia C2 #3)
- [ ] `RULES_TEST_PROJECT_ID` validado != prod/staging projectIds (OBS Sofia C2 #1)
- [ ] `npm run lint` pasa
- [ ] `npm run build` pasa
- [ ] `npm run test:run` (frontend) y `cd functions && npm run test:run` siguen pasando
- [ ] `docs/_sidebar.md` actualizado con Specs y Plan entries
- [ ] PR abierto con todos los gates verdes en CI (incluyendo job `rules-test`)

---

## Validacion de Plan

(Pending — invocar `pablo` con el prompt indicado en el agent template.)

---

## Validacion de Plan

**Fecha:** 2026-05-16
**Estado:** VALIDADO CON OBSERVACIONES
**Analista:** Pablo (delivery-lead) — Ciclo 1 unico

### Contexto revisado

- PRD: docs/feat/infra/332-firestore-rules-unit-testing-harness/prd.md (sello Sofia: VALIDADO CON OBSERVACIONES, 2026-05-16)
- Specs: docs/feat/infra/332-firestore-rules-unit-testing-harness/specs.md (Validacion Tecnica: Pending — ver OBS #1)
- Plan: 10 fases, sin agentes paralelos explicitos (implementador unico)
- Verificaciones de campo:
  - `firestore.rules` linea 42 (R12 create) y linea 73 (R12 update) — coinciden con la intencion del plan (que dice "linea ~39" y "linea ~61", usando "~" como aproximacion aceptable).
  - `.firebaserc` solo declara projectId `modo-mapa-app` — confirma que `modo-mapa-rules-test` no colisiona.
  - `.github/workflows/deploy.yml` linea 46 y `deploy-staging.yml` linea 52 tienen `needs: [lint, test, functions-test]` — el delta del plan agrega `rules-test` correctamente.
  - `docs/_sidebar.md` lineas 176-177 ya contienen los entries Specs+Plan del #332 (paso 9.6 idempotente; ver OBS #3).
  - `vitest.config.ts` no tiene `tests/**` en `exclude` actualmente — paso 3.2 propone agregarlo defensive (correcto).
  - `scripts/deploy-staging-rules.sh` existe — confirma R4 del plan (gate va ANTES del step, no toca el script).
  - Test count actual: 1829 frontend (`project-reference.md` L109). Plan dice 1829 → 1845 (+16). Aritmetica correcta.

### Cobertura specs → plan

Verificado item por item:
- setup.ts (specs S2) → Fase 2. **Cubierto.**
- users.rules.test.ts 16 tests (specs S3) → Fase 5.1-5.3. **Cubierto.**
- vitest.rules.config.ts (specs L344-L364) → Fase 3. **Cubierto.**
- Scripts `test:rules` + `test:rules:ci` (specs L379-L391) → Fase 4. **Cubierto.**
- Comentario adyacente a R12 en `firestore.rules` (specs L43-L65) → Fase 6. **Cubierto.**
- Job CI en ambos workflows (specs L401-L442) → Fase 7. **Cubierto.**
- Cross-refs en 4 PRDs anteriores (specs L129-L136) → Fase 8 (8 sub-pasos). **Cubierto.**
- Docs: tests.md, devops.md, security.md, project-reference.md, _sidebar.md (specs L124-L128) → Fase 9. **Cubierto.**

Out-of-scope respetados: NO migra tests de #322 (tabla de verdad completa), NO toca storage.rules, NO agrega tests de userSettings/feedback/notifications/etc. ✓

### OBSERVACION #1: Specs sin sello de Diego

**Seccion del plan**: aplica al protocolo de revision, no al plan en si.
**Problema de delivery**: el specs cierra con "Validacion Tecnica — (Pending — invocar `diego`...)". Por protocolo formal Pablo no deberia validar plan sin sello previo de Diego en specs. El usuario reporto "PRD/specs validados por Sofia", pero Sofia valida solo PRD; specs lo valida Diego.
**Escenario concreto**: si el specs tiene errores tecnicos (firma de `initializeTestEnvironment`, signature del harness v3, formato del `vitest.workspace`, etc.) que Diego habria detectado, el plan los va a heredar y la implementacion los va a chocar.
**Que necesitamos**: ejecutar `diego` (tech-architect) sobre specs.md antes de implementar, o que manu/usuario confirme explicitamente que el bypass de Diego es consciente (la feature es test infra acotada, sin runtime, archivos chicos, riesgo tecnico bajo) y aceptado.

### OBSERVACION #2: Paso 9.6 (`_sidebar.md`) ya esta aplicado

**Seccion del plan**: Fase 9, paso 9.6.
**Problema de delivery**: el plan agenda agregar entries `Specs` y `Plan` debajo del PRD #332, pero `docs/_sidebar.md` lineas 175-177 ya los contiene (probablemente quedo del workflow al crear PRD/specs).
**Escenario concreto**: el implementador puede pasar el paso o, si re-aplica, agregar duplicados. Riesgo bajo si el implementador hace `grep` previo.
**Que necesitamos**: el paso 9.6 puede recodificarse como "verificar que los entries existen; si no, agregarlos" — no rompe nada, pero evita confusion durante la implementacion.

### OBSERVACION #3: Fase 10.4 puede requerir tocar `eslint.config.js`

**Seccion del plan**: Fase 10, paso 10.4.
**Problema de delivery**: el plan dice "Si ESLint no incluye `tests/**`, verificar `eslint.config.js` o agregarlo". `eslint.config.js` no esta en la tabla de archivos modificados de specs (L116-L137). Si efectivamente hay que agregarlo, el plan deberia anticiparlo como modificacion conocida — no como contingencia descubierta en Fase 10.
**Escenario concreto**: el implementador llega a 10.4, descubre que ESLint no recorre `tests/**`, y entra en modo "fix on the fly" agregando una entrada al config en el ultimo paso. Esto suele dejar configs subideales (patterns muy amplios) o crear un mini-debate al revisar el PR.
**Que necesitamos**: pre-verificar antes de Fase 1 si `tests/**` ya esta cubierto por ESLint (`grep -n "tests" eslint.config.js` o equivalente). Si no esta, agregar `eslint.config.js` a la tabla de archivos modificados y crear un paso explicito (ej. Fase 3.4 o nuevo) que agregue el include.

### OBSERVACION #4: Hard-fail del job CI puede bloquear deploys legitimos

**Seccion del plan**: Fase 7 (job `rules-test` en `needs:` de `deploy-rules-and-functions`).
**Problema de delivery**: el plan (alineado con specs D6) elige hard-fail sin retry. Si una corrida del emulador en CI tiene cold-start flaky (puerto 8080 ocupado por restos de runs anteriores, descarga corrupta del emulator jar, Java timeout en setup-java@v4), el deploy de rules queda bloqueado y el siguiente push a `main` o `staging` falla hasta que un humano re-trigger el workflow.
**Escenario concreto**: hotfix urgente de prod necesita mergear rule de seguridad. Job `rules-test` falla por flakiness de emulador. Deploy queda gateado. Operador debe re-trigger o saltar gate (sin protocolo de bypass documentado).
**Que necesitamos**: documentar el procedimiento de bypass (por ejemplo: "si rules-test falla por flakiness no relacionada a las rules, comentar `[skip rules-test]` en el commit message" o "re-run del job en GitHub UI"). No hace falta automatizar — alcanza con anclar la decision en `docs/reference/devops.md` o en el `R1-R4` del plan.

### OBSERVACION #5: Falta verificacion explicita de Java en Fase 1

**Seccion del plan**: Fase 1, paso 1.4.
**Problema de delivery**: el paso `npx firebase-tools --version` valida que el bin esta instalado, pero NO valida que Java este disponible localmente (requerido para `firebase emulators:exec` en Fase 5.4). Si el Pi no tiene Java, Fase 5.4 falla y el implementador descubre el requisito tarde.
**Escenario concreto**: implementador completa Fase 1-4 sin friccion. Llega a Fase 5.4, `npm run test:rules` falla con `java: command not found` o equivalente. Friccion + reinstall de Java + retry.
**Que necesitamos**: agregar paso `1.6` (o equivalente): "verificar `java -version` retorna 11+. Si no, documentar como skip de Fase 5.4 local y confiar en CI (que tiene `setup-java@v4` garantizado)". Plan ya menciona el riesgo en R1 pero no lo eleva a step explicito del check operacional.

### Cerrado en esta iteracion (sin Ciclo 2 — todo es OBSERVACION)

- OBSERVACION #1 → escalable a usuario/manu (sin sello de Diego pero feature de bajo riesgo tecnico)
- OBSERVACION #2 → minor (paso idempotente, no rompe)
- OBSERVACION #3 → preventiva (anticipar ESLint config)
- OBSERVACION #4 → preventiva (documentar bypass del gate CI)
- OBSERVACION #5 → preventiva (verificacion Java local)

### Observaciones para la implementacion

- **Antes de Fase 1**: confirmar con usuario si se procede sin sello de Diego (OBS #1). Si manu acepta el riesgo dado el scope (test infra, no runtime), proceder.
- **En Fase 1**: agregar check de Java local. Si no esta, documentar fallback (skip 5.4 local, confiar en CI).
- **En Fase 3**: pre-verificar cobertura de ESLint sobre `tests/**` y, si falta, anclar el cambio a `eslint.config.js` como archivo modificado conocido.
- **En Fase 7**: documentar procedimiento de bypass del job `rules-test` en caso de flakiness (re-run manual desde GH Actions UI).
- **En Fase 9**: `_sidebar.md` paso 9.6 ya esta aplicado — verificar antes de re-aplicar.
- El plan es coherente con specs en cobertura, orden, granularidad, risk staging y rollback. No hay BLOQUEANTES de delivery.

### Listo para pasar a implementacion?

**Si con observaciones**, condicionado a:

1. Confirmacion del usuario/manu sobre el bypass del sello de Diego (OBS #1), o ejecucion previa de `diego` sobre specs.
2. Aplicacion de las 4 observaciones preventivas (#2, #3, #4, #5) como ajustes inline durante la implementacion — ninguna requiere re-spawning del specs-plan-writer.
