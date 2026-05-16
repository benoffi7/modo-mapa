# Specs: Tech debt #325 followups — TS errors + marker lookback + abuseLogs

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-05-16
**Issue:** #337

---

## Modelo de datos

No hay cambios al modelo. Este feature es 100% type cleanup, build pipeline y script de CI.

### Tipos afectados (sin cambio de shape, solo de ubicacion / literales)

- `AbuseLogEntry.type` (`functions/src/utils/abuseLogger.ts:6`) — union **NO se modifica**. Sigue siendo:
  ```ts
  'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood' | 'anon_flood' | 'ip_rate_limit' | 'config_edit' | 'deletion_failure'
  ```
- `ModerationAction` (hoy importado desde `'../shared/types/admin'` que no existe) — **se define inline** en `functions/src/admin/moderation.ts`. Shape:
  ```ts
  type ModerationAction = 'delete' | 'hide';
  ```
- `ModerationTargetCollection` (mismo problema) — **se define inline** en `functions/src/admin/moderation.ts`. Shape:
  ```ts
  type ModerationTargetCollection = 'comments' | 'ratings' | 'customTags';
  ```

Ambos shapes coinciden 1:1 con los tipos frontend ya existentes en `src/types/admin.ts:196-198` (no duplicar contenido — la duplicacion frontend/backend es deliberada por boundary).

## Firestore Rules

Sin cambios. Las rules sobre `abuseLogs` (Functions-only create, admin-only read) y `moderationLogs` (mismo patron) se mantienen. El cambio de literal `'invalid_input'` → `'flagged'` no afecta rules (no hay validacion de `type` en rules, solo de campos via `hasOnly()`).

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio necesario? |
|---------------------|------------|-------------|--------------------|-------------------|
| (ningun query nuevo) | — | — | — | No |

### Field whitelist check

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio en rules? |
|-----------|------------------------|----------------------|---------------------------------------|------------------|
| (sin cambios de campos) | — | — | — | No |

## Cloud Functions

Sin cambios funcionales en triggers ni callables. Solo cambios sintacticos:

- `functions/src/triggers/menuPhotos.ts` — tres callsites de `logAbuse` (lineas 29, 37, 44) cambian `type: 'invalid_input'` por `type: 'flagged'`. Mantienen `detail` y `collection` intactos.
- `functions/src/admin/claims.ts` — dos invocaciones a `getFirestore()` (lineas 42 y 70) se reemplazan por `getDb()` importado desde `'../helpers/env'`. Eliminar el import `getFirestore` de `'firebase-admin/firestore'` si queda huerfano (mantener `FieldValue` que sigue en uso).
- `functions/src/admin/moderation.ts` — eliminar el import roto `from '../shared/types/admin'`. Agregar dos `type` inline al tope.

### Cuarto callsite (`menuPhotos.ts:58`) — verificado

Sofia marco como observacion verificar el cuarto callsite. Confirmado en disco:

```ts
// linea 58
await logAbuse(db, {
  userId,
  type: 'rate_limit',  // ya es un AbuseType valido — NO requiere cambio
  collection: 'menuPhotos',
  detail: 'Exceeded 10 menuPhotos/day',
});
```

Solo los tres callsites de validacion de input (lineas 29, 37, 44) requieren cambio. El callsite de rate limit (58) no aplica al issue.

## Seed Data

N/A — no se introducen colecciones ni campos.

## Componentes

N/A — no hay UI nueva ni modificada.

### Mutable prop audit

N/A.

## Textos de usuario

N/A — feature 100% interno (build pipeline + script + JSDoc). No hay copy user-facing.

## Hooks

N/A — no hay hooks nuevos ni modificados.

## Servicios

### `src/services/abuseLogs.ts` — solo JSDoc

Agregar bloque JSDoc arriba de `subscribeToAbuseLogs` explicando por que no se instrumenta con `measureAsync`:

