# PRD: Tech debt — coverage global <80% (preexistente, descubierto en #330)

**Feature:** 338-coverage-global-80-preexistente
**Categoria:** infra
**Fecha:** 2026-05-16
**Issue:** #338
**Prioridad:** Alta (CI blocker en `deploy.yml` — push a `main`/`new-home`; `deploy-staging.yml` no esta afectado porque no corre coverage)

---

## Contexto

Durante el `/merge` de #330 (hooks coverage gaps, mergeado en v2.48.0) la auditoria post-merge detecto que el coverage **global** de branches del frontend cayo a **79.48%** — por debajo del threshold de **80%** configurado en `vitest.config.ts`. La feature #330 sumo +62 tests y elevo el coverage 0.21pp (desde 79.27%), pero no cerro el gap. El issue confirma con baseline antes/despues que el shortfall es **preexistente** a #330 y vive en archivos que la feature no toco. En este momento `npm run test:coverage` falla localmente y el workflow `.github/workflows/deploy.yml` (push a `main`/`new-home`) rechaza el deploy porque corre `npm run test:coverage` como gate. El workflow `.github/workflows/deploy-staging.yml` corre solo `npm run test:run` (sin coverage), por lo que NO esta afectado; no existe un `staging.yml` separado.

## Problema

- **CI blocker en `deploy.yml`**: `npm run test:coverage` falla por branches 79.48% < threshold 80%. El workflow que corre en push a `main`/`new-home` (deploy productivo y de docs) queda bloqueado hasta cerrar el gap o ajustar el umbral. `deploy-staging.yml` no esta afectado porque corre `test:run` sin coverage, pero entonces no hay gate de coverage antes de staging — el gap recien aparece al intentar promover a prod.
- **Origen no localizado**: el reporte de coverage del run de #330 no enumera explicitamente que archivos faltan branches — solo emite "does not meet" globalmente. Los probables culpables (segun la nota del merge skill Phase 1g del issue) son `QuestionForm`, `FiltersContext`, branches no-Error del catch en `syncEngine`, y la rama offline flush de `perfMetrics`, pero hay que confirmarlo con la salida real.
- **Regresion silenciosa**: el threshold de branches es 80% (lineas/stmts/funcs estan en 80/77/80 respectivamente y el frontend reporta 90.7% branches en `tests.md` — desajuste con el run actual). El gap aparecio sin gatear merges previos porque CI corrio sobre las metricas locales del run que ya pasaba el umbral.

## Solucion

### S1. Identificar archivos con branches uncovered

Ejecutar `npx vitest run --coverage 2>&1 | tee /tmp/coverage-338.log` y filtrar:

```bash
grep -E "does not meet|^\s*[0-9]+ \|" /tmp/coverage-338.log
grep "% Branch" -A 200 /tmp/coverage-338.log | awk -F'|' '$3 ~ /[0-9]/ && $3+0 < 80'
```

Resultado esperado: lista concreta de archivos con `% Branch < 80`. Sospechosos a priori (segun el issue):

- `src/components/business/QuestionForm.tsx` — validaciones de input, rate-limit branch, optimistic update branch.
- `src/context/FiltersContext.tsx` — branches de toggles de filtros, fallbacks de valores default.
- `src/services/syncEngine.ts` — `catch` con discriminacion `error instanceof Error` vs no-Error, dynamic-import error branch.
- `src/utils/perfMetrics.ts` — flush offline branch, beacon fallback branch.

S1 produce **una lista exhaustiva** con: `<archivo> — % branches actual — # branches faltantes`.

### S2. Tests targeted para cada archivo identificado

Para **cada** archivo con `% Branch < 80%` de S1, agregar branches faltantes. Los 4 sospechosos a priori **ya tienen test file existente**, por lo que la regla por defecto es **ampliar**, no crear archivos nuevos.

**Regla "ampliar vs crear nuevo"**:

- **Preferir ampliar** el test file existente del archivo productivo.
- **Crear un test file nuevo** (ej: `QuestionForm.branches.test.tsx`) solo si:
  1. El archivo existente supera 300 LOC y agregar mas tests lo lleva cerca del limite blocker de 400 LOC (ver `patterns.md`), O
  2. El scenario a cubrir es disjunto del propio (ej: tests de rate-limit pertenecen a su propio scenario file porque requieren fakeTimers globales que romperian los tests existentes), O
  3. El test file existente tiene un setup `beforeEach` que choca con los mocks que necesita el branch faltante.

