# Specs: Tech debt — coverage global <80% (preexistente, descubierto en #330)

**PRD:** [prd.md](prd.md)
**Issue:** #338
**Fecha:** 2026-05-16

---

## Resumen tecnico

Este feature **no introduce codigo productivo**. El alcance es:

1. **S1** — Identificar archivos productivos del frontend con `% Branch < 80%` ejecutando `npm run test:coverage` y parseando la salida v8.
2. **S2** — Agregar tests targeted (ampliar test files existentes por default; crear nuevos solo bajo los 3 criterios del PRD) para cubrir las branches faltantes hasta que el global de branches alcance `>= 81%` (guidance de margen sobre el threshold real de CI de 80%).
3. **S3** — Validar local (`npm run test:coverage` pasa los 4 thresholds), reproducir el job `test` de `.github/workflows/deploy.yml`, y actualizar `docs/reference/tests.md` y `project-reference.md`.

No hay modelo de datos nuevo. No hay rules nuevas. No hay Cloud Functions nuevas. No hay UI nueva. No hay textos user-facing. Las secciones del template que no aplican estan marcadas explicitamente como **N/A** con razon corta.

---

## Modelo de datos

**N/A** — no se introducen colecciones, campos, ni interfaces TypeScript nuevas.

## Firestore Rules

**N/A** — no se agregan ni modifican rules.

### Rules impact analysis

**N/A** — el feature no introduce queries productivas. Los tests mockean Firebase SDK con `vi.mock('firebase/firestore', ...)`, sin tocar reglas reales ni el emulador.

### Field whitelist check

**N/A** — no se agregan ni modifican campos en colecciones.

## Cloud Functions

**N/A** — no se agregan triggers, scheduled functions, ni callables.

## Seed Data

**N/A** — no se introducen colecciones nuevas ni campos requeridos.

## Componentes

**N/A** — no se modifica codigo productivo de componentes. Si durante S2 un fix-as-you-go encuentra un bug en un componente y corresponde fix segun la tabla del PRD (fila "Bug productivo"), se documenta en el commit del fix; no se introducen componentes nuevos.

### Mutable prop audit

**N/A** — sin componentes nuevos.

## Textos de usuario

**N/A** — el feature no toca UI ni copy.

## Hooks

**N/A** — no se agregan hooks. `FiltersContext.useFilters` ya tiene tests que cubren el 100% de sus branches (verificado al leer `FiltersContext.test.tsx`); si S1 confirma `< 80%` en branches de este modulo, S2 amplia el test file existente, no crea hook nuevo.

## Servicios

**N/A** — no se modifican servicios. Si fix-as-you-go corrige un bug en `syncEngine` o similar, el cambio queda acotado al diff documentado en el commit.

## Integracion

**N/A** — no hay integracion con codigo productivo. La integracion ocurre solo a nivel de tests (ampliacion de `*.test.ts(x)`).

### Preventive checklist

- [x] **Service layer**: Tests no importan `firebase/firestore` directamente — usan `vi.mock('firebase/firestore', ...)` por convencion de `tests.md`.
- [x] **Duplicated constants**: No se agregan constantes. Si un test necesita un valor constante, lo importa de `src/constants/`.
- [x] **Context-first data**: No aplica (no hay nuevas lecturas).
- [x] **Silent .catch**: Si fix-as-you-go corrige un `.catch(() => {})`, debera usar `logger.warn` minimo. Caso a documentar en el commit del fix si aplica.
- [x] **Stale props**: N/A — no se introducen componentes.

## Tests

Este feature **es** un trabajo de tests. La tabla de abajo cubre los 4 sospechosos a priori del PRD; **la lista final** se confirma en S1 (paso 1 del plan) y puede agregar/quitar archivos. Si S1 revela archivos distintos, esta seccion se actualiza antes de empezar S2.

### Archivos a testear (estimacion previa a S1)

