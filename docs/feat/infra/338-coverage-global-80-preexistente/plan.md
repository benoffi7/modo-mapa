# Plan: Tech debt — coverage global <80% (preexistente, descubierto en #330)

**Specs:** [specs.md](specs.md)
**PRD:** [prd.md](prd.md)
**Issue:** #338
**Fecha:** 2026-05-16

---

## Resumen del enfoque

Plan en 4 fases secuenciales (S1 -> S2 -> S3 -> Documentacion). Cada fase tiene un gate de salida claro:

- **Fase 1 (S1)**: salida = lista exhaustiva de archivos con `% Branch < 80%` documentada en el PR.
- **Fase 2 (S2)**: salida = `npm run test:coverage` reporta branches global `>= 81%` y los 4 thresholds pasan.
- **Fase 3 (S3)**: salida = CI workflow `deploy.yml` job `test` pasa en una rama temporal pusheada.
- **Fase 4 (Documentacion)**: salida = `tests.md` + `project-reference.md` actualizados con formato OBS #1.

---

## Fases de implementacion

### Fase 1 (S1): Identificar archivos con branches uncovered

**Branch:** `feat/338-coverage-80-branches` (creada desde `new-home`)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | (terminal) | `git checkout new-home && git pull && git checkout -b feat/338-coverage-80-branches` |
| 2 | (terminal) | `npm ci` (asegurar deps frescas, mismo runtime que CI). |
| 3 | (terminal) | Ejecutar `npx vitest run --coverage 2>&1 | tee /tmp/coverage-338.log`. Esperado: el run falla por threshold de branches (este es el punto de partida). |
| 4 | (terminal) | Parsear la salida con: `grep -E "does not meet|^\s*[0-9]+ \|" /tmp/coverage-338.log` y `awk -F'|' '$3 ~ /[0-9]/ && $3+0 < 80' /tmp/coverage-338.log` (tomado del PRD S1). |
| 5 | (terminal) | Inspeccionar tambien la salida HTML/JSON de v8: `coverage/coverage-summary.json` para precision (no depender solo de stdout). `cat coverage/coverage-summary.json | jq 'to_entries[] | select(.value.branches.pct < 80) | {file: .key, branches: .value.branches.pct}'`. |
| 6 | `docs/feat/infra/338-coverage-global-80-preexistente/s1-findings.md` (nuevo, temporal) | Documentar la lista exhaustiva: `<archivo> — % branches actual — # branches faltantes — branches especificas (lineas)`. Este file es referencia para Fase 2; puede borrarse en Fase 4 si se prefiere no commitearlo (decision en Fase 4 paso 5). |
| 7 | (mental check) | Si la lista revela archivos distintos a los 4 sospechosos: registrar en `s1-findings.md`. Si revela `<=4 archivos` y todos son los sospechosos: continuar a Fase 2 con la tabla del specs. |
| 8 | (escalation gate) | Si la lista revela mas de **10 archivos** con `< 80%` branches: parar y reportar al usuario antes de continuar — puede senalar regresion estructural mas profunda. |

**Gate de salida Fase 1**: lista exhaustiva con archivos y branches especificas documentada en `s1-findings.md`. Si la lista esta vacia (el run sale sin error de threshold), parar y reportar — es posible que el bug se haya resuelto incidentalmente entre #330 merge y hoy; en ese caso, solo se ejecuta Fase 4 (actualizar `tests.md` con la metrica real actual).

---

### Fase 2 (S2): Tests targeted por archivo identificado

Esta fase es **iterativa**: por cada archivo de la lista de Fase 1, aplicar la regla de ampliar/crear-nuevo (specs D1) + el gate de fix-as-you-go (PRD tabla de 5 casos) + la regla de parada (PRD seccion "Regla de parada de S2").

