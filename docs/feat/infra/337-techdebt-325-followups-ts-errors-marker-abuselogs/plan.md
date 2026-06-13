# Plan: Tech debt #325 followups — TS errors + marker lookback + abuseLogs

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-05-16
**Issue:** #337

---

## Fases de implementacion

### Fase 1: Reparar los 4 errores TypeScript reales en `functions/`

**Branch:** `feat/337-techdebt-325-followups-ts-errors-marker-abuselogs`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/moderation.ts` | Eliminar el import `import type { ModerationAction, ModerationTargetCollection } from '../shared/types/admin';` (linea 6 — modulo inexistente). Reemplazar por dos `type` inline al tope del archivo, despues de los demas imports: `type ModerationAction = 'delete' | 'hide';` y `type ModerationTargetCollection = 'comments' | 'ratings' | 'customTags';`. Verificar que los call sites internos (`writeModerationLog`, `moderateComment`, `moderateRating`, `moderateCustomTag`) siguen typchequeando. |
| 2 | `functions/src/triggers/menuPhotos.ts` | En lineas 29, 37 y 44, cambiar `type: 'invalid_input'` por `type: 'flagged'`. Conservar el resto del objeto (`userId`, `collection: 'menuPhotos'`, `detail: ...`) sin cambios. **NO tocar la linea 58** (`type: 'rate_limit'` — ya es valido). |
| 3 | `functions/src/admin/claims.ts` | Agregar `getDb` al import de `'../helpers/env'` (linea 6 ya importa de ahi). Eliminar `getFirestore` del import de `'firebase-admin/firestore'` (linea 5) — dejar solo `FieldValue` que se sigue usando en lineas 74, 76. Reemplazar `getFirestore()` por `getDb()` en lineas 42 y 70. |
| 4 | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Cambiar en la linea ~226 (dentro del test `'rejects empty storagePath and logs abuse'`) la assertion `type: 'invalid_input'` por `type: 'flagged'`. **NO tocar la linea ~185** (`type: 'rate_limit'`). |
| 5 | (verificacion) | Correr `cd functions && npm run build` — debe terminar con exit 0 sin errors en `moderation.ts`, `menuPhotos.ts`, `claims.ts`. |
| 6 | (verificacion) | Correr `cd functions && npm run test:run -- menuPhotos` (smoke per observacion Sofia) y `cd functions && npm run test:run` (suite completa). Todo verde. Si algun test de `claims.test.ts` mockeaba `getFirestore` directamente, agregar mock equivalente para `getDb` desde `helpers/env`. |

### Fase 2: Robustecer el detector del marker (check 6 del pre-staging script)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `scripts/pre-staging-check.sh` | En la linea 111, cambiar `for back in 1 2; do` por `for back in 1 2 3 4 5; do`. Tambien actualizar el comentario en la linea 106 si menciona `up to 2 previous lines` — reemplazar por `up to 5 previous lines`. |
| 2 | (smoke test manual) | Crear `src/services/__tmp_perf_smoke_5.ts` y `src/services/__tmp_perf_smoke_6.ts` segun la receta del specs (seccion "Smoke test detallado"). Correr `bash scripts/pre-staging-check.sh`. Verificar: fixture 5 PASS, fixture 6 FAIL en check 6. **Borrar ambas fixtures inmediatamente despues del smoke** — NO commitearlas. |
| 3 | `docs/reference/patterns.md` | Actualizar linea 154 (descripcion del marker `// perf-instrument-ok`): cambiar `"hasta 2 lineas arriba"` por `"hasta 5 lineas arriba"`. El resto de la celda queda igual. |

### Fase 3: Documentar la decision sobre `abuseLogs.ts`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/abuseLogs.ts` | Reemplazar el JSDoc actual de `subscribeToAbuseLogs` (linea 8-10) por el bloque ampliado descripto en el specs (seccion "Servicios → src/services/abuseLogs.ts — solo JSDoc"). NO agregar el marker `// perf-instrument-ok`. NO cambiar la signature ni el body. |

### Fase 4 (opcional, contingente): Promocion check 1 WARN→FAIL para `functions/`

Sub-item documentado en el specs como decision diferida. **Solo ejecutar si la Fase 1 deja `cd functions && npm run build` 100% limpio sin warnings residuales.** Si hay algun warning residual fuera del scope de este issue, NO promocionar y dejar entrada en `docs/reports/tech-debt.md`.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | (verificacion previa) | Correr `cd functions && npx tsc --noEmit 2>&1` desde branch limpia post-Fase-1. Si el output esta 100% vacio (exit 0 + 0 warnings), avanzar al paso 2. Si hay warnings, skipear esta fase y agregar entrada a `docs/reports/tech-debt.md`. |
| 2 | `scripts/pre-staging-check.sh` | En el bloque del check 1 (lineas 19-31), reemplazar el `echo WARN + CHECKS_PASSED++` actual (lineas 26-27) por un llamado a `fail "functions TypeScript errors"`. El check 1 ahora bloquea en lugar de tolerar. |
| 3 | (verificacion) | Correr `bash scripts/pre-staging-check.sh` desde branch limpia — check 1 debe seguir PASS. Si falla, revertir paso 2 (algo residual quedo). |

