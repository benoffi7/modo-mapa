# Plan de implementación: perf-instrumentation de count queries en follows/favorites (#347)

**Specs:** [specs.md](specs.md) — VALIDADO CON OBSERVACIONES por Diego (2026-06-12)
**PRD:** [prd.md](prd.md) — VALIDADO CON OBSERVACIONES por Sofia (2026-06-10)
**Fecha:** 2026-06-12

---

## Estrategia y staging de riesgo

| Fase | Riesgo | Notas |
|------|--------|-------|
| F1 — Wrap 3 call sites en `measureAsync` (S1) | Bajo | Decorador de medición; sin cambio de firma ni semántica offline. **Cierra R7.** |
| F2 — Paridad labels + seed (S2) | Bajo | Solo agrega 2 entradas a un registro de constantes y al doc agregado del seed `.mjs` |
| F3 — Tests (con la feature, no al final) | Bajo | F3a setup de mocks `favorites.test.ts` (gap real), F3b asserts en ambos services |
| F4 — Verificación de guard + done (S3) | Bajo | `npm run guards` → R7 con 0 hits; `npm run guards:check` no sube baseline |

> **Orden deliberado:** F1 (instrumentación) y F3 (tests) van en la misma entrega lógica — los tests acompañan al código que instrumentan. F4 (verificación del guard) es el último paso porque depende de que F1 esté completo y bien formateado (línea-por-línea). No hay fase de docs obligatoria: el PRD/specs confirman que `patterns.md` ya documenta `measureAsync` y no hay colecciones/campos/rules nuevos.

### Invariantes que el plan DEBE respetar (observaciones de Diego)

1. **Guard R7 es línea-por-línea.** El grep subyacente (`scripts/guards/checks.mjs:271`) es `grep -rn "getCountOfflineSafe(" ... | grep -v measureAsync`. En los 3 sites `measureAsync(` y `getCountOfflineSafe(` deben quedar en la **misma línea física**. Si el wrap parte ambos en líneas distintas, el guard sigue reportando el hit. Atención a `followUser:41`, que es una **asignación** (`const followingCount = await getCountOfflineSafe(...)`) — el specs solo muestra el ejemplo inline para `favorites_count`.
2. **Sufijo camelCase de las claves es intencional, NO normalizar a snake puro.** `follows_followingCount` / `follows_followersCount` / `favorites_count` replican el precedente en producción (`follows_followersCount` en `perfHelpers.ts:72` + seed `:917`). Normalizar rompería la paridad con la fila existente que ya recibe muestras.
3. **`favorites.test.ts` parte sin infra de mock.** No mockea `getCountOfflineSafe` ni `measureAsync` ni importa `fetchUserFavoritesCount` (verificado: `favorites.test.ts:1-22` solo mockea firestore/queryCache/analytics e importa `addFavorite, removeFavorite`). F3a es **setup de mocks completo**, no solo un assert. `follows.test.ts` ya mockea `getCountOfflineSafe` (`:11-14`) pero **no** `measureAsync` ni testea `fetchFollowersCount` — ambos a agregar en F3b.

---

## File ownership

| Archivo | Fase | Tipo de cambio |
|---------|------|----------------|
| `src/services/follows.ts` | F1 | wrap 2 sites + import `measureAsync` |
| `src/services/favorites.ts` | F1 | wrap 1 site + import `measureAsync` |
| `src/components/admin/perf/perfHelpers.ts` | F2 | +2 entradas en `QUERY_LABELS` |
| `scripts/seed-admin-data.mjs` | F2 | +2 entradas en doc agregado `perfMetrics.queries` |
| `src/services/follows.test.ts` | F3b | mock `measureAsync` + tests de `followUser` y `fetchFollowersCount` + smoke label |
| `src/services/favorites.test.ts` | F3a + F3b | setup mocks (`getCountOfflineSafe`, `measureAsync`) + import `fetchUserFavoritesCount` + test + smoke label |

Sin solapamiento entre fases. F1 y F2 tocan archivos disjuntos → podrían ir en paralelo, pero se commitean separados por trazabilidad.

