# Specs: Firestore rules unit testing — montar @firebase/rules-unit-testing harness

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-05-16
**Issue:** [#332](https://github.com/benoffi7/modo-mapa/issues/332)
**Issues relacionadas:** #322, #300, #289, #251

---

## Resumen tecnico

Esta feature **no toca runtime** (no agrega hooks, services, components, ni Cloud Functions). Es una infra de testing nueva, con un primer suite de referencia para `users`. Los entregables son:

1. Dependencias nuevas: `@firebase/rules-unit-testing` v3.x + `firebase-tools` v13.x como `devDependencies`.
2. Carpeta nueva `tests/rules/` con `setup.ts` (factory + helpers) y `users.rules.test.ts` (16 tests).
3. Vitest config separado `vitest.rules.config.ts` (env Node, sin coverage thresholds, timeout 10s).
4. Scripts nuevos `test:rules` (local) y `test:rules:ci` en `package.json`.
5. Job `rules-test` en `.github/workflows/deploy.yml` **y** `.github/workflows/deploy-staging.yml` como `needs:` del step de deploy de rules.
6. Doc nueva: seccion `## Firestore Rules Tests` en `docs/reference/tests.md` con inventario plantilla minima.
7. Cross-refs en specs/plans de #322, #251, #289, #300 indicando que la infra ya existe.

---

## Modelo de datos

No aplica. La feature no introduce ni modifica colecciones de Firestore. Los tests del suite `users.rules.test.ts` operan contra un emulador con `projectId` aislado (`modo-mapa-rules-test`) que **nunca** se persiste a prod/staging.

### Aislamiento de projectId del harness

| projectId | Uso | Backend |
|-----------|-----|---------|
| `modo-mapa-rules-test` | Harness de tests (S2/S3) | Emulador Firestore en `localhost:8080` |
| `modo-mapa-app` (production) | Prod runtime + workflows `deploy.yml` | Firestore real, default DB |
| `modo-mapa-app` con `databaseId=staging` | Staging runtime + workflow `deploy-staging.yml` | Firestore real, named DB `staging` |

**Verificacion (OBS Sofia C2 #1)**: el id `modo-mapa-rules-test` se elige porque (a) no matchea `modo-mapa-app` que es el unico projectId real, (b) el sufijo `-rules-test` es semantico y dificil de confundir con un alias real, (c) el harness `initializeTestEnvironment` solo se conecta a `localhost:8080` (firma `firestore: { host: 'localhost', port: 8080 }`) — incluso si el projectId colisionara, no llega a Firestore real. **Constante exportada** desde `setup.ts` como `RULES_TEST_PROJECT_ID = 'modo-mapa-rules-test'` para que ningun test lo redeclare. Si en el futuro se agregan suites adicionales (ej. `userSettings.rules.test.ts`), todas importan la constante — no hay rehardcode.

## Firestore Rules

**No se modifica `firestore.rules` en este feature**, con una unica excepcion textual sin cambio semantico (OBS Sofia C2 #3):

### Comentario adyacente a R12 (visibilidad para editores de rules)

En `firestore.rules`, agregar comentario `// covered by tests/rules/users.rules.test.ts` justo antes del bloque R12 (linea ~39 en create y ~61 en update) para que cualquier futuro editor de la rule sepa que existe regression sentinel automatizado:

```javascript
// covered by tests/rules/users.rules.test.ts (R12 - bidireccional displayNameLower)
// #322 S3 R12: equality bidireccional. displayNameLower obligatorio en create
// (ya esta en keys().hasOnly) y debe ser exactamente displayName.lower().
&& request.resource.data.displayNameLower == request.resource.data.displayName.lower()
```

Y en update (linea ~61):

```javascript
// covered by tests/rules/users.rules.test.ts (R12 - bidireccional displayNameLower en update)
// #322 S3 R12: equality bidireccional. Si CUALQUIERA de displayName o
// displayNameLower esta en affectedKeys(), AMBOS deben matchear...
&& (
  (!('displayName' in request.resource.data.diff(resource.data).affectedKeys())
    && !('displayNameLower' in request.resource.data.diff(resource.data).affectedKeys()))
  || (request.resource.data.displayNameLower == request.resource.data.displayName.lower())
);
```

**No** se cambia ninguna logica de rule. El comentario es metadata.

### Rules impact analysis

No aplica — la feature no agrega queries nuevas.

### Field whitelist check

No aplica — no se agregan ni modifican campos.

## Cloud Functions

No aplica.

## Seed Data

No aplica. La feature no introduce colecciones ni campos nuevos. El emulador del harness se limpia entre tests via `clearFirestore()` y no requiere seed.

## Componentes

No aplica.

### Mutable prop audit

No aplica.

## Textos de usuario

No aplica. La feature no agrega strings user-facing. La doc en `tests.md` es tecnica.

## Hooks

No aplica.

## Servicios

No aplica.

---

## Archivos a crear / modificar

### Nuevos archivos

| Path | Tipo | Proposito |
|------|------|-----------|
| `tests/rules/setup.ts` | Test helper (Node) | Factory `createRulesTestEnv()`, helpers `authedContext`, `unauthedContext`, `expectAllow`, `expectDeny`, `clearFirestore`, `withAdminContext`. Constante `RULES_TEST_PROJECT_ID`. |
| `tests/rules/users.rules.test.ts` | Test suite (Node) | 16 tests cubriendo R6, R7, R12, hasOnly de la rule `match /users/{userId}`. |
| `vitest.rules.config.ts` | Config Vitest | Config separado, env `node`, excluye coverage thresholds, timeout 10s, `include: ['tests/rules/**/*.test.ts']`. |

### Archivos modificados

| Path | Cambio |
|------|--------|
| `package.json` | Agregar `@firebase/rules-unit-testing` y `firebase-tools` a `devDependencies`. Agregar scripts `test:rules` y `test:rules:ci`. |
| `firestore.rules` | Agregar comentarios `// covered by tests/rules/users.rules.test.ts` adyacentes a R12 en create y update (sin cambio semantico). |
| `.github/workflows/deploy.yml` | Agregar job `rules-test` como dependency (`needs:`) de `deploy-rules-and-functions`. |
| `.github/workflows/deploy-staging.yml` | Agregar job `rules-test` como dependency (`needs:`) de `deploy-rules-and-functions`. |
| `docs/reference/tests.md` | Agregar seccion `## Firestore Rules Tests` con patron, ejemplos, e inventario plantilla minima. |
| `docs/reference/devops.md` | Agregar nota sobre script `npm run test:rules` y el nuevo job CI. |
| `docs/reference/security.md` | Agregar pointer a tests de rules en la seccion de Firestore rules. |
| `docs/reference/project-reference.md` | Bump count de tests (1829 + 16 = 1845 frontend) y mencionar la suite nueva. |
| `docs/_sidebar.md` | Agregar entries `Specs` y `Plan` debajo del entry `#332`. |
| `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/plan.md` | Nota cross-ref: "infra #332 mergeada — followup R12 tabla de verdad migrable a `users.rules.test.ts`". |
| `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/specs.md` | Idem. |
| `docs/feat/security/251-usersettings-rules-fix/specs.md` | Nota cross-ref: "infra #332 disponible — followup `userSettings.rules.test.ts` queda como issue separado". |
| `docs/feat/security/251-usersettings-rules-fix/plan.md` | Idem. |
| `docs/fix/security/289-firestore-rules-gaps/specs.md` | Nota cross-ref: "infra #332 disponible — followup per-item validation tests queda como issue separado". |
| `docs/fix/security/289-firestore-rules-gaps/plan.md` | Idem. |
| `docs/feat/security/300-security-critical-deps-appcheck-abuse/specs.md` | Nota cross-ref: "R6/R7 cubierto por `tests/rules/users.rules.test.ts` (#332). R14 sigue cubierto por tests de Cloud Function (`functions/src/admin/claims.test.ts`)." |
| `docs/feat/security/300-security-critical-deps-appcheck-abuse/plan.md` | Idem. |

### Estimacion de tamano de archivos

| Archivo | LOC estimado | < 400? |
|---------|--------------|--------|
| `tests/rules/setup.ts` | 120-180 | SI |
| `tests/rules/users.rules.test.ts` | 280-360 | SI |
| `vitest.rules.config.ts` | 30-40 | SI |
| `package.json` (delta) | +6 lineas | SI |
| `.github/workflows/deploy.yml` (delta) | +25 lineas | SI |
| `.github/workflows/deploy-staging.yml` (delta) | +25 lineas | SI |
| `docs/reference/tests.md` (delta) | +60 lineas | SI |

Ningun archivo supera 400 LOC.

---

## Contrato del setup factory (`tests/rules/setup.ts`)

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

// Constante exportada (no rehardcode entre suites).
export const RULES_TEST_PROJECT_ID = 'modo-mapa-rules-test';
export const RULES_EMULATOR_HOST = 'localhost';
export const RULES_EMULATOR_PORT = 8080;

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

export async function createRulesTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: RULES_TEST_PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'), // fresh read en cada call
      host: RULES_EMULATOR_HOST,
      port: RULES_EMULATOR_PORT,
    },
  });
}

