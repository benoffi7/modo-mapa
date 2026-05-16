# PRD: Tech debt #325 followups — TS errors preexistentes + marker lookback + abuseLogs

**Feature:** 337-techdebt-325-followups-ts-errors-marker-abuselogs
**Categoria:** infra
**Fecha:** 2026-05-16
**Issue:** #337
**Prioridad:** Media

---

## Contexto

Durante la implementacion de #325 (perf-instrumentation-coverage, cerrado en v2.47.0) la auditoria de Thanos cerro el BLOCKER principal pero dejo tres hallazgos residuales (FYI) que el merge documento como followup. Este PRD agrupa los tres en un cleanup acotado para no contaminar futuras builds de `functions/` ni dejar un footgun semantico en el check 6 de `scripts/pre-staging-check.sh`.

## Problema

- La build de Cloud Functions tira **4 errores TypeScript reales** (verificados con `npx tsc --noEmit`): `functions/src/admin/moderation.ts:6` importa `'../shared/types/admin'` (modulo inexistente), `functions/src/triggers/menuPhotos.ts:29/37/44` pasa `'invalid_input'` a `logAbuse` cuando ese literal no esta en el union `AbuseType`, y `functions/src/admin/claims.ts:42,70` usa `getFirestore()` raw en vez de `getDb()` (tambien flageado por check 3 del pre-staging script).
- El detector del marker `// perf-instrument-ok` en `scripts/pre-staging-check.sh` check 6 hace lookback de solo 2 lineas (loop `for back in 1 2`). Si en el futuro alguien introduce un `Promise.all([...])` ya envuelto por `measureAsync` pero con mas de 2 lineas entre el marker y el `getDocs(...)` raw, el check **acepta el codigo sin warning** — el marker se considera ausente. No es un bug actual (no hay regresion), pero es un footgun semantico para PRs futuros.
- `src/services/abuseLogs.ts` quedo fuera del scope de #325 porque solo usa `onSnapshot` (no `getDoc`/`getDocs`). El patron `measureAsync` no aplica directamente — no hay una promise que medir, es una subscription. El check 6 actual **solo flagea `getDoc`/`getDocs` raw**, no `onSnapshot`, asi que no hay accion pendiente en CI. Si en el futuro se quiere telemetria de tiempo-hasta-primer-snapshot o tamano del payload, requiere un patron distinto (probablemente `trackEvent`). Se documenta para que no se reabra en una proxima auditoria como "falta instrumentar".

## Solucion

### S1 — Reparar los 4 errores TS reales en functions/

Tres frentes independientes, ordenados por riesgo:

1. **`functions/src/admin/moderation.ts:6`** — el import `from '../shared/types/admin'` apunta a un path que no existe en disco (`functions/src/shared/` solo contiene `userOwnedCollections.ts`). Los tipos involucrados (`ModerationAction`, `ModerationTargetCollection`) tienen **un solo callsite** (este archivo). Decision: **definir ambos tipos inline en `moderation.ts`** (al tope del archivo, despues de los imports) y eliminar el import roto. Justificacion: principio "no premature abstraction" — solo crear `functions/src/shared/types/admin.ts` cuando haya 2+ callsites. Hoy no los hay.

2. **`functions/src/triggers/menuPhotos.ts:29/37/44`** — las tres llamadas a `logAbuse(...)` pasan `type: 'invalid_input'` que no esta en el union `AbuseType` (`'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood' | 'anon_flood' | 'ip_rate_limit' | 'config_edit' | 'deletion_failure'`). Decision: **Opcion (b) — mapear los tres callsites a `'flagged'`**, conservando el `detail` field con el contexto original (path-traversal, mismatch userId/businessId, storagePath invalido). Justificacion: los tres casos son manipulacion sospechosa de input que cabe semanticamente en `'flagged'` (que ya cubre "contenido sospechoso"). El `detail` string preserva la diferencia operativa sin requerir extender el union ni tocar los **5 callsites** que dependen de `AbuseType`: `functions/src/utils/abuseLogger.ts:6` (union) + `:12-21` (`SEVERITY_MAP` exhaustivo), `src/types/admin.ts:58` (union frontend duplicado), `src/constants/admin.ts:39+50` (`ABUSE_TYPE_LABELS`, `ABUSE_TYPE_COLORS`), `src/components/admin/alerts/alertsHelpers.ts:39` (`ALL_TYPES` para filtro dropdown). Cero superficie nueva.

3. **`functions/src/admin/claims.ts:42,70`** — reemplazar `getFirestore()` por `getDb()` (helper de `functions/src/helpers/env.ts`). Es el patron canonico del proyecto y elimina el blocker del check 3 de `scripts/pre-staging-check.sh`.