En esos casos, nombrar el archivo nuevo `<archivo>.<scenario>.test.ts(x)` (mismo patron que `syncEngine.323.test.ts` o `perfMetrics.init.test.ts`).

**Sospechosos a priori (a confirmar en S1)** — todos tienen test file existente:

- **`QuestionForm`** (`src/components/business/__tests__/QuestionForm.test.tsx`): ampliar con validacion de input vacio, rate-limit hit (UI replaced por Alert), optimistic update success/error, submit con/sin texto, edit mode toggle.
- **`FiltersContext`** (`src/context/FiltersContext.test.tsx`): ampliar via `renderHook` con `FiltersProvider`; cubrir cada toggle (tags, price levels, distance), reset, default values cuando no hay user, persistencia opcional si aplica.
- **`syncEngine`** (`src/services/syncEngine.test.ts` + `syncEngine.323.test.ts`): ampliar — preferiblemente el primero — con branch del catch `throw 'string'` (no-Error) y `throw new Error(...)` para cubrir ambas ramas de `error instanceof Error`. Mock de `withOfflineSupport` y dynamic-import del service.
- **`perfMetrics`** (`src/utils/perfMetrics.test.ts` + `perfMetrics.init.test.ts`): ampliar `perfMetrics.test.ts` con flush `navigator.onLine === false`, flush con `navigator.sendBeacon` ausente, flush con sample empty array.

Si la lista de S1 incluye archivos adicionales no mencionados aqui, aplicar el mismo criterio: chequear si existe test file y ampliar; si no existe, crear uno siguiendo la convencion del modulo. Minimo 1 test por branch faltante.

### S3. Validacion y guard de regresion

