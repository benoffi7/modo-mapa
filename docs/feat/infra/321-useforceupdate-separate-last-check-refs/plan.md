# Plan: Separate `lastCheckTs` refs per event type in `useForceUpdate`

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Fases de implementacion

### Fase 1: Split de refs en el hook

**Branch:** `feat/321-useforceupdate-separate-refs`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useForceUpdate.ts` | Reemplazar `const lastCheckTs = useRef<number>(0);` (linea 130) por `const lastVisibilityTs = useRef<number>(0);` + `const lastOnlineTs = useRef<number>(0);`. |
| 2 | `src/hooks/useForceUpdate.ts` | Actualizar `handleVisibilityChange` (linea 165-170): consultar/actualizar `lastVisibilityTs.current` en vez de `lastCheckTs.current`. No tocar el guard `visibilityState !== 'visible'` ni la llamada `void run()`. |
| 3 | `src/hooks/useForceUpdate.ts` | Actualizar `handleOnline` (linea 172-176): consultar/actualizar `lastOnlineTs.current` en vez de `lastCheckTs.current`. |

### Fase 2: Actualizar tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/hooks/useForceUpdate.test.ts` | En `describe('debounce guard', ...)` — actualizar el test `visibilitychange hidden no consume el debounce` (lineas ~728-756) para verificar tambien que un `online` intercalado NO consume el debounce de `visibilitychange`. Estructura: dispatch `online` (consume `lastOnlineTs`), inmediatamente dispatch `visibilitychange → visible` dentro de 5s → debe pasar (porque `lastVisibilityTs` sigue en 0). |
| 5 | `src/hooks/useForceUpdate.test.ts` | Agregar test nuevo en `describe('debounce guard', ...)`: `visible y online dentro de 5s AMBOS llaman fetchAppVersionConfig (cross-event independence)`. Estructura exacta en specs.md seccion "Tests a agregar". El fetch debe resolver inmediato (no queda en vuelo) para aislar cross-event debounce del guard de concurrencia. |
| 6 | `src/hooks/useForceUpdate.test.ts` | Agregar test nuevo (simetria): `segundo visibilitychange dentro de 5s no llama fetchAppVersionConfig (intra-event dedup)`. Estructura simetrica al test existente `segundo evento online dentro de 5s...` pero usando `visibilitychange` + `visibilityState: 'visible'`. |
| 7 | `src/hooks/useForceUpdate.test.ts` | VERIFICAR SIN MODIFICAR: el test `segunda invocacion simultanea no llama fetchAppVersionConfig dos veces` (lineas 590-614) sigue presente y sin cambios. Es complementario al test nuevo (cubre fetch EN VUELO, mientras el nuevo cubre fetch RESUELTO). |
| 8 | `src/hooks/useForceUpdate.test.ts` | VERIFICAR SIN MODIFICAR: los tests `segundo evento online dentro de 5s no llama fetchAppVersionConfig` (lineas ~671-698), `evento online despues de 5s SI llama fetchAppVersionConfig` (lineas ~700-726) y `mount y setInterval no son afectados por debounce` (lineas ~758-779) siguen pasando sin cambios. |

### Fase 3: Verificacion local

| Paso | Comando | Cambio |
|------|---------|--------|
| 9 | `npm run test -- useForceUpdate` | Toda la suite del hook pasa (incluye el test de concurrencia existente + tests nuevos). |
| 10 | `npm run lint` | Sin errores nuevos. |
| 11 | `npm run typecheck` | Sin errores TS. |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `docs/reference/patterns.md` | Seccion "Stable event listeners via refs" (L79). Reemplazar la frase "`useForceUpdate` también usa este patrón: `checkingRef` (concurrency guard booleano) y `lastCheckTs` (`useRef<number>`) para debounce de 5s via timestamp en los handlers de `visibilitychange` y `online`." por una version que refleje el split: "`useForceUpdate` también usa este patrón: `checkingRef` (concurrency guard booleano) y **una ref por tipo de evento** — `lastVisibilityTs` y `lastOnlineTs` (`useRef<number>`) — para debounce independiente de 5s via timestamp en los handlers de `visibilitychange` y `online`. Un evento de un tipo no consume el debounce del otro." |
| 13 | `docs/_sidebar.md` | Agregar entradas Specs + Plan bajo la entrada existente `#321 useForceUpdate — Separate lastCheckTs per event` (linea 157). Formato: `    - [Specs](/feat/infra/321-useforceupdate-separate-last-check-refs/specs.md)` + `    - [Plan](/feat/infra/321-useforceupdate-separate-last-check-refs/plan.md)`. |

No se tocan:

- `docs/reference/features.md` — comportamiento user-facing no cambia.
- `docs/reference/firestore.md` — no hay cambios de dominio.
- `docs/reference/security.md` — no hay cambios de rules/rate limits.
- `docs/reference/project-reference.md` — el cambio es XS, no requiere bump de resumen.
- `src/components/menu/HelpSection.tsx` — no hay cambios visibles al usuario.

---

