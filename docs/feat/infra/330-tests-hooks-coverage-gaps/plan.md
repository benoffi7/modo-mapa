# Plan: Tech debt — tests para hooks sin cobertura + utils/media + admin callables

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-29
**Issue:** #330

---

## Fases de implementacion

### Fase 1: Tests nuevos para hooks (S1 + utils/media S2 + admin callables S3)

**Branch:** `feat/330-tests-hooks-coverage-gaps`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useRankings.test.ts` (nuevo) | Crear archivo con `describe('useRankings')`. Mockear `./useAsyncData` (dual call con `mockImplementationOnce`), `../services/rankings` (`fetchRanking`, `getCurrentPeriodKey`, `getPreviousPeriodKey`). Cases: (a) data + prevRanking ambos presentes con userIds compartidos → map de deltas correcto, (b) userId solo en `data` → no aparece en map, (c) data sin prevRanking (`useAsyncData` segundo call retorna `data: null`) → map vacio, (d) `data: null` (loading) → map vacio, (e) refetch llama `useAsyncData.refetch` del primer call, (f) cambio de `setPeriodType('alltime')` → `prevFetcher` retorna `Promise.resolve(null)` (verificado via spy a `getPreviousPeriodKey`) |
| 2 | `src/hooks/useUnsavedChanges.test.ts` (nuevo) | `describe('useUnsavedChanges')` con cases: (a) `isDirty=false` con `[]`, `['']`, `['  ']`, (b) `isDirty=true` con un value no vacio, (c) `confirmClose(cb)` con isDirty=false → llama cb inline, dialog NO abre, (d) `confirmClose(cb)` con isDirty=true → dialog abre, cb guardado en ref, (e) `onDiscard` cierra dialog y llama cb pendiente, (f) `onDiscard` con pendingClose null no rompe (case defensivo), (g) `onKeepEditing` cierra dialog y limpia ref sin llamar cb |
| 2b | `src/hooks/useUnsavedChanges.ts` | Agregar JSDoc al hook documentando el riesgo de la API variadic (un caller que pase un valor no-string rompe `.trim()`). Sin cambio de comportamiento. Texto: `/** @remarks La API actual recibe `...string[]`. Pasar un objeto/null rompe el `.trim()`. Followup en backlog para tipo explicito. */` |
| 3 | `src/hooks/useUserLocation.test.ts` (nuevo) | Mockear `../context/FiltersContext` con `mockSetUserLocation`. `vi.stubGlobal('navigator', ...)`. Cases: (a) `navigator.geolocation` undefined → `error` setteado, (b) success → `setUserLocation({lat, lng})` llamado, `isLocating=false`, (c) `error.code === 1` → mensaje "Permiso denegado", (d) `error.code === 2` (otro) → mensaje generico, (e) error path resetea `isLocating` a false |
| 4 | `src/hooks/useUserSearch.test.ts` (nuevo) | `vi.useFakeTimers()` en `beforeEach`. Mockear `../services/users` (`searchUsers`) y `../utils/logger`. Cases: (a) term `''` → results=[], searching=false, (b) term `'a'` (1 char) → idem, (c) term `'ab'` con `vi.advanceTimersByTime(299)` → `searchUsers` NO llamado, (d) avanzar a 300 + `await waitFor` → `searchUsers` llamado, results setteados, (e) `searchUsers` rechaza → `logger.error` llamado + results=[], (f) `clear()` cancela timer pendiente, (g) call consecutivo cancela timer previo (verificable con `searchUsers` llamado solo una vez) |
| 5 | `src/hooks/useSurpriseMe.test.ts` (nuevo) | Mockear `./useBusinesses` (`allBusinesses` array fijo de 5 negocios con coords conocidas — 3 cerca de `sortLocation`, 2 lejos), `./useVisitHistory`, `./useSortLocation`, `../context/ToastContext`, `../utils/analytics` (`trackEvent`). Cases: (a) ningun visitado, hay nearby → pick es nearby, `toast.success` con nombre, (b) ningun visitado, todos lejos → pick es de `candidates`, (c) todos visitados → fallback a `allBusinesses`, `toast.info(MSG_ONBOARDING.surpriseAllVisited)`, (d) happy path verifica `onSelect(pick)` + `onClose()` + `trackEvent('surprise_me', { business_id })` |
| 6 | `src/hooks/useVisitHistory.test.ts` (extender) | Agregar 2 cases al describe existente: (a) cap MAX_VISIT_HISTORY=50 — pre-poblar localStorage con 50 entries via `JSON.stringify`, recordVisit de un id 51 → primer entry desplazado fuera, total sigue 50, (b) localStorage corrupto (`localStorage.setItem(STORAGE_KEY_VISITS, '{not-json')`) → `useVisitHistory` arranca con `visits=[]` |
| 7 | `src/utils/media.test.ts` (nuevo) | `describe('isValidStorageUrl')` con cases: (a) URL valida exacta, (b) `undefined` → false, (c) `null as unknown` → false, (d) `123 as unknown` → false (number), (e) `{} as unknown` → false (object), (f) `''` → false, (g) prefix-bypass `https://firebasestorage.googleapis.com.evil.com/...` → false, (h) scheme-confusion `http://firebasestorage.googleapis.com/...` → false, (i) prefijo extra `evil-https://firebasestorage.googleapis.com/...` → false |
| 8 | `src/services/__tests__/adminClaims.test.ts` (nuevo) | Mockear `../../config/firebase` (`functions: {}`) y `firebase/functions` (`httpsCallable: mockHttpsCallable`). `beforeEach` con `vi.resetModules()` + `vi.clearAllMocks()`. Cases: (a) `await import('../adminClaims')` invoca `httpsCallable({}, 'setAdminClaim')`, (b) llamar `setAdminClaim({ targetUid: 'uid-1' })` propaga el payload al `mockCallableFn` |
| 9 | `src/services/__tests__/adminFeedback.test.ts` (nuevo) | Mismo patron. Cases: (a) `respondToFeedback` construido con `'respondToFeedback'` y payload `{ feedbackId, response }`, (b) `resolveFeedback` con `'resolveFeedback'` y `{ feedbackId }`, (c) `createGithubIssueFromFeedback` con `'createGithubIssueFromFeedback'` y `{ feedbackId }` (response `{ issueUrl }`) |