```ts
/**
 * Subscribes to real-time abuse logs, ordered by timestamp descending.
 *
 * NOTE — Perf instrumentation: esta funcion usa `onSnapshot` (subscription, no
 * promise), por lo cual el patron `measureAsync` / `measuredGetDoc` /
 * `measuredGetDocs` de `src/utils/perfMetrics.ts` no aplica directamente —
 * no hay una promise asincronica que envolver. El check 6 de
 * `scripts/pre-staging-check.sh` solo flagea `getDoc`/`getDocs` raw, no
 * `onSnapshot`, por lo cual NO se requiere el marker `// perf-instrument-ok`
 * (que tiene semantica especifica: suprimir el flag de read raw envuelto en
 * un `Promise.all` ya medido). Si en el futuro se desea telemetria de
 * tiempo-hasta-primer-snapshot, usar `trackEvent('admin_abuse_subscribe', { ms })`
 * con un timer manual (deferido — entrada futura en `docs/reports/tech-debt.md`).
 */
```

Sin cambios de logica. La funcion sigue siendo idem.

## Scripts

### `scripts/pre-staging-check.sh` — check 6, lookback ampliado

Bumpear el loop de lookback del marker `perf-instrument-ok` de `for back in 1 2` a `for back in 1 2 3 4 5`. Una unica linea cambia:

```diff
-  for back in 1 2; do
+  for back in 1 2 3 4 5; do
```

Comportamiento resultante:
- Marker en la **misma linea** del read raw → PASS (sin cambio respecto a hoy).
- Marker hasta **5 lineas arriba** del read raw → PASS (cubre `Promise.all` con 3-4 reads).
- Marker a **6+ lineas** → FAIL (cota superior, evita falso positivo silencioso).
- Sin marker y sin wrapper → FAIL (sin cambio respecto a hoy).

El cambio es backward-compat con todos los markers existentes (todos estan en mismo-linea o 1-2 lineas arriba).

## Integracion

Este feature no agrega integracion entre modulos. Solo repara errores TS preexistentes y robustece un script de CI.

### Preventive checklist

- [x] **Service layer**: no se introduce ningun import `firebase/firestore` para writes en componentes (cambio es solo JSDoc en `abuseLogs.ts`)
- [x] **Duplicated constants**: los tipos `ModerationAction`/`ModerationTargetCollection` se definen inline en su unico callsite — no son duplicacion sino consolidacion (eliminamos el import roto a un archivo inexistente)
- [x] **Context-first data**: N/A — no hay nuevo data fetch
- [x] **Silent .catch**: N/A — no se agregan handlers nuevos
- [x] **Stale props**: N/A — no hay componentes

## Tests

### Archivos a modificar

| Archivo | Cambio | Justificacion |
|---------|--------|---------------|
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | Actualizar assertion linea 226: `type: 'invalid_input'` → `type: 'flagged'` | Test "rejects empty storagePath and logs abuse" verifica el shape del `logAbuse` call; al cambiar el literal en el codigo, el test debe reflejar el nuevo literal. **El test linea 185 (`type: 'rate_limit'`) NO se toca** — corresponde al callsite linea 58 que no cambia. |

### Archivos sin cambios (verificados)

| Archivo | Por que |
|---------|---------|
| `functions/src/__tests__/utils/abuseLogger.test.ts` | El union `AbuseType` no cambia. `SEVERITY_MAP` no cambia. Si existieran tests usando string crudo `'invalid_input'` deberian estar tageados TS-incompatibles — pero al ser inputs invalidos TS los rechazaria. Verificar pasa sin modificar. |
| `functions/src/__tests__/admin/claims.test.ts` | `getFirestore()` y `getDb()` devuelven el mismo singleton en runtime (ambos resuelven al `admin.firestore()`). Los mocks de tests usan `vi.mock('firebase-admin/firestore')` con stubs para `getFirestore` — al cambiar a `getDb()`, **debe verificarse que el mock del helper `getDb` en `helpers/env` este disponible o agregarse**. |
| `functions/src/__tests__/admin/moderation.test.ts` (si existe) | Los tipos `ModerationAction`/`ModerationTargetCollection` cambian de ubicacion (import roto → inline). El consumer test no importa esos tipos (los usa via mock del callable); pasa sin cambios. |
| `src/services/abuseLogs.ts` | Cambio es solo JSDoc, no logica runtime |

### Tests manuales requeridos

| Verificacion | Comando | Resultado esperado |
|--------------|---------|--------------------|
| Build de functions limpio | `cd functions && npm run build` | exit 0, sin errors TS en `moderation.ts`, `menuPhotos.ts`, `claims.ts` |
| Test suite de functions | `cd functions && npm run test:run` | Todo verde post-fix |
| Test suite de menuPhotos (per Sofia) | `cd functions && npm run test:run -- menuPhotos` | Verde tras el update del assertion linea 226 |
| Pre-staging check completo | `bash scripts/pre-staging-check.sh` | Checks 1, 3, 6 en PASS |
| Smoke test lookback=5 (per Sofia) | Crear fixture `__tmp_marker_5.ts` con marker 5 lineas arriba del `getDocs(...)` raw + fixture `__tmp_marker_6.ts` con marker 6 lineas arriba; correr `bash scripts/pre-staging-check.sh` apuntado a la fixture. Borrar fixtures al terminar. | `__tmp_marker_5.ts` PASS, `__tmp_marker_6.ts` FAIL |
| Suite frontend | `npm run test:run` desde root | Todo verde (cambio solo en JSDoc, no logica) |

### Smoke test detallado (lookback=5)

El smoke test es manual, ejecutado por el implementador. Procedimiento:

1. Crear `src/services/__tmp_perf_smoke_5.ts`:
   ```ts
   import { getDocs, query, collection } from 'firebase/firestore';
   import { db } from '../config/firebase';
   import { measureAsync } from '../utils/perfMetrics';

   export async function smokeFive() {
     return measureAsync('smoke_five', async () => {
       // perf-instrument-ok
       // line 2
       // line 3
       // line 4
       // line 5
       return getDocs(query(collection(db, 'users')));
     });
   }
   ```
   Marker a 5 lineas arriba del `getDocs(...)`. Correr `bash scripts/pre-staging-check.sh` — debe reportar check 6 PASS para esta fixture.

2. Crear `src/services/__tmp_perf_smoke_6.ts` (igual pero con 6 lineas de gap):
   ```ts
   // ...mismo encabezado
   export async function smokeSix() {
     return measureAsync('smoke_six', async () => {
       // perf-instrument-ok
       // line 2
       // line 3
       // line 4
       // line 5
       // line 6
       return getDocs(query(collection(db, 'users')));
     });
   }
   ```
   Marker a 6 lineas arriba. Correr `bash scripts/pre-staging-check.sh` — debe reportar check 6 FAIL para esta fixture (cota superior verificada).

3. Borrar ambas fixtures (`rm src/services/__tmp_perf_smoke_*.ts`). NO commitearlas.

## Analytics

N/A — no se agrega ningun `trackEvent`. Lo unico relacionado a telemetria es la nota en el JSDoc de `abuseLogs.ts` que documenta que si en el futuro se desea medir time-to-first-snapshot, debe usarse `trackEvent` con timer manual (fuera de scope).

---

## Offline

N/A — feature 100% build/CI/types.

### Cache strategy
N/A

### Writes offline
N/A

### Fallback UI
N/A

---

## Accesibilidad y UI mobile

N/A — sin UI.

### Reglas
N/A

## Textos y copy

N/A — sin texto user-facing.

### Reglas de copy
N/A

---

## Decisiones tecnicas

### D1 — `'invalid_input'` mapea a `'flagged'` (Opcion b)

**Alternativa rechazada (Opcion a):** extender el union `AbuseType` con `'invalid_input'`.

**Por que rechazada:** requiere tocar 5 callsites del union (`abuseLogger.ts:6` + `:12-21` exhaustive `SEVERITY_MAP`, `src/types/admin.ts:58` duplicado frontend, `src/constants/admin.ts:39+50` labels/colors, `src/components/admin/alerts/alertsHelpers.ts:39` `ALL_TYPES`). Aumenta superficie sin valor agregado: `'flagged'` ya tiene la semantica de "contenido sospechoso" que cubre los tres casos (path traversal, mismatch userId, mismatch businessId), y el `detail` string preserva la diferencia operativa que el operador necesita en el dashboard.

**Por que Opcion b:** cero cambios al union, cero cambios al frontend, trazabilidad operativa preservada en `detail`.

### D2 — Tipos `Moderation*` inline en `moderation.ts` (no crear `shared/types/admin.ts`)

**Alternativa rechazada:** crear `functions/src/shared/types/admin.ts` con los tipos y dejar el import.

**Por que rechazada:** principio "no premature abstraction" — los dos tipos tienen un solo callsite (este archivo). El frontend ya tiene su propia copia en `src/types/admin.ts` (duplicacion deliberada por boundary client/server). Crear el archivo "porque queda lindo importar" introduce un archivo adicional sin reduccion de duplicacion (el frontend seguiria definiendo los tipos por su lado).

**Por que inline:** un solo callsite, mismo archivo, cero archivos nuevos.

### D3 — `abuseLogs.ts` solo JSDoc, sin marker

**Alternativa rechazada:** agregar `// perf-instrument-ok` al `onSnapshot(...)` para "sellar" que fue revisado.