| Archivo test | Que testear | Tipo | Accion |
|-------------|-------------|------|--------|
| `src/components/business/__tests__/QuestionForm.test.tsx` | Branches faltantes a confirmar en S1. Sospechosos: char-count branch cuando `value.length === 0` vs `> 0`, helperText render, disabled states combinados. El test existente ya cubre 9 escenarios (~100% sospechado); puede salir de la lista despues de S1. | Ampliar (si S1 confirma) | Default ampliar |
| `src/context/FiltersContext.test.tsx` | Branches faltantes a confirmar en S1. El test existente ya cubre toggleFilter add/remove, setPriceFilter set/toggle-off, setUserLocation set/null, setSearchQuery — sospechoso de estar al 100%. Puede salir de la lista despues de S1. | Ampliar (si S1 confirma) | Default ampliar |
| `src/services/syncEngine.test.ts` | Branch `error instanceof Error` vs no-Error en el catch de `processQueue` (linea 222 de `syncEngine.ts`). El test `'wraps non-Error throws in Error when marking failed'` ya cubre el path no-Error; **verificar en S1** si la branch que falta es otra (ej: el caso `newRetry < OFFLINE_MAX_RETRIES` con `deferred.push`, o la branch del switch sin match). | Ampliar `syncEngine.test.ts` | Default ampliar |
| `src/utils/perfMetrics.test.ts` | Sospechosos por inspeccion del codigo: `flushPerfMetrics` cuando `flushed === true` (early return linea 183), cuando `sessionId === ''` (early return linea 184), cuando `!hasVitals` (linea 189), cuando `!navigator.onLine` (linea 196). Tambien observers `try/catch` (linea 81, 95, 127, 141). | Ampliar `perfMetrics.test.ts` | Default ampliar |
| `<archivos extra de S1>` | A confirmar tras ejecutar S1 | Default ampliar; crear nuevo solo bajo los 3 criterios de S2 del PRD | Decision en S2 |

### Casos a cubrir por archivo (estimacion, refinar en S2)

**`syncEngine.test.ts`** — branches sospechadas faltantes:

- Default case del switch sin match (linea 26-191): no existe en el codigo (el switch no tiene `default`, asi que un type invalido pasa silencioso). **Si S1 marca esto como branch faltante**, agregar caso `executeAction` con `type` que no esta en el discriminado union para forzar el path "no case match" — esto requiere cast `as unknown as OfflineAction`.
- Branch `newRetry >= OFFLINE_MAX_RETRIES` ya cubierta por `'marks action failed after max retries'`.
- Branch `newRetry < OFFLINE_MAX_RETRIES` ya cubierta por `'defers failed actions instead of blocking with backoff'`.
- Branch `syncing === true` (early return) ya cubierta por `'prevents concurrent processing via syncing lock'`.

**`perfMetrics.test.ts`** — branches sospechadas faltantes en `flushPerfMetrics`:

- `flushed === true` early return: forzar dos `flushPerfMetrics()` consecutivos y verificar que el segundo no llama `httpsCallable`.
- `!hasVitals` early return: llamar `flushPerfMetrics` con vitals todos `null` (estado inicial) y verificar no-call.
- `!navigator.onLine`: stub `navigator.onLine = false` y verificar que no llama `httpsCallable`.
- Catch de `httpsCallable` que vuelve a poner `flushed = false`: hacer que `mockCallable` reject, verificar que `flushed` queda en `false` (chequear via re-llamar y ver que SI vuelve a invocar).
- `scheduleFlush`: forzar `flushTimer` existente y verificar que se cancela con `clearTimeout`.
- Observers `try/catch`: stub `PerformanceObserver` que tire (ya cubierto parcialmente en `perfMetrics.init.test.ts`). Verificar en S1 si falta cobertura aqui.

**`QuestionForm.test.tsx`** — branches sospechadas faltantes:

- `value.length > 0` vs `=== 0` para el helperText ternario (linea 52): el test `'shows char count when value is non-empty'` cubre el truthy; falta verificar explicitamente que `value=''` NO renderiza el helperText (no `getByText(/0\//)`).
- Confirmar en S1 si esta branch es la que falta o hay otra.

**`FiltersContext.test.tsx`** — todas las branches parecen cubiertas en el test existente. Si S1 reporta `< 80%`, identificar la branch real (probable: efecto de `useMemo` con re-render, o callback identity entre renders). Default: ampliar con tests de identidad referencial si aplica.

### Mock strategy

- **Firestore (`firebase/firestore`)**: mock estatico con `vi.mock` como en `syncEngine.test.ts` y `perfMetrics.test.ts`.
- **`firebase/functions`**: mock con `httpsCallable` retornando `mockCallable` configurable (patron de `perfMetrics.test.ts`).
- **`navigator` (`onLine`, `userAgent`, `connection`)**: `vi.stubGlobal('navigator', { ... })` + `vi.unstubAllGlobals()` en `afterEach` (patron existente en `perfMetrics.test.ts`).
- **PerformanceObserver**: `vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)` con la clase mock de `tests.md`.
- **Fake timers**: `vi.useFakeTimers({ shouldAdvanceTime: true })` + `vi.useRealTimers()` en `afterEach` (patron de `syncEngine.test.ts`).
- **Fresh module state**: `vi.resetModules()` antes de cada `await import('./perfMetrics')` cuando se necesita estado limpio (modulo tiene `let sessionId`, `let flushed`, `let flushTimer` a nivel de modulo).

