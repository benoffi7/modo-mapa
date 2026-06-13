# PRD: Tech debt — tests para hooks sin cobertura + utils/media + admin callables

**Feature:** 330-tests-hooks-coverage-gaps
**Categoria:** infra
**Fecha:** 2026-04-29
**Issue:** #330
**Prioridad:** Media

---

## Contexto

El health check del 2026-04-25 (pr-reviewer) detecto 6 hooks con logica condicional/asincrona sin `.test.ts`, mas `utils/media.ts` (validador de URL security-adjacent) y dos wrappers de admin callables sin tests de smoke. La regla `feedback_agent_must_write_tests.md` exige tests para todo hook con logica; el proyecto cubre 96.1% statements y 90.7% branches en frontend, pero estos archivos quedaron por fuera del set medido o tienen branches especificos no ejercitados (ej. `useUserLocation` con error code 1 vs codigo generico, `useUserSearch` con error en debounce, `isValidStorageUrl` con prefix-bypass).

`useVisitHistory.ts` ya tiene un `.test.ts` con 5 cases (basico, business resolution, repeat visit, clear, business=null). Falta cubrir el cap `MAX_VISIT_HISTORY` y el fallback de `JSON.parse` corrupto, asi que entra al scope para redondear cobertura, no para crear un archivo nuevo.

## Problema

- Hooks con branches no testeados: `useRankings` (calculo de delta de posicion), `useUnsavedChanges` (state machine de dialog), `useUserLocation` (error.code = 1 vs generico, browser sin geolocation), `useUserSearch` (debounce + error path en logger.error), `useSurpriseMe` (filtro nearby vs fallback, todos visitados), `useVisitHistory` (cap MAX, parse fallback).
- `utils/media.ts:isValidStorageUrl` es un validador security-adjacent (decide si una URL apunta a Firebase Storage). Sin tests, un cambio futuro al `STORAGE_URL_PREFIX` o un `startsWith` mal escrito pueden abrir prefix-bypass (ej. `https://firebasestorage.googleapis.com.evil.com/...`) sin que falle CI.
- `services/adminClaims.ts` y `services/adminFeedback.ts` son wrappers `httpsCallable` sin tests. Un rename de la callable name (`'setAdminClaim'`, `'respondToFeedback'`, etc.) o un cambio de shape de payload no se detectaria hasta runtime en /admin.
- Hallazgos secundarios del health check que conviene resolver en el mismo paso:
  - `PeriodType` literal duplicado en `useRankings.ts:6` (existe la firma equivalente en `services/rankings.ts:35`); centralizar y reusar.
  - `useUserSearch.ts:6` re-exporta `UserSearchResult` solo como `export type`; consumidores pueden importarlo de `hooks/useUserSearch` o de `services/users` — colapsar a una sola fuente (`services/users.ts:61`).
  - Decision sobre barrel `src/hooks/index.ts`: el resto del proyecto (`theme/`, `types/`, `constants/`, `services/admin/`) tiene barrel; `hooks/` no. Documentar la decision (mantener sin barrel) en `patterns.md` o agregar el barrel.

## Solucion

### S1 — Tests nuevos para hooks (6 archivos `.test.ts`)

Crear/extender tests siguiendo los patterns ya establecidos en `tests.md` y `vitest_mock_patterns`. Mock strategy con `vi.hoisted()` para variables compartidas, `vi.resetAllMocks()` + `vi.useRealTimers()` en `afterEach`. Para hooks con timers (debounce de `useUserSearch`), `vi.useFakeTimers()` + `vi.runAllTimers()` + `await waitFor` para resolver microtasks.

Cobertura objetivo: 100% branches en cada hook nuevo. Patron de import: `import { renderHook, act, waitFor } from '@testing-library/react'` (mismo patron que `useFollow.test.ts`, `useVisitHistory.test.ts`).

### S2 — Tests para `utils/media.ts`