---

## Fase 1 — Envolver los 3 call sites en `measureAsync` (S1)

**Branch:** `feat/347-perf-instrument-count-queries`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/follows.ts:20` | Extender el import existente de `../utils/perfMetrics`: `import { measuredGetDoc, measuredGetDocs, measureAsync } from '../utils/perfMetrics';` |
| 2 | `src/services/follows.ts:41-43` | Envolver el count del límite. **`measureAsync(` y `getCountOfflineSafe(` en la MISMA línea** (es asignación): `const followingCount = await measureAsync('follows_followingCount', () => getCountOfflineSafe(` ... `));`. La key NO cambia de camelCase. |
| 3 | `src/services/follows.ts:98-100` | Envolver el return: `return measureAsync('follows_followersCount', () => getCountOfflineSafe(` ... `));`. `follows_followersCount` ya existe en labels/seed — solo se emite desde este nuevo origen. |
| 4 | `src/services/favorites.ts:13` | Agregar import: `import { measureAsync } from '../utils/perfMetrics';` (hoy no importa perfMetrics). |
| 5 | `src/services/favorites.ts:52-54` | Envolver el return: `return measureAsync('favorites_count', () => getCountOfflineSafe(` ... `));`. Patrón canónico de `ratings.ts:141`. |

**Forma esperada de `followUser:41` (asignación — el caso de riesgo del guard):**

```ts
const followingCount = await measureAsync('follows_followingCount', () => getCountOfflineSafe(
  query(collection(db, COLLECTIONS.FOLLOWS), where('followerId', '==', followerId)),
));
```

> `measureAsync(` y `getCountOfflineSafe(` quedan en la línea de apertura → el `grep -v measureAsync` neutraliza ese hit. El cierre `));` puede ir en líneas siguientes sin afectar el grep (que matchea la línea con `getCountOfflineSafe(`).

- **Verificación rápida local:** `grep -rn "getCountOfflineSafe(" src/services/follows.ts src/services/favorites.ts | grep -v measureAsync` debe devolver vacío (salvo, fuera de scope, los `// guard:exempt` de `rankings.ts`).
- **Test:** `npx vitest run src/services/follows.test.ts src/services/favorites.test.ts` debe seguir verde **antes** de F3 (los mocks existentes de `follows` toleran el wrap solo si `measureAsync` está mockeado o si `sessionId` no está seteado; ver nota en F3b). `npx tsc --noEmit` sin errores (firmas `Promise<void>`/`Promise<number>` intactas).
- **Commit:** `fix(#347): envolver 3 count queries de follows/favorites en measureAsync`
- **Rollback:** revert del commit; ambos services vuelven a `getCountOfflineSafe` directo (el guard R7 volvería a reportar, estado previo conocido).

---

## Fase 2 — Paridad de labels + seed para las 2 claves nuevas (S2)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/perf/perfHelpers.ts` (junto a `:72`) | Agregar al objeto `QUERY_LABELS`: `follows_followingCount: 'Seguidos: count',` y `favorites_count: 'Favoritos: count',`. Mantener estilo `<Sustantivo>: count` y orden alfabético/agrupado del bloque. NO tocar `follows_followersCount` (ya existe). |
| 2 | `scripts/seed-admin-data.mjs` (bloque `perfMetrics.queries`, `:902-953`, junto a `:917`) | Agregar 2 entradas con valores plausibles: `follows_followingCount: { p50: 70, p95: 180, count: 35 },` y `favorites_count: { p50: 65, p95: 160, count: 90 },`. NO tocar `follows_followersCount: { p50: 60, p95: 150, count: 40 }` (`:917`). El staging recibe las claves por el mismo `.mjs` vía `--target staging`. |

- **Verificación:** `npx tsc --noEmit` (labels); `node --check scripts/seed-admin-data.mjs` para validar sintaxis del seed.
- **Verificación de paridad (Regla 7 del guard #303):** opcionalmente `node scripts/seed-admin-data.mjs` contra el emulador y confirmar que `QueryLatencyTable` renderiza `Seguidos: count` y `Favoritos: count`. No bloqueante para el merge si el guard pasa.
- **Commit:** `chore(#347): registrar follows_followingCount + favorites_count en QUERY_LABELS y seed`
- **Rollback:** revert del commit; las filas caen al fallback `?? name` de `QueryLatencyTable` (sin label en español, pero sin romper).

---

## Fase 3 — Tests (acompañan a la instrumentación)

### F3a — Setup de mocks en `favorites.test.ts` (gap de infraestructura, observación 3 de Diego)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/favorites.test.ts` (junto a `:6-7`) | Agregar mock de `getCountOfflineSafe` siguiendo el patrón de `follows.test.ts:11-14`: `const mockGetCountOfflineSafe = vi.fn();` + `vi.mock('./getCountOfflineSafe', () => ({ getCountOfflineSafe: (...a) => mockGetCountOfflineSafe(...a) }));`. |
| 2 | `src/services/favorites.test.ts` | Agregar mock de `perfMetrics` que delega: `vi.mock('../utils/perfMetrics', () => ({ measureAsync: vi.fn((_name, fn) => fn()) }));`. Importar el mock para spy de `name`. |
| 3 | `src/services/favorites.test.ts` | Agregar mock de `./offlineInterceptor` si la importación de `fetchUserFavoritesCount` arrastra el módulo (verificar: `favorites.ts:14` importa `gateServiceWrite`; hoy los tests de add/remove ya lo ejercen — confirmar si está mockeado o si funciona por el mock de firestore). |
| 4 | `src/services/favorites.test.ts:20` | Extender el import: `import { addFavorite, removeFavorite, fetchUserFavoritesCount } from './favorites';`. |

### F3b — Asserts de instrumentación en ambos services

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/follows.test.ts` (junto a `:11-14`) | Agregar mock de `perfMetrics`: `vi.mock('../utils/perfMetrics', () => ({ measuredGetDoc: vi.fn(), measuredGetDocs: vi.fn(), measureAsync: vi.fn((_name, fn) => fn()) }));`. Importar `measureAsync` (el mock) para el spy. **Sin este mock, el wrap de F1 ejecuta el `measureAsync` real, que en test (sin `sessionId`) hace `return fn()` — funciona, pero no permite assertar el `name`.** |
| 2 | `src/services/follows.test.ts` | Test `followUser` invoca `measureAsync` con `'follows_followingCount'` y delega en `getCountOfflineSafe` (mock resuelve un número < 200 → no lanza; verificar que `setDoc` + `invalidateQueryCache` + `trackEvent(EVT_FOLLOW)` siguen llamándose). Test del límite: `mockGetCountOfflineSafe` resuelve `200` → `followUser` rechaza con `'Has alcanzado el limite de 200 usuarios seguidos'`. |
| 3 | `src/services/follows.test.ts` | Test `fetchFollowersCount` (hoy no testeado): importar de `./follows`, mock resuelve `7` → retorna `7`; `measureAsync` invocado con `'follows_followersCount'`. Path offline: mock resuelve `0` → retorna `0`. |
| 4 | `src/services/follows.test.ts` | Smoke: `import { QUERY_LABELS } from '../components/admin/perf/perfHelpers';` + `expect(QUERY_LABELS['follows_followingCount']).toBeTruthy()`. (Decisión specs: NO crear `perfHelpers.test.ts`; cubrir vía smoke.) |
| 5 | `src/services/favorites.test.ts` | Test `fetchUserFavoritesCount`: mock resuelve `12` → retorna `12`; `measureAsync` invocado con `'favorites_count'`. Path offline: mock resuelve `0` → retorna `0`. Smoke: `expect(QUERY_LABELS['favorites_count']).toBeTruthy()`. |

- **Test:** `npx vitest run src/services/follows.test.ts src/services/favorites.test.ts` verde; cobertura del código nuevo >= 80% (el wrap es trivial); no baja la cobertura existente (`favorites.test.ts` 7 casos, `follows.test.ts`).
- **Commit:** `test(#347): cubrir measureAsync en counts de follows/favorites + smoke de labels`
- **Rollback:** revert del commit de tests (el código de F1/F2 sigue funcional, solo sin los asserts nuevos).

---

## Fase 4 — Verificación del guard #303 y criterio de done (S3)

| Paso | Comando | Criterio |
|------|---------|----------|
| 1 | `npm run guards` (= `node scripts/guards/run.mjs --pretty`) | La regla `R7-getCount-without-measure` del guard `303` reporta **0 hits**. |
| 2 | `npm run guards:check` (= `node scripts/guards/check-baseline.mjs`, gate de CI `guards.yml:43`) | Pasa — NO sube el `.guards-baseline.json` (el baseline de R7 ya esperaba 0; los 3 sites dejan de contar). |
| 3 | `npm run build` | Build OK. |
| 4 | `npx vitest run` (suite completa o al menos services tocados) | Verde. |

- **Sin commit propio** (es verificación). Si el guard expone un baseline desactualizado, ajustar baseline en el commit de F1 con justificación. No agregar reglas nuevas al guard (fuera de scope, R7 y R3 ya existen).
- **Rollback:** N/A (fase de verificación).

---

## Orden de implementación

1. **F1** — wrap de los 3 sites (`follows.ts`, `favorites.ts`) respetando el invariante línea-por-línea. Es la raíz: cierra R7 y habilita el resto.
2. **F2** — labels + seed (independiente de F1, pero se commitea después por trazabilidad de la clave emitida).
3. **F3a → F3b** — setup de mocks de `favorites.test.ts` primero (sin él los tests nuevos no compilan), luego los asserts en ambos services.
4. **F4** — correr `npm run guards` y `npm run guards:check`; build + suite completa.

Dependencia dura: F3b paso 4/5 (smoke de labels) requiere F2 paso 1 mergeado (las claves deben existir en `QUERY_LABELS`). F1 debe preceder a F4.

---

## Test plan global

| Archivo / comando | Qué cubre | Fase |
|-------------------|-----------|------|
| `src/services/follows.test.ts` | `measureAsync('follows_followingCount')` en `followUser`; límite 200 sigue lanzando; `fetchFollowersCount` retorna número + key + offline 0; smoke label | F3b |
| `src/services/favorites.test.ts` | setup mocks + `fetchUserFavoritesCount` retorna número + key `favorites_count` + offline 0; add/remove existentes intactos; smoke label | F3a + F3b |
| `npm run guards` | R7 con 0 hits | F4 |
| `npm run guards:check` | baseline no sube | F4 |
| `npm run build` / `npx tsc --noEmit` | firmas y tipos intactos | F1/F4 |

Mock strategy: `measureAsync` mockeado como `(_name, fn) => fn()` (delega y permite spy del `name`); `getCountOfflineSafe` mockeado para controlar retorno (incluido `0` offline). Sin regresión en asserts de `invalidateQueryCache` / `trackEvent`.

---

## Riesgos

1. **Wrap parte `measureAsync`/`getCountOfflineSafe` en líneas distintas → R7 sigue rojo.** Mitigación: invariante explícito en F1 + verificación con grep local antes de F4; el caso de `followUser:41` (asignación) está documentado con su forma exacta.
2. **Normalización accidental de la key a snake puro** (`follows_following_count`) rompería la paridad con la fila prod `follows_followersCount`. Mitigación: invariante #2 + las keys están escritas literalmente en cada paso del plan.
3. **`favorites.test.ts` sin mock de `perfMetrics`/`getCountOfflineSafe` → el test de `fetchUserFavoritesCount` falla o ejecuta el `measureAsync` real.** Mitigación: F3a es setup de mocks completo (no un assert), siguiendo `follows.test.ts:11-14`.

---

## Guardrails (verificación final)

- [ ] Ningún componente importa `firebase/firestore` directamente (solo services, capa permitida).
- [ ] Sin colecciones/campos/rules/Cloud Functions nuevos → sin cambios en `firestore.rules` ni functions.
- [ ] Las 2 claves nuevas registradas en `QUERY_LABELS` (`perfHelpers.ts`) y en el doc agregado del seed `.mjs` (paridad Regla 7 del guard #303).
- [ ] Keys con sufijo camelCase preservado (no normalizar).
- [ ] `measureAsync` y `getCountOfflineSafe` en la misma línea física en los 3 sites.
- [ ] Ningún archivo supera 400 líneas (`follows.ts` ~106, `favorites.ts` ~71, `perfHelpers.ts` ~127).
- [ ] Sin `logger.error` envuelto en `if (DEV)`; sin `.catch(() => {})`.
- [ ] Labels en español con terminología consistente (`Seguidos: count`, `Favoritos: count`).

## Criterios de done

- [ ] Los 3 call sites ejecutan `getCountOfflineSafe` dentro de `measureAsync` con keys `follows_followingCount` / `follows_followersCount` / `favorites_count`.
- [ ] `npm run guards` → `R7-getCount-without-measure` con 0 hits; `npm run guards:check` pasa.
- [ ] `QUERY_LABELS` y seed `perfMetrics.queries` contienen las 2 claves nuevas con label no vacío.
- [ ] `follows.test.ts` y `favorites.test.ts` verdes con asserts nuevos de `measureAsync` + smoke de labels; cobertura del código nuevo >= 80%, sin bajar la existente.
- [ ] `npm run build` OK; `npx tsc --noEmit` sin errores.

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Observaciones para el implementador:**

1. Es un issue de esfuerzo S sobre un solo branch / un solo owner — NO hay agentes paralelos, asi que no aplica riesgo de overlap de ownership. La tabla de file ownership es informativa, no una asignacion luna/nico. Si se delega, va a UN solo implementador (perfil backend/services).
2. La forma exacta de `followUser:41` (asignacion `const followingCount = await measureAsync('follows_followingCount', () => getCountOfflineSafe(`) DEBE quedar con `measureAsync(` y `getCountOfflineSafe(` en la misma linea fisica. Verificado contra `checks.mjs:271`: el grep R7 matchea la linea de `getCountOfflineSafe(` y la neutraliza solo si `measureAsync` esta en esa misma linea. El cierre `));` en lineas siguientes no afecta. Confirmar con el grep local de F1 ANTES de F4.
3. Claves camelCase (`follows_followingCount`, `favorites_count`) NO se normalizan a snake puro — replican el precedente prod `follows_followersCount` (verificado en `perfHelpers.ts:72` y seed `:917`). Escritas literalmente en cada paso, mantenerlas asi.
4. F3a (setup de mocks en `favorites.test.ts`) es trabajo de infraestructura, no un assert: el archivo hoy NO mockea `getCountOfflineSafe`/`measureAsync` ni importa `fetchUserFavoritesCount` (verificado `:1-22`). El paso F3a-3 (verificar si `offlineInterceptor`/`gateServiceWrite` necesita mock) queda como verificacion durante implementacion — los tests de add/remove ya ejercen `gateServiceWrite` (`favorites.ts:32,59`) pero `fetchUserFavoritesCount` no lo toca, asi que probablemente no haga falta mockearlo para el test nuevo. No es bloqueante.
5. El branch sugerido en F1 (`feat/347-perf-instrument-count-queries`) asume base `main`; el repo trabaja sobre `new-home`. Confirmar la base correcta al crear el branch (decision de quien delega, no del plan).
6. El plan asume que `.guards-baseline.json` para R7 ya espera 0 hits (F4 paso 2). Si el baseline actual cuenta los 3 sites como hits esperados, F4 va a requerir bajar el baseline en el commit de F1 — el plan ya lo contempla ("ajustar baseline en el commit de F1 con justificacion"). Verificar el valor del baseline antes de cerrar F4.

Cobertura specs->plan completa (3 call sites, 2 claves nuevas en labels+seed, smoke de labels, no-crear perfHelpers.test.ts, out-of-scope respetados). Orden de fases correcto (F1 raiz, F3a antes de F3b, dependencia F3b->F2 documentada). Test plan integrado con la feature, no al final. Rollback por fase definido. Sin BLOQUEANTES ni IMPORTANTES.