## Orden de implementacion

1. Paso 1-3 (Fase 1) — modificar `useForceUpdate.ts`. Los tres pasos deben commitearse juntos (cambio atomico que mantiene la suite verde sin el test nuevo, porque los tests existentes no distinguen entre refs compartidos o separados).
2. Paso 4 (Fase 2) — actualizar el test `visibilitychange hidden no consume el debounce` para reflejar cross-event.
3. Paso 5 (Fase 2) — agregar el test nuevo de regresion del bug.
4. Paso 6 (Fase 2) — agregar el test simetrico para `visibilitychange` intra-event.
5. Paso 7-8 (Fase 2) — verificacion manual de que tests existentes NO fueron tocados (lectura + grep).
6. Paso 9-11 (Fase 3) — correr tests + lint + typecheck.
7. Paso 12-13 (Fase 4) — actualizar docs.

Dependencia cruzada: los pasos 1-3 deben ir antes que los tests nuevos (pasos 5-6), porque los tests assertan el comportamiento post-split.

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Delta estimado | Lineas finales |
|---------|-----------------|----------------|----------------|
| `src/hooks/useForceUpdate.ts` | 192 | +1 (una ref extra) | ~193 |
| `src/hooks/useForceUpdate.test.ts` | 807 | +60-80 (2 tests nuevos + edits al existente) | ~870-890 |
| `docs/reference/patterns.md` | ~700 (seccion L79 actualizada) | +0 a +1 | igual |

Ningun archivo supera 400 lineas de codigo fuente. El test file ya es largo pero es el archivo de tests del hook (espera que crezca con cada feature). No se decomponen.

## Riesgos

1. **Riesgo:** Implementador borra el test `useForceUpdate.test.ts:590-614` creyendo que contradice el test nuevo.
   **Mitigacion:** paso 7 del plan es una verificacion explicita (lectura del archivo + grep) de que ese test sigue presente. La seccion "Tests a preservar sin cambios" del specs lo documenta. Success Criteria #4 del PRD lo requiere.
2. **Riesgo:** El test nuevo `visible y online dentro de 5s AMBOS llaman fetchAppVersionConfig` puede ser flaky si el mock de `fetchAppVersionConfig` no drena antes del segundo evento.
   **Mitigacion:** el mock se configura con `mockResolvedValue` (resuelve inmediato). Los `await act(async () => { await Promise.resolve(); })` drenan microtasks entre eventos. Patron ya probado en el archivo (ej. `finally libera el flag en path error`).
