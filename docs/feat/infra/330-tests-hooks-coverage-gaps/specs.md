# Specs: Tech debt — tests para hooks sin cobertura + utils/media + admin callables

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-29
**Issue:** #330

---

## Modelo de datos

No se introducen colecciones nuevas, ni campos nuevos en colecciones existentes, ni tipos nuevos en `src/types/`.

Cambio de tipos (refactor S4):

```ts
// src/services/rankings.ts (nuevo export)
export type RankingPeriodType = 'weekly' | 'monthly' | 'yearly' | 'alltime';
```

`getCurrentPeriodKey` y `getPreviousPeriodKey` actualizan su firma para consumir `RankingPeriodType` en lugar del literal in-line. `useRankings.ts` deja de declarar el `type PeriodType` interno y consume el alias compartido.

## Firestore Rules

No aplica. El PRD no introduce reads/writes a colecciones nuevas. Los tests mockean `firebase/firestore` y `firebase/functions`; ningun test golpea reglas reales.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|---------------------|----------------|
| (n/a — solo tests) | — | — | — | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|---------------------|
| (n/a) | — | — | — | — |

## Cloud Functions

No aplica. Los smoke tests de admin callables (S3) verifican el cliente del SDK (`httpsCallable`); las funciones server-side (`functions/src/admin/claims.ts`, `functions/src/admin/feedback.ts`) son out-of-scope (issues separados en `tests.md`).

## Seed Data

No aplica. Sin cambios de schema.

## Componentes

No aplica. El PRD no introduce ni modifica componentes UI.

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|--------------------|-----------------|
| (n/a) | — | — | — | — |

## Textos de usuario

Sin textos nuevos. Los tests de `useUserLocation` verifican como assertions exactas los strings ya existentes en el hook (con tildes correctas):

| Texto | Donde se usa | Notas |
|-------|--------------|-------|
| `Geolocalización no soportada por tu navegador` | `useUserLocation.ts:11` (existente) | tilde en `Geolocalización` — asserted en test |
| `Permiso de ubicación denegado` | `useUserLocation.ts:29` (existente) | tilde en `ubicación` — asserted en test |
| `No se pudo obtener tu ubicación` | `useUserLocation.ts:30` (existente) | tilde en `ubicación` — asserted en test |

## Hooks

### Hooks existentes (sin cambios funcionales — solo se agregan tests)

| Hook | Archivo | Cambio |
|------|---------|--------|
| `useRankings` | `src/hooks/useRankings.ts` | Refactor S4: deja de declarar `type PeriodType` local, importa `RankingPeriodType` de `services/rankings`. Sin cambio de comportamiento. |
| `useUserSearch` | `src/hooks/useUserSearch.ts` | Refactor S5: borrar `export type { UserSearchResult }`. Sin cambio de comportamiento (consumidores usan `services/users`). |
| `useUnsavedChanges` | `src/hooks/useUnsavedChanges.ts` | Sin cambio. JSDoc opcional con nota sobre la API variadic (riesgo documentado en deuda tecnica). |
| `useUserLocation` | `src/hooks/useUserLocation.ts` | Sin cambio. |
| `useSurpriseMe` | `src/hooks/useSurpriseMe.ts` | Sin cambio. |
| `useVisitHistory` | `src/hooks/useVisitHistory.ts` | Sin cambio (test extendido). |

## Servicios

### Servicios existentes (sin cambios funcionales)

| Service | Archivo | Cambio |
|---------|---------|--------|
| `rankings` | `src/services/rankings.ts` | Refactor S4: agregar `export type RankingPeriodType`, actualizar firmas de `getCurrentPeriodKey`/`getPreviousPeriodKey` para usar el alias. Sin cambio de logica. |
| `adminClaims` | `src/services/adminClaims.ts` | Sin cambio. Smoke test nuevo. |
| `adminFeedback` | `src/services/adminFeedback.ts` | Sin cambio. Smoke test nuevo. |

## Integracion

Este PRD agrega archivos `.test.ts` y aplica refactors mecanicos a 2 hooks + 1 service. La integracion es nula desde el punto de vista de runtime: los tests corren en `vitest`, y los refactors no cambian la API publica de ningun modulo (el `RankingPeriodType` reemplaza un literal duplicado, el re-export de `UserSearchResult` se borra sin callsites externos).

### Preventive checklist