### Fase 2: Refactors menores (S4 + S5)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/rankings.ts` | Agregar `export type RankingPeriodType = 'weekly' \| 'monthly' \| 'yearly' \| 'alltime';` al top del archivo. Reemplazar las firmas in-line `(type: 'weekly' \| 'monthly' \| 'yearly' \| 'alltime')` en `getCurrentPeriodKey` y `getPreviousPeriodKey` por `(type: RankingPeriodType)`. Sin cambio de logica. |
| 2 | `src/hooks/useRankings.ts` | Borrar la linea `type PeriodType = 'weekly' \| 'monthly' \| 'yearly' \| 'alltime';`. Importar: `import type { RankingPeriodType } from '../services/rankings';`. Reemplazar los 3 usos de `PeriodType` en el archivo por `RankingPeriodType`. Sin cambio funcional. |
| 3 | `src/hooks/useUserSearch.ts` | Borrar la linea `export type { UserSearchResult };` (linea 6). Mantener `import type { UserSearchResult } from '../services/users';` (linea 3) — el tipo se sigue usando internamente. |
| 4 | grep verification | Ejecutar `grep -rn "from.*useUserSearch.*UserSearchResult" src/` y `grep -rn "PeriodType" src/`. El primero debe retornar vacio (Sofia ya verifico). El segundo solo debe listar `services/rankings.ts` y `useRankings.ts` (con el alias nuevo). Si aparece otro archivo, migrar tambien. |

### Fase 3: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/tests.md` | Actualizar tabla "React App — Hooks": cambiar `useRankings`, `useUnsavedChanges`, `useUserLocation`, `useUserSearch`, `useSurpriseMe`, `useVisitHistory` de `⏳`/parcial a archivo + cases + cobertura "100%" o "100% stmts, 95% branches". Agregar fila para `utils/media.ts` en la tabla "React App — Utilidades". Agregar `adminClaims.ts` y `adminFeedback.ts` en "React App — Servicios" con `__tests__/adminClaims.test.ts` / `__tests__/adminFeedback.test.ts`. Actualizar header con cobertura nueva (numero de test files: +9). |
| 2 | `docs/reference/patterns.md` | Agregar fila en seccion "TypeScript y build": `**No barrel para src/hooks/**` con la justificacion (S6 de specs). Texto: ver decision D8 del specs.md. |
| 3 | `docs/_sidebar.md` | Agregar entries para Specs y Plan bajo `#330` en seccion Infra. Patron: `    - [Specs](/feat/infra/330-tests-hooks-coverage-gaps/specs.md)` y `    - [Plan](/feat/infra/330-tests-hooks-coverage-gaps/plan.md)`. |

