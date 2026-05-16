# PRD: Firestore rules unit testing — montar @firebase/rules-unit-testing harness

**Feature:** 332-firestore-rules-unit-testing-harness
**Categoria:** infra
**Fecha:** 2026-05-16
**Issue:** [#332](https://github.com/benoffi7/modo-mapa/issues/332)
**Issues relacionadas:** [#322](https://github.com/benoffi7/modo-mapa/issues/322) (firestore rules hardening — usa esta infra para cubrir R12/R14), [#300](https://github.com/benoffi7/modo-mapa/issues/300) (R6/R7 a cubrir), [#251](https://github.com/benoffi7/modo-mapa/issues/251) (userSettings rules — quedo sin tests directos)
**Prioridad:** Alta (desbloquea cobertura automatizada de TODOS los cambios futuros en `firestore.rules`)

---

## Contexto

El proyecto tiene `firestore.rules` con 776 lineas que cubren 20+ colecciones con type guards, `keys().hasOnly()`, `affectedKeys()`, regex de charset (R7), bidireccionalidad de `displayNameLower` (R12), bootstrap admin gate (R14) y rate limits server-side. La cobertura actual del archivo es **cero tests automatizados**: tres rondas de auditoria de seguridad (#251, #289, #300, #322) planearon usar `@firebase/rules-unit-testing` pero ninguna lo instalo. Cada PRD posterior tuvo que elegir entre (a) cubrir indirectamente via tests de Cloud Functions/triggers, (b) verificacion manual contra el emulador, o (c) no cubrir. Las specs de #322 explicitan que la verificacion de R12 (equality bidireccional `displayNameLower == displayName.lower()`) y los 5 casos de la tabla de verdad estan **out-of-scope hasta que #332 mergee**. Sin esta infra, cada hardening de rules degrada a "test manual + confianza en que las rules estan bien escritas".

## Problema

- **Cero cobertura automatizada de `firestore.rules`**: 776 lineas de logica de seguridad sin un solo test. `grep -rn "rules-unit-testing\|RulesTestEnvironment" .` confirma que el paquete no esta instalado ni hay setup.
- **Deuda acumulada de 4 PRDs**: #251, #289, #300, #322 documentaron escenarios concretos que deberian estar cubiertos (R6 profilePublic filter, R7 displayName charset, R12 bidireccional, R14 bootstrap gate, userSettings hasOnly, feedback.message type guard, notifications.read type guard) y los dejaron como deuda explicita.
- **Cada PRD de rules paga el costo de "decidir si vale la pena instalar la infra"**: el costo de bootstrap (instalar paquete + configurar emulador en CI + escribir el primer setup) es no trivial (1-2 dias) y compite con el scope del feature en si. Resultado: nadie lo paga, todos lo difieren.
- **Verificacion manual no escala**: los 5 casos de tabla de verdad de R12, los 7+ casos de userSettings update, los path traversal de menuPhotos — son demasiados para validar a mano en cada cambio de rules. Las regresiones silenciosas (alguien edita una rule y rompe un guard sin notarlo) no tienen red de seguridad.

## Solucion

Montamos infraestructura completa de unit testing de Firestore rules, con un primer test suite de referencia que cubre los invariantes mas criticos del guard 300-security (R6, R7, R12). El objetivo no es cubrir todas las rules en este PRD — es **abrir la puerta** para que cada PRD futuro de rules pueda agregar 5-10 tests sin pagar el costo del bootstrap.

### S1 — Instalar dependencia y wiring basico

- Agregar `@firebase/rules-unit-testing` como `devDependency` en `package.json` (root). Version compatible con Firebase 12.x (12.x del SDK acepta el harness v3.x).
- Agregar `firebase-tools` como `devDependency` con version pin compatible con `@firebase/rules-unit-testing` v3 (probablemente `^13.x`). **Razon**: install rapido via cache de npm de CI, version controlada y reproducible. **Descartadas**: instalacion global (riesgo de drift entre runner y dev local), `npx firebase-tools` (re-download cada run, suma minutos de Actions).
- Verificar que `firebase.json` ya tiene `emulators.firestore` configurado (port 8080, confirmado).
- Agregar variable de entorno `FIRESTORE_EMULATOR_HOST=localhost:8080` que el harness lee automaticamente.

### S2 — Setup factory reutilizable

**Decision de path**: el proyecto NO tiene una convencion `src/__tests__/` — la convencion existente es `src/<dominio>/__tests__/` (tests colocados con el codigo TS que prueban). Los rules tests **no testean codigo TS**: prueban el archivo `firestore.rules` del root contra un emulador. Por eso vivimos **fuera de `src/`** en `tests/rules/`. Justificacion: encajar bajo un dominio `src/<algo>/__tests__/` seria forzado (no hay codigo TS bajo prueba); usar `src/__tests__/rules/` rompe la convencion existente. `tests/rules/` deja claro que es una suite de root, paralela al deploy de `firestore.rules`.

Crear `tests/rules/setup.ts` con un factory `createRulesTestEnv()` que:

- Llama a `initializeTestEnvironment({ projectId: 'modo-mapa-rules-test', firestore: { rules: readFileSync(rulesPath, 'utf8'), host: 'localhost', port: 8080 } })`.
- **Contrato de path**: `rulesPath = path.resolve(__dirname, '../../firestore.rules')` — relativo al archivo de setup (`tests/rules/setup.ts`), apunta a `firestore.rules` del root. Cada llamada a `createRulesTestEnv()` lee fresh el archivo desde disco. **NO** se cachea el env globalmente entre suites — cada test suite que necesite env propio llama al factory en `beforeAll`/`beforeEach`, garantizando refresh-on-rerun cuando el archivo `firestore.rules` cambia entre corridas (relevante en watch mode local y en CI con cache).
- Expone helpers tipados: `authedContext(uid: string, extra?: { token?: object })` y `unauthedContext()` que retornan `RulesTestContext` con `firestore()`.
- Provee helpers de aserciones `expectAllow(promise)` y `expectDeny(promise)` que wrappean `assertSucceeds` y `assertFails`.
- Expone `clearFirestore()` y `cleanup()` para usar en `beforeEach`/`afterAll`.
- Provee helper `withAdminContext(env, fn)` para escribir docs de bootstrap saltando rules (usa `env.withSecurityRulesDisabled`).

Patron del helper sigue el patron `vi.hoisted()` del proyecto (ver `feedback_vitest_mock_patterns.md`).

### S3 — Primer test suite de referencia: `users.rules.test.ts`

Crear `tests/rules/users.rules.test.ts` cubriendo los invariantes mas criticos del guard 300-security. Lista canonica de tests (>= 16):

- **R6 (`hasOnly` whitelist en users)** — 4 tests:
  1. `create` con campo extra (fuera del whitelist) → **deny**.
  2. `create` sin campo requerido (ej: falta `displayName`) → **deny**.
  3. `update` agregando campo nuevo no listado en `affectedKeys().hasOnly()` → **deny**.
  4. `create` con todos los campos del whitelist y nada mas → **allow**.

- **R7 (displayName charset + length)** — 5 tests:
  1. `displayName.size() < 1` (string vacio) → **deny**.
  2. `displayName.size() > 30` → **deny**.
  3. `displayName` con caracteres fuera del regex (ej: `"Juan!"`, `"Juan."`, `" Juan"`) → **deny**.
  4. `displayName` valido (`"Pedro_Garcia"`) → **allow**.
  5. `displayName` whitespace edge (`"   "` all whitespace) → **deny**.

- **R12 (`displayNameLower` bidireccional)** — 5 tests (tabla de verdad de specs #322 L240-247):
  1. `displayNameLower != displayName.lower()` → **deny**.
  2. `displayNameLower == displayName.lower()` → **allow**.
  3. `create` con `displayName` presente pero `displayNameLower` ausente → **deny**.
  4. `update` unidireccional: cambia solo `displayName` sin actualizar `displayNameLower` → **deny**.
  5. `update` bidireccional: cambia ambos campos en sync → **allow**.

- **`hasOnly` field injection (campo solo permitido en update)** — 2 tests:
  1. `update` que afecta unicamente `displayName` (campo whitelisted) → **allow**.
  2. `update` que afecta `displayName` + un campo extra (ej: `isAdmin`) → **deny**.

**Total: 16 tests**. Cobertura de las rules `users/{userId}` create + read + update.

**Regression sentinel** (IMP #2): el test "R12 - update bidireccional: cambia ambos campos en sync → allow" + el "update unidireccional → deny" cubren la rama exacta del invariante `displayNameLower == displayName.lower()`. Si alguien remueve el check bidireccional de `firestore.rules`, el test "update unidireccional → deny" pasa a fallar (permitiria una escritura que deberia denegarse). Esto convierte la garantia en regresion automatizada versionada — no walkthrough manual. Documentar este sentinel con un comentario en el archivo de test:

```ts
// Regression sentinel: si se remueve el check bidireccional (displayNameLower == displayName.lower())
// de firestore.rules, el test "R12 update unidireccional -> deny" pasa a allow y falla aca.
```

### S4 — Wiring a `npm run test:run` con emulador automatico

El reto operacional es que las rules tests requieren el emulador Firestore corriendo. Dos modos:

- **Local (dev)**: usuario corre `npm run test:rules` que internamente hace `firebase emulators:exec --only firestore "vitest run tests/rules"`. Script nuevo en `package.json`.
- **CI**: nuevo job `rules-test` (a) en `.github/workflows/deploy.yml` (prod) como `needs:` del step que despliega rules y (b) **tambien en `.github/workflows/deploy-staging.yml`** como `needs:` del step "Deploy Firestore rules and indexes to staging database" (linea 70). **Justificacion (BLOQ #2)**: staging-DB tambien necesita protegerse — si dejamos el gate solo en prod, una regresion puede llegar a staging y romperla antes de promover. El gate va a ambos workflows. El job (a) instala deps con cache de npm (`firebase-tools` cached), (b) cachea el Java/emulator, (c) corre `firebase emulators:exec --only firestore "npm run test:rules:ci"` donde `test:rules:ci` es `vitest run --config vitest.rules.config.ts`.

**Tiempo estimado del job CI (IMP #4)**: ~2-4 min total (install firebase-tools cached + Java/emulator cached + 16 tests). Sin caches, puede subir a 5-7 min la primera corrida. Si el emulador **falla a levantar** (puerto 8080 ocupado, Java no disponible, descarga corrupta), el job **hard-fails sin retry** — la unica salida valida es fix forward. Mensaje de error claro emitido por el script: `"Firestore emulator failed to start on port 8080 — check if another process holds the port"`. No usamos retry automatico porque enmascara problemas reales del runner.

**Paths filter opcional (OBS #2)**: el job puede limitarse a triggers que toquen archivos relevantes, para ahorrar minutos de Actions en PRs que no tocan rules:

```yaml
on:
  pull_request:
    paths:
      - 'firestore.rules'
      - 'tests/rules/**'
      - 'package.json'
      - 'package-lock.json'
      - 'vitest.rules.config.ts'
```

No es obligatorio (correr en todos los PRs da mas seguridad), pero se evalua al implementar.

Crear `vitest.rules.config.ts` separado del `vitest.config.ts` principal porque:

- Las rules tests son `node` (no `jsdom`) — el harness corre en Node y no necesita DOM.
- Excluir del coverage global (no son coverage de codigo TS).
- Timeout mas alto (10s vs 5s default) porque cada test inicializa env contra emulador.

El `npm run test:coverage` actual NO incluye las rules tests (para no requerir emulador en cada run de coverage local). Las rules tests corren en su propio job de CI.

### S5 — Documentar el patron en `docs/reference/tests.md`

Agregar seccion `## Firestore Rules Tests` con:

- Como correr local (`npm run test:rules`).
- Como agregar un test nuevo (importar setup, usar helpers).
- Convencion de naming (`<collection>.rules.test.ts`).
- Lista de invariantes cubiertos vs pendientes (al cierre: solo users; resto queda como inventario para PRDs futuros).
- Snippet del helper `authedContext` y de un caso allow/deny tipico.

**Plantilla minima del inventario (OBS #1)** — una linea por cada `match /collection/{x}` en `firestore.rules`, con dos checkboxes (allow + deny) y link al PRD/specs que documenta el invariante de origen. Ejemplo:

```markdown
### Inventario de cobertura de rules

- [x] users — cubierto en `tests/rules/users.rules.test.ts` (R6/R7/R12/hasOnly, ver #322 specs L240-247 y #300)
- [ ] [ ] userSettings — pendiente. Invariante: hasOnly + type guards. Origen: #251 specs L144 y L204
- [ ] [ ] feedback — pendiente. Invariante: message.size() <= 500 + type guard. Origen: #289
- [ ] [ ] notifications — pendiente. Invariante: solo update de campo `read`. Origen: #289
- [ ] [ ] comments — pendiente. Invariante: rate limit (server-side) + ownership. Origen: rules L###
- [ ] [ ] ratings — pendiente. Origen: rules L###
- [ ] [ ] sharedLists — pendiente. Invariante: per-item validation followedTags. Origen: #289
- [ ] [ ] listItems — pendiente. Invariante: per-item businessId validation. Origen: #289
- [ ] [ ] customTags — pendiente.
- [ ] [ ] (...continuar por cada coleccion del archivo)
```

Cada `[ ] [ ]` representa "allow path test" + "deny path test". La meta es marcar ambos cuando el PRD futuro agrega tests para esa coleccion.

### S6 — Actualizar referencias en specs/PRDs existentes que difirieron tests

#322 specs L1098, #322 plan L28 y L408, #251 specs L144 y L204 dicen "out of scope, tracked en #332". Una vez mergeado este PRD, agregar una nota en cada uno indicando que la infra ya existe y que las migraciones de tests de rules quedan como followups en sus propios issues si no se hicieron aca. **No** vamos a migrar los 5 casos de #322 en este PRD — solo dejamos el suite de referencia con users. El followup de #322 (migrar la tabla de verdad bidireccional a tests automatizados) puede abrirse como sub-issue separado cuando este PRD mergee.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — Instalar `@firebase/rules-unit-testing` + `firebase-tools` (devDep, `^13.x` compat con harness v3) + env var FIRESTORE_EMULATOR_HOST | Alta | S |
| S2 — `tests/rules/setup.ts` factory + helpers (authedContext, unauthedContext, expectAllow, expectDeny, clearFirestore, withAdminContext) con `path.resolve(__dirname, '../../firestore.rules')` y refresh-on-rerun | Alta | M |
| S3 — `tests/rules/users.rules.test.ts` suite de referencia (16 tests, R6+R7+R12+hasOnly) + regression sentinel comment | Alta | M |
| S4 — `vitest.rules.config.ts` + scripts `test:rules` y `test:rules:ci` en package.json | Alta | S |
| S4 — Job `rules-test` en `.github/workflows/deploy.yml` (prod) **y** en `.github/workflows/deploy-staging.yml` (staging) con `firebase emulators:exec`, hard-fail sin retry, paths filter opcional | Alta | S |
| S5 — Seccion `## Firestore Rules Tests` en `docs/reference/tests.md` (patron + ejemplos + inventario plantilla minima) | Media | S |
| S6 — Nota cross-referencia en specs/plan de #322, #251, #289, #300 (out-of-scope ahora resuelto) | Baja | S |

**Esfuerzo total estimado:** M-L (1-2 dias en una sesion focused; la mayor parte es trial-and-error del CI con `firebase emulators:exec` y rate limits del workflow runner).

---

## Out of Scope

- **No cubrir todas las colecciones en este PRD.** Solo `users` (16 tests, los invariantes mas auditados). El resto se cubre incrementalmente en PRDs futuros que toquen cada coleccion.
- **No migrar los tests de #322 (tabla de verdad bidireccional) automatizados aca.** Se deja inventariado en `tests.md` como pendiente. La razon: si los migramos en este PRD, el scope crece a XL y bloqueamos mergear la infra.
- **No mockear el emulador.** Los tests corren contra Firestore emulator real (lo que el harness hace por diseno). Si el emulador no esta corriendo, los tests fallan con mensaje claro — el script `npm run test:rules` se encarga de levantarlo.
- **No reemplazar tests de Cloud Functions.** Triggers y callables siguen testeandose como hoy (mock de SDK). Las rules tests cubren la capa **declarativa** (que escribe el cliente directamente), no los flows mediados por Functions.
- **No agregar tests de Storage rules.** `storage.rules` queda fuera de este PRD (es archivo separado, paquete soporta `storage: { rules, host, port }` pero requiere su propio emulador port 9199). Tracked como followup si se necesita.

---

## Tests

Esta feature **es** una infra de tests. La meta-cobertura aplica asi:

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `tests/rules/setup.ts` | Test helper | Auto-validado: si el setup esta roto, todos los tests de S3 fallan. No necesita tests propios. |
| `tests/rules/users.rules.test.ts` | Test suite (es el deliverable, no algo a testear) | 16 tests cubriendo R6, R7, R12, hasOnly |

### Criterios de testing

- Los 16 tests de `users.rules.test.ts` deben pasar en CI con emulador.
- Los tests deben fallar deterministicamente si alguien introduce una regresion en `firestore.rules` para la coleccion users (ej: relajar el regex de R7 o quitar el equality check de R12).
- Cobertura: no aplica `>= 80%` aca porque `firestore.rules` no es TypeScript — la metrica es "todos los invariantes documentados en specs estan cubiertos por al menos 1 test allow + 1 test deny".
- El job `rules-test` de CI debe gatear el deploy de rules (`needs:` lo bloquea si fallan).

---

## Seguridad

Este feature **no** introduce nuevas superficies de ataque — agrega tests. Las consideraciones aplican al codigo del harness, no al producto.

- [ ] **No exponer el emulador a Internet en CI**: el job de GitHub Actions corre el emulador en `localhost` del runner, sin port forwarding.
- [ ] **No commitear credenciales del emulador**: el emulador no requiere credenciales (corre en modo unauthenticated por diseno), pero verificar que ningun `.env` con `GOOGLE_APPLICATION_CREDENTIALS` apuntando a SA key se commitee.
- [ ] **No usar el harness contra produccion**: el `projectId` del harness (`modo-mapa-rules-test`) es distinto del real (`modo-mapa-app`). Si por error apunta al real, las escrituras de tests crearian docs reales — el harness solo opera contra emulador (`host: 'localhost'`), pero documentar el riesgo en `tests.md`.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A — feature interno (CI + tests) | N/A | N/A |

(No aplica: el feature no expone endpoints, no escribe a Firestore real, no agrega rules, no toca Storage.)

---

## Deuda tecnica y seguridad

Esta feature **resuelve** deuda tecnica de 4 PRDs anteriores. Es un habilitador.

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech debt" --state open --json number,title
```

Resultado: solo este issue (#332) y #339 (UI tech debt no relacionado). Las decisiones de "no instalar la infra" en #251, #289, #300, #322 estan documentadas en los specs/plans de esos PRDs pero no son issues abiertos.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #322 (Firestore rules hardening) | Mitiga: los 5 casos de tabla de verdad R12 documentados en specs L1098 quedan cubribles con esta infra | Cuando #322 ya mergeado (esta) + #332 mergea, abrir followup para migrar la tabla de verdad a `users.rules.test.ts`. NO migrar aca (out-of-scope). |
| #300 (R6 + R7 + R14) | Mitiga: R6 (profilePublic gate), R7 (displayName charset) y R14 (bootstrap admin) quedan cubribles | El suite de referencia de S3 cubre R6 + R7 directamente. R14 (bootstrap admin) no se cubre aca porque es logica en Cloud Function (`setAdminClaim`), no en rules — se testea en `functions/src/admin/claims.test.ts` aparte. |
| #251 (userSettings rules) | Mitiga: specs L144 y L204 explicitamente difieren tests automatizados | Inventariar en `tests.md` como "pendiente". Followup separado para crear `userSettings.rules.test.ts`. |
| #289 (sharedLists rate limit + rules field gaps) | Mitiga: per-item validation de followedTags / listItems.businessId | Inventariar en `tests.md` como "pendiente". |

### Mitigacion incorporada

- Instalacion de `@firebase/rules-unit-testing` (paso S1).
- Setup factory reutilizable (paso S2) — todos los PRDs futuros pueden importar de `tests/rules/setup.ts`.
- CI gate en deploy de rules (paso S4) — previene regresion futura en lo que SI esta cubierto.
- Documentacion del patron (paso S5) — baja la barrera para que el proximo PRD agregue su test sin re-investigar.

---

## Robustez del codigo

### Checklist de hooks async

(No aplica directamente — este feature no agrega hooks ni componentes. Los checks que SI aplican:)

- [ ] El setup factory de `setup.ts` cierra correctamente el env en `afterAll` (`await env.cleanup()`) para evitar leaks entre suites.
- [ ] El factory no exporta funciones que no se usen fuera de tests — todo queda en `tests/rules/`.
- [ ] No se importan constantes hardcodeadas para `projectId` ni para `host` — vienen de constantes del setup.
- [ ] `setup.ts` no debe superar 200 lineas (es factory + helpers, mantener compacto).
- [ ] `users.rules.test.ts` no debe superar 400 lineas (16 tests + helpers locales).

### Checklist de observabilidad

(No aplica — este feature no agrega Cloud Functions, services, ni trackEvent.)

- [ ] Los logs del job CI deben mostrar claramente "X tests passed, Y failed" para que sea diagnosticable cuando algo rompe.

### Checklist offline

(No aplica — este feature es de tests/CI, no toca runtime de la app.)

### Checklist de documentacion

- [ ] `docs/reference/tests.md` actualizado con seccion `## Firestore Rules Tests`.
- [ ] `docs/reference/security.md` actualizado con nota "Tests de rules: ver `docs/reference/tests.md`" en la seccion de Firestore rules.
- [ ] Cross-referencia en `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/plan.md` (linea 28 y 408) para indicar que la infra ya existe.
- [ ] `docs/reference/devops.md` actualizado con el nuevo script `npm run test:rules` y el job de CI.
- [ ] `docs/reference/project-reference.md` actualizado con el conteo de tests (16 nuevos).

---

## Offline

### Data flows

(No aplica — este feature no toca runtime de la app. Solo CI + tests.)

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] No aplica: el feature no agrega reads/writes runtime.

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] `setup.ts` vive en `tests/rules/` — carpeta dedicada, no en `src/utils/` ni en el barrel de tests existente.
- [x] Helpers expuestos por el setup son props-driven (reciben `env` o `uid` como params, no leen contexto global).
- [x] No se modifica `vitest.config.ts` principal — se agrega `vitest.rules.config.ts` separado para mantener separation of concerns.
- [x] No se agrega codigo nuevo a `src/components/`, `src/hooks/`, `src/services/` — es 100% test infra.
- [x] No se importa firebase SDK desde components: `@firebase/rules-unit-testing` solo se importa en `tests/rules/**`.
- [x] No se crea nuevo contexto global ni se agrega useState a layout.
- [x] Ningun archivo nuevo supera 400 lineas.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No toca components |
| Estado global | = | No agrega contexto |
| Firebase coupling | = | Nuevo import limitado a `tests/rules/**` (boundary clara, equivalente a un dominio test propio) |
| Organizacion por dominio | + | Crea nueva carpeta dedicada `__tests__/rules/`, no contamina otros dominios |

---

## Accesibilidad y UI mobile

(No aplica — este feature no toca UI.)

### Checklist de accesibilidad

- [x] No aplica: sin UI nueva.

### Checklist de copy

- [x] No aplica: sin strings user-facing nuevos. La documentacion en `tests.md` sigue las convenciones existentes (espanol, voseo no aplica en docs tecnicos).

---

## Success Criteria

1. `npm ls @firebase/rules-unit-testing firebase-tools` reporta ambos paquetes instalados (harness + CLI version-pinned).
2. Existe `tests/rules/setup.ts` exportando `createRulesTestEnv`, `authedContext`, `unauthedContext`, `expectAllow`, `expectDeny`, `clearFirestore`, `withAdminContext` y usando `path.resolve(__dirname, '../../firestore.rules')`.
3. Existe `tests/rules/users.rules.test.ts` con **>= 16 tests** segun la lista canonica de S3 (4 de R6/hasOnly create + 5 de R7 + 5 de R12 + 2 de hasOnly update), todos pasando contra el emulador.
4. `npm run test:rules` corre local y pasa (con emulador levantado automaticamente via `firebase emulators:exec`).
5. El job `rules-test` corre en **ambos** workflows: `.github/workflows/deploy.yml` (prod) **y** `.github/workflows/deploy-staging.yml` (staging) como `needs:` del step de deploy de rules, gateando el deploy si falla. Pasa en CI en ambos.
6. `docs/reference/tests.md` documenta el patron, los invariantes cubiertos por users.rules.test.ts, y el inventario plantilla minima (`[ ] [ ] <coleccion>` allow+deny) con todas las colecciones de `firestore.rules` listadas.
7. **Regression sentinel automatizado (no walkthrough manual)**: el comentario en `users.rules.test.ts` y los tests "R12 update unidireccional → deny" + "R12 update bidireccional → allow" garantizan que cualquier remocion del check bidireccional `displayNameLower == displayName.lower()` en `firestore.rules` hace fallar el suite. La verificacion es regresion en el suite versionado — no se require walkthrough manual al mergear.

---

## Validacion Funcional

**Fecha:** 2026-05-16
**Estado:** VALIDADO CON OBSERVACIONES
**Analista:** Sofia (functional-analyst) — Ciclo 2

Todos los hallazgos del Ciclo 1 cerrados (3 BLOQUEANTES + 4 IMPORTANTES + 2 OBS). Listo para specs-plan-writer.

### Observaciones residuales para el implementador

- Validar en specs/plan que `projectId` del harness (`modo-mapa-rules-test`) NO colisiona con projectIds reales (prod/staging).
- Al cerrar el PRD, ejecutar las cross-refs de S6 (actualizar specs/plans de #322, #251, #289, #300).
- Considerar agregar comentario `// covered by tests/rules/users.rules.test.ts` al lado del invariante R12 en `firestore.rules` para visibilidad del editor de rules.