Archivo `src/utils/media.test.ts` con cases que cubran:

- URL valida exacta de Firebase Storage.
- URL `undefined` y `null` (deben retornar `false`).
- URLs no string (numero, objeto) — el guard `typeof url === 'string'` debe rechazarlas.
- **Prefix-bypass attempts**: `https://firebasestorage.googleapis.com.evil.com/...` (debe rechazarse — `startsWith` con `/` final del prefix lo bloquea, pero el test lo deja documentado).
- **Scheme-confusion**: `http://firebasestorage.googleapis.com/...` (sin TLS — debe rechazarse).
- URL con caracteres adicionales antes del prefix (debe rechazarse).
- URL vacia (`''`) — rechazar.

### S3 — Smoke tests para admin callables

`src/services/__tests__/adminClaims.test.ts` y `src/services/__tests__/adminFeedback.test.ts`. Mockear `httpsCallable` y `firebase/functions` para verificar:

- Callable se construye con el nombre correcto (`'setAdminClaim'`, `'respondToFeedback'`, `'resolveFeedback'`, `'createGithubIssueFromFeedback'`).
- Se pasa la instancia `functions` correcta como primer argumento.
- Tipos de payload/response son los esperados (esto se valida via TypeScript, pero un test runtime con `expect(httpsCallable).toHaveBeenCalledWith(...)` cierra el contrato).

Patron similar al de `services/userProfile.test.ts` y `services/menuPhotos.test.ts` (que mockean `firebase/functions` con `vi.mock`).

### S4 — `PeriodType` centralizado

Mover el literal `'weekly' | 'monthly' | 'yearly' | 'alltime'` de `useRankings.ts:6` a `services/rankings.ts` como tipo exportado:

```ts
export type RankingPeriodType = 'weekly' | 'monthly' | 'yearly' | 'alltime';
```

Actualizar `getPreviousPeriodKey` y `useRankings` para consumir el tipo. El nombre cambia de `PeriodType` a `RankingPeriodType` para evitar colision con otros dominios (notificaciones, estadisticas) que ya tienen periodos propios.

### S5 — Colapsar `UserSearchResult` re-export

Eliminar `export type { UserSearchResult }` de `useUserSearch.ts:6`. Consumidores que lo importen del hook deben migrar a `services/users.ts`. Buscar callsites (`grep -r "from.*useUserSearch.*UserSearchResult"`) y migrar en el mismo PR.

### S6 — Decision sobre barrel `hooks/index.ts`

Decision: **NO crear barrel**. Justificacion documentada en `patterns.md` seccion TypeScript:

> Hooks no tienen barrel (`src/hooks/index.ts`) intencionalmente. Cada hook se importa desde su archivo (`from './hooks/useFollow'`). Esto permite que vitest tree-shake mocks por archivo sin que un mock de un hook fuerce la carga del modulo de otro hook (problema observado historicamente con barrel imports en tests).

Si esta decision es controversial, escalable a Sofia.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| `useRankings.test.ts` (delta calc + previous period null para alltime + sin previo) | Alta | S |
| `useUnsavedChanges.test.ts` (isDirty con strings vacios/whitespace, dialog open/close, discard ejecuta callback, keepEditing limpia ref) | Alta | S |
| `useUserLocation.test.ts` (no soportado, code=1, code generico, success path, mock `navigator.geolocation.getCurrentPosition`) | Alta | S |
| `useUserSearch.test.ts` (debounce 300ms, term <2, clear cancela timer, error path llama logger) | Alta | S |
| `useSurpriseMe.test.ts` (visitados vs no visitados, nearby <=5km, todos visitados → toast.info, todos visitados sin candidatos → fallback al pool completo, trackEvent) | Alta | S |
| `useVisitHistory.test.ts` extension (cap MAX_VISIT_HISTORY, JSON.parse fallback corrupto) | Media | XS |
| `utils/media.test.ts` (URL valida, undefined, prefix-bypass, scheme-confusion, no-string) | Alta | XS |
| `services/__tests__/adminClaims.test.ts` (callable name + payload shape) | Media | XS |
| `services/__tests__/adminFeedback.test.ts` (3 callables) | Media | XS |
| `RankingPeriodType` centralizado en `services/rankings.ts` + migrar `useRankings` | Media | XS |
| Colapsar `UserSearchResult` re-export en `useUserSearch.ts` + migrar callsites | Media | XS |
| Documentar decision de no-barrel en `patterns.md` | Baja | XS |