- [x] **Service layer**: Ningun test importa `firebase/firestore` ni `firebase/functions` directamente — todos pasan por `vi.mock`. Los servicios bajo test ya estan en `services/`.
- [x] **Duplicated constants**: El refactor S4 elimina el literal `'weekly' | 'monthly' | 'yearly' | 'alltime'` duplicado entre hook y service. Tras el cambio, queda una sola fuente (`services/rankings.ts`).
- [x] **Context-first data**: No aplica — no se introducen `getDoc` nuevos. `useUserLocation` ya consume `useFilters` (context).
- [x] **Silent .catch**: Verificado — los hooks bajo test ya usan `logger.error` o re-throw. Los tests verifican el side effect del `logger.error` en `useUserSearch`.
- [x] **Stale props**: No aplica — no se introducen componentes.

## Tests

### Archivos a crear/extender

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/useRankings.test.ts` (nuevo) | Delta calc cuando `data` y `prevRanking` ambos presentes con userIds compartidos; userIds que aparecen solo en `data` (no map entry); `alltime` (`prevFetcher` resuelve a null → no map); fetcher principal en error → `error=true`; refetch propaga; cambio de `periodType` dispara refetch implicito (por dependencia de `useCallback`) | Hook |
| `src/hooks/useUnsavedChanges.test.ts` (nuevo) | `isDirty=false` con `[]`, `['']`, `['  ']` (whitespace); `isDirty=true` con un value no vacio; `confirmClose` con isDirty=false ejecuta callback inline y NO abre dialog; `confirmClose` con isDirty=true abre dialog y guarda pendingClose ref; `onDiscard` cierra dialog y ejecuta pendingClose; `onDiscard` con pendingClose null no rompe; `onKeepEditing` cierra dialog y limpia ref sin ejecutar callback | Hook |
| `src/hooks/useUserLocation.test.ts` (nuevo) | `navigator.geolocation` undefined → `error` setteado y NO se llama getCurrentPosition; success path setea `userLocation` con lat/lng + resetea `isLocating`; `error.code === 1` → mensaje "Permiso denegado"; `error.code !== 1` (cualquier otro) → mensaje generico "No se pudo obtener"; `isLocating` se resetea en success y en error | Hook |
| `src/hooks/useUserSearch.test.ts` (nuevo) | term `''` y term `'a'` (1 char) limpian `results` + `searching=false` y cancelan timer pendiente; debounce 300ms (avanzar `vi.advanceTimersByTime(299)` no llama `searchUsers`; `300` lo llama); call exitoso setea `results`; `searchUsers` rechaza → `logger.error` + `results=[]` + `searching=false`; `clear()` cancela timer pending; calls consecutivos cancelan timer previo (verificar via spy a `clearTimeout` o conteo de llamadas a `searchUsers`) | Hook |
| `src/hooks/useSurpriseMe.test.ts` (nuevo) | Pool todo no visitado + sortLocation cerca → pick es de `nearby`; pool no visitado pero todos lejos (>5km) → pick es de `candidates` (no nearby); todos visitados → fallback a `allBusinesses` + `toast.info(MSG_ONBOARDING.surpriseAllVisited)`; happy path llama `onSelect(pick)` + `onClose()` + `toast.success(...)` + `trackEvent('surprise_me', { business_id })`; OBS3 (defensivo): mockear `allBusinesses` como `[]` documenta el comportamiento (`Math.floor(... * 0)=0` → `pool[0]=undefined` → tests defienden el patron actual con assertion explicita) | Hook |
| `src/hooks/useVisitHistory.test.ts` (extender) | Agregar 2 cases al describe existente: (1) cap MAX_VISIT_HISTORY se respeta — al insertar el visit numero 51, se elimina el mas viejo (slice); (2) localStorage corrupto (`'{not-json'`) → `readVisits` retorna `[]` y el hook arranca limpio | Hook |
| `src/utils/media.test.ts` (nuevo) | URL valida `https://firebasestorage.googleapis.com/v0/b/...` → true; `undefined` → false; `null` casteado a unknown → false; numero, objeto, boolean → false (typeof guard); URL vacia `''` → false; prefix-bypass `https://firebasestorage.googleapis.com.evil.com/...` → false (el `/` final del prefix bloquea); scheme-confusion `http://firebasestorage.googleapis.com/...` → false (sin TLS); URL con prefijo extra `evil-https://firebasestorage.googleapis.com/...` → false | Util |
| `src/services/__tests__/adminClaims.test.ts` (nuevo) | `httpsCallable` invocado con `(functions, 'setAdminClaim')` al import del modulo; cuando se invoca el callable retornado, recibe payload `{ targetUid: string }` | Service |
| `src/services/__tests__/adminFeedback.test.ts` (nuevo) | `respondToFeedback` se construye con `'respondToFeedback'` y payload `{ feedbackId, response }`; `resolveFeedback` con `'resolveFeedback'` y `{ feedbackId }`; `createGithubIssueFromFeedback` con `'createGithubIssueFromFeedback'` y `{ feedbackId }` (response shape `{ issueUrl }`) | Service |