#### Fase 2.A — Sospechosos a priori (si Fase 1 los confirma)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/syncEngine.test.ts` (LOC 411) | Ampliar si Fase 1 lo confirma. Branches a cubrir segun specs casos: probablemente el path "no match en switch" (cast a `OfflineAction` con type invalido). Verificar contra `s1-findings.md`. Si el archivo cruza 400 LOC, decidir partir en `syncEngine.errors.test.ts` (criterio scenario disjunto del PRD). |
| 2 | `src/utils/perfMetrics.test.ts` (LOC 222) | Ampliar. Casos: (a) doble flush -> verificar early return por `flushed`; (b) flush sin vitals -> early return; (c) `navigator.onLine === false` -> no llama `httpsCallable`; (d) `httpsCallable` reject -> `flushed = false` y siguiente flush funciona; (e) si Fase 1 lo marca: `scheduleFlush` con `flushTimer` existente -> `clearTimeout` invocado. Patron: `vi.resetModules()` + `freshImport()` por test. Mock `navigator` via `vi.stubGlobal`. |
| 3 | `src/components/business/__tests__/QuestionForm.test.tsx` (LOC 69) | Si Fase 1 lo confirma: ampliar con caso explicito `value=''` que NO renderiza helperText (`expect(screen.queryByText(/\//)).not.toBeInTheDocument()`). Verificar disabled state combinatorio `isSubmitting && value.trim()`. |
| 4 | `src/context/FiltersContext.test.tsx` (LOC 57) | Si Fase 1 lo confirma: ampliar. Posibles branches: identidad referencial del `value` de `useMemo` entre re-renders sin cambio de state; consumir el context sin `Provider` (usa default values). Si el test queda en `< 100%` post-ampliacion, dejar nota en el PR. |

#### Fase 2.B — Archivos extra de S1 (si los hay)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `<extra-1>.ts` test file | Para cada archivo extra de Fase 1: aplicar D1 (ampliar default; crear nuevo solo bajo los 3 criterios). Documentar decision en commit message. |
| 6 | `<extra-N>.ts` test file | Idem. |

#### Fase 2.C — Re-run y regla de parada

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | (terminal) | Tras agregar tests del bloque anterior, re-correr `npm run test:coverage`. |
| 8 | (mental check) | Aplicar regla de parada de S2 del PRD: si branches global `>= 81%` -> Fase 3. Si `[80%, 81%)` -> agregar tests al siguiente archivo de la lista con menor `% Branch` (volver a paso 5). Si `< 80%` -> seguir cubriendo. |
| 9 | (escalation gate) | Si llegar a `>= 81%` requiere `c8 ignore` masivo (mas de **5 usos nuevos**) o tests artificiales (test que solo invoca codigo sin assert real para inflar branches): **parar y escalar al usuario**. PRD seccion "Observaciones para el implementador" explicita este gate. |

#### Fase 2.D — Fix-as-you-go (si aparece)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | (codigo productivo, solo si aplica) | Para cada hallazgo durante Fase 2.A-B, aplicar gate del PRD (tabla de 5 casos): bug productivo -> fix con commit `fix: <descripcion>`; dead code trivial -> eliminar (commit separado); dead code no-trivial -> abrir issue y `c8 ignore` mientras tanto; defensive jsdom -> `c8 ignore next` con `// jsdom-unsupported: <razon>`; refactor mas amplio -> issue separado. |
| 11 | (commit) | Cada fix-as-you-go: commit separado del commit de tests, mensaje claro. No mezclar 5+ archivos de fix en un solo commit. |

**Gate de salida Fase 2**: `npm run test:coverage` local pasa los 4 thresholds (statements 80, branches 80, functions 77, lines 80), con branches global `>= 81%`. Si no se alcanza, no avanzar — re-inspeccionar `s1-findings.md` y aplicar regla de parada.

---

