# Plan: Tech Debt — fanOut N+1 Dedup Reads

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Fases de implementacion

### Fase 1: Refactor `fanOutToFollowers` + ajuste de constantes

**Branch:** `feat/312-fanout-n1-dedup-reads`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/constants/fanOut.ts` | Cambiar `FANOUT_MAX_RECIPIENTS_PER_ACTION` de 5000 a 500. Agregar `FANOUT_GETALL_CHUNK_SIZE = 30`. Actualizar JSDoc explicando la razon del valor 500 (cota conservadora hasta datos reales de uso). |
| 2 | `functions/src/utils/fanOut.ts` | Reemplazar el loop `await dedupRef.get()` individual por el algoritmo de batch dedup: (a) construir array de `{ followerId, dedupKey, dedupRef }`; (b) dividir en chunks de 30; (c) `Promise.all(chunks.map(c => db.getAll(...c)))`; (d) construir `Map<string, DocumentSnapshot>` con los resultados; (e) loop de escritura consulta el Map local. Envolver el `Promise.all` en try/catch que propague el error (no silenciar). Agregar `trackFunctionTiming('fanOutDedupBatch', batchStartMs)` inmediatamente despues del `Promise.all` (S3). Mantener intactos todos los paths de `trackFunctionTiming('fanOutToFollowers', startMs)` existentes. |

### Fase 2: Actualizar tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `functions/src/__tests__/utils/fanOut.test.ts` | Agregar `getAll` al mock `buildDb`: recibe `...refs`, los resuelve contra `state.dedup` usando `ref._dedupKey`. Actualizar `dedupCollection.doc` para incluir `_dedupKey: id` en el objeto retornado. Agregar spy `db.getAll` al state para verificar cantidad de llamadas. |
| 4 | `functions/src/__tests__/utils/fanOut.test.ts` | Agregar los nuevos casos de test: chunking con 1 follower, 31 followers sin dedup, 31 followers con 30 dedup frescos, dedup expirado, early returns no llaman `getAll`, cap de 500 recipients, batch multi-commit con >250 recipients, `trackFunctionTiming` llamado exactamente 1 vez por path. |
| 5 | `functions/src/__tests__/utils/fanOut.test.ts` | Agregar verificacion de que `dedupCollection.doc().get` (read individual) no recibe llamadas en el path normal post-refactor. Esto asegura que el refactor no regresa a N+1 en futuros cambios. |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `docs/reference/patterns.md` | Actualizar la descripcion del patron **Fan-out writes pattern** en la tabla de "Follows y activity feed" para mencionar el batch dedup con `db.getAll()` en chunks de 30, el `Promise.all` entre chunks, y el Map local para lookup durante el loop de escritura. |

---

## Orden de implementacion

1. **Paso 1** — constantes primero: `FANOUT_MAX_RECIPIENTS_PER_ACTION` y `FANOUT_GETALL_CHUNK_SIZE` deben existir antes de importarlos en el utility.
2. **Paso 2** — refactor del utility: depende de las constantes del paso 1.
3. **Paso 3** — actualizar el mock `buildDb`: necesita la nueva firma de `getAll` que el utility ahora llama.
4. **Paso 4** — nuevos casos de test: depende del mock actualizado del paso 3.
5. **Paso 5** — verificacion anti-regresion: depende de que el mock tenga spy de `getAll` y spy de `.get()` individual.
6. **Paso 6** — docs: puede hacerse en paralelo con los pasos 3-5, no tiene dependencias.

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas post-refactor | Accion si supera 400 |
|---------|----------------|-------------------------------|----------------------|
| `functions/src/utils/fanOut.ts` | 135 | ~175 | No supera — ok |
| `functions/src/constants/fanOut.ts` | 12 | ~20 | No supera — ok |
| `functions/src/__tests__/utils/fanOut.test.ts` | 341 | ~480 | No supera — ok |

---

## Riesgos

### R1 — Limite de 30 refs en `db.getAll()` no respetado

Si `FANOUT_GETALL_CHUNK_SIZE` se usa mal o el chunking tiene un off-by-one, `getAll` recibe mas de 30 refs y falla con error en runtime. Mitigacion: el test de "31 followers" verifica que `db.getAll` se llama exactamente 2 veces (chunk de 30 + chunk de 1). Si el chunking es incorrecto, el test falla antes de llegar a produccion.

### R2 — `Promise.all` de chunks falla parcialmente

Si un chunk de `getAll` falla (error de red, timeout de Firestore), el `Promise.all` rechaza y el trigger completo falla. Esto es el comportamiento correcto: Cloud Functions reintenta automaticamente el trigger. La alternativa de ignorar chunks fallidos podria resultar en feeds incompletos sin dedup. El try/catch del caller propaga el error correctamente.

### R3 — Reduccion de cap afecta usuarios con mas de 500 seguidores

Con `FANOUT_MAX_RECIPIENTS_PER_ACTION = 500`, usuarios con mas de 500 seguidores solo notifican a los primeros 500 (ordenados por el query de Firestore, que no garantiza orden especifico). Para el volumen actual de usuarios esto es aceptable. Si en el futuro hay usuarios con bases de seguidores grandes, el sistema de fan-out selectivo (throttling por actor) es el camino correcto, no aumentar el cap.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — cambio puramente en `functions/src/utils/`
- [x] Archivos nuevos en carpeta de dominio correcta — `fanOut.ts` ya esta en `functions/src/utils/`
- [x] Logica de negocio en hooks/services, no en componentes — no aplica (server-side)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — `fanOut.ts` es el hotspot H-3, este issue lo cierra
- [x] Ningun archivo resultante supera 400 lineas — ver tabla de estimacion arriba

## Guardrails de seguridad

- [x] No hay nuevas colecciones escribibles por usuarios — sin cambios de rules
- [x] No hay secrets, admin emails, ni credenciales en archivos commiteados
- [x] `getCountFromServer` no aplica — no hay queries de count en este cambio
- [x] El `Promise.all` de chunks tiene propagacion de error correcta (no silencia fallos)
- [x] Counter decrements no aplican — este cambio es de reads, no de counters

## Guardrails de observabilidad

- [x] `trackFunctionTiming('fanOutToFollowers', startMs)` — mantenido en todos los paths de retorno existentes
- [x] `trackFunctionTiming('fanOutDedupBatch', batchStartMs)` — nuevo, mide especificamente la fase de reads de dedup (S3)
- [x] No hay `trackEvent` de GA4 nuevo — este cambio no tiene superficie de usuario

## Guardrails de accesibilidad y UI

No aplica — cambio puramente server-side.

## Guardrails de copy

No aplica — sin textos de usuario.

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `docs/reference/patterns.md` | Actualizar descripcion del patron "Fan-out writes pattern" para mencionar batch dedup con `db.getAll()` en chunks de 30 y `Promise.all` entre chunks |

Los siguientes docs no requieren update:

- `docs/reference/security.md` — sin cambios de rules, auth, ni storage
- `docs/reference/firestore.md` — sin cambios de schema ni colecciones
- `docs/reference/features.md` — el comportamiento observable del fan-out no cambia para el usuario
- `docs/reference/project-reference.md` — actualizar version/fecha en el merge commit

---

## Criterios de done

- [x] `fanOutToFollowers` hace como maximo `ceil(n/30)` llamadas a Firestore durante la fase de dedup para n followers
- [x] Tests existentes siguen pasando (8 casos actuales)
- [x] Nuevos casos de test cubren chunking, Map lookup, early returns, y anti-regresion de reads individuales
- [x] Cobertura >= 100% en `fanOut.ts` (nivel actual — mantener)
- [x] `FANOUT_MAX_RECIPIENTS_PER_ACTION` actualizado a 500 con JSDoc explicativo
- [x] `FANOUT_GETALL_CHUNK_SIZE = 30` exportado desde `functions/src/constants/fanOut.ts`
- [x] `trackFunctionTiming('fanOutDedupBatch', ...)` agregado para medir fase de reads
- [x] No hay lint errors (`cd functions && npx eslint src/utils/fanOut.ts src/__tests__/utils/fanOut.test.ts`)
- [x] Build de functions exitoso (`cd functions && npm run build`)
- [x] Tests de functions pasan (`cd functions && npx vitest run`)
- [x] `docs/reference/patterns.md` actualizado