### Mock strategy

- **Firebase config**: `vi.mock('../config/firebase', () => ({ db: {}, functions: {} }))`.
- **`firebase/functions` (smoke admin)**: `vi.mock('firebase/functions', () => ({ httpsCallable: (functions, name) => mockHttpsCallable(functions, name) }))`. `mockHttpsCallable` retorna un `mockCallableFn = vi.fn()` que los tests asertan. Patron identico al de `services/__tests__/menuPhotos.test.ts`.
- **`useAsyncData` (consumido por `useRankings`)**: mockear con `vi.mock('./useAsyncData', ...)` que retorna `{ data, loading, error, refetch }` controlable por variables hoisted con `vi.hoisted()`. El test inyecta `data` y `prevRanking` como dos llamadas consecutivas (el mock distingue por la fetcher que se le pasa, o por orden — usar `mockImplementation` que retorne distinto por call index).
- **`services/rankings`**: mockear `fetchRanking`, `getCurrentPeriodKey`, `getPreviousPeriodKey` con `vi.fn()`.
- **`navigator.geolocation`**: `vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } })` en `beforeEach`. Para el case "no soportada", `vi.stubGlobal('navigator', {})`. `vi.unstubAllGlobals()` en `afterEach`.
- **`useFilters` (context consumido por `useUserLocation`)**: `vi.mock('../context/FiltersContext', () => ({ useFilters: () => ({ userLocation, setUserLocation: mockSetUserLocation }) }))`.
- **`allBusinesses` y `useVisitHistory`/`useSortLocation` para `useSurpriseMe`**: mockear el modulo `'./useBusinesses'` exportando `allBusinesses` como array fijo con coords conocidas, mockear `'./useVisitHistory'` para retornar `{ visits: [...] }`, mockear `'./useSortLocation'` para retornar `{ lat, lng }`. `distanceKm` se deja real (deterministica, sin side effects).
- **`logger`**: `vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() } }))`.
- **`ToastContext`**: `vi.mock('../context/ToastContext', () => ({ useToast: () => ({ success: mockSuccess, info: mockInfo, error: mockError }) }))`.
- **`trackEvent`**: `vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }))`.
- **LocalStorage**: real (jsdom), limpiar con `localStorage.clear()` en `beforeEach`.
- **Timers (`useUserSearch`)**: `vi.useFakeTimers()` + `vi.advanceTimersByTime(N)` + `await waitFor(...)` para resolver microtasks tras avanzar el timer. `vi.useRealTimers()` en `afterEach`.

### Patron de imports y cleanup

Todos los tests siguen el patron establecido (`useFollow.test.ts`, `useVisitHistory.test.ts`):

```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock(...) y vi.hoisted(...) en topo del archivo

beforeEach(() => {
  vi.clearAllMocks();
  // resets especificos por test (localStorage.clear, stubGlobal, etc.)
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
```

### Criterios de aceptacion

- Cobertura >= 95% statements, >= 90% branches en cada uno de los 6 hooks (`useRankings`, `useUnsavedChanges`, `useUserLocation`, `useUserSearch`, `useSurpriseMe`, `useVisitHistory`) y `utils/media.ts`. Verificable via `npm run test:coverage` filtrando por archivo.
- Cobertura >= 80% en los smoke tests de admin (`adminClaims.ts`, `adminFeedback.ts` son one-liners — el smoke verifica la construccion del callable).
- Todos los paths condicionales del PRD cubiertos.
- Side effects verificados (`toast.info/success`, `trackEvent`, `logger.error`, `setUserLocation`).
- `npm run test:run` pasa sin errores.

## Analytics