### Fase 4: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | (cli) | `npm run test:run` — verificar que todos los tests nuevos pasan |
| 2 | (cli) | `npm run test:coverage -- src/hooks/useRankings.test.ts src/hooks/useUnsavedChanges.test.ts ...` — verificar >= 95% statements, >= 90% branches por archivo |
| 3 | (cli) | `npm run lint` — sin errores |
| 4 | (cli) | `npm run build` — sin errores TypeScript (verifica que el refactor S4/S5 no rompio consumers) |

---

## Orden de implementacion

1. **Fase 2 paso 1** (`services/rankings.ts` agrega `RankingPeriodType`) — debe ir antes que Fase 1 paso 1, porque el test de `useRankings` importa del refactor consolidado.
2. **Fase 2 paso 2** (`useRankings.ts` consume `RankingPeriodType`) — antes del test del hook.
3. **Fase 2 paso 3** (`useUserSearch.ts` borra re-export) — antes del test del hook (el test importa de `services/users`).
4. **Fase 2 paso 4** (grep verification) — checkpoint.
5. **Fase 1 pasos 1-9** — los tests pueden escribirse en paralelo (independientes entre si). Recomendado en orden listado para revisar PR de manera natural.
6. **Fase 1 paso 2b** (JSDoc en `useUnsavedChanges.ts`) — junto con su test.
7. **Fase 3** — actualizar docs despues de que todos los tests pasen.
8. **Fase 4** — verificacion final pre-commit.

## Estimacion de file sizes

| Archivo | Lineas estimadas | <= 400? |
|---------|-----------------|---------|
| `src/hooks/useRankings.test.ts` | ~150 | si |
| `src/hooks/useUnsavedChanges.test.ts` | ~110 | si |
| `src/hooks/useUserLocation.test.ts` | ~120 | si |
| `src/hooks/useUserSearch.test.ts` | ~150 | si |
| `src/hooks/useSurpriseMe.test.ts` | ~140 | si |
| `src/hooks/useVisitHistory.test.ts` (post-extension) | ~110 | si |
| `src/utils/media.test.ts` | ~70 | si |
| `src/services/__tests__/adminClaims.test.ts` | ~50 | si |
| `src/services/__tests__/adminFeedback.test.ts` | ~80 | si |
| `src/hooks/useRankings.ts` (post-refactor) | ~57 (sin cambio neto) | si |
| `src/hooks/useUserSearch.ts` (post-refactor) | ~42 (-1 linea) | si |
| `src/services/rankings.ts` (post-refactor) | +1 linea (~120) | si |
| `src/hooks/useUnsavedChanges.ts` (+JSDoc) | ~55 | si |

Ningun archivo nuevo o modificado supera 400 lineas. Sin necesidad de decomposicion.

## Riesgos