### Criterios de aceptacion (de Success Criteria del PRD)

- `npm run test:coverage` pasa los 4 thresholds (statements 80, branches 80, functions 77, lines 80) local.
- Branches global `>= 81%` (guidance — margen de 1pp sobre threshold de CI).
- Cada archivo en la lista final de S1 tiene `>= 1 test` por branch que estaba uncovered.
- `vitest.config.ts` no se modifica.
- Si se usa `/* c8 ignore */`, formato exacto OBS #2 del PRD: `/* c8 ignore next */ // jsdom-unsupported: <razon corta>` (o prefijos `unreachable:`, `ssr-only:`, `type-narrowed:`).
- **Regla de parada de S2** se respeta literalmente (PRD seccion "Regla de parada de S2").
- **Gate de fix-as-you-go** se aplica antes de tocar codigo productivo (PRD tabla de 5 casos).

## Analytics

**N/A** — no se agregan eventos.

---

## Offline

**N/A** — no hay data flows nuevos. Los tests de `syncEngine` y `perfMetrics` SI cubren branches offline existentes (`navigator.onLine === false`, retry/defer de la cola, dynamic-import errors). Esto esta listado arriba en "Casos a cubrir por archivo".

### Cache strategy

**N/A**

### Writes offline

**N/A**

### Fallback UI

**N/A**

---

## Accesibilidad y UI mobile

**N/A** — sin UI nueva.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| N/A | — | — | — | — |

### Reglas

**N/A**

## Textos y copy

**N/A** — sin copy nuevo.

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| N/A | — | — |

### Reglas de copy

**N/A**

---

## Decisiones tecnicas

### D1 — Ampliar test files existentes vs crear nuevos

**Decision**: ampliar por default. Crear nuevo `<archivo>.<scenario>.test.ts(x)` solo si se cumple alguno de los 3 criterios del PRD (LOC > 300 cerca del blocker 400, scenario disjunto, setup conflictivo).

**Justificacion**: minimiza churn, mantiene la convencion `__tests__/X.test.tsx` co-localizada con el codigo, no fragmenta navegacion de tests.

**Alternativas rechazadas**:

- Crear archivo nuevo siempre: aumenta cantidad de archivos sin beneficio claro y fragmenta historial.
- Tocar solo los 4 sospechosos: el PRD ya contempla "archivos extra de S1" (S2.5) — la lista real puede diferir.

### D2 — Threshold real 80%, guidance 81%

**Decision**: el threshold de CI sigue siendo 80% (no se modifica `vitest.config.ts`). El `>= 81%` global de branches es **guidance interno** de este PR para tener margen de 1pp y absorber regresiones menores en futuros PRs sin re-disparar el bloqueo.

**Justificacion**: PRD seccion "Regla de parada de S2" + Success Criteria #4 explicitamente prohibe bajar threshold. El margen interno protege contra el patron historico (issue #301) de "agregamos 1 test y volvemos a romper".

**Alternativas rechazadas**:

- Bajar threshold a 79%: out-of-scope explicito del PRD.
- Subir threshold a 81%: cambia el contrato y podria romper otros PRs en flight.

### D3 — Manejo de branches inalcanzables: `/* c8 ignore next */`

**Decision**: usar `c8 ignore` solo como ultimo recurso (caso "branch defensiva inalcanzable en jsdom" del gate de fix-as-you-go). Formato exacto OBS #2: `/* c8 ignore next */ // jsdom-unsupported: <razon>`. Prefijos analogos `unreachable:`, `ssr-only:`, `type-narrowed:` cuando aplique.

**Justificacion**: sin comentario, no se aprueba el diff. Esto deja trazabilidad de POR QUE se ignora y permite auditar en el futuro si el comentario sigue vigente (ej: si jsdom incorpora `sendBeacon`).

**Regla operacional**: si la branch SE puede testear con mock (`navigator.onLine = false`, etc.), NO se usa `c8 ignore` — se testea. `c8 ignore` es ultimo recurso, no atajo.

### D4 — Fix-as-you-go acotado

**Decision**: aplicar el gate de 5 casos del PRD. Bug productivo o dead code trivial -> fix en este PR (con commit separado o claramente delimitado). Refactor para mejor testabilidad -> issue separado (out-of-scope). Branch defensiva jsdom -> `c8 ignore` con comentario. Si el fix excede "un diff acotado", parar y abrir issue.

**Justificacion**: el PRD es de tests, no de refactor. Mezclar refactor amplio aumenta riesgo de regresion y dificulta el review.