export function authedContext(
  env: RulesTestEnvironment,
  uid: string,
  extra?: { token?: Record<string, unknown> }
): RulesTestContext {
  return env.authenticatedContext(uid, extra?.token);
}

export function unauthedContext(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext();
}

// Aserciones wrappers — promesa de tipo any porque el harness retorna unknown.
export function expectAllow<T>(promise: Promise<T>): Promise<T> {
  return assertSucceeds(promise);
}

export function expectDeny<T>(promise: Promise<T>): Promise<T> {
  return assertFails(promise);
}

// Limpia todos los docs entre tests (usar en beforeEach).
export async function clearFirestore(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore();
}

// Bypass de rules para setup de fixtures (admin SDK paths).
export async function withAdminContext(
  env: RulesTestEnvironment,
  fn: (ctx: RulesTestContext) => Promise<void>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (adminCtx) => {
    await fn(adminCtx);
  });
}
```

### Decisiones de diseno

1. **No singleton**. Cada suite hace `beforeAll(async () => { env = await createRulesTestEnv() })` y `afterAll(async () => { await env.cleanup() })`. Razon: si un test rompe el env (rules tienen syntax error), el proximo suite no hereda estado contaminado. Costo: 1-2s extra por suite (aceptable; tenemos 1 suite por ahora).
2. **Fresh read del archivo `firestore.rules` en cada `createRulesTestEnv()`**. Garantiza que en watch mode local y en CI con cache, los tests reflejen el archivo en disco actual.
3. **`path.resolve(__dirname, '../../firestore.rules')`**. Anclado al archivo `setup.ts` (no a `process.cwd()`), funciona desde cualquier cwd que ejecute Vitest.
4. **`env.cleanup()` obligatorio en `afterAll`**. Sin esto, el proceso de Node mantiene sockets abiertos contra el emulador y Vitest no termina. Documentar en el snippet del template.
5. **`clearFirestore` en `beforeEach`** (no en `afterEach`): garantia de estado limpio aun si un test crasheo a mitad de su ejecucion.

---

## Contrato del suite de referencia (`tests/rules/users.rules.test.ts`)

### Estructura

```ts
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  createRulesTestEnv,
  authedContext,
  unauthedContext,
  expectAllow,
  expectDeny,
  clearFirestore,
} from './setup';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const UID = 'user_alice';
const OTHER_UID = 'user_bob';