1. **`useAsyncData` mock dual call**: si el orden interno de las llamadas a `useAsyncData` en `useRankings.ts` cambia (ej. `prevFetcher` antes de `fetcher`), el test rompe sin que cambie el comportamiento. Mitigacion: documentar el orden esperado en un comentario en el mock + agregar un assert defensivo (`expect(useAsyncData).toHaveBeenCalledTimes(2)` y verificar que el primer call usa `getCurrentPeriodKey`).
2. **Smoke admin tests con `vi.resetModules()`**: si otros tests del mismo runner manipulan modulos compartidos, `resetModules` puede invalidar caches. Mitigacion: usar el patron `await import` ya validado en `userProfile.test.ts` y aislar con `beforeEach`.
3. **`vi.useFakeTimers()` y microtasks**: el debounce de `useUserSearch` ejecuta una callback async (`async () => { ... }`). Avanzar el timer dispara la callback, pero el `await searchUsers(...)` interno necesita un tick adicional. Mitigacion: combinar `vi.advanceTimersByTime(300)` con `await waitFor(() => expect(...))` — patron documentado en `tests.md` y `vitest_mock_patterns`.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — solo se mockea via `vi.mock`.
- [x] Archivos nuevos en carpeta de dominio correcta: tests de hooks en `src/hooks/`, util en `src/utils/`, services en `src/services/__tests__/`.
- [x] Logica de negocio en hooks/services, no en componentes — sin cambios al pattern.
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — `useRankings.ts` (PeriodType) y `useUserSearch.ts` (re-export) llevan su fix en Fase 2.
- [x] Ningun archivo resultante supera 400 lineas — verificado en tabla de estimacion.

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` ... — no aplica, sin coleccion nueva.
- [x] Todo campo string tiene `.size() <= N` ... — no aplica.
- [x] Counter decrements en triggers ... — no aplica.
- [x] Rate limits llaman `snap.ref.delete()` ... — no aplica.
- [x] Toda coleccion nueva escribible ... — no aplica.
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificado: tests usan `'uid-1'`, `'photo-123'`, etc. (datos sinteticos).
- [x] `getCountFromServer` → `getCountOfflineSafe` siempre — no aplica, sin counts.

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — no aplica.
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — no aplica (sin services nuevos).
- [x] Todo `trackEvent` nuevo esta registrado — no aplica (sin trackEvent nuevos).
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — verificado en `useUserSearch.ts:28` (linea ya cumple la regla; el test la verifica como side effect en error path).

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — no aplica (sin componentes).
- [x] No hay `<Typography onClick>` — no aplica.
- [x] Touch targets minimo 44x44px — no aplica.
- [x] Componentes con fetch tienen error state con retry — no aplica.
- [x] `<img>` con URL dinamica tienen `onError` fallback — no aplica.
- [x] httpsCallable en componentes user-facing tienen guard offline — no aplica (los smoke tests son del client wrapper, no de componentes).

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo — no aplica (sin textos nuevos).
- [x] Tildes correctas en todos los textos en espanol — verificado en assertions de `useUserLocation.test.ts` (textos existentes).
- [x] Terminologia consistente: "comercios" no "negocios" — no aplica.
- [x] Strings reutilizables en `src/constants/messages/` — verificado: `useSurpriseMe.test.ts` asserta contra `MSG_ONBOARDING.surpriseAllVisited` (constante existente).

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | NO se actualiza — no se modifican rules, rate limits, auth ni storage rules. |
| 2 | `docs/reference/firestore.md` | NO se actualiza — sin cambios de schema. |
| 3 | `docs/reference/features.md` | NO se actualiza — sin funcionalidad nueva user-facing. |
| 4 | `docs/reference/patterns.md` | SI — agregar fila "No barrel para src/hooks/" en seccion "TypeScript y build" (decision S6/D8). |
| 5 | `docs/reference/project-reference.md` | NO se actualiza en este PR — `manu`/`merge` skill maneja version bump al cierre del issue. |
| 6 | `src/components/menu/HelpSection.tsx` | NO se actualiza — sin cambio de comportamiento user-facing. |
| 7 | `docs/reference/tests.md` | SI — actualizar inventario con 9 archivos nuevos (6 hooks + 1 util + 2 services), filas movidas de `⏳` a `100%`. Actualizar header (test files count). |
| 8 | `docs/_sidebar.md` | SI — agregar entries Specs y Plan bajo `#330` en Infra. |

## Criterios de done

- [ ] 9 archivos `.test.ts` nuevos creados + extension de `useVisitHistory.test.ts` (2 cases adicionales). Total: ~50 cases nuevos.
- [ ] `npm run test:run` pasa.
- [ ] Cobertura >= 95% statements / >= 90% branches en cada uno de los 6 hooks y `utils/media.ts` — verificable via `npm run test:coverage`.
- [ ] `RankingPeriodType` exportado desde `services/rankings.ts`. `grep "'weekly' | 'monthly' | 'yearly' | 'alltime'"` retorna solo el archivo del service.
- [ ] `UserSearchResult` exportado solo desde `services/users.ts`. `useUserSearch.ts` no re-exporta.
- [ ] `docs/reference/patterns.md` documenta la decision de no-barrel para `src/hooks/`.
- [ ] `docs/reference/tests.md` actualizado con las filas correspondientes.
- [ ] `docs/_sidebar.md` lista Specs y Plan del #330.
- [ ] No lint errors (`npm run lint`).
- [ ] Build succeeds (`npm run build`).
- [ ] No introduce deuda tecnica nueva — verificado en specs.md seccion "Deuda tecnica: mitigacion incorporada".