3. **Riesgo:** Instrumentacion de `measureAsync` (agregada en #315) reporta mas samples tras el fix, generando ruido en telemetria.
   **Mitigacion:** es comportamiento esperado (ver PRD "Issues relacionados"). No se requiere accion.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — solo se toca un hook existente que ya delega en `services/config.ts`.
- [x] Archivo nuevo: NO se crean archivos nuevos.
- [x] Logica de negocio: el debounce sigue dentro del hook (no hay que extraer util). No hay logica que migrar a service/context.
- [x] No se agrega deuda — se reduce deuda (split hace la intencion explicita).
- [x] `src/hooks/useForceUpdate.ts` queda en ~193 lineas (muy por debajo de 400).

## Guardrails de seguridad

- [x] No se tocan rules — no aplica `hasOnly()`.
- [x] No se agregan campos — no aplica `affectedKeys()`.
- [x] No se tocan admin writes.
- [x] No hay counter decrements.
- [x] No se agregan rate limits.
- [x] No se agregan triggers ni collections writable.
- [x] No se introducen secrets.
- [x] No se introducen `getCountFromServer`.

## Guardrails de observabilidad

- [x] CF triggers: no se tocan.
- [x] Services: no se tocan. `measureAsync` en `fetchAppVersionConfig` (ya presente desde #315) sigue.
- [x] `trackEvent`: no se agregan eventos nuevos.
- [x] `logger.error`: no se agrega. El hook sigue usando `logger.log`/`logger.warn`.

## Guardrails de accesibilidad y UI

- [x] No se agregan controles — no aplica aria-label.
- [x] No se agregan `Typography onClick`, `Box onClick`, etc.
- [x] No se agregan touch targets.
- [x] No se agregan estados de fetch visibles.
- [x] No se agregan `<img>`.
- [x] No se agregan `httpsCallable`.

## Guardrails de copy

- [x] No hay textos user-facing nuevos — no aplica voseo/tildes.
- [x] No hay terminologia que revisar.
- [x] No hay strings reutilizables nuevos.

## Fase final: Documentacion (OBLIGATORIA)

Ya incluida como Fase 4 arriba. Resumen:

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `docs/reference/patterns.md` | Actualizar descripcion de `useForceUpdate` en seccion "Stable event listeners via refs" (L79) para reflejar `lastVisibilityTs` + `lastOnlineTs`. |
| 13 | `docs/_sidebar.md` | Agregar entradas Specs + Plan. |

Archivos que NO requieren update (justificado en specs seccion "Documentacion" y PRD checklist):

- `docs/reference/security.md` — sin cambios de rules/auth/rate limits.
- `docs/reference/firestore.md` — sin cambios de colecciones/campos.
- `docs/reference/features.md` — comportamiento user-facing no cambia.
- `docs/reference/project-reference.md` — cambio XS no requiere bump.
- `src/components/menu/HelpSection.tsx` — no hay cambios visibles al usuario.

## Criterios de done

- [ ] `lastCheckTs` reemplazado por `lastVisibilityTs` + `lastOnlineTs` en `useForceUpdate.ts`.
- [ ] `handleVisibilityChange` consulta/actualiza solo `lastVisibilityTs`.
- [ ] `handleOnline` consulta/actualiza solo `lastOnlineTs`.
- [ ] Test nuevo `visible y online dentro de 5s AMBOS llaman fetchAppVersionConfig` agregado y verde.
- [ ] Test simetrico `segundo visibilitychange dentro de 5s no llama fetchAppVersionConfig` agregado y verde.
- [ ] Test existente `segunda invocacion simultanea no llama fetchAppVersionConfig dos veces` (lineas 590-614) sigue presente y verde.
- [ ] Test actualizado `visibilitychange hidden no consume el debounce` verifica tambien cross-event independence.
- [ ] Resto de la suite `useForceUpdate.test.ts` sigue verde.
- [ ] `npm run lint` sin errores.
- [ ] `npm run typecheck` sin errores.
- [ ] Build `npm run build` succeeds (pre-push hook).
- [ ] Cobertura >= 80% en codigo modificado (ya al 100% en paths de debounce/concurrency — se mantiene).
- [ ] `docs/reference/patterns.md` actualizado (L79 refleja `lastVisibilityTs` + `lastOnlineTs`).
- [ ] `docs/_sidebar.md` con entradas Specs + Plan.
- [ ] Success Criteria #1-#5 del PRD cumplidos.

---

## Validacion de Plan


**Delivery Lead**: Pablo
**Fecha**: 2026-04-23
**Estado**: VALIDADO CON OBSERVACIONES (Ciclo 1)

### Nota de contexto

Diego corre en paralelo sobre specs; plan validado asumiendo que no habra cambios estructurales en specs. Si Diego devuelve cambios significativos (naming, ordenamiento, API del hook), este veredicto se reabre.

### Cerrado en esta iteracion

Sin BLOQUEANTES ni IMPORTANTES. El plan pasa checklist de delivery sin hallazgos que bloqueen implementacion:

- Specs -> plan: todo item del specs mapeado a paso. Tests preservation (paso 7), tests nuevos (5, 6), test actualizado (4) cubiertos.
- Orden logico: fase 1 (codigo) antes de fase 2 (tests que assertan post-split) antes de fase 3 (verificacion) antes de fase 4 (docs). Dependencia cruzada explicita (linea 65).
- Granularidad: pasos 1-3 commit atomico declarado explicito en "Orden de implementacion".
- Ownership: implementacion directa, sin paralelo. Sin overlap de archivos.
- Test plan integrado: tests viven en fase 2 inmediatamente despues del cambio de codigo, no en paso final "agregar tests".
- Risk staging: cambio reversible puro (revert del commit unico). Sin rules/migrations/destructivos.
- Estimacion: XS, consistente con PRD.
- Documentacion agendada: paso 12 (patterns.md L79) + paso 13 (_sidebar.md) con justificacion explicita de archivos NO tocados.
- Preservation test `useForceUpdate.test.ts:590-614`: reforzada en paso 7 + riesgo #1 + Success Criteria #4 del PRD. Ningun implementador puede borrarla por descuido.

### Observaciones para la implementacion

- **OBSERVACION #1 (paso 13 redundante)**: `docs/_sidebar.md` lineas 162-163 ya contienen las entradas Specs + Plan del issue #321 (agregadas en commits previos del batch #312-#318). El implementador debe verificar presencia antes de editar; si ya estan, marcar done sin cambios.

- **OBSERVACION #2 (comentario desactualizado)**: `useForceUpdate.test.ts:682` contiene comentario inline `// Primer evento online - pasa el debounce (lastCheckTs=0, Date.now()-0 >> 5000)` dentro del test que el paso 8 marca "VERIFICAR SIN MODIFICAR". Post-split ese simbolo no existe. Opcional actualizar a `lastOnlineTs=0` (comment-only, no cambia el test). Si se deja, Thanos puede flaggear como docstale menor. Decision del implementador.

- **OBSERVACION #3 (merge strategy no explicito)**: el plan declara branch (`feat/321-useforceupdate-separate-refs`) pero no si se mergea standalone o agrupado con otros issues abiertos. Default razonable: un solo PR standalone a `new-home` via skill `/merge`. Si manu decide agrupar, re-coordinar.

### Listo para pasar a implementacion?

Si, con las 3 observaciones anotadas. Ninguna bloquea. Validacion queda sujeta a que Diego no introduzca cambios estructurales en specs; si los hay, reabrir.