describe('firestore.rules — users/{userId}', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesTestEnv();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await clearFirestore(env);
  });

  // 4 R6 tests + 5 R7 tests + 5 R12 tests + 2 hasOnly update tests = 16
});
```

### Tests canonicos (16)

#### R6 — `hasOnly()` whitelist en users (create) — 4 tests

| # | Caso | Resultado esperado |
|---|------|-------------------|
| 1 | `create` con campo extra fuera del whitelist (ej. `isAdmin: true`) | **DENY** |
| 2 | `create` sin campo requerido (falta `displayName`) | **DENY** |
| 3 | `update` agregando campo nuevo no listado en `affectedKeys().hasOnly()` (ej. `email`) | **DENY** |
| 4 | `create` con exactamente los 4 campos del whitelist (`displayName`, `displayNameLower`, `avatarId`, `createdAt`) | **ALLOW** |

#### R7 — displayName charset + length — 5 tests

| # | Caso | Resultado esperado |
|---|------|-------------------|
| 5 | `displayName.size() < 1` (string vacio `""`) | **DENY** |
| 6 | `displayName.size() > 30` (string de 31 chars) | **DENY** |
| 7 | `displayName` con char fuera del regex (`"Juan!"`) | **DENY** |
| 8 | `displayName` valido (`"Pedro_Garcia"` o `"Maria Lopez"`) | **ALLOW** |
| 9 | `displayName` all-whitespace (`"   "`) | **DENY** |

#### R12 — `displayNameLower` bidireccional — 5 tests

| # | Caso | Resultado esperado |
|---|------|-------------------|
| 10 | `create` con `displayNameLower != displayName.lower()` (ej. `displayName: "Juan"`, `displayNameLower: "pedro"`) | **DENY** |
| 11 | `create` con `displayNameLower == displayName.lower()` | **ALLOW** |
| 12 | `create` con `displayName` presente pero `displayNameLower` ausente (sale del whitelist) | **DENY** |
| 13 | `update` unidireccional: cambia solo `displayName` sin actualizar `displayNameLower` (stale) | **DENY** |
| 14 | `update` bidireccional: cambia ambos campos en sync | **ALLOW** |

#### hasOnly update field injection — 2 tests

| # | Caso | Resultado esperado |
|---|------|-------------------|
| 15 | `update` que afecta unicamente `displayName` + `displayNameLower` (campos whitelisted en update) en sync | **ALLOW** |
| 16 | `update` que afecta `displayName` + un campo extra (ej. `isAdmin: true`) | **DENY** |

### Helpers locales del suite

```ts
// Helper para escribir el doc inicial via admin context (bypass rules).
async function seedUser(env: RulesTestEnvironment, uid: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

// Payload base valido para create.
function validUserPayload(displayName = 'Pedro_Garcia') {
  return {
    displayName,
    displayNameLower: displayName.toLowerCase(),
    avatarId: 'avatar_1',
    createdAt: serverTimestamp(),
  };
}
```

### Regression sentinel

Comentario obligatorio en el archivo, encima del grupo R12:

```ts
// Regression sentinel: si se remueve el check bidireccional
// (displayNameLower == displayName.lower()) de firestore.rules, los tests
// "R12 update unidireccional -> DENY" y "R12 create lower != name.lower() -> DENY"
// pasan a ALLOW y este suite falla aca. Verificacion automatizada — no
// walkthrough manual. Cross-ref: #322 specs L240-247, #332 specs S3.
```

---

## Vitest config nuevo (`vitest.rules.config.ts`)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'functions/**', 'src/**'],
    testTimeout: 10_000, // initializeTestEnvironment puede tardar ~1-2s primera vez
    hookTimeout: 10_000,
    // Sin coverage thresholds — firestore.rules no es codigo TS, no hay metrica
    // de coverage aplicable. Los tests son "todos pasan o falla CI".
    coverage: {
      enabled: false,
    },
  },
});
```

### Por que separado de `vitest.config.ts`

| Razon | Detalle |
|-------|---------|
| Env distinto | `node` vs `jsdom` — el harness corre en Node, no necesita DOM |
| Coverage policy | Los tests de rules no contribuyen a la metrica del 80% de TS — son un suite paralelo |
| Timeout | 10s vs 5s default (init del env contra emulador es lento la primera vez) |
| Includes | Solo `tests/rules/**`, no `src/**` (no contamina `npm test`) |

---

## Scripts en `package.json`

```json
{
  "scripts": {
    "test:rules": "firebase emulators:exec --only firestore 'vitest run --config vitest.rules.config.ts'",
    "test:rules:ci": "vitest run --config vitest.rules.config.ts"
  }
}
```

### Diferencia entre los dos scripts

- **`test:rules`** (local dev): levanta el emulador con `firebase emulators:exec --only firestore` (se cae cuando termina vitest). Para que el usuario no tenga que levantar el emulador a mano.
- **`test:rules:ci`** (workflow): el emulador YA esta corriendo (lo levanta el step de CI con `emulators:exec` que wrapea `npm run test:rules:ci`). Evita doble wrap.

### Existing scripts — no se modifican

- `npm test` (watch mode normal) sigue corriendo solo `src/**` — los rules tests NO entran al watch general porque requieren emulador.
- `npm run test:coverage` sigue siendo el coverage frontend — los rules tests NO contribuyen a la metrica.
- `npm run test:run` sigue sin tocar rules tests.

---

## CI integration

### Job `rules-test` (mismo template para ambos workflows)

Insertar el siguiente job en `deploy.yml` y `deploy-staging.yml`:

```yaml
  rules-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      # Java requerido por el emulador Firestore (firebase-tools usa Java internamente).
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - run: npm ci
      - name: Run Firestore rules tests against emulator
        # firebase-tools es devDependency (instalado con npm ci); npx encuentra el bin local.
        # emulators:exec levanta el emulador, corre el comando, baja el emulador.
        run: npx firebase-tools emulators:exec --only firestore "npm run test:rules:ci"
```

### Modificaciones

**`deploy.yml`** linea 46: agregar `rules-test` a `needs:` de `deploy-rules-and-functions`:

```yaml
  deploy-rules-and-functions:
    needs: [lint, test, functions-test, rules-test]
```

**`deploy-staging.yml`** linea 52: idem.

```yaml
  deploy-rules-and-functions:
    needs: [lint, test, functions-test, rules-test]
```

### Hard-fail policy

El job **falla sin retry** si:

- Puerto 8080 ocupado por otro proceso del runner → mensaje del emulador: `Could not start Firestore Emulator, port taken: 8080`. Fix forward (debug del runner).
- Java no disponible → step `setup-java@v4` falla antes de llegar.
- Descarga corrupta del emulator jar → firebase-tools re-descarga en proxima corrida (cache invalidation natural).

No usamos `continue-on-error: true` ni retry loops. Una regresion en rules debe gatear el deploy, ese es el punto.

### Paths filter (opcional, decision en plan)

Se evalua aplicar:

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

**Decision en plan**: por ahora NO aplicar paths filter — los workflows actuales corren en push a `main`/`staging`, no en `pull_request`. Sumar el filter requiere agregar trigger `pull_request` que cambia semantica de los workflows. Tracked como followup si el costo de Actions sube.

---

## Integracion

No hay integracion con codigo runtime. La feature es 100% test infra.

### Preventive checklist

- [x] **Service layer**: no aplica (no components, no services).
- [x] **Duplicated constants**: `RULES_TEST_PROJECT_ID` exportada desde `setup.ts`. Cualquier futuro suite la importa.
- [x] **Context-first data**: no aplica.
- [x] **Silent .catch**: el setup no usa `.catch(() => {})`. Errores del harness fallan loud — vitest los reporta como test failure.
- [x] **Stale props**: no aplica.

---

## Tests

Esta feature **es** un sistema de tests. La cobertura aplica asi:

| Archivo | Que testear | Tipo |
|---------|-------------|------|
| `tests/rules/setup.ts` | No requiere tests propios — auto-validado: si el setup esta roto, `users.rules.test.ts` falla en `beforeAll`. | helper |
| `tests/rules/users.rules.test.ts` | 16 tests (es el deliverable, no algo a testear). Cubre R6 (4), R7 (5), R12 (5), hasOnly update (2). | suite |

### Criterio de aceptacion

- Los 16 tests pasan contra el emulador (local + CI en ambos workflows).
- El job `rules-test` gatea `deploy-rules-and-functions` (`needs:`).
- Regression sentinel: si alguien remueve `displayNameLower == displayName.lower()` de `firestore.rules`, tests 10, 11, 13, 14 cambian de DENY a ALLOW (o viceversa) y el suite falla.
- Cobertura TS: no aplica el 80% — `firestore.rules` no es TS. Metrica es "todos los invariantes documentados en specs tienen al menos 1 allow + 1 deny".

### No modificamos coverage thresholds

`vitest.config.ts` (frontend) y `functions/vitest.config.ts` se mantienen sin cambios. El suite de rules NO entra a esos coverage runs.

## Analytics

No aplica.

---

## Offline

No aplica. La feature es infra de tests, no toca runtime de la app.

### Cache strategy

N/A.

### Writes offline

N/A.

### Fallback UI

N/A.

---

## Accesibilidad y UI mobile

No aplica.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| N/A | N/A | N/A | N/A | N/A |

## Textos y copy

No aplica. La doc nueva en `tests.md` sigue convenciones tecnicas existentes (espanol, sin RTL).

---

## Decisiones tecnicas

### D1 — Path de la suite: `tests/rules/` (root) en lugar de `src/__tests__/`

- **Razon**: la convencion existente del proyecto es `src/<dominio>/__tests__/` colocada con el codigo TS que prueban. Las rules tests no testean codigo TS — prueban el archivo `firestore.rules` del root contra un emulador.
- **Alternativas rechazadas**: `src/__tests__/rules/` (rompe convencion existente, sugiere dominio TS); `src/test/rules/` (la carpeta `src/test/` es para setup global de vitest, no para suites).
- **Eleccion**: `tests/rules/` deja claro que es un suite root-level, paralelo a `firestore.rules`.

### D2 — `firebase-tools` como devDependency en lugar de instalacion global

- **Razon**: version controlada y reproducible. Instalacion global tiene drift entre runner y dev local; `npx firebase-tools` sin instalar re-descarga cada run.
- **Costo**: ~80MB de devDep agregada. Aceptable para infra de CI (Pi local no lo instala salvo que el dev corra rules tests).
- **Pin**: `^13.x` para compat con `@firebase/rules-unit-testing` v3.x y Firebase 12.x.

### D3 — Vitest config separado en lugar de modificar el principal

- **Razon**: el principal tiene `environment: 'jsdom'` y coverage thresholds del 80%. Las rules tests necesitan `node` y NO deben contribuir a la metrica de coverage frontend.
- **Alternativa rechazada**: usar `vitest.workspace.ts` para multi-config. No lo aplicamos porque sumar workspaces requiere modificar tambien la integracion con `@vitest/coverage-v8` actual; el costo no justifica.

### D4 — Suite unico (`users`) en este PRD, no migrar todos los invariantes

- **Razon**: el objetivo es **abrir la puerta** para que PRDs futuros agreguen 5-10 tests sin pagar bootstrap. Migrar #251, #289, #322 en este PRD lo lleva a scope XL y bloquea el merge.
- **Followups documentados**: en `tests.md` queda el inventario plantilla minima con `[ ] [ ]` por coleccion pendiente.

### D5 — Job CI en **ambos** workflows (prod + staging)

- **Razon (BLOQ Sofia C2 #2)**: si el gate va solo a prod, una regresion en rules puede llegar a staging y romperla antes de promover. Staging tambien necesita gate.
- **Costo extra**: ~2-4 min por workflow, x2 = 4-8 min totales sumando ambos pushes (push a `staging` y eventual merge a `main`). Aceptable.

### D6 — Hard-fail sin retry en el job

- **Razon (IMP Sofia C2 #4)**: retry automatico enmascara problemas reales del runner (Java falla, puerto ocupado). Es mejor que falle visiblemente y un humano lo diagnostique.
- **Mitigacion**: el mensaje de error del emulador es claro (`port taken: 8080`, `Java not installed`). El fix es forward, no retry.

### D7 — No mockear el emulador

- **Razon**: el harness `@firebase/rules-unit-testing` esta disenado para correr contra emulador real. Mockear el emulador eliminaria la fidelidad del test (las rules CEL se compilan en el emulador, no en JS).
- **Costo**: requiere Java + emulador en CI. Mitigado con cache de actions.

---

## Hardening de seguridad

La feature **no** introduce superficies de ataque nuevas. Aplican checks defensivos al harness mismo:

### Firestore rules requeridas

No aplica (no se agregan rules; solo comentarios).

### Rate limiting

No aplica.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Colision de projectId con prod/staging escribiendo docs reales | Constante `RULES_TEST_PROJECT_ID = 'modo-mapa-rules-test'` + harness pinea `host: 'localhost'` (nunca alcanza Firestore real) | `tests/rules/setup.ts` |
| Service account leak via emulador | Emulador no requiere credenciales; no hay env var `GOOGLE_APPLICATION_CREDENTIALS` en el job CI | `.github/workflows/*.yml` |
| Port forwarding del emulador a Internet | Emulador escucha en `localhost:8080` del runner; sin port forwarding configurado | `firebase.json` (sin cambios) |
| Drift de version entre runner y dev (firebase-tools) | Pin a `^13.x` en `devDependencies` | `package.json` |

### Verificacion explicita (OBS Sofia C2 #1)

Antes de mergear, el implementador valida que `RULES_TEST_PROJECT_ID === 'modo-mapa-rules-test'`:

- NO matchea `modo-mapa-app` (prod + staging real).
- NO es un alias en `.firebaserc` (verificar `cat .firebaserc | grep modo-mapa-rules-test` → no debe matchear).

Si por error futuro alguien renombra el projectId real a algo que matchee `modo-mapa-rules-test`, el harness sigue conectado a `localhost:8080` (jamas a Firestore prod). El doble check es defense-in-depth.

---

## Deuda tecnica: mitigacion incorporada

Esta feature **resuelve** deuda tecnica de 4 PRDs anteriores. Es un habilitador.

| Issue | Que se resuelve aca | Que queda como followup |
|-------|--------------------|--------------------------|
| #322 (rules hardening) | R6/R7/R12 cubiertos por `users.rules.test.ts` (16 tests). El sentinel R12 garantiza que la equality bidireccional no se puede remover sin que tests fallen. | Migrar los 5 casos completos de la tabla de verdad R12 a tests parametrizados (out-of-scope, en sub-issue). |
| #300 (R6 + R7 + R14) | R6 (profilePublic gate via hasOnly) + R7 (displayName charset) cubierto. | R14 (bootstrap admin) NO migra — es Cloud Function (`setAdminClaim`), se testea en `functions/src/admin/claims.test.ts`. |
| #251 (userSettings rules) | Infra disponible. | `tests/rules/userSettings.rules.test.ts` queda como issue separado para PRDs futuros que toquen userSettings. |
| #289 (sharedLists/listItems per-item validation) | Infra disponible. | `tests/rules/sharedLists.rules.test.ts` queda como issue separado. |

### Verificacion de no-aggravation

Ningun archivo que tocamos tiene deuda tecnica abierta que estemos empeorando:

- `firestore.rules` — solo agregamos comentarios (sin cambio semantico).
- `package.json` — agregamos devDeps (no cambia runtime).
- `.github/workflows/deploy.yml`, `deploy-staging.yml` — agregamos un job (no modificamos los existentes).

---

## Validacion Tecnica

**Fecha:** 2026-05-16
**Estado:** VALIDADO CON OBSERVACIONES
**Reviewer:** Diego (specs-plan-reviewer) — Ciclo 1

### Contexto revisado

- PRD: `docs/feat/infra/332-firestore-rules-unit-testing-harness/prd.md` (sello Sofia: VALIDADO CON OBSERVACIONES, 2026-05-16)
- Specs: `docs/feat/infra/332-firestore-rules-unit-testing-harness/specs.md`
- Patrones del proyecto revisados: `docs/reference/tests.md`, `vitest.config.ts`, `package.json`, `firebase.json`, `.firebaserc`
- Codigo existente verificado:
  - `firestore.rules` L22-72 (bloque `match /users/{userId}` — confirma R6/R7/R12 y posicion de los comentarios propuestos)
  - `.github/workflows/deploy.yml` L46 (`deploy-rules-and-functions` con `needs: [lint, test, functions-test]`)
  - `.github/workflows/deploy-staging.yml` L52 (idem; step staging usa `bash scripts/deploy-staging-rules.sh`, custom curl-based — `needs:` igualmente aplica como gate)
  - `firebase.json` (emulator firestore en port 8080, sin `host` explicito — default `127.0.0.1`)
  - `.firebaserc` (`default: modo-mapa-app`; targets prod + staging; `modo-mapa-rules-test` no aparece — projectId del harness no colisiona con alias real)
  - `grep -rn "rules-unit-testing"` confirma que el paquete no esta instalado actualmente
- Cobertura actual frontend (post-#338): branches 81.86% / threshold 80% — margen 1.86% (relevante para OBS #2)

### Cobertura PRD -> specs

Todos los S1-S6 del PRD tienen seccion correspondiente en specs. Los 7 criterios de aceptacion del PRD tienen implementacion descrita (incluido el regression sentinel automatizado #7). Las 3 observaciones residuales de Sofia C2 estan direccionadas explicitamente:
- OBS C2 #1 (projectId no-colision) -> seccion "Aislamiento de projectId del harness" + "Verificacion explicita" en Hardening
- OBS C2 #2 (cross-refs S6) -> tabla "Archivos modificados" lista las 8 cross-refs concretas
- OBS C2 #3 (comentario adyacente en rules) -> seccion "Comentario adyacente a R12"

### IMPORTANTE #1 — `FIRESTORE_EMULATOR_HOST` mencionado en PRD S1 no aparece en specs

**Seccion del specs:** Contrato del setup factory (L154-220) + Scripts en package.json (L379-397) + CI integration (L407-426)
**Hueco tecnico:** el PRD S1 (L32) prometio "Agregar variable de entorno `FIRESTORE_EMULATOR_HOST=localhost:8080` que el harness lee automaticamente". El specs no menciona la variable en ningun archivo. El setup pinea `host`/`port` explicito en `initializeTestEnvironment`, lo cual hace el env var redundante — pero la decision no esta documentada.
**Escenario concreto:** el implementador llega al CI step y duda si debe setear `env: FIRESTORE_EMULATOR_HOST: localhost:8080` en el job de Actions (porque el PRD lo pidio) o no (porque el specs pinea host/port). Sin la decision documentada, hay riesgo de doble configuracion (con drift posible) o de "agregar por las dudas" un env var no usado.
**Que necesitamos en el specs:** una nota explicita en "Decisiones de diseno" (L222-228) o en "Decisiones tecnicas" (Dx) declarando que **no se usa `FIRESTORE_EMULATOR_HOST`** porque el setup pinea `host: 'localhost'` y `port: 8080` directo en `initializeTestEnvironment`. Esto cierra el gap PRD->specs y evita ambiguedad operacional.

### OBSERVACION #1 — Job CI no aclara si necesita `cd functions && npm ci`

**Seccion del specs:** CI integration L407-426
**Hueco tecnico:** el job propuesto hace `npm ci` (root) y `npx firebase-tools emulators:exec ...`. No menciona si requiere o no `cd functions && npm ci`. Los jobs `test` y `functions-test` existentes son simetricos en ese punto. Para `rules-test` no aplica (`firebase-tools` es devDep del root, y el harness corre puro Node sin Functions emulator).
**Escenario concreto:** el implementador del plan puede agregar `cd functions && npm ci` "por simetria" y duplicar 30-60s del job sin necesidad. O al reves: si en el futuro alguien quiere agregar tests de Cloud Function triggers contra el emulador, el supuesto cambia.
**Que se necesita:** una linea en CI integration aclarando "el job no instala `functions/node_modules` — `firebase-tools` esta en devDeps del root y `emulators:exec --only firestore` no requiere el binario de Functions".

### OBSERVACION #2 — Impacto de nuevas devDeps en el job `test` existente

**Seccion del specs:** seccion "Tests" L504-505 (declara que rules tests no contribuyen a coverage frontend) y "Archivos a crear / modificar" (L120)
**Hueco tecnico:** agregar `@firebase/rules-unit-testing` (~10MB) y `firebase-tools` (~80MB) a devDeps cambia `package-lock.json`. El job `test` actual corre `npm run test:coverage` con threshold 80% branches (margen actual 1.86%). El specs aclara que rules tests NO entran a coverage frontend, pero no menciona si `npm ci` del root podria romper algun otro test por shared deps o conflictos de version (ej. `@firebase/rules-unit-testing` v3 requiere `firebase@>=12`, ya cumplido en `package.json` con `firebase: ^12.11.0` — verificado).
**Escenario concreto:** en CI primera corrida con devDeps nuevas, `npm ci` instala ~100MB extra. No deberia romper nada (las devDeps no se importan desde `src/**`), pero conviene un commit aislado de "solo install" para verificar antes del commit del setup. Es decision del plan, no del specs.
**Que se necesita:** mencion en specs (Decisiones tecnicas o Hardening) de que la instalacion de devDeps se valida en un commit/PR previo o como primer step del plan, para detectar conflictos antes de mezclar con el setup. No es bloqueante.

### Lo que NO marco (verificado y correcto)

- Path `tests/rules/` fuera de `src/` — coherente con convencion del proyecto (tests colocados con codigo TS; rules no son TS).
- Vitest config separado — justificado contra `vitest.config.ts` actual (jsdom + thresholds 80%).
- Cross-refs S6 listadas en tabla "Archivos modificados" — completas (8 archivos en 4 features).
- `firestore.rules` solo agrega comentarios (sin cambio semantico) — verificado que la rule de update R12 (L46-65 del rules actual) coincide con el snippet propuesto en specs L55-63.
- Tabla de aislamiento de projectId (L31-34 del specs) correcta — verificado contra `.firebaserc`.
- Limites de archivo: estimaciones (L141-148) confirman < 400 LOC en todos.
- Hard-fail sin retry en el job — decision tecnica defendible (D6).
- Coverage policy de rules tests (no entra a metrica 80% TS) — documentada y consistente con `tests.md`.

### Listo para pasar a plan?

**Si con observaciones.** Diego cierra IMPORTANTE #1 con un patch chico al specs (1 parrafo en "Decisiones tecnicas" — pej. D8: no usamos `FIRESTORE_EMULATOR_HOST` porque pineamos host/port). Las dos OBSERVACIONES pueden quedar como decisiones del plan (Pablo). No hay BLOQUEANTES.

### Observaciones tecnicas para el plan (Pablo)

- El plan debe ordenar la instalacion de devDeps (`@firebase/rules-unit-testing`, `firebase-tools`) **antes** de crear el setup, idealmente en un commit/fase propia, para verificar que `npm ci` con las nuevas deps no rompe el job `test` actual.
- El plan debe verificar que el job `rules-test` no se cuelga si `emulators:exec` no termina (timeout del step de Actions a 10 min como safety).
- Si Pablo encuentra que el step staging (`scripts/deploy-staging-rules.sh`) tiene su propio entry point custom (no `npx firebase-tools deploy`), confirmar que `needs: rules-test` igualmente lo gatea — verificado: si si, porque `needs:` aplica antes del step de deploy.