### Fase 5: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Ya cubierto en Fase 2 paso 3 (lookback=5). No requiere paso adicional. |
| 2 | `docs/reference/security.md` | Sin cambio — el cambio de tipos no afecta superficie de seguridad (verificado en specs). |
| 3 | `docs/reference/firestore.md` | Sin cambio — no se modifican colecciones ni rules. |
| 4 | `docs/reference/features.md` | Sin cambio — no hay funcionalidad visible al usuario. |
| 5 | `docs/reference/project-reference.md` | Actualizar la seccion de version/fecha post-merge mencionando el cleanup de #337 en el changelog (si el merge skill lo requiere — caso comun: bump version + nota corta tipo "tech debt cleanup: TS errors en functions, marker lookback ampliado, abuseLogs documentado"). |
| 6 | `docs/_sidebar.md` | Agregar entradas Specs y Plan bajo la linea ya existente `#337 Tech debt: #325 followups...` (linea 184 segun grep): dos lineas hijas con indentacion de 4 espacios extra apuntando a `/feat/infra/337-techdebt-325-followups-ts-errors-marker-abuselogs/specs.md` y `.../plan.md`. |
| 7 | `src/components/menu/HelpSection.tsx` | Sin cambio — no afecta comportamiento user-facing. |

---

## Orden de implementacion

1. Fase 1 paso 1 (moderation.ts inline types) — desbloquea tsc errors 1 de 4.
2. Fase 1 paso 2 (menuPhotos.ts literales) — desbloquea tsc errors 2-3-4 de 4 (los tres `'invalid_input'`).
3. Fase 1 paso 3 (claims.ts getDb) — desbloquea check 3 del pre-staging script.
4. Fase 1 paso 4 (test assertion) — alinea suite con el cambio del paso 2.
5. Fase 1 pasos 5-6 (verificacion build + tests).
6. Fase 2 paso 1 (lookback=5 en script) — independiente de Fase 1, pero conviene despues para tener branch limpia.
7. Fase 2 paso 2 (smoke test fixtures, **borrar inmediatamente**).
8. Fase 2 paso 3 (actualizar patterns.md).
9. Fase 3 paso 1 (JSDoc en abuseLogs.ts) — independiente, baja prioridad.
10. Fase 4 (opcional, contingente al output limpio del paso 5).
11. Fase 5 (documentacion final + sidebar).

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas antes | Lineas despues | Riesgo monolitico |
|---------|--------------|----------------|-------------------|
| `functions/src/admin/moderation.ts` | ~208 | ~210 (+2 inline types) | OK — <400 |
| `functions/src/triggers/menuPhotos.ts` | 96 | 96 (cambio in-place) | OK |
| `functions/src/admin/claims.ts` | 128 | 128 (cambio in-place) | OK |
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | ~400 | ~400 (cambio in-place) | OK |
| `scripts/pre-staging-check.sh` | 153 | 153 (cambio in-place 1 char + comentario) | OK |
| `src/services/abuseLogs.ts` | 34 | ~50 (+JSDoc ampliado) | OK |
| `docs/reference/patterns.md` | ~N (existing) | +0 (cambio in-place 1 palabra) | OK |
| `docs/_sidebar.md` | ~N (existing) | +2 lineas | OK |

Ningun archivo se acerca al limite de 400 lineas. No requiere decomposicion.

## Riesgos

