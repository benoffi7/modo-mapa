# Plan: Tech debt — FANOUT_MAX_RECIPIENTS_PER_ACTION naming y semantica del batch commit

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Fases de implementacion

### Fase 1: Clarificacion de constantes y JSDoc

**Branch:** `feat/320-fanout-constant-naming`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/constants/fanOut.ts` | Ampliar el JSDoc de `FANOUT_MAX_RECIPIENTS_PER_ACTION` (lineas 10-14 actuales) para dejar explicito: (a) que acota el `.limit()` de la query de followers, (b) que **NO** es el tamano del batch commit interno, (c) la relacion aritmetica `500 recipients × 2 writes por recipient = 1000 writes = exactamente 2 batches de BATCH_COMMIT_MAX_OPS`, (d) que es una cota conservadora heredada de #312 y que aumentarla requiere revisar el sistema de fan-out selectivo en vez de subir el numero. Referenciar `BATCH_COMMIT_MAX_OPS` por nombre (esta en otro archivo, pero ambos se leen juntos). NO cambiar el valor ni el nombre. |
| 2 | `functions/src/utils/fanOut.ts` | Agregar al inicio del archivo (despues de los imports y antes de `interface FanOutData`) la declaracion y export de `BATCH_COMMIT_MAX_OPS = 500` con JSDoc: `"Firestore batched write hard limit (500 ops per batch). Kept local to fanOut.ts — this is the SDK cap, not a product decision. Note: FANOUT_MAX_RECIPIENTS_PER_ACTION (500 recipients × 2 writes each = 1000 writes) translates to exactly 2 commits of BATCH_COMMIT_MAX_OPS writes."` |
| 3 | `functions/src/utils/fanOut.ts` | Reemplazar la linea `if (count >= 500) {` (linea 158 actual) por `if (count >= BATCH_COMMIT_MAX_OPS) {`. Actualizar el comentario de la linea 157 (`// Firestore batch hard cap is 500 writes; we write 2 per recipient`) a algo como `// Flush when we hit the SDK batch cap; 2 writes per recipient means ~250 recipients per commit`. No tocar ninguna otra linea del utility. |
| 4 | `docs/reference/patterns.md:110` | Reemplazar el fragmento "`Batch writes de 500.`" dentro de la fila "Fan-out writes pattern" por mencion explicita a **ambas** constantes: `"Writes agrupados en batches de \`BATCH_COMMIT_MAX_OPS\` (500 ops, limite duro del SDK Firestore). El cap de recipients \`FANOUT_MAX_RECIPIENTS_PER_ACTION\` (500) × 2 writes por recipient (dedup + feed item) = exactamente 2 batches por invocacion en el peor caso."` Mantener el resto de la fila intacto. |

### Fase 2: Verificacion y documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A (comando) | Correr la suite de tests de `functions/`: `cd functions && npm test`. Verificar que `fanOut.test.ts` y `fanOutBatch.test.ts` siguen verdes. |
| 2 | N/A (comando) | Correr el lint de functions: `cd functions && npm run lint`. |
| 3 | N/A (comando) | Verificar tipos: `cd functions && npm run build` (o equivalente `tsc`). |

---

## Orden de implementacion

1. Paso 1 (ampliar JSDoc en `constants/fanOut.ts`) — sin dependencias.
2. Paso 2 (declarar `BATCH_COMMIT_MAX_OPS` en `utils/fanOut.ts`) — la constante debe existir antes de ser usada.
3. Paso 3 (reemplazar literal en el `if`) — depende del paso 2 (la constante ya debe estar declarada).
4. Paso 4 (`patterns.md:110`) — se puede hacer en paralelo con los anteriores; depende solo del PRD para el copy.
5. Fase 2 (verificacion) — al final, tras commits de los pasos 1-4.

## Riesgos

1. **Riesgo: romper `fanOut.test.ts` por error de copy/paste en el reemplazo del literal.** Mitigacion: los tests existentes no comparan contra el literal `500` del batch commit (verificado en PRD Ciclo 1), por lo que un reemplazo correcto no deberia romperlos. Si rompen, revertir paso 3 y revisar.
2. **Riesgo: introducir inconsistencia de naming cross-module al dejar `BATCH_COMMIT_MAX_OPS` local.** Mitigacion: decision explicita documentada en PRD S2 y specs "Decisiones tecnicas". Los otros call-sites del repo con literal `500` se quedan como estan hasta que aparezca patron reutilizable.
3. **Riesgo: JSDoc de `patterns.md:110` queda fuera de sincronia si el codigo cambia en el futuro.** Mitigacion: el texto nuevo referencia los nombres de las constantes, no los valores, asi que resiste cambios de valor. Si algun dia se renombran, la guardia de documentacion en cada PRD detecta la necesidad de update.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — N/A (feature de backend).
- [x] Archivos tocados estan en las carpetas de dominio correctas: `functions/src/constants/` (constantes de dominio) y `functions/src/utils/` (utility). No se mueve nada.
- [x] Logica de negocio no cambia — el cambio es puramente de naming.
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — este plan **es** el fix de la deuda identificada en el merge de #312.
- [x] Ningun archivo resultante supera 400 lineas: `fanOut.ts` pasa de 170 a ~178 lineas (+~8 por la declaracion de `BATCH_COMMIT_MAX_OPS` con JSDoc); `constants/fanOut.ts` pasa de 21 a ~35 lineas (+~14 por el JSDoc ampliado).

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — N/A (no hay coleccion nueva).
- [x] Todo campo string tiene `.size() <= N` en rules — N/A.
- [x] Todo campo list tiene `.size() <= N` en rules — N/A.
- [x] Admin writes tambien tienen validacion de campos — N/A.
- [x] Counter decrements en triggers usan `Math.max(0, ...)` — N/A (no se tocan triggers).
- [x] Rate limits llaman `snap.ref.delete()` — N/A (no hay rate limit nuevo).
- [x] Toda coleccion nueva escribible por usuarios tiene trigger con rate limit — N/A.
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados — verificado: el cambio es solo codigo tecnico.
- [x] `getCountFromServer` → usar `getCountOfflineSafe` siempre — N/A (no se usa count queries).

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — N/A (no se agregan triggers). Los existentes `trackFunctionTiming('fanOutToFollowers')` y `trackFunctionTiming('fanOutDedupBatch')` se preservan sin cambios.
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — N/A.
- [x] Todo `trackEvent` nuevo esta registrado en `GA4_EVENT_NAMES` — N/A (no se agregan eventos).
- [x] Todo `trackEvent` nuevo tiene feature card en `ga4FeatureDefinitions.ts` — N/A.
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — N/A (no se agrega logging).

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — N/A (feature sin UI).
- [x] No hay `<Typography onClick>` — N/A.
- [x] Touch targets minimo 44x44px — N/A.
- [x] Componentes con fetch tienen error state con retry — N/A.
- [x] `<img>` con URL dinamica tienen `onError` fallback — N/A.
- [x] httpsCallable en componentes user-facing tienen guard offline — N/A.

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo — N/A (solo JSDoc tecnico en ingles).
- [x] Tildes correctas en todos los textos en espanol — N/A en JSDoc; verificar en `patterns.md:110` al cerrar el paso 4.
- [x] Terminologia consistente: "comercios" no "negocios" — N/A.
- [x] Strings reutilizables en `src/constants/messages/` — N/A.

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | No requiere cambio. El fan-out no cambia su superficie de seguridad; el guardrail `FANOUT_MAX_RECIPIENTS_PER_ACTION = 500` ya esta documentado. |
| 2 | `docs/reference/firestore.md` | No requiere cambio. No hay colecciones nuevas ni campos nuevos. |
| 3 | `docs/reference/features.md` | No requiere cambio. Feature no es user-facing. |
| 4 | `docs/reference/patterns.md` | **Ya incluido como paso 4 de Fase 1.** Linea 110 actualizada para referenciar ambas constantes. |
| 5 | `docs/reference/project-reference.md` | No requiere cambio (solo se actualiza en bumps de version, no por tech debt XS). |
| 6 | `src/components/menu/HelpSection.tsx` | No requiere cambio. No hay comportamiento user-visible que cambie. |

Unica entrada de documentacion viva es la actualizacion de `patterns.md:110`, ya planificada dentro de Fase 1. Se elimina deuda documental (no se acumula).

## Criterios de done

- [ ] Paso 1: JSDoc de `FANOUT_MAX_RECIPIENTS_PER_ACTION` ampliado con la explicacion completa (acota query de followers, no es el batch commit, relacion 500 × 2 = 2 batches).
- [ ] Paso 2: `BATCH_COMMIT_MAX_OPS = 500` declarado y exportado en `functions/src/utils/fanOut.ts` con JSDoc que explica "SDK batch cap, not a product decision".
- [ ] Paso 3: Literal `500` en `if (count >= 500)` reemplazado por `BATCH_COMMIT_MAX_OPS`. Comentario adyacente actualizado.
- [ ] Paso 4: `docs/reference/patterns.md:110` menciona ambas constantes y la relacion entre ellas.
- [ ] Suite de tests de `functions/` sigue verde (`fanOut.test.ts` + `fanOutBatch.test.ts` + resto).
- [ ] `npm run lint` en `functions/` sin errores.
- [ ] `tsc` en `functions/` sin errores.
- [ ] Build principal no se ve afectado (no se tocan archivos de `src/`).
- [ ] No se crea `functions/src/constants/firestore.ts` (fuera de scope).
- [ ] No se migran otros call-sites del repo con literal `500` en batch commits (fuera de scope).
- [ ] No se renombra `FANOUT_MAX_RECIPIENTS_PER_ACTION`.
- [ ] `docs/reference/patterns.md` unico doc de referencia actualizado; los otros no requieren cambio (verificado en Fase final).

---

## Validacion de Plan

**Delivery Lead**: Pablo
**Fecha**: {pendiente}
**Estado**: {pendiente}
**Delivery Lead**: Pablo
**Fecha**: 2026-04-23
**Estado**: VALIDADO CON OBSERVACIONES
**Ciclos**: 1

### Observaciones (no bloqueantes)

- **OBS #1 — Merge strategy implicito**: el plan no explicita si es un PR unico o varios. Para scope XS de 4 pasos en 3 archivos, un PR unico sobre `new-home` es lo razonable. Si el implementador decide dividir, documentar orden de merges.
- **OBS #2 — Branch base**: el plan nombra el branch (`feat/320-fanout-constant-naming`) pero no su base. Recordatorio: se parte de `new-home`, no de `main`.
- **OBS #3 — Wording del JSDoc actual a corregir**: el JSDoc actual en `constants/fanOut.ts:12` dice "500 = 250 recipients × 2 writes each... stays within one Firestore batch limit", que es inexacto (en realidad son 2 batches en el peor caso). El paso 1 debe corregir esa afirmacion, no solo ampliarla. El PRD y el plan ya piden la relacion correcta ("500 × 2 = 2 batches") — verificar que el nuevo JSDoc reemplace la afirmacion incorrecta y no la conserve.
- **OBS #4 — Pasos 2 y 3 tocan el mismo archivo**: si el implementador prefiere un unico commit atomico para ambos (declarar constante + usarla), es aceptable. El plan no lo prohibe.

### Verificaciones de terreno realizadas
- `functions/src/constants/fanOut.ts:15` — constante confirmada en esa linea.
- `functions/src/utils/fanOut.ts:157-158` — literal `500` y comentario adyacente confirmados.
- `docs/reference/patterns.md:110` — fragmento "Batch writes de 500" confirmado dentro de la fila "Fan-out writes pattern".
- Tests: unico match de `500` en la suite de `fanOut` es `fanOutBatch.test.ts:133` (nombre decorativo de `it(...)`, no assertion — la assertion usa `FANOUT_MAX_RECIPIENTS_PER_ACTION`). Confirmado: reemplazar el literal del batch commit no rompe ningun test.

### Listo para pasar a implementacion?
Si — con las observaciones arriba como notas para el implementador.