### D5 — `tests.md` reporta ambas metricas etiquetadas (OBS #1)

**Decision**: en S3.2, `docs/reference/tests.md` reporta:

- **Branches global (incluye archivos sin test) — fuente: `vitest coverage summary`**: el numero que evalua CI. Debe ser `>= 80%` (target del PR: `>= 81%`).
- **Branches promedio archivos con test — fuente: vitest coverage por-archivo**: indicador informativo de calidad de los tests existentes. Sin threshold.

**Justificacion**: el desfase 90.7% (historico) vs 79.48% (run real) que disparo este issue venia de mezclar las dos definiciones. Etiquetar explicitamente evita que el proximo `/health-check` se confunda.

**Formato exacto a usar** en `tests.md` (reemplaza la tabla actual de "Cobertura actual"):

```markdown
### Cobertura actual ({YYYY-MM-DD})

**Frontend (src/) — global (incluye archivos sin test, fuente: `vitest coverage summary`):**

| Metrica | % |
|---------|---|
| Statements | XX.X% |
| Branches | XX.X%  <-- threshold CI 80% |
| Functions | XX.X% |
| Lines | XX.X% |

**Frontend (src/) — promedio archivos con test (informativo, fuente: vitest coverage por-archivo):**

| Metrica | % |
|---------|---|
| Statements | XX.X% |
| Branches | XX.X% |
| Functions | XX.X% |
| Lines | XX.X% |

**Cloud Functions (functions/):** (sin cambios — fuera de scope #338)

| Metrica | % |
|---------|---|
| Statements | 98.5% |
| Branches | 89.4% |
| Functions | 100% |
| Lines | 98.4% |
```

### D6 — Pre-merge gate local reproduce `deploy.yml`

**Decision**: antes de hacer push de la rama, ejecutar localmente:

```bash
npm ci
npm run lint
npm run test:coverage
```

Estos son exactamente los pasos que correra `.github/workflows/deploy.yml` jobs `lint` + `test`. No basta con `npm run test:run` (eso es lo que corre `deploy-staging.yml` y NO valida coverage). Si local pasa pero CI falla, escalar — no patchear.

**Justificacion**: el blocker de CI vive en `deploy.yml` (push a `main`), no en `deploy-staging.yml`. Reproducir local el gate exacto reduce el round-trip de validacion y previene falsos positivos.

---

## Hardening de seguridad

**N/A** — no se introducen superficies nuevas (no hay rules, no hay endpoints, no hay colecciones, no hay queries productivas, no hay storage).

### Firestore rules requeridas

**N/A**

### Rate limiting

**N/A**

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| **Filtrar datos reales en tests** | Tests usan mocks (`vi.mock('firebase/firestore', ...)`); UIDs/emails sinteticos (`'test-uid'`, `'user@example.com'`). No se toca el emulador con datos productivos. | `*.test.ts(x)` del scope |
| **Secretos hardcoded en fixtures** | Convencion: no usar API keys reales en mocks. Si un test necesita simular un secret, usar literal `'fake-secret'` o `'<redacted>'`. | `*.test.ts(x)` del scope |

---

## Deuda tecnica: mitigacion incorporada

Issues consultados (segun PRD seccion "Deuda tecnica y seguridad"):

- `gh issue list --label security --state open` -> `[]`
- `gh issue list --label "tech debt" --state open` -> `[]`

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #338 (este issue) | Coverage global de branches < 80% bloqueando `deploy.yml`. | Todo el plan |
| #330 (cerrado v2.48.0) | No se cierra aqui, pero #338 es el followup explicito. | Contexto, no accion. |
| #301 (cerrado, patron previo del mismo problema) | Replicar patron: agregar tests targeted, NO bajar threshold. | D2 (decision tecnica) + Plan Fase 2 |

Adicionalmente, si durante S2 aparece un fix-as-you-go que coincide con item en `docs/reports/tech-debt.md`, mencionarlo en el commit.

---


## Validacion Tecnica

**Arquitecto**: Diego
**Fecha**: 2026-05-02
**Estado**: VALIDADO CON OBSERVACIONES

### Contexto revisado