**Esfuerzo total estimado:** M (8 archivos de test nuevos + 1 extension + 3 refactors menores)

---

## Out of Scope

- Tests para los otros 13 hooks listados como `⏳` en `tests.md` (`useUndoDelete`, `useAsyncData`, etc.) — estan separados en sus propios issues.
- Cambio de signature de `useUnsavedChanges` (variadic `...string[]` → `Record<string, string | undefined>` o `isDirty: boolean`). Es un breaking change que afecta callsites; queda como followup separado tras este PRD.
- Tests para callables admin del lado server (`functions/src/admin/claims.ts`, `functions/src/admin/feedback.ts`) — son issues separados en `tests.md` priorizados como Media.
- Aumentar el threshold global de cobertura. La feature mantiene >=80% pero no toca `vitest.config.ts`.

---

## Tests

Este PRD ES un PRD de tests, asi que esta seccion describe los tests que se van a crear (no los que validan el feature).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useRankings.test.ts` (nuevo) | Hook | Delta calc para usuarios que aparecen en ambos periodos, ausentes en previo (no aparecen en map), `alltime` (prevFetcher devuelve null), errores en fetch principal, refetch propaga al state |
| `src/hooks/useUnsavedChanges.test.ts` (nuevo) | Hook | `isDirty=false` con strings vacios o solo whitespace, `confirmClose` ejecuta directo si no hay dirt, abre dialog si hay dirt, `onDiscard` cierra y ejecuta el pending callback, `onKeepEditing` cierra y NO ejecuta callback, ref se limpia |
| `src/hooks/useUserLocation.test.ts` (nuevo) | Hook | `navigator.geolocation` undefined → error setteado y NO se llama getCurrentPosition, success path setea userLocation con lat/lng, `error.code === 1` (PERMISSION_DENIED) → mensaje "Permiso denegado", otros codigos → mensaje "No se pudo obtener", `isLocating` se resetea en ambos paths |
| `src/hooks/useUserSearch.test.ts` (nuevo) | Hook | Term `''` y termino de 1 char limpian results y cancelan searching, debounce 300ms (no llama searchUsers antes de avanzar timers), llamada exitosa setea results, error en searchUsers llama `logger.error` y resetea results=[], `clear()` cancela timer pending, calls consecutivos cancelan timer previo |
| `src/hooks/useSurpriseMe.test.ts` (nuevo) | Hook | Filtro de visitados, filtro nearby <=5km cuando hay candidatos, fallback al pool completo si todos los businesses fueron visitados (toast.info), seleccion random llama onSelect+onClose, `trackEvent` con businessId del pick |
| `src/hooks/useVisitHistory.test.ts` (extender) | Hook | Cap MAX_VISIT_HISTORY se respeta al insertar (slice), JSON.parse de localStorage corrupto retorna [] (no tira) |
| `src/utils/media.test.ts` (nuevo) | Util | URL valida, undefined, null casteable, prefix-bypass (`...com.evil.com/`), scheme-confusion (`http://`), no-string types, vacio |
| `src/services/__tests__/adminClaims.test.ts` (nuevo) | Service | `httpsCallable` invocado con `(functions, 'setAdminClaim')`, payload `{ targetUid }` propaga, return type es void |
| `src/services/__tests__/adminFeedback.test.ts` (nuevo) | Service | `respondToFeedback`, `resolveFeedback`, `createGithubIssueFromFeedback` cada uno con su nombre y shape |