---

## Validacion de Plan

(Pendiente de Pablo — no invocado en esta sesion por instruccion del usuario.)

---

## Validacion de Plan

**Fecha**: 2026-05-01
**Auditor**: Pablo (delivery lead)
**Estado**: VALIDADO CON OBSERVACIONES
**Listo para implementacion**: Si

### Resumen del analisis

Plan claro, secuencial, con orden de ejecucion explicito (Fase 2 refactors antes de Fase 1 tests para que los tests importen del codigo ya consolidado). Granularidad correcta: cada paso = un archivo + cases enumerados. File sizes estimados, todos bajo 400 lineas. Risk staging coherente: refactors mecanicos primero (revertibles via git revert sin efecto en datos), tests despues, docs al final, verificacion final con `npm run test:run` + `coverage` + `lint` + `build`.

### Verificaciones realizadas

- Cobertura specs → plan completa: S1 (6 hooks tests) → Fase 1 pasos 1-6, S2 → Fase 1 paso 7, S3 → Fase 1 pasos 8-9, S4 → Fase 2 pasos 1-2, S5 → Fase 2 paso 3, S6 → Fase 3 paso 2, D7 (JSDoc) → Fase 1 paso 2b.
- Out-of-scope respetado: no se tocan los 13 hooks restantes, ni `functions/`, ni la signature variadic de `useUnsavedChanges`.
- Orden de dependencias: refactor `RankingPeriodType` (Fase 2 paso 1) antes de test `useRankings` (Fase 1 paso 1). Refactor re-export `UserSearchResult` (Fase 2 paso 3) antes de test `useUserSearch` (Fase 1 paso 4).
- Single-PR strategy: todo en branch `feat/330-tests-hooks-coverage-gaps`; tamano de review razonable (~50 cases + 3 refactors XS).
- Rollback: revert por paso es trivial (no hay migraciones, ni rules, ni cambios de schema).
- Documentacion agendada: `tests.md` (Fase 3 paso 1), `patterns.md` (Fase 3 paso 2), `_sidebar.md` (Fase 3 paso 3). Explicitamente marcados como NO aplica: `features.md`, `firestore.md`, `security.md`, `HelpSection.tsx`, `project-reference.md`.

### Observaciones (no bloqueantes)

1. **Sello tecnico de Diego ausente**: el specs.md (linea 297-299) declara "Pendiente de Diego — no invocado en esta sesion por instruccion del usuario". Procedo a validar el plan por instruccion explicita del usuario. Si Diego revisa el specs despues y encuentra issues con la mock strategy (ej. `useAsyncData` dual-call de D1, `vi.resetModules()` de D4), el plan puede necesitar ajustes menores en los pasos correspondientes — sin afectar el orden global ni el scope.
2. **Numero de fase vs orden de ejecucion**: la tabla "Fases de implementacion" lista Fase 1 antes que Fase 2, pero la seccion "Orden de implementacion" (linea 56) ejecuta Fase 2 primero (refactors) y despues Fase 1 (tests). Esta documentado y es coherente; el implementador debe leer ambas secciones. No bloquea; mejorable en futuras iteraciones renombrando fases para alinear numero con orden.
3. **Fase 3 vs "Fase final: Documentacion"**: hay dos secciones de docs (lineas 37-43 y lineas 134-145). La Fase 3 es operativa (3 pasos); la Fase final es checklist (8 puntos con NO aplica + justificacion). Redundante pero no contradictorio — el implementador toma la Fase 3 como guia operativa y la Fase final como confirmacion del scope de docs.

### Sin hallazgos BLOQUEANTES ni IMPORTANTES

El plan puede pasar a implementacion. Recomendado un solo agente (no requiere paralelismo) para mantener coherencia en los refactors S4/S5 que cruzan service + hook + tests.