No se introducen `trackEvent` nuevos. El test de `useSurpriseMe` verifica el `trackEvent('surprise_me', { business_id })` ya existente.

---

## Offline

No aplica. Tests corren en jsdom, no tocan paths offline de produccion.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| (n/a) | — | — | — |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|---------------------|
| (n/a) | — | — |

### Fallback UI

(n/a)

---

## Accesibilidad y UI mobile

No aplica. El PRD no introduce componentes ni elementos interactivos.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| (n/a) | — | — | — | — |

### Reglas

(n/a)

## Textos y copy

Sin textos nuevos. Los tests asertan como strings exactos los textos existentes de `useUserLocation` (ya con tildes correctas).

### Reglas de copy

(n/a — sin strings nuevos)

---

## Decisiones tecnicas

### D1 — Mock de `useAsyncData` por orden de llamada

`useRankings` llama `useAsyncData` dos veces (una para `fetcher`, otra para `prevFetcher`). El mock necesita distinguir entre ambas. Decision: usar `vi.fn().mockImplementationOnce(...)` dos veces consecutivas en el orden en que el hook las invoca (data primero, prev despues). Alternativa rechazada: distinguir por el contenido del fetcher pasado — fragil, acoplado a internals.

### D2 — `allBusinesses` mock como modulo, no como import

`useSurpriseMe` importa `allBusinesses` como named export de `./useBusinesses`. Mockearlo con `vi.mock('./useBusinesses', () => ({ allBusinesses: [...], useBusinesses: vi.fn() }))` desde el top-level del test. Alternativa rechazada: stub via `vi.stubGlobal` — `allBusinesses` no es global.

### D3 — `vi.useFakeTimers()` solo en `useUserSearch`

Solo `useUserSearch` tiene debounce con `setTimeout`. Los demas hooks usan timers indirectos (no relevantes para el test). Decision: aplicar fake timers exclusivamente en el archivo `useUserSearch.test.ts`. `useVisitHistory` y otros usan real timers (jsdom).

### D4 — Smoke tests de admin: import-time vs lazy

`httpsCallable` se invoca al evaluar `services/adminClaims.ts` (top-level). Para asertar la construccion, el test debe `await import(...)` despues de declarar el mock — patron ya establecido en `menuPhotos.test.ts`. `vi.clearAllMocks()` en `beforeEach` se llama ANTES del `await import`, asi que la primera llamada al import es la unica que cuenta.

Alternativa: usar `vi.resetModules()` antes de cada `await import` para forzar re-evaluacion. Decision: SI usarlo en estos tests para que cada `it(...)` mida la construccion fresca del callable. Patron observado en `userProfile.test.ts` line 64 (`await import('../userProfile')` por test).

### D5 — Refactor S4 (RankingPeriodType) — done en este PRD vs followup

El PRD lo lista en scope. Decision: hacerlo aca por dos razones: (a) es trivial — un literal duplicado entre dos archivos, (b) consolidar tipos antes de escribir tests evita que los tests se acoplen al `type PeriodType` privado de `useRankings.ts` que el refactor borra.

### D6 — Refactor S5 (UserSearchResult re-export) — borrar antes vs despues de tests

El re-export es una linea (`export type { UserSearchResult }`). Sin callsites externos (verificado por Sofia: el grep retorna vacio). Decision: borrarlo antes de escribir el test de `useUserSearch` para que el test importe `UserSearchResult` directo de `services/users` desde el inicio.

### D7 — JSDoc de riesgo en `useUnsavedChanges`

El PRD menciona como out-of-scope el refactor variadic (`...string[]` → API explicita). Decision: agregar un bloque `@deprecated`-style JSDoc en `useUnsavedChanges.ts` documentando el riesgo de la API actual (un caller que pase un objeto en lugar de strings rompe el `.trim()`). No cambia comportamiento. Esto cumple lo pedido por el PRD seccion "Deuda tecnica" punto 7.

### D8 — Decision S6: no-barrel para `hooks/`

Documentar en `patterns.md` seccion "TypeScript y build" como nueva fila:

> **No barrel para `src/hooks/`** | A diferencia de `theme/`, `types/`, `constants/`, `services/admin/`, no hay `src/hooks/index.ts`. Cada hook se importa de su archivo. Justificacion: vitest tree-shake mocks por archivo; un `vi.mock('./hooks/useFoo')` no debe forzar la carga del modulo de otro hook que solo entra al barrel. No crear el barrel sin discutirlo previamente.

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna. Este PRD no introduce paths de produccion que toquen Firestore.