**Por que rechazada:** el marker tiene semantica especifica documentada en `patterns.md` (suprime el flag del check 6 para reads raw envueltos en Promise.all medidos). El check 6 ni siquiera flagea `onSnapshot` — el marker ahi seria ruido semantico, y un proximo lector podria asumir que el marker certifica "perf revisado" generico cuando en realidad es un sello especifico para una situacion concreta. Mantener el contrato del marker estricto.

**Por que JSDoc:** documenta la decision en el unico lugar donde un lector futuro la va a leer (la funcion misma), sin contaminar el contrato del marker.

### D4 — Lookback=5 (Opcion A), no marker same-line obligatorio (Opcion B)

**Alternativa rechazada (Opcion B):** forzar marker same-line, migrar los existentes.

**Por que rechazada:** los markers ya colocados en el merge de #325 mezclan same-line y 1-2-line-arriba. Migrar los `~2 a 5` markers existentes a same-line es ruido sin valor — el problema real no es la posicion del marker sino la cota de lookback frente a futuros Promise.all con 3-4 reads.

**Por que lookback=5:** backward-compat, cierra el footgun sin migracion, y la cota superior 5 es generosa (un Promise.all con 5+ reads ya deberia refactorizarse de todas formas).

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna — no cambian las rules.

### Rate limiting