### Mock strategy

- Firestore: `vi.mock('../config/firebase', () => ({ db: {}, functions: {} }))`.
- `firebase/functions`: `vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(...) }))` para los smoke tests de admin.
- `useAsyncData` (consumido por `useRankings`): mock con `vi.mock('./useAsyncData', ...)` que devuelve `{ data, loading, error, refetch }` controlable por `vi.hoisted()`.
- `services/rankings`: mock de `fetchRanking`, `getCurrentPeriodKey`, `getPreviousPeriodKey`.
- `navigator.geolocation`: `vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } })` antes de cada test, restaurar en `afterEach`.
- `allBusinesses` (consumido por `useSurpriseMe`): mock del modulo `'./useBusinesses'` con un array fijo de 5 businesses con coords conocidas.
- `distanceKm`: dejar la implementacion real (es deterministica, no tiene side effects).
- `logger`: `vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() } }))`.
- Toast: `vi.mock('../context/ToastContext', () => ({ useToast: () => ({ success: mockSuccess, info: mockInfo, error: mockError }) }))`.
- LocalStorage: usar el real (jsdom lo provee), limpiar con `localStorage.clear()` en `beforeEach`.

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (objetivo: 100% branches en los hooks targeted).
- Tests de validacion para todos los inputs del usuario (term en `useUserSearch`, `values` en `useUnsavedChanges`).
- Todos los paths condicionales cubiertos (geolocation no soportada, error.code === 1 vs otros, alltime sin prevPeriod, debounce cancelacion).
- Side effects verificados (toast.info/success, trackEvent, logger.error en error path, `setUserLocation` del context).

---

## Seguridad

Este PRD agrega tests, no codigo de produccion. Lista mitigada:

- [ ] No introduce escrituras a Firestore (tests aislados con mocks).
- [ ] No introduce nuevos endpoints, callables ni rules.
- [ ] No agrega campos a userSettings.
- [ ] El test de `isValidStorageUrl` documenta vectores de bypass (prefix-confusion, scheme-confusion) — refuerza la postura defensiva del validador.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `isValidStorageUrl` | URL maliciosa con prefix similar (`firebasestorage.googleapis.com.evil.com`) que pase un `startsWith` mal escrito | El test bloquea regresiones — verifica que el `/` final del prefix esta presente y rechaza este vector |
| `isValidStorageUrl` | URL `http://` (sin TLS) que pasa un `startsWith` que olvida el scheme | El test cubre esto |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| `tests.md ⏳ useUnsavedChanges` (referencia interna) | mitiga | Cierra el item del backlog |
| `tests.md ⏳ useRankings` | mitiga | Cierra el item del backlog |
| Hallazgo health-check #330 punto 5 (`UserSearchResult` re-export) | mitiga | Resuelto en S5 |
| Hallazgo health-check #330 punto 6 (barrel `hooks/`) | mitiga | Decision documentada en S6 |
| Hallazgo health-check #330 punto 7 (`useUnsavedChanges` API variadic) | empeora si no se considera | Out-of-scope explicito (followup separado), pero se documenta el riesgo en el JSDoc del hook como parte de S1 |

### Mitigacion incorporada

- `RankingPeriodType` deja de estar duplicado entre `useRankings.ts:6` y `services/rankings.ts:35` — fuente unica de verdad (S4).
- `UserSearchResult` deja de tener doble export — fuente unica de verdad (S5).
- Decision de barrel `hooks/` documentada en `patterns.md` (S6) — evita que el proximo agente cree el barrel sin contexto.

---

## Robustez del codigo

Este PRD agrega solo archivos de test. Los hooks existentes no se modifican (excepto los tres refactors menores S4/S5/S6 que no introducen async ni storage keys nuevas).

### Checklist de hooks async