1. `npm run test:coverage` debe pasar local con margen: branches >= 81% global (no quedar al filo). Ver "Regla de parada de S2" abajo para el criterio exacto.
2. Actualizar `docs/reference/tests.md` con el nuevo total de tests y el % real de branches (ver OBS #1 para que metrica reportar).
3. **No bajar el threshold** (la alternativa "bajar threshold a 79% como medida temporal" del issue queda explicitamente fuera de scope — ver Out of Scope).
4. **Pre-merge gate local**: antes de hacer push de la rama de este PRD, ejecutar `npm run test:coverage` localmente y confirmar que pasa los 4 thresholds. Esto reproduce exactamente lo que correra `deploy.yml` al mergear a `new-home`/`main`. No basta con `npm run test:run` (eso es lo que corre `deploy-staging.yml` y NO valida el threshold).
5. Validar que CI pasa: push a una rama temporal contra `new-home` y confirmar que el job de coverage en `.github/workflows/deploy.yml` pasa los 4 thresholds. (`deploy-staging.yml` no chequea coverage, asi que no sirve como validacion.)

### Regla de parada de S2

S2 termina cuando `npm run test:coverage` reporta `branches >= 81%` global. Procedimiento:

1. Cubrir con tests los archivos identificados en S1 que tienen `% Branch < 80%` (S2.1 a S2.4 + extras de S2.5).
2. Re-correr `npm run test:coverage` y leer el global de branches.
3. Si global `>= 81%` -> S2 OK, pasar a S3.
4. Si global esta en `[80%, 81%)` -> agregar tests al **siguiente** archivo de la lista de S1 con menor `% Branch` hasta cruzar 81%.
5. Si global `< 80%` -> seguir con los archivos restantes de S1 hasta entrar al rango y aplicar la regla anterior.

El **threshold real de CI es 80%** (configurado en `vitest.config.ts`). El `>= 81%` es **guidance** (margen de 1pp) para no quedar al filo y absorber pequenas regresiones de futuros PRs sin volver a bloquear CI.

### Gate de fix-as-you-go

Durante S2 puede aparecer codigo que se ve raro al intentar testearlo. Para cada hallazgo, aplicar este gate antes de tocar codigo productivo:

| Tipo de hallazgo | Que hacer en este PR | Comentario / accion adicional |
|------------------|---------------------|-------------------------------|
| **Bug productivo** (la branch existe y al cubrirla se descubre que el codigo esta mal — ej: condicion invertida, error que nunca se loggea, branch que silenciosamente devuelve `undefined` cuando deberia tirar) | **Fix en este PR** | Mencionar el bug en el commit message (`fix: <descripcion>`) y agregar el test que cubre el comportamiento correcto, no el bugueado |
| **Dead code de branch** (la branch es inalcanzable por construccion — ej: chequeo de `if (x)` despues de un `if (!x) return` previo) | **Eliminar el dead code en este PR** | Commit separado o claramente delimitado en el diff. Si el dead code es no-trivial (>5 lineas o atraviesa archivos), abrir issue y dejar `/* c8 ignore */` con justificacion mientras tanto |
| **Branch defensiva inalcanzable en jsdom** (ej: `if (typeof navigator.sendBeacon === 'undefined')` cuando jsdom siempre la tiene definida; fallback de `window.crypto`) | **No tocar codigo productivo** | Agregar `/* c8 ignore next */ // jsdom-unsupported: <razon>` en la linea inmediatamente anterior a la branch. Ver OBS #2 para el formato exacto |
| **Branch defensiva que SI se puede testear con mock** (ej: mockear `navigator.onLine = false`) | **Testear, no ignorar** | Esto es lo esperado en la mayoria de los casos; `c8 ignore` es ultimo recurso |
| **Refactor para mejorar testabilidad** (extraer funcion, exportar helper) | **Fuera de scope de este PR** | Anotar en el plan de issues, abrir issue de tech debt si es relevante |

Regla: este PRD no es un PR de refactor. Si un fix-as-you-go es no-trivial (mas de un diff acotado, requiere cambios en multiples archivos, o cambia API publica), parar y abrir issue separado en lugar de meterlo aca.

### UX

No hay impacto UX directo — es tech debt de tests. Sin embargo, indirectamente desbloquea la cadena de deploys, lo que significa que features pendientes (proximos merges) pueden llegar a prod sin friccion.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Run coverage + identificar archivos con branches uncovered | Alta | XS |
| S2.1 Tests para `QuestionForm` (si confirma) | Alta | S |
| S2.2 Tests para `FiltersContext` (si confirma) | Alta | S |
| S2.3 Tests para `syncEngine` non-Error catch branch | Alta | XS |
| S2.4 Tests para `perfMetrics` offline flush | Alta | XS |
| S2.5 Tests para archivos adicionales detectados en S1 | Media | S-M (variable) |
| S3. Validacion local + CI + update `tests.md` | Alta | XS |

**Esfuerzo total estimado:** S (M si S1 revela mas archivos de los esperados)

---

## Out of Scope

- **Bajar el threshold de branches a 79%** (alternativa rapida sugerida en el issue): rechazada porque desactiva el guard de regresion estructural. Si en un futuro se quiere relajar, debe hacerse via PRD aparte con justificacion.
- **Refactor de los archivos identificados** para reducir su complejidad ciclomatica. El alcance es solo agregar tests; no se toca codigo productivo salvo bugs detectados que ameriten fix-as-you-go.
- **Coverage de Cloud Functions** (`functions/`): este issue es sobre el frontend. Cloud Functions tiene su propio `vitest.config.ts` con thresholds separados y `tests.md` reporta 89.4% branches — fuera de scope.
- **Llegar a 100% branches**: el objetivo es >= 81% global con margen. Branches inalcanzables (codigo defensivo, fallbacks de browser APIs no testeables en jsdom) pueden documentarse con `/* c8 ignore next */ // jsdom-unsupported: <razon>` (formato exacto, ver OBS #2).

---

## Tests

Este feature **es** un trabajo de tests. La regla "toda nueva feature debe tener tests >=80%" no aplica en el sentido habitual — el feature consiste en crear los tests que faltan. Sin embargo:

### Archivos que necesitaran tests (estimacion previa a S1)

| Archivo productivo | Test file existente | Accion por defecto | Que testear |
|--------------------|---------------------|--------------------|-------------|
| `src/components/business/QuestionForm.tsx` | `src/components/business/__tests__/QuestionForm.test.tsx` | Ampliar | Validacion de input, rate-limit branch, optimistic update success/error |
| `src/context/FiltersContext.tsx` | `src/context/FiltersContext.test.tsx` | Ampliar | Toggle de tags, toggle de price levels, reset, default values |
| `src/services/syncEngine.ts` | `src/services/syncEngine.test.ts` + `syncEngine.323.test.ts` | Ampliar `syncEngine.test.ts` | Branch `error instanceof Error` vs no-Error en catch |
| `src/utils/perfMetrics.ts` | `src/utils/perfMetrics.test.ts` + `perfMetrics.init.test.ts` | Ampliar `perfMetrics.test.ts` | Flush offline, beacon ausente, sample vacio |
| `<archivos extra de S1>` | Verificar en S1 | Default ampliar; crear nuevo solo bajo los 3 criterios de S2 | Branches faltantes detectados |

### Criterios de testing

- Cobertura global de branches >= 81% (margen de 1pp sobre el threshold de 80%)
- Cada archivo cubierto debe tener al menos 1 test por branch que estaba uncovered
- `npm run test:coverage` pasa los 4 thresholds (statements 80, branches 80, functions 77, lines 80)
- No se elimina ni se ignora codigo productivo solo para subir el %
- Si se usa `/* c8 ignore */`, debe seguir el formato exacto: `/* c8 ignore next */ // jsdom-unsupported: <razon corta>` (ver OBS #2)

---

## Seguridad

No hay superficies nuevas expuestas por este feature — es solo testing. Sin embargo, dos consideraciones marginales:

- [ ] **Mocks de Firestore en tests** no deben tocar datos reales (regla general): usar el patron `vi.mock('firebase/firestore')` documentado en `tests.md`.
- [ ] **No filtrar secretos en fixtures**: usar UIDs y emails sinteticos (`'test-uid'`, `'user@example.com'`) en mocks de auth.

### Vectores de ataque automatizado

No aplica — el feature no agrega endpoints, ni queries, ni colecciones, ni rules. Solo agrega archivos `*.test.ts(x)` y posiblemente helpers de test en `src/test/`.

---

## Deuda tecnica y seguridad

Consultados issues abiertos de seguridad y tech debt: ambas listas devolvieron `[]` (no hay issues abiertos con esos labels en este momento). El backlog de tech debt vive principalmente en `docs/reports/tech-debt.md` y en cards de "Tech Debt: New Home" del sidebar.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #330 (cerrado v2.48.0) | Descubre y reporta el gap, pero no cierra | Este PRD es el followup explicito |
| #301 (cerrado) | Episodio previo del mismo problema (branches 79.3%) | Replicar patron: agregar tests targeted, NO bajar threshold |
| `tests.md` reporta 90.7% branches | Desajuste con el run actual (79.48%) — el 90.7% probablemente es promedio ponderado por-archivo-con-tests, no global del proyecto | Reportar ambas metricas claramente etiquetadas (ver OBS #1) |

### Mitigacion incorporada

- **Threshold no se baja**: refuerza el guard de regresion (cierra el patron de "bajar para desbloquear"). Documentar la decision en el commit y en el PR.
- **Update de `tests.md`** sincroniza la doc con la realidad: evita que el proximo `/health-check` use numeros obsoletos para evaluar el estado. Formato definido en OBS #1.

### Observaciones de Sofia resueltas en este PRD

**OBS #1 — desfase 90.7% (tests.md) vs 79.48% (run real)**: el numero historico de `tests.md` parece ser el promedio de `% Branch` sobre los archivos que tienen test (excluye archivos sin tests), mientras que `npm run test:coverage` global incluye **todos** los archivos productivos (con y sin tests). Decision: en S3, `tests.md` debe reportar **ambas metricas claramente etiquetadas**:

- `Branches global (incluye archivos sin test) — fuente: vitest coverage summary`: el numero que evalua CI (debe ser >= 80%).
- `Branches promedio archivos con test — fuente: vitest coverage por-archivo`: indicador de calidad de los tests existentes (informativo, sin threshold).

Esto evita ambiguedad en futuros `/health-check` y deja claro cual es el numero que dispara el blocker de CI.

**OBS #2 — formato de `/* c8 ignore */`**: cuando S2 decida no testear una branch (caso "Branch defensiva inalcanzable en jsdom" del gate de fix-as-you-go), usar exactamente:

```ts
/* c8 ignore next */ // jsdom-unsupported: <razon corta>
<linea de codigo cuya branch se ignora>
```

Ejemplos validos:

- `/* c8 ignore next */ // jsdom-unsupported: sendBeacon siempre definido en jsdom`
- `/* c8 ignore next */ // jsdom-unsupported: navigator.connection no expuesto`
- `/* c8 ignore next 3 */ // jsdom-unsupported: window.crypto.subtle solo en HTTPS`

Si el motivo NO es jsdom (ej: fallback que solo se ejecuta en SSR, branch defensiva para errores que TypeScript ya descarta), usar prefijos analogos: `// unreachable:`, `// ssr-only:`, `// type-narrowed:`. Cada uso de `c8 ignore` requiere comentario en la misma linea — sin comentario no se aprueba el diff.

---

## Robustez del codigo

Aplica de forma reducida porque el feature no introduce hooks ni componentes nuevos. Items relevantes:

### Checklist de hooks async

- [ ] No aplica: no se agregan hooks ni componentes con `useEffect`/async.

### Checklist de observabilidad

- [ ] No aplica: no se agregan Cloud Functions ni queries Firestore productivas.

### Checklist offline

- [ ] No aplica directamente, pero **los tests de `syncEngine` y `perfMetrics` deben cubrir branches offline** (sample empty, flush con sin red).

### Checklist de documentacion

- [ ] `docs/reference/tests.md` actualizado con **ambas metricas etiquetadas** (branches global + branches promedio archivos-con-test, OBS #1) y el numero total de tests
- [ ] `docs/reference/project-reference.md` actualizado en la linea de Tests si el delta de tests es relevante (`#338 +N frontend coverage backfill`)
- [ ] No se agregan eventos analytics ni colecciones — `firestore.md` y `analyticsReport.ts` no se tocan

---

## Offline

No aplica como feature — es testing. Sin embargo, los tests **deben cubrir branches offline** existentes en `syncEngine` y `perfMetrics`:

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A — feature no introduce data flows | — | — | — |

### Checklist offline

- [ ] Tests de `syncEngine` cubren branch de retry/dynamic-import error
- [ ] Tests de `perfMetrics` cubren branch de flush offline / beacon ausente
- [ ] No se introducen escrituras a Firestore ni reads nuevos

### Esfuerzo offline adicional: S (incluido en S2)

---

## Modularizacion y % monolitico

El feature **no toca codigo productivo** (excepto, eventualmente, fixes triviales descubiertos durante el testing). El % monolitico se mantiene.

### Checklist modularizacion

- [ ] Tests viven al lado del archivo testeado o en `__tests__/` segun convencion existente del modulo
- [ ] No se agregan exports al barrel `index.ts` de hooks (`patterns.md` "No barrel para `src/hooks/`")
- [ ] Si se necesitan helpers compartidos de test, viven en `src/test/` (NO en services/ ni en components/)
- [ ] No se importa `firebase/firestore` desde tests sin `vi.mock('firebase/firestore', ...)` — patron de `tests.md`
- [ ] Archivos de test no superan 400 lineas (si un test excede, partir por scenario)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo tests, no se modifica codigo productivo |
| Estado global | = | No se tocan contexts, salvo via `renderHook` con providers |
| Firebase coupling | = | Tests mockean Firebase SDK |
| Organizacion por dominio | = | Tests viven en `__tests__/` del dominio del archivo testeado |

---

## Accesibilidad y UI mobile

No aplica — feature de tests sin UI.

### Checklist de accesibilidad

- [ ] No aplica: no se agregan componentes ni interacciones

### Checklist de copy

- [ ] No aplica: no se agregan textos user-facing

---

## Success Criteria

1. `npm run test:coverage` pasa local los 4 thresholds (statements 80, branches 80, functions 77, lines 80) en frontend, con branches >= 81% global (margen, segun la regla de parada de S2).
2. Se identificaron y documentaron los archivos productivos especificos cuyas branches estaban por debajo del 80% (lista concreta, no solo "sospechosos").
3. Cada archivo identificado tiene al menos 1 test nuevo por branch que estaba uncovered. Por default se **ampliaron** los test files existentes; los archivos nuevos creados (si hay) cumplen alguno de los 3 criterios de S2.
4. `vitest.config.ts` **no se modifica** — el threshold de 80 se mantiene.
5. `docs/reference/tests.md` actualizado con **ambas metricas etiquetadas** (global incluyendo archivos sin test + promedio archivos con test, OBS #1). `docs/reference/project-reference.md` actualizado con el total de tests.
6. Pre-merge gate local cumplido: `npm run test:coverage` ejecutado localmente y pasando antes del push (no basta con `npm run test:run`).
7. Workflow CI `.github/workflows/deploy.yml` pasa el job de coverage en un push a rama temporal antes de mergear (este es el workflow que actua como blocker, no `deploy-staging.yml`).
8. Si se uso `/* c8 ignore */`, cada uso tiene el formato exacto definido en OBS #2 con comentario `// jsdom-unsupported: <razon>` (u otro prefijo justificado).

---

## Validacion Funcional

**Fecha**: 2026-05-02
**Estado**: VALIDADO CON OBSERVACIONES
**Auditor**: Sofia (analista funcional)

### Cerrado en Ciclo 2

- **BLOQUEANTE #1** "Workflow CI ambiguo (deploy.yml vs deploy-staging.yml vs staging.yml)" -> resuelto. PRD aclara que `deploy.yml` corre `test:coverage` (blocker real), `deploy-staging.yml` corre `test:run` (no gatea coverage) y `staging.yml` no existe. Verificado contra `.github/workflows/`. Pre-merge gate local incorporado en S3.4.
- **IMPORTANTE #1** "Fix-as-you-go sin criterio" -> resuelto. Tabla de 5 casos (bug productivo / dead code / branch defensiva jsdom / branch defensiva con mock / refactor) con accion explicita y regla de stop si el fix es no-trivial.
- **IMPORTANTE #2** "Ampliar vs crear test file nuevo" -> resuelto. Regla "ampliar por default" + 3 criterios disjuntos para crear nuevo (LOC, scenario disjunto, setup conflictivo) + tabla con "Test file existente" y "Accion por defecto" por archivo sospechoso.
- **IMPORTANTE #3** "Regla de parada de S2 sin criterio" -> resuelto. Procedimiento iterativo de 5 pasos con threshold real (80%) y guidance (81%) claramente etiquetados.
- **OBS #1** "Desfase tests.md (90.7%) vs run real (79.48%)" -> resuelto. `tests.md` reportara ambas metricas etiquetadas: global (CI gate) + promedio archivos-con-test (informativo).
- **OBS #2** "Formato de `c8 ignore` ambiguo" -> resuelto. Formato exacto `/* c8 ignore next */ // jsdom-unsupported: <razon>` + ejemplos + prefijos analogos no-jsdom + regla "sin comentario no se aprueba".

### Observaciones para el implementador

- La lista de sospechosos a priori (QuestionForm, FiltersContext, syncEngine, perfMetrics) es estimacion del issue, no contrato. S1 puede revelar archivos distintos o adicionales — el PRD ya lo contempla en S2.5 y en la tabla de "Archivos que necesitaran tests".
- El threshold `branches >= 81%` es guidance interno de este PR (margen sobre el 80% real de CI). Si el implementador encuentra que llegar a 81% requiere `c8 ignore` masivo o tests artificiales, parar y escalar — el objetivo es cerrar el gap real, no inflar el numero.
- Al actualizar `tests.md` (S3.2) y `project-reference.md` (checklist documentacion), seguir el formato OBS #1 exactamente — la confusion entre metricas global/por-archivo es lo que disparo este issue.
- El pre-merge gate local (S3.4) reproduce lo que correra `deploy.yml`. Si en CI falla pese a pasar local, es senal de inconsistencia de entorno y amerita issue separado, no patchear el threshold.

### Listo para specs-plan-writer?

Si. El PRD cierra todos los huecos detectados y tiene criterios testeables. specs/plan puede arrancar sin inventar.