### Fase 3 (S3): Validacion local + CI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | (terminal) | **Pre-merge gate local** (specs D6): `npm ci && npm run lint && npm run test:coverage`. Reproduce exactamente jobs `lint` + `test` de `.github/workflows/deploy.yml`. **NO** usar `npm run test:run` — eso es lo que corre `deploy-staging.yml` y no valida coverage. |
| 2 | (terminal) | Si paso 1 pasa: `git push -u origin feat/338-coverage-80-branches`. |
| 3 | (verificar CI) | Esperar a que corra el workflow asociado al push. **Importante**: `deploy.yml` corre solo en push a `main`, no en ramas feature. Para validar el job `test`, crear un PR draft contra `new-home` (que tampoco dispara `deploy.yml` directamente — `deploy.yml` se gatilla en push a `main` post-merge). El workflow que SI corre en ramas feature/PR es `deploy-staging.yml` (que NO valida coverage). |
| 4 | (decision gate) | **El gate efectivo de coverage es local + el merge a `main`**. Para validar antes de merge, ejecutar local. Tras merge a `new-home`, el merge skill (`/merge`) corre sus propios checks. El job `test` de `deploy.yml` se valida realmente recien al hacer push a `main` post-merge — si falla ahi, escalar como issue separado (specs D6: "si en CI falla pese a pasar local, es senal de inconsistencia de entorno"). |
| 5 | (verificar) | Confirmar que `vitest.config.ts` no fue modificado: `git diff new-home -- vitest.config.ts` debe ser vacio (Success Criteria #4 del PRD). |

**Gate de salida Fase 3**: pre-merge gate local pasa + push exitoso + (cuando se haga el merge a `main` post-Fase 4) job `test` del `deploy.yml` pasa.

---

### Fase 4 (final, OBLIGATORIA): Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/tests.md` | Actualizar seccion "Cobertura actual" con formato OBS #1 / specs D5 (dos tablas etiquetadas: global incluye-archivos-sin-test + promedio archivos-con-test). Actualizar fecha. Actualizar contador "Total test cases" con `+N` correspondiente al delta de tests agregados en Fase 2. |
| 2 | `docs/reference/tests.md` | Si Fase 2 agrego tests a `syncEngine`, `perfMetrics`, `QuestionForm`, `FiltersContext` u otros: actualizar las filas de "Inventario de Tests" correspondientes con el nuevo `Cases` y `Cobertura`. |
| 3 | `docs/reference/project-reference.md` | En la linea "Tests" (linea ~109 del documento, narrativa de deltas): agregar `#338 +N frontend coverage backfill (branches)`. Actualizar el total acumulado `1702 frontend + 528 functions tests` con el nuevo total. |
| 4 | `docs/_sidebar.md` | Agregar entradas para este feature en seccion **Infra**:<br>`- [#338 Coverage Global 80 Branches (preexistente)](/feat/infra/338-coverage-global-80-preexistente/prd.md)`<br>`  - [Specs](/feat/infra/338-coverage-global-80-preexistente/specs.md)`<br>`  - [Plan](/feat/infra/338-coverage-global-80-preexistente/plan.md)` |
| 5 | `docs/feat/infra/338-coverage-global-80-preexistente/s1-findings.md` | **Decision**: si la lista de Fase 1 es valiosa como referencia historica (10+ items con detalle), mantener el archivo. Si fueron solo los 4 sospechosos: eliminar el archivo o convertirlo en una seccion "Hallazgos S1" del PR description. Default: eliminar para no acumular temporales en docs. |
| 6 | (no aplica) | `docs/reference/security.md`, `firestore.md`, `features.md`, `patterns.md`, `HelpSection.tsx`: **no se tocan** — el feature es solo tests, no cambia rules, datos, features, patrones, ni copy. |

**Gate de salida Fase 4**: `tests.md` refleja la metrica real con el formato de dos tablas etiquetadas; `project-reference.md` y `_sidebar.md` actualizados; `s1-findings.md` resuelto (mantenido o eliminado).

---

## Orden de implementacion

1. Fase 1 paso 1-2 — branch + `npm ci`.
2. Fase 1 paso 3-5 — coverage run + parse.
3. Fase 1 paso 6-8 — documentar findings + escalation check.
4. Fase 2.A — sospechosos confirmados (orden por menor LOC primero: `FiltersContext` -> `QuestionForm` -> `perfMetrics` -> `syncEngine`).
5. Fase 2.B — extras de S1, si los hay.
6. Fase 2.C — re-run iterativo hasta gate de salida.
7. Fase 2.D — fix-as-you-go, intercalado segun aparezca.
8. Fase 3 — pre-merge gate local + push.
9. Fase 4 — docs.

Dependencia critica: Fase 2 no puede empezar sin la lista exhaustiva de Fase 1 (no atajar empezando por los sospechosos — el PRD explicitamente contempla que la lista puede diferir).

---

## Estimacion de tamano de archivos

| Archivo | LOC actual | LOC estimado post-cambios | Riesgo de blocker 400 |
|---------|-----------|---------------------------|----------------------|
| `src/services/syncEngine.test.ts` | 411 | 420-450 (+10-40) | **ALTO** — ya cruzo 400. Si Fase 2.A agrega >10 LOC, decidir partir en `syncEngine.errors.test.ts`. |
| `src/utils/perfMetrics.test.ts` | 222 | 280-320 (+60-100) | Bajo |
| `src/components/business/__tests__/QuestionForm.test.tsx` | 69 | 85-100 (+15-30) | Bajo |
| `src/context/FiltersContext.test.tsx` | 57 | 70-85 (+15-30) | Bajo |
| `<extras de S1>` | ? | ? | Evaluar caso por caso en Fase 2.B |
| `docs/reference/tests.md` | ~400 | ~410 | Bajo (doc, no codigo) |

**Decomposicion preventiva**: `syncEngine.test.ts` ya esta en 411 LOC. Si Fase 2.A requiere >5 LOC nuevos, aplicar el criterio "scenario disjunto" del PRD y crear `syncEngine.errors.test.ts` con los tests de branches faltantes (mantener convencion de nombres `<archivo>.<scenario>.test.ts` como `syncEngine.323.test.ts`).

---

## Riesgos

1. **S1 revela mas de 10 archivos con `< 80%` branches**: indica regresion estructural mas profunda que el alcance estimado del PRD. Mitigacion: gate de escalacion en Fase 1 paso 8 — parar y reportar al usuario antes de empezar Fase 2.
2. **`syncEngine.test.ts` cruza 450 LOC tras Fase 2.A**: el file ya esta en 411. Mitigacion: aplicar criterio scenario-disjunto del PRD y partir en `syncEngine.errors.test.ts` antes de pasarse del blocker 400 (regla de file-size-directive).
3. **CI `deploy.yml` falla post-merge pese a local pasar**: senala inconsistencia entre entorno local (Pi) y CI (Ubuntu node22). Mitigacion: D6 + Fase 3 paso 4 — escalar como issue separado, no patchear el threshold. Validar diferencia con `npm ci` (no `npm install`) y `node --version`.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — no se agregan componentes.
- [x] Archivos nuevos en carpeta de dominio correcta — tests viven co-localizados con el archivo testeado o en `__tests__/` del modulo, segun convencion existente.
- [x] Logica de negocio en hooks/services, no en componentes — no se modifica logica productiva (excepto fix-as-you-go acotado por gate).
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix — N/A (no hay issues abiertos de tech debt segun PRD).
- [x] Ningun archivo resultante supera 400 lineas — `syncEngine.test.ts` ya excede; plan contempla split preventivo. Otros files dentro de margen.

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — N/A (sin colecciones nuevas).
- [x] Todo campo string tiene `.size()` — N/A.
- [x] Todo campo list tiene `.size()` — N/A.
- [x] Admin writes tienen validacion — N/A.
- [x] Counter decrements usan `Math.max(0, ...)` — N/A.
- [x] Rate limits llaman `snap.ref.delete()` — N/A.
- [x] Toda coleccion escribible tiene CF trigger con rate limit — N/A.
- [x] No hay secrets, admin emails, credenciales en archivos commiteados — verificado en Fase 2 mediante revision manual de cada test agregado (UIDs sinteticos, emails `@example.com`).
- [x] `getCountFromServer` -> `getCountOfflineSafe` — N/A (no se agregan reads).

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — N/A.
- [x] Todo service nuevo tiene `measureAsync` — N/A.
- [x] Todo `trackEvent` nuevo en `GA4_EVENT_NAMES` — N/A.
- [x] Todo `trackEvent` nuevo tiene feature card — N/A.
- [x] `logger.error` no esta dentro de `if (import.meta.env.DEV)` — no se modifica codigo productivo de logging.

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — N/A (sin UI nueva). Si Fase 2.A toca tests de `QuestionForm`, no se cambia su markup; el aria-label "Publicar pregunta" ya existe.
- [x] No `<Typography onClick>` — N/A.
- [x] Touch targets `>= 44x44px` — N/A.
- [x] Componentes con fetch tienen error state — N/A.
- [x] `<img>` con URL dinamica tienen `onError` — N/A.
- [x] httpsCallable en componentes user-facing tienen guard offline — N/A. (`perfMetrics.flushPerfMetrics` ya tiene su propio guard `!navigator.onLine`; los tests de Fase 2 confirman ese path).

## Guardrails de copy

- [x] Voseo — N/A (sin copy nuevo).
- [x] Tildes — N/A.
- [x] Terminologia "comercios" — N/A.
- [x] Strings reutilizables en `src/constants/messages/` — N/A.

---

## Fase final: Documentacion (OBLIGATORIA — ver Fase 4 arriba)

Ya cubierta en Fase 4. Resumen de archivos doc tocados:

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/tests.md` | Cobertura actual con formato OBS #1 (dos tablas etiquetadas) + actualizacion de fila por archivo tocado en inventario |
| 2 | `docs/reference/project-reference.md` | Linea Tests con `#338 +N frontend coverage backfill (branches)` + total acumulado |
| 3 | `docs/_sidebar.md` | Nueva entrada para este feature en seccion Infra |
| 4 | `docs/reference/security.md` | **No se toca** — no se modifican rules ni superficies |
| 5 | `docs/reference/firestore.md` | **No se toca** — sin cambios de schema |
| 6 | `docs/reference/features.md` | **No se toca** — sin features nuevas |
| 7 | `docs/reference/patterns.md` | **No se toca** — sin patrones nuevos |
| 8 | `src/components/menu/HelpSection.tsx` | **No se toca** — sin cambios visibles al usuario |

---

## Criterios de done

- [ ] `npm run test:coverage` local pasa los 4 thresholds (statements 80, branches 80, functions 77, lines 80) con branches global `>= 81%`.
- [ ] `s1-findings.md` documenta la lista exhaustiva de Fase 1 (o se confirma que la lista es solo los 4 sospechosos y se incorpora en commit message).
- [ ] Cada archivo de la lista de Fase 1 tiene `>= 1 test` nuevo por branch que estaba uncovered.
- [ ] `vitest.config.ts` no fue modificado (verificable con `git diff new-home -- vitest.config.ts`).
- [ ] Si se uso `/* c8 ignore */`, formato exacto OBS #2 (`/* c8 ignore next */ // jsdom-unsupported: <razon>` o prefijo analogo).
- [ ] `docs/reference/tests.md` actualizado con formato dos-tablas etiquetadas (D5).
- [ ] `docs/reference/project-reference.md` actualizado con `#338 +N` en linea Tests.
- [ ] `docs/_sidebar.md` tiene la nueva entrada de Infra.
- [ ] Pre-merge gate local cumplido (specs D6).
- [ ] No se introdujeron secretos ni UIDs reales en tests.
- [ ] Build succeeds: `npm run build` pasa (validar antes de push).
- [ ] Lint succeeds: `npm run lint` pasa.

---

## Validacion de Plan

**Delivery Lead**: Pablo
**Fecha**: pendiente
**Estado**: pendiente (este plan se generara antes de invocar Pablo — el usuario indica no invocar agentes)

> Nota: el usuario solicito generar specs+plan sin invocar Diego ni Pablo. El sello queda pendiente para una iteracion posterior si se decide pasarlos por los validadores.

---

## Validacion de Plan

**Delivery Lead**: Pablo
**Fecha**: 2026-05-02
**Estado**: VALIDADO

### Contexto revisado

- PRD: `docs/feat/infra/338-coverage-global-80-preexistente/prd.md` (sello Sofia: VALIDADO CON OBSERVACIONES, 2026-05-02)
- Specs: `docs/feat/infra/338-coverage-global-80-preexistente/specs.md` (sin sello formal de Diego; el usuario indica proceder por excepcion — feature es solo tests, sin decisiones tecnicas productivas que arbitrar)
- Plan: `docs/feat/infra/338-coverage-global-80-preexistente/plan.md`
- Total fases: 4 (S1 -> S2 -> S3 -> Documentacion)
- Agentes propuestos: secuencial, un solo implementador (sin paralelizacion luna/nico — no aplica para feature de tests)

### Cerrado en esta iteracion

- No hay hallazgos BLOQUEANTES.
- No hay hallazgos IMPORTANTES.

### Checklist de delivery — resultado

1. **Cobertura specs -> plan**: cada S1/S2/S3 + Documentacion aparece como fase. Fix-as-you-go cubierto en Fase 2.D. D1-D6 referenciadas. Out-of-scope (bajar threshold, refactor amplio, CF coverage) NO aparecen como pasos. OK.
2. **Orden logico**: Fase 1 produce lista exhaustiva antes que Fase 2 la consuma. Tests antes de docs. Pre-merge gate local antes de push. OK.
3. **Granularidad**: pasos atomicos por archivo. Fase 2 iterativa con gate de parada explicito. OK.
4. **Ownership**: trabajo secuencial sin paralelizacion; no hay overlap de archivos. OK.
5. **Test plan integrado**: los tests SON la feature, no hay paso "agregar tests al final". OK.
6. **Risk staging**: sin schema/rules/migrations. Cambios totalmente reversibles. OK.
7. **Rollback**: revert commit suficiente (solo tests + docs). OK.
8. **Estimacion**: alineada con PRD (S, posible M). OK.
9. **Deploy/merge**: un PR contra `new-home`. Plan reconoce honestamente que `deploy.yml` solo se valida en push a `main` post-merge; mitigado con pre-merge gate local que reproduce exactamente jobs `lint` + `test`. OK.
10. **Documentacion**: `tests.md`, `project-reference.md`, `_sidebar.md` cubiertos con formato OBS #1. `security.md`, `firestore.md`, `features.md`, `patterns.md`, `HelpSection.tsx`, `privacy policy`: explicitamente marcados N/A con razon. OK.

### Observaciones para la implementacion

- **Gate de escalacion Fase 1 paso 8 (>10 archivos)**: si la lista de S1 revela mas de 10 archivos con `< 80%` branches, el plan instruye parar y reportar antes de empezar S2. Respetarlo — puede senalar regresion estructural fuera del alcance del PRD.
- **Split preventivo de `syncEngine.test.ts`**: ya en 411 LOC. Si Fase 2.A agrega >5 LOC nuevos, aplicar el criterio scenario-disjunto y crear `syncEngine.errors.test.ts`. El plan ya lo contempla pero el implementador debe vigilarlo activamente para no chocar contra el blocker 400 del merge skill.
- **Pre-merge gate local es obligatorio**: `npm ci && npm run lint && npm run test:coverage`. NO basta con `npm run test:run` — eso corre `deploy-staging.yml` sin coverage. Si local pasa y CI a `main` falla post-merge, escalar como inconsistencia de entorno, no patchear el threshold.
- **Decision sobre `s1-findings.md`**: el plan deja default "eliminar al final" si la lista es solo los 4 sospechosos. Si la lista es valiosa como referencia historica (10+ items con detalle), mantener. Decision queda en Fase 4 paso 5.
- **Margen 81% es guidance, no contrato**: si llegar a 81% requiere `c8 ignore` masivo (>5 usos nuevos) o tests artificiales, parar y escalar — el plan tiene este gate en Fase 2.C paso 9. Es preferible mergear con 80.x% legitimo que con 81% inflado.
- **Merge skill `/merge` correra sus propios checks** post-merge a `new-home` (bump de version, audits, docs sync). El plan no lo menciona explicitamente pero es el flujo estandar — no requiere accion adicional del implementador.

### Listo para pasar a implementacion?

Si.