- PRD con sello Sofia VALIDADO CON OBSERVACIONES (2026-05-02).
- Patrones: `docs/reference/patterns.md`, `docs/reference/tests.md`.
- CI: `.github/workflows/deploy.yml` (corre `npm run test:coverage`, gate real), `.github/workflows/deploy-staging.yml` (corre `npm run test:run`, sin gate). Consistente con specs D6.
- Config: `vitest.config.ts` con thresholds `statements 80, branches 80, functions 77, lines 80`. Specs Success Criteria #4 lo respeta (`vitest.config.ts` no se modifica).
- Verificado en codigo: existencia de los 4 test files sospechosos, LOC reales (`syncEngine.test.ts` 411, `perfMetrics.test.ts` 222, `QuestionForm.test.tsx` 69, `FiltersContext.test.tsx` 57), switch sin `default` en `syncEngine.ts:29` (specs lo afirma correctamente).

### Resultado del checklist tecnico

- **Cobertura PRD -> specs**: cada solucion del PRD (S1, S2, S3, regla de parada, gate de fix-as-you-go, OBS #1, OBS #2) tiene seccion correspondiente en el specs (D1-D6 + "Casos a cubrir por archivo" + criterios de aceptacion).
- **Data model / rules / Cloud Functions / security / a11y / analytics**: **genuinamente N/A** — el feature no introduce codigo productivo. El specs marca cada seccion como `N/A` con razon corta. No corresponde marcar BLOQUEANTE la ausencia de cosas que el feature por definicion no introduce.
- **Consistencia con patrones**: respeta `patterns.md` (no barrel para hooks, no silent `.catch`, `logger.error` fuera de `if DEV`). Los menciona como guardrails en el preventive checklist.
- **Mock strategy**: alineada con la seccion "Patrones de Testing" de `tests.md` — `vi.mock('firebase/firestore', ...)`, `vi.stubGlobal('navigator', ...)`, `vi.resetModules()` para fresh state, fake timers + `vi.useRealTimers()` en `afterEach`.
- **Riesgo file-size (`syncEngine.test.ts` en 411 LOC)**: el specs lo reconoce en D1 (criterio "LOC > 300 cerca del blocker 400") y el plan tiene mitigacion (split preventivo en `syncEngine.errors.test.ts`). Cubierto.
- **Gate CI**: D6 reproduce localmente lo que corre `deploy.yml`. Verificado contra los workflows reales.
- **OBS #1 (dos metricas etiquetadas)**: D5 transcribe el formato exacto a usar en `tests.md`, evitando la ambiguedad que disparo este issue.
- **OBS #2 (`/* c8 ignore */`)**: D3 + regla operacional ("si la branch se puede testear con mock, NO se usa `c8 ignore`"). El plan agrega gate cuantitativo (>5 usos nuevos -> escalar).

### Cerrado en Ciclo 1

No hay BLOQUEANTES.
No hay IMPORTANTES — el specs documenta los huecos como "a confirmar en S1", patron valido para un feature exploratorio donde la lista real depende de la salida de coverage.

### Observaciones

- **OBS #1 — bloque previo de "Validacion Tecnica" con estado `pendiente`**: el specs traia un bloque heredado que decia "este specs se generara antes de invocar Diego — el usuario indica no invocar agentes". Esta iteracion invoca Diego, asi que el bloque previo queda reemplazado por este sello. No es un hueco tecnico del feature, es un ajuste de traza documental — resuelto al agregar este bloque.

### Observaciones tecnicas para el plan (Pablo)

- **Fase 1 paso 5**: el specs/plan parsea `coverage/coverage-summary.json` con `jq`. Verificar que el reporter `json-summary` este habilitado en `vitest.config.ts` o que la salida de v8 genere ese archivo. Si no esta, anadirlo al config no es modificacion del threshold (no rompe Success Criteria #4), pero conviene que Pablo lo tenga visible en el plan.
- **Fase 3 paso 3-4**: el plan describe correctamente que `deploy.yml` solo gatea en push a `main`, no en feature branches/PRs. El gate efectivo pre-merge es local. Esto esta bien identificado; Pablo solo debe confirmar que el orden (pre-merge gate local -> merge -> push a main) no deja ventana donde otro PR mergee primero y rompa el threshold entre validacion local y push a main.
- **Decomposicion preventiva de `syncEngine.test.ts`**: si Fase 2.A agrega >5 LOC, el plan ya contempla split. Pablo deberia validar el criterio de cuando ejecutar ese split (antes o despues de re-run de cobertura).
- **`s1-findings.md` (Fase 1 paso 6)**: el plan crea un archivo temporal en `docs/feat/...`. La decision de mantenerlo o eliminarlo queda diferida a Fase 4 paso 5. Coherente con el specs, no requiere cambio.

### Listo para pasar a plan?

Si. El specs no tiene huecos tecnicos bloqueantes, respeta los patrones del proyecto, y cierra las dos observaciones de Sofia con formato exacto. La unica observacion abierta es documental (bloque heredado), resuelta con este sello.