Sin cambios — los rate limits existentes (`menuPhotos`: 10/dia, `moderate_{adminId}`: 10/min via `checkCallableRateLimit`) se mantienen identicos.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Path traversal en `storagePath` (preexistente) | `STORAGE_PATH_REGEX` + check pathSegments — cambio de literal `'flagged'` no afecta defensa | `functions/src/triggers/menuPhotos.ts:11,27` |
| Mismatch userId/businessId en storagePath (preexistente) | Validacion de segmentos — sin cambio | `functions/src/triggers/menuPhotos.ts:35,42` |
| Admin claim sin auth (preexistente) | `assertAdmin()` en `removeAdminClaim`, gate email+bootstrap-flag en `setAdminClaim` — `getDb()` no cambia gate | `functions/src/admin/claims.ts:30-55,108` |
| Marker silenciosamente invalido en PR futuro de perf | Lookback ampliado a 5 lineas, documentado en `patterns.md` | `scripts/pre-staging-check.sh:111`, `docs/reference/patterns.md:154` |

---

## Deuda tecnica: mitigacion incorporada

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| Check 3 del pre-staging script (output ruidoso por `getFirestore()` raw en `claims.ts`) | S1.3 migra a `getDb()` | Fase 1, paso 3 |
| Build `functions/ tsc --noEmit` con 4 errors preexistentes | S1.1+S1.2+S1.3 dejan tsc limpio | Fase 1, pasos 1-3 |
| Lookback=2 frágil en check 6 | S2 lo amplia a 5 | Fase 2, paso 1 |
| `abuseLogs.ts` ambiguo respecto a `measureAsync` (potencial reapertura en auditoria futura) | S3 lo documenta con JSDoc | Fase 3, paso 1 |
| Check 1 degradado a WARN para functions (tolerancia historica) | Evaluar promocion a FAIL en plan (sub-item opcional) | Fase 4 (opcional), paso 1 |

### Issue check 1 WARN→FAIL (decision diferida del PRD)

El PRD documento que post-fix se podria promocionar el check 1 del pre-staging script de WARN a FAIL para `functions/`. Esto convierte regresiones futuras de tipos en bloqueante inmediato. La decision se toma en el plan como **sub-item opcional** (Fase 4): si tsc queda 100% limpio post-S1, agregamos un paso de promocion; si por algun edge case queda algun warning residual, se deja como tech debt aparte. Ver Fase 4 del plan.

---

## Validacion Tecnica

**Validado por:** Diego (Solution Architect) — Ciclo 1 (sin hallazgos BLOQUEANTES)
**Fecha:** 2026-05-16
**Estado:** VALIDADO CON OBSERVACIONES