### Rate limiting

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| (n/a) | — | — |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Prefix-bypass en URL de Firebase Storage (`firebasestorage.googleapis.com.evil.com/...`) | Test verifica que `isValidStorageUrl` rechaza la URL — la presencia del `/` final en `STORAGE_URL_PREFIX` ya bloquea el ataque, el test queda como regression guard | `src/utils/media.test.ts` |
| Scheme-confusion (`http://` sin TLS) | Test verifica que la URL se rechaza — `STORAGE_URL_PREFIX` empieza con `https://` | `src/utils/media.test.ts` |
| Type confusion (objeto, numero pasado como `url`) | Test verifica que el guard `typeof url === 'string'` rechaza inputs no-string | `src/utils/media.test.ts` |
| Rename silencioso de Cloud Function callable name | Smoke tests bloquean — un cambio en el string `'setAdminClaim'`, `'respondToFeedback'`, `'resolveFeedback'`, `'createGithubIssueFromFeedback'` rompe el test antes de runtime | `src/services/__tests__/adminClaims.test.ts`, `src/services/__tests__/adminFeedback.test.ts` |

---

## Deuda tecnica: mitigacion incorporada

Issues abiertos consultados (status al 2026-04-29):

```bash
gh issue list --label tech debt --state open --json number,title
gh issue list --label security --state open --json number,title
```

| Issue / Hallazgo | Que se resuelve | Paso del plan |
|------------------|----------------|---------------|
| `tests.md ⏳ useUnsavedChanges` | Cobertura del state machine de dialog | Fase 1 paso 2 |
| `tests.md ⏳ useRankings` | Cobertura de delta calc + alltime branch | Fase 1 paso 1 |
| `tests.md ⏳ useAsyncData` (parcial) | NO se resuelve aca — los tests de `useRankings` mockean `useAsyncData`. Cerrar `useAsyncData` queda como issue separado en backlog | (out-of-scope) |
| Health-check #330 punto 5 (`UserSearchResult` re-export) | Resuelto | Fase 2 paso 2 |
| Health-check #330 punto 6 (barrel `hooks/`) | Decision documentada | Fase 3 paso 2 |
| Health-check #330 punto 7 (`useUnsavedChanges` API variadic) | Documentado JSDoc; followup separado | Fase 1 paso 2b |
| Hallazgo: `PeriodType` duplicado entre `useRankings.ts:6` y `services/rankings.ts:35` | Centralizado en service | Fase 2 paso 1 |

No se introduce deuda tecnica nueva. Los archivos tocados (`useRankings.ts`, `useUserSearch.ts`, `services/rankings.ts`) reducen acoplamiento.

---


## Validacion Tecnica

**Fecha**: 2026-05-01
**Auditor**: Diego (solution architect)
**Estado**: VALIDADO
**Listo para Pablo (plan reviewer)**: Si

### Resumen del analisis

Specs cubre todos los items del PRD (S1-S6) sin gaps tecnicos. La estrategia de mocks es granular (D1-D4) y resuelve las ambiguedades previsibles antes de la implementacion. Los refactors S4/S5 son mecanicos y verificables (literal duplicado entre dos archivos, re-export sin callsites externos). La decision S6 (no-barrel para `hooks/`) tiene justificacion tecnica concreta vinculada al tree-shaking de mocks de vitest. El hardening de seguridad documenta vectores ya bloqueados como regression guards (no como fixes), expectativa correcta.

### Verificaciones realizadas