- [ ] Los tests no introducen `useEffect` con await — solo `renderHook` + `act` + `waitFor`.
- [ ] No hay `setState` post-async sin guard (no aplica — son tests).
- [ ] Funciones no exportadas que solo se usan internamente: no se introducen.
- [ ] Archivos de test van en `src/hooks/` (junto al archivo) o `src/services/__tests__/` siguiendo la convencion existente.
- [ ] Constantes de localStorage existentes (`STORAGE_KEY_VISITS`) ya estan en `src/constants/storage.ts`. No se introducen keys nuevas.
- [ ] Archivos nuevos no superan 300 lineas — los tests target estan entre 80-150 lineas cada uno.
- [ ] `logger.error` en `useUserSearch.ts:28` no esta bajo `if (DEV)` — el test lo verifica como side effect en el error path.

### Checklist de observabilidad

- [ ] No introduce Cloud Function trigger.
- [ ] No introduce service nuevo con queries Firestore.
- [ ] No introduce `trackEvent` nuevos. El test de `useSurpriseMe` verifica el `trackEvent('surprise_me', ...)` existente.

### Checklist offline

- [ ] No introduce formularios/dialogs nuevos.
- [ ] El test de `useUserSearch` no necesita gate offline (el debounce ya falla naturalmente si no hay red — el test del error path lo cubre).

### Checklist de documentacion

- [ ] No agrega secciones de HomeScreen.
- [ ] No agrega analytics events.
- [ ] No agrega tipos al barrel — se mueve `RankingPeriodType` dentro de `services/rankings.ts` (export del archivo, no del barrel).
- [ ] `docs/reference/tests.md` se actualiza con la fila por hook (de `⏳` a `100%` con conteo de cases).
- [ ] `docs/reference/patterns.md` se actualiza con la decision de no-barrel (S6).
- [ ] No toca `firestore.md`.

---

## Offline

No aplica directamente. Tests son ejecutados en jsdom; no hay paths de produccion offline modificados.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| (n/a) | — | — | — |

### Esfuerzo offline adicional: S (cero)

---

## Modularizacion y % monolitico

Este PRD reduce ligeramente el acoplamiento al colapsar el re-export de `UserSearchResult` (S5) y centralizar `RankingPeriodType` (S4).

### Checklist modularizacion

- [ ] Logica de tests en archivos `.test.ts` co-ubicados con el hook (convencion existente).
- [ ] No agrega `useState` a AppShell ni SideMenu.
- [ ] Props explicitas — no aplica.
- [ ] Cada test ejercita props reales, no noop.
- [ ] Ningun archivo de test importa directo de `firebase/firestore` — solo mockea via `vi.mock`.
- [ ] Archivos en `src/hooks/` siguen siendo hooks (los `.test.ts` no cuentan como hooks).
- [ ] Archivos nuevos no superan 400 lineas (target 80-150 cada uno).
- [ ] Tests de admin callables van en `src/services/__tests__/` siguiendo la convencion ya establecida (`userProfile.test.ts`, `menuPhotos.test.ts`).
- [ ] Archivos nuevos van en carpeta de dominio correcta.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No toca componentes |
| Estado global | = | No toca contextos |
| Firebase coupling | - | Smoke tests de admin callables refuerzan la boundary del service layer (un cambio en callable name rompe el test, no escapa a runtime) |
| Organizacion por dominio | + | Tests en la carpeta correcta de cada hook/service |

---

## Accesibilidad y UI mobile

No aplica. Este PRD no toca componentes UI.

### Checklist de accesibilidad

- [ ] No introduce `<IconButton>` ni elementos clickables.
- [ ] Tests no validan a11y (esta cubierto por el agente copy-auditor + el test suite existente).

### Checklist de copy

- [ ] No introduce strings user-facing nuevos.
- [ ] Los mensajes de error existentes en `useUserLocation` (`'Geolocalización no soportada por tu navegador'`, `'Permiso de ubicación denegado'`, `'No se pudo obtener tu ubicación'`) ya tienen tildes correctas. El test los verifica como assertions exactas.