PRD con sello Sofia (VALIDADO CON OBSERVACIONES, Ciclo 2). Specs verificado contra disco: union `AbuseType` en `functions/src/utils/abuseLogger.ts:6`, los tres callsites `'invalid_input'` en `functions/src/triggers/menuPhotos.ts:29/37/44`, el cuarto callsite `'rate_limit'` en linea 60, import roto `'../shared/types/admin'` en `functions/src/admin/moderation.ts:6`, ausencia de `functions/src/shared/types/` (solo existe `userOwnedCollections.ts`), `getFirestore()` raw en `claims.ts:42,70`, helper `getDb()` en `functions/src/helpers/env.ts:36`, loop `for back in 1 2` en `scripts/pre-staging-check.sh:111`, test assertion `type: 'invalid_input'` en `functions/src/__tests__/triggers/menuPhotos.test.ts:226`, y test assertion `type: 'rate_limit'` linea 185 (que NO se toca). Todas las afirmaciones del specs coinciden con el estado de disco.

### Cerrado en esta iteracion
- Sin hallazgos BLOQUEANTES. El specs cubre todos los items del PRD (S1.1/S1.2/S1.3/S2/S3) con paso concreto, decisiones tecnicas justificadas (D1-D4), y test plan acorde a la politica del proyecto (no se introducen tests nuevos porque no hay logica nueva; solo se actualiza un assertion).

### Observaciones para implementacion (no bloquean)

- **OBSERVACION #1 — Paso explicito de actualizar `docs/reference/patterns.md:154`.** El PRD lista en Success Criteria #3 y en "Checklist de documentacion" que `patterns.md` debe quedar actualizado para reflejar lookback=5. El specs lo menciona dos veces como archivo target (D4 y tabla "Vectores de ataque") pero no tiene un paso propio que describa el cambio textual exacto ("hasta 2 lineas arriba" → "hasta 5 lineas arriba" en la celda del marker, linea 154). Sugerencia para el plan: agregar un sub-paso de Fase 2 que edite ese string puntual. Sin esto, la suite cumple los gates pero queda inconsistencia entre script (lookback=5) y doc canonica (lookback=2).

- **OBSERVACION #2 — Accion concreta sobre el mock `helpers/env` en `claims.test.ts`.** El specs flaggea correctamente que `claims.test.ts:76-79` mockea `helpers/env` exportando solo `IS_EMULATOR` y `ENFORCE_APP_CHECK_ADMIN`, sin `getDb`. Tras la migracion `getFirestore()` → `getDb()`, el `import { getDb } from '../helpers/env'` en `claims.ts` resolvera al mock sin `getDb` definido, lo cual hara que `getDb()` retorne `undefined` en runtime de test. El specs dice "debe verificarse que el mock del helper `getDb` en `helpers/env` este disponible o agregarse" — la accion concreta es **agregar `getDb: () => mockDb` al mock de `helpers/env`**, donde `mockDb` ya esta declarado en `firebase-admin/firestore` mock (linea 60-75). El implementador necesita esto explicito para no asumir que basta con cambiar el archivo de produccion. Sugerencia para el plan: marcar como sub-paso de Fase 1.3.

### Observaciones tecnicas para el plan

- Las dos OBS de arriba son trabajo de plan (orden de pasos, scope de cambios por fase). Pablo deberia confirmar que el plan incluye (a) edicion de `patterns.md:154`, y (b) update del mock `helpers/env` en `claims.test.ts` ANTES de correr `cd functions && npm run test:run` post-fix.
- Cobertura testing del proyecto sigue la politica de `docs/reference/tests.md` (>=80% branches sobre codigo nuevo). Como aqui no hay codigo nuevo (solo repair de tipos, cambio de literal, y JSDoc), no aplica delta de cobertura; el gate es "tests existentes siguen verdes".
- El smoke test del lookback=5 (S2) usa fixtures en `src/services/__tmp_perf_smoke_*.ts` — verificado que ese directorio es exactamente el que escanea check 6. Recordar al implementador borrar las fixtures antes del commit (el specs ya lo dice, pero conviene reforzar en el plan).

### Listo para pasar a plan?

Si, con observaciones. Las dos OBS son refinamientos del plan, no del specs — el specs ya tiene todo el contenido tecnico necesario para implementar correctamente, y Pablo puede absorber las OBS al armar el plan sin requerir Ciclo 2 de Diego.