> Nota sobre el cuerpo del issue: el issue menciona `functions/src/admin/deleteUserData` con "referencias rotas". Ese archivo **no existe** en disco — solo existen `deleteUserAccount` (callable) y `deletionAuditLogs.ts` (admin). El `npx tsc --noEmit` no reporta ningun error en archivos con ese nombre. Se asume que el redactor del issue se confundio o ese fix ya entro implicitamente; este PRD lo deja **fuera de scope** (ver "Out of Scope").

### S2 — Hacer mas robusto el detector del marker `perf-instrument-ok`

Dos opciones, elegir una:

- **Opcion A (lookback ampliado):** bumpear el loop `for back in 1 2` a `for back in 1 2 3 4 5` (5 lineas). Cubre el caso de Promise.all con tres-cuatro reads. Es el cambio minimo y backward-compat (no rompe ningun marker existente).
- **Opcion B (marker explicito en linea):** documentar como politica que el marker DEBE ir en la misma linea del `getDocs(...)`/`getDoc(...)` raw (no en una linea de comentario arriba), y actualizar el detector para chequear solo same-line. Mas estricto pero rompe los markers existentes si los hay en linea-arriba — habria que migrarlos.

**Recomendacion:** **Opcion A** (lookback=5) porque es backward-compat con los markers ya escritos (el merge de #325 los puso en linea-misma y/o linea-arriba), y porque el coste de "false positive" (marker viejo se considera valido aunque este lejos) ya esta presente con lookback=2. Bumpear a 5 reduce la ventana de footgun a casi cero sin migracion. Documentar la convencion en `patterns.md`.

### S3 — Documentar la decision sobre `abuseLogs.ts`

`src/services/abuseLogs.ts` solo expone una funcion que devuelve `onSnapshot(...)` para el dashboard admin. No hay una promise async que envolver con `measureAsync`. El check 6 del pre-staging script **solo flagea `getDoc`/`getDocs` raw**, no `onSnapshot`, asi que no hay accion requerida por CI. La unica accion es documental:

- **JSDoc en la funcion** (preferido): agregar un bloque `/** ... */` arriba de la funcion exportada explicando que `onSnapshot` queda fuera de `measureAsync` por design (es subscription, no promise), y que si se quiere telemetria de tiempo-hasta-primer-snapshot se debe usar `trackEvent` con timer manual. NO agregar el marker `// perf-instrument-ok` — el marker tiene semantica especifica para el check 6 (suprimir flag de read raw envuelto), no es un sello generico de "instrumentacion revisada". Mezclar semanticas confunde al proximo lector y rompe el contrato del marker.
- **Telemetria custom (deferida):** si en el futuro se quiere medir time-to-first-snapshot, agregar `trackEvent('admin_abuse_subscribe', { ms })` envolviendo el `onSnapshot` con un timer manual. Fuera de scope de este PRD — se deja como entrada en `docs/reports/tech-debt.md` con prioridad baja.

### Consideraciones UX

Ninguna. Es 100% tech debt interno (build pipeline + script de CI + docs). No hay UI nueva, no hay strings user-facing, no hay flow de usuario.

### Consideraciones de seguridad

- **`getFirestore()` → `getDb()`** cierra el check 3 del pre-staging script. No es vulnerabilidad, pero `getDb()` aplica configuracion canonica (databaseId si difiere de `(default)`) — la inconsistencia es deuda potencial si en el futuro se introduce multi-database.
- **Mapeo de `'invalid_input'` a `'flagged'`** (Opcion b) preserva la trazabilidad operativa via el `detail` field. El dashboard admin (`AbuseAlerts`) ya maneja `'flagged'` con label, color y severity `'high'` — cero impacto downstream. La coleccion `abuseLogs` sigue siendo Functions-only para create (sin cambio en rules).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1.1 — Reparar `moderation.ts:6` (tipos `ModerationAction` y `ModerationTargetCollection` inline en el mismo archivo, eliminar import roto) | Alta | XS |
| S1.2 — Reparar `menuPhotos.ts:29/37/44` (mapear los 3 callsites a `type: 'flagged'`, preservar contexto en `detail`) | Alta | XS |
| S1.3 — Reparar `claims.ts:42,70` (migrar `getFirestore()` a `getDb()`) | Alta | XS |
| S2 — Bumpear lookback del marker check 6 a 5 lineas + doc en patterns.md | Media | XS |
| S3 — JSDoc en `abuseLogs.ts` explicando por que no usa `measureAsync` (sin marker) | Baja | XS |
| Tests — actualizar `abuseLogger.test.ts` solo si los cambios de tipos rompen tests existentes (no se agregan variantes nuevas) | Baja | XS |
| Verificar `cd functions && npm run build` pasa limpio post-fix (gate autoritativo) | Alta | XS |
| Verificar `bash scripts/pre-staging-check.sh` pasa limpio post-fix (checks 1, 3, 6) | Alta | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactor de `functions/src/admin/deleteUserData` — el archivo no existe en disco, no hay errors reales que reparar. Si el redactor del issue identifica un archivo concreto, abrir issue separado.
- Telemetria custom sobre `onSnapshot` en `abuseLogs.ts` (time-to-first-snapshot). Se deja como entrada futura en `docs/reports/tech-debt.md`.
- Migrar otros usos legitimos de `getFirestore()` (si los hubiera fuera de `claims.ts:42/70`). Si tsc o el check 3 detectan mas callsites, escalar a un issue separado de cleanup.
- Cambiar la politica de instrumentacion (`measureAsync` vs `measuredGetDoc`) — esta consolidada en #325 y no se toca aca.

---

## Tests

Politica del proyecto: >=80% cobertura del codigo nuevo. Este PRD es 100% repair (no logica nueva ni variantes nuevas de tipo) — no requiere tests nuevos. El gate de calidad es que tests existentes no se rompan y los builds queden limpios.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/abuseLogger.test.ts` | No requiere update | El union `AbuseType` no cambia (Opcion b mapea a `'flagged'` existente). Si tests existentes usan `'invalid_input'` como string crudo deberian fallar TS — pero al ser inputs literales ya invalidos, no hay tests asi. Verificar pasa sin cambios. |
| `functions/src/triggers/__tests__/menuPhotos.test.ts` | No crear | El trigger ya tiene cobertura indirecta via callsites de `logAbuse`. Cambio es solo del literal `type`. |
| `scripts/pre-staging-check.sh` | Manual | Smoke test del lookback ampliado: archivo de fixture con marker 4-5 lineas arriba del read raw debe pasar; archivo con marker a 6+ lineas debe fallar (cota superior verificada) |
| `src/services/abuseLogs.ts` | No requiere test nuevo | Cambio es solo JSDoc, no logica |
| `functions/src/admin/moderation.ts` | No requiere test nuevo | Cambio es solo definir tipos inline, no logica runtime |

### Criterios de testing

- Cobertura no decrece sobre `functions/` (delta es ~10 lineas de tipos + cambio de literales, no logica nueva)
- `cd functions && npm run build` debe terminar con exit 0 (gate autoritativo — incluye `tsc` via script `build` definido en `functions/package.json`)
- `bash scripts/pre-staging-check.sh` debe pasar checks 1, 3 y 6 verdes
- Tests existentes de `abuseLogger.test.ts` y `claims.test.ts` no deben romperse

---

## Seguridad

Esto es tech debt — no introduce nuevas superficies de ataque. Igualmente, checklist relevante:

- [ ] `claims.ts:42/70` post-fix sigue gateado por `assertAdmin()` (no regresion en auth)
- [ ] Mapear `'invalid_input'` a `'flagged'` no cambia el shape de los docs en `abuseLogs` — rules siguen siendo `Functions only` create + `admin` read
- [ ] El marker `// perf-instrument-ok` no es un vector de seguridad — es solo un comentario para el linter custom

### Vectores de ataque automatizado

N/A. No hay superficies nuevas. El cambio es interno al build pipeline y al type system.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #325 (cerrado) | origen de los followups | Este PRD cierra los 3 residuales FYI |
| #339 (abierto) | tech debt UI no relacionado | Sin interaccion |
| Check 3 de `scripts/pre-staging-check.sh` | bloqueado por `getFirestore()` raw en `claims.ts` | S1.3 lo desbloquea |
| Check 6 de `scripts/pre-staging-check.sh` | lookback frágil | S2 lo robustece |

### Mitigacion incorporada

- S1.3 desbloquea el **check 3** del pre-staging script para futuros PRs que toquen `functions/` (hoy genera ruido en el output).
- S1.1, S1.2, S1.3 dejan `functions/ npm run build` (tsc) limpio. Post-fix, en specs/plan se debera evaluar como sub-item opcional **subir el check 1 de `scripts/pre-staging-check.sh` de WARN a FAIL para `functions/`** (hoy esta degradado a WARN para tolerar estos errors preexistentes). Esto convierte regresiones futuras de tipos en bloqueantes inmediatos en lugar de ruido tolerado.
- S2 reduce el riesgo de "marker silenciosamente invalido" en PRs futuros de perf instrumentation.

---

## Robustez del codigo

Esto es repair, no codigo nuevo de hooks/componentes. La mayoria de items del checklist estandar no aplica. Igualmente:

### Checklist de hooks async

- N/A — no hay hooks nuevos

### Checklist de observabilidad

- [ ] El cambio en `abuseLogger` no rompe los samples existentes en `config/perfCounters`
- [ ] `trackFunctionTiming` en triggers existentes no se toca

### Checklist offline

- N/A — el feature no toca UI ni writes de usuario

### Checklist de documentacion

- [ ] `docs/reference/patterns.md` actualizado: agregar nota corta sobre lookback=5 en la celda del marker `perf-instrument-ok`
- [ ] `docs/reference/security.md` no requiere update — el cambio de tipos no afecta superficie de seguridad
- [ ] No se modifica `ABUSE_TYPE_LABELS` ni `ABUSE_TYPE_COLORS` (frontend) — `'flagged'` ya esta cubierto

---

## Offline

N/A — este PRD es 100% build pipeline + types + script de CI. No toca UI ni data flow del usuario.

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

N/A en el sentido habitual — no se agregan componentes. Pero el cambio:

- **Reduce ruido en build:** `functions/ tsc --noEmit` limpio = menos friccion en futuros worktrees que toquen functions.
- **Robustece un script compartido:** `scripts/pre-staging-check.sh` es leido por todos los gates de merge — mejorar su semantica beneficia a todos los workstreams.

### Checklist modularizacion

- [ ] No se agregan archivos nuevos. Los tipos `ModerationAction` y `ModerationTargetCollection` (S1.1) van inline en `functions/src/admin/moderation.ts` (single-callsite, no premature abstraction)
- [ ] `AbuseType` NO se modifica — Opcion (b) mapea los callsites a `'flagged'` existente
- [ ] `ABUSE_TYPE_LABELS` / `ABUSE_TYPE_COLORS` NO se modifican — `'flagged'` ya esta cubierto

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes |
| Estado global | = | No se toca contexto ni state |
| Firebase coupling | - | `claims.ts` pasa de `getFirestore()` raw a helper `getDb()` (menos acoplamiento directo) |
| Organizacion por dominio | = | Tipos S1.1 inline en su unico callsite — sin archivos nuevos |

---

## Accesibilidad y UI mobile

N/A — sin UI nueva.

---

## Success Criteria

1. `cd functions && npm run build` termina con exit code 0 y sin errores en `moderation.ts`, `menuPhotos.ts` ni `claims.ts`.
2. `bash scripts/pre-staging-check.sh` reporta checks 1, 3 y 6 como PASS sobre una branch limpia post-fix.
3. El detector del marker `perf-instrument-ok` en check 6 acepta markers ubicados hasta 5 lineas arriba del read raw, y este comportamiento esta documentado en `docs/reference/patterns.md`.
4. `src/services/abuseLogs.ts` tiene un bloque JSDoc explicativo de por que no usa `measureAsync` (es subscription, no promise) — sin marker `// perf-instrument-ok` (que tiene semantica especifica para reads raw).
5. Los tres callsites de `logAbuse` en `menuPhotos.ts` pasan `type: 'flagged'` (no `'invalid_input'`) y el contexto especifico se preserva en el `detail` string. El union `AbuseType` no se modifica.
6. La suite de tests existente (`npm run test:run` en root y en `functions/`) pasa sin regresion.

---

## Validacion Funcional

**Validado por:** Sofia (analista funcional) — Ciclo 2
**Fecha:** 2026-05-16
**Estado:** VALIDADO CON OBSERVACIONES

Todos los hallazgos del Ciclo 1 cerrados (5 IMPORTANTES + 3 OBS). Decisiones registradas: Opción (b) mapear a `'flagged'`, tipos inline en moderation.ts, abuseLogs.ts JSDoc-only sin marker, check 1 promotion diferido a specs/plan.

### Observaciones para implementación (no bloquean)

- Verificar en specs/plan si `menuPhotos.ts:58` (cuarto callsite de `logAbuse` no mencionado en PRD original) también requiere cambio. Sumar a S1.2 si aplica.
- Smoke test del lookback=5 (S2): fixtures temporales (marker a 5 líneas → PASS; marker a 6 líneas → FAIL).
- Correr `npm run test:run -- menuPhotos` post-fix para confirmar no hay assertion sobre literal `'invalid_input'`.

### Listo para specs-plan-writer

Sí.