---

## Success Criteria

1. 8 archivos de test nuevos creados (`useRankings`, `useUnsavedChanges`, `useUserLocation`, `useUserSearch`, `useSurpriseMe`, `media`, `adminClaims`, `adminFeedback`) + extension de `useVisitHistory.test.ts`. Todos pasan en `npm run test:run`.
2. Cobertura >=95% statements, >=90% branches en cada uno de los 6 hooks y `utils/media.ts`. Verificable via `npm run test:coverage` filtrando por archivo.
3. `RankingPeriodType` exportado desde `services/rankings.ts` y consumido por `useRankings`. Sin literales duplicados en el codebase (`grep "'weekly' | 'monthly' | 'yearly' | 'alltime'"` retorna solo el archivo del services).
4. `UserSearchResult` exportado solo desde `services/users.ts`. `useUserSearch.ts` no re-exporta. Callsites migrados.
5. `docs/reference/patterns.md` documenta la decision de no-barrel para `src/hooks/`. `docs/reference/tests.md` actualizado con las filas correspondientes (de `⏳` a `100%`).

---

## Validacion Funcional

**Fecha**: 2026-05-01
**Auditor**: Sofia (analista funcional)
**Estado**: VALIDADO CON OBSERVACIONES
**Listo para specs-plan-writer**: Si

### Resumen del analisis

PRD claro, scope cerrado, criterios de exito testeables (cobertura >=95% statements / >=90% branches por archivo, verificable via `npm run test:coverage`). Los 6 hooks tienen branches concretos identificados con escenarios reales. Mock strategy explicita y consistente con `vitest_mock_patterns` ya establecido. Out-of-scope explicito sobre el refactor variadic de `useUnsavedChanges` y los tests server-side.

### Verificaciones realizadas

- `useVisitHistory.test.ts` ya existe en `src/hooks/` con 5 cases (basico, business resolution, repeat visit, clear, business=null) — el PRD lo trata correctamente como extension (cap MAX y JSON.parse fallback).
- `services/__tests__/` ya existe con `userProfile.test.ts` y `menuPhotos.test.ts` — la ubicacion de S3 (adminClaims/adminFeedback tests) sigue la convencion establecida.
- `PeriodType` en `useRankings.ts:6` es un `type` interno (no exportado) — el rename a `RankingPeriodType` y movida a `services/rankings.ts` no es un breaking change para consumidores externos.
- `STORAGE_URL_PREFIX = 'https://firebasestorage.googleapis.com/'` termina con `/` — el prefix-bypass `firebasestorage.googleapis.com.evil.com` ya esta bloqueado por la implementacion actual; el test de S2 funciona como regression guard, no como fix de un bug existente.
- `src/hooks/index.ts` no existe — la decision documentada en S6 (no crear barrel) refleja el estado actual y previene que un proximo agente lo cree sin contexto.
- Re-export de `UserSearchResult` en `useUserSearch.ts:6`: el grep `from.*useUserSearch.*UserSearchResult` no encontro callsites externos. La migracion S5 se reduce a borrar la linea.

### Observaciones (no bloqueantes)

1. **S5 — callsites de `UserSearchResult`**: probable que el grep retorne vacio. Si es asi, la migracion S5 se reduce a borrar la linea de re-export — el implementador lo descubre al ejecutar el grep.
2. **S2 — prefix-bypass**: el `/` final de `STORAGE_URL_PREFIX` ya bloquea el vector. El test documenta el vector como guarda de regresion.
3. **S1 — `useSurpriseMe`**: considerar agregar un case adicional para "pool de businesses vacio" (defensivo). No bloqueante para el scope actual.

### Sin hallazgos BLOQUEANTES ni IMPORTANTES

El PRD puede pasar a `specs-plan-writer` directamente.