- **Patron `httpsCallable` mock**: replicado exacto de `services/__tests__/menuPhotos.test.ts:14-19` (mock factory + `mockCallableFn`). Verificado en disco.
- **`UserSearchResult` callsites**: `grep -rn "UserSearchResult" src/` retorna solo `useUserSearch.ts:3` (import), `useUserSearch.ts:6` (re-export a borrar), `useUserSearch.ts:9` (uso interno) y `services/users.ts:61,72,90` (definicion + usos). Sin callsites externos al hook — la migracion S5 se reduce a borrar la linea `export type { UserSearchResult }` sin tocar otros archivos.
- **`PeriodType` duplicado**: confirmado en `useRankings.ts:6` (literal `'weekly' | 'monthly' | 'yearly' | 'alltime'`) y repetido in-line en `services/rankings.ts:132,179`. La centralizacion en `RankingPeriodType` consolida tres ocurrencias, no dos.
- **`isValidStorageUrl`**: implementacion en `utils/media.ts` confirma que `STORAGE_URL_PREFIX` termina con `/` y que el guard `typeof url === 'string'` esta presente. Los casos del test (prefix-bypass, scheme-confusion, type confusion) estan alineados con la implementacion actual.
- **`useUserLocation` strings**: confirmado que las tres aserciones del test (`'Geolocalización no soportada por tu navegador'`, `'Permiso de ubicación denegado'`, `'No se pudo obtener tu ubicación'`) coinciden character-for-character con `useUserLocation.ts:11,29,30` (incluyendo tildes en `Geolocalización` y `ubicación`).
- **`useSurpriseMe` pool vacio (OBS3 Sofia)**: el specs documenta el comportamiento defensivo (`Math.floor(0 * 0)=0` → `pool[0]=undefined`) como assertion explicita. Correcto — el test defiende el patron actual sin pedir cambio en el hook.
- **`useRankings` mock por orden de llamada (D1)**: confirmado al leer el hook (`useAsyncData(fetcher)` linea 35, `useAsyncData(prevFetcher)` linea 36). El mock con `mockImplementationOnce` en orden secuencial es la unica estrategia robusta sin acoplarse a la identidad del fetcher.
- **`vi.resetModules()` para smoke admin (D4)**: patron verificado en `services/__tests__/userProfile.test.ts` y aplicable a estos modulos donde `httpsCallable` se invoca a top-level.
- **Convencion de ubicacion**: `src/hooks/*.test.ts` (co-localizado) y `src/services/__tests__/*.test.ts` (carpeta `__tests__`) — ambas presentes en el repo, ningun test rompe la convencion.

### Cobertura del checklist tecnico

- [x] Cobertura PRD → specs: cada S1-S6 mapeado, out-of-scope respetado.
- [x] Data model: refactor S4 sin breaking change (tipo interno → tipo exportado).
- [x] Security model: hardening como regression guard, no fix.
- [x] Patrones del proyecto: `vi.hoisted()`, `vi.useRealTimers()`, `vi.unstubAllGlobals()` aplicados; tests en carpeta correcta.
- [x] Edge cases: pool vacio, geolocation no soportada, parse corrupto, debounce cancelacion, alltime sin prev.
- [x] Dependencies viables: `vi.stubGlobal`, `vi.advanceTimersByTime`, `vi.resetModules`, `vi.mock` con factory.
- [x] Observabilidad: `logger.error` y `trackEvent` verificados como side effects.
- [x] Testing strategy: criterio cuantificado por archivo (>=95% statements, >=90% branches).
- [x] Backwards compat: S4 sin breaking (tipo interno); S5 sin callsites externos (verificado).
- [x] PWA/multi-tab: no aplica (tests aislados en jsdom).

### Observaciones tecnicas para Pablo

1. **Orden de fases**: ejecutar refactor S4 (`RankingPeriodType`) ANTES del test de `useRankings` evita acoplarse al `type PeriodType` privado que se va a borrar. El specs lo dice (D5) — Pablo deberia mantenerlo en el plan.
2. **Refactor S5 antes que test de `useUserSearch`**: similar logica (D6). El plan tiene que ordenar los pasos asi: refactor → tests, no a la inversa.
3. **Patron `await import()` en smoke admin tests**: Pablo deberia verificar que cada `it(...)` ejecute `vi.resetModules()` antes del `await import` para que la asercion sobre `httpsCallable` mida la primera llamada (D4).
4. **`useVisitHistory.test.ts` extension, no rewrite**: el archivo ya tiene 5 cases. Pablo deberia listar explicitamente "agregar 2 cases" no "crear archivo".
5. **Actualizacion de docs (`tests.md`, `patterns.md`)**: el plan tiene que incluir el paso de actualizar ambos archivos de referencia (mover hooks de `⏳` a `100%`, agregar fila no-barrel en patterns). El PRD lo declara como Success Criteria #5.

### Sin hallazgos BLOQUEANTES, IMPORTANTES ni OBSERVACIONES tecnicas pendientes

El specs puede pasar a `plan-writer` directamente.