1. **Test mock de `getFirestore` en `claims.test.ts`** — si el test mockeaba directamente `getFirestore` y no `getDb` via `helpers/env`, el cambio podria romper el setup del mock. Mitigacion: durante Fase 1 paso 6, si algun test falla con `TypeError: getDb is not a function` o similar, agregar al setup del test el mock equivalente (`vi.mock('../../helpers/env', ...)`) — patron documentado en `feedback_vitest_mock_patterns.md` (memoria). Esfuerzo: <10 min.
2. **`tsc --noEmit` con warnings residuales fuera de scope** — la promocion check 1 WARN→FAIL (Fase 4) es optimista. Si quedan warnings de archivos no tocados en este issue, no se promociona y se deja entrada en tech-debt. Mitigacion: Fase 4 es opcional y contingente al paso 1 de verificacion. No bloquea merge.
3. **Fixtures de smoke test commiteadas por error** — el smoke test crea `__tmp_perf_smoke_*.ts` en `src/services/`. Si el implementador olvida borrarlos antes del commit, contaminan el repo. Mitigacion: paso 2 de Fase 2 documenta explicitamente "borrar inmediatamente". El pre-commit hook + revision visual al `git status` deberia detectarlo. Si igual se commitea, el merge skill lo detecta antes de subir.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — no hay componentes nuevos
- [x] Archivos nuevos en carpeta de dominio correcta — no hay archivos nuevos
- [x] Logica de negocio en hooks/services — no se mueve logica
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — `claims.ts` tenia ruido de check 3, se incluye el fix
- [x] Ningun archivo resultante supera 400 lineas — verificado en la tabla de estimacion

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — N/A, no hay colecciones nuevas
- [x] Todo campo string tiene `.size() <= N` — N/A
- [x] Todo campo list tiene `.size() <= N` — N/A
- [x] Admin writes tambien tienen validacion de campos — sin cambio en admin writes
- [x] Counter decrements en triggers usan `Math.max(0, ...)` — sin cambio en triggers de counters
- [x] Rate limits llaman `snap.ref.delete()` — sin cambio en rate limits
- [x] Toda coleccion nueva escribible por usuarios tiene CF trigger con rate limit — N/A
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificado
- [x] `getCountFromServer` → `getCountOfflineSafe` — N/A, no se agrega query nuevo

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — sin triggers nuevos; los existentes (`onMenuPhotoCreated`) mantienen su `trackFunctionTiming` intacto
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — sin services nuevos
- [x] Todo `trackEvent` nuevo registrado en `GA4_EVENT_NAMES` — no se agrega trackEvent
- [x] Todo `trackEvent` nuevo tiene feature card — N/A
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — sin cambio en logger calls

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — N/A, sin UI
- [x] No hay `<Typography onClick>` — N/A
- [x] Touch targets minimo 44x44px — N/A
- [x] Componentes con fetch tienen error state con retry — N/A
- [x] `<img>` con URL dinamica tienen `onError` fallback — N/A
- [x] httpsCallable en componentes user-facing tienen guard offline — N/A

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo — N/A, sin textos nuevos
- [x] Tildes correctas — N/A
- [x] Terminologia consistente — N/A
- [x] Strings reutilizables en `src/constants/messages/` — N/A

## Criterios de done

- [ ] `cd functions && npm run build` termina con exit 0 y sin errores en `moderation.ts`, `menuPhotos.ts`, `claims.ts`
- [ ] `bash scripts/pre-staging-check.sh` reporta checks 1, 3 y 6 como PASS sobre la branch
- [ ] Los tres callsites de `logAbuse` en `menuPhotos.ts` lineas 29/37/44 pasan `type: 'flagged'`; el callsite linea 58 sigue como `'rate_limit'`
- [ ] El detector del marker `perf-instrument-ok` acepta markers hasta 5 lineas arriba del read raw, verificado via smoke test (fixture 5 PASS, fixture 6 FAIL)
- [ ] Fixtures temporales `__tmp_perf_smoke_*.ts` borradas antes del commit (verificar `git status` limpio en `src/services/`)
- [ ] `src/services/abuseLogs.ts` tiene el bloque JSDoc ampliado, sin marker `// perf-instrument-ok`
- [ ] `functions/src/__tests__/triggers/menuPhotos.test.ts` linea 226 alineado con el nuevo literal `'flagged'`; linea 185 (`'rate_limit'`) intacta
- [ ] `npm run test:run` desde root y `cd functions && npm run test:run` ambos verdes
- [ ] `npm run test:run -- menuPhotos` (smoke per Sofia) verde
- [ ] `docs/reference/patterns.md` linea 154 actualizada a "hasta 5 lineas arriba"
- [ ] `docs/_sidebar.md` incluye entradas Specs y Plan para #337
- [ ] (Opcional, contingente) Si `tsc --noEmit` quedo 100% limpio, check 1 del pre-staging script promocionado de WARN a FAIL para `functions/`
- [ ] No hay imports de `'../shared/types/admin'` en functions/src/ (verificar con `grep -r "shared/types/admin" functions/src/`)
- [ ] No hay `'invalid_input'` en functions/src/ excepto el archivo de coverage HTML que se autogenera (verificar con `grep -rn "invalid_input" functions/src/ --include='*.ts'`)
- [ ] No hay `getFirestore()` raw en functions/src/ excepto `helpers/env.ts` (verificar con check 3)

---

## Validacion de Plan

**Validado por:** Pablo (Delivery Lead) — Ciclo 1
**Fecha:** 2026-05-16
**Estado:** VALIDADO CON OBSERVACIONES

PRD + specs validados (Sofia C2, Diego C1). Plan cubre todos los items con pasos atómicos.

### Observaciones para implementación (no bloquean)

- **IMPORTANTE #1**: promover ajuste mock `getDb` en `claims.test.ts:76-79` de contingencia (Fase 1 paso 6) a acción explícita en Fase 1 paso 3. Diego verificó: mock no expone `getDb`, fallo determinístico.
- **IMPORTANTE #2**: agregar sub-paso a Fase 1 paso 1 — eliminar mock huérfano `vi.mock('../../shared/types/admin', () => ({}))` en `moderation.test.ts:56` (NO `menuPhotos.test.ts`).
- OBS #1 Diego (patterns.md:154 lookback=5) ya cubierta en Fase 2 paso 3.

### Listo para implementación

Sí.
