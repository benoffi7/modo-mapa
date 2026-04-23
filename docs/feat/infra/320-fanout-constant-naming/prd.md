# PRD: Tech debt — FANOUT_MAX_RECIPIENTS_PER_ACTION naming y semantica del batch commit

**Feature:** 320-fanout-constant-naming
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #320
**Prioridad:** Baja

---

## Contexto

Durante el merge de #312 (fanOut N+1 → `db.getAll()` por chunks), el auditor de arquitectura detecto que la constante `FANOUT_MAX_RECIPIENTS_PER_ACTION = 500` en `functions/src/constants/fanOut.ts` tiene un nombre que puede confundir al lector que no conoce el detalle de Firestore batches: el cap real de `.limit()` en la query de followers es 500, pero el batch commit interno en `functions/src/utils/fanOut.ts` se flushea al alcanzar 500 **writes** (no 500 recipients), y cada recipient genera 2 writes (`dedupRef` + `feedRef`), por lo que en la practica se commitea cada ~250 recipients. El comportamiento es correcto — es un concern puramente de legibilidad y autodocumentacion del codigo.

## Problema

- El nombre `FANOUT_MAX_RECIPIENTS_PER_ACTION` sugiere que el cap es "destinatarios maximos por accion", pero el lector puede interpretar erroneamente que ese numero es tambien el tamano del batch commit interno (cuando ese cap viene del limite duro de Firestore de 500 ops por batch, no de esta constante).
- El comentario de `// Firestore batch hard cap is 500 writes; we write 2 per recipient` en el utility ya explica la diferencia, pero aparece lejos del site donde se define la constante.
- No hay un bug ni un cambio de comportamiento esperado: es deuda tecnica de naming/docs, baja prioridad.

## Solucion

Solucion contenida al scope XS: sin archivos nuevos, sin cross-module churn. Se mejoran los JSDoc existentes y se extrae el literal `500` del batch commit a una constante local del mismo archivo utility.

### S1 — Mejorar JSDoc de `FANOUT_MAX_RECIPIENTS_PER_ACTION`

Ampliar el comentario de `FANOUT_MAX_RECIPIENTS_PER_ACTION` en `functions/src/constants/fanOut.ts` para dejar explicito:

- Que el valor acota el `.limit()` de la query de followers (ese es el "max recipients").
- Que **no** es el tamano del batch commit interno; el batch commit se flushea al llegar a 500 **writes** (limite de Firestore), lo que en la practica es ~250 recipients netos porque cada recipient genera 2 writes (dedup + feed item).
- La relacion aritmetica explicita: `FANOUT_MAX_RECIPIENTS_PER_ACTION` (500 recipients) × 2 writes por recipient = 1000 writes = 2 batches de `BATCH_COMMIT_MAX_OPS` (500 writes por batch).
- Que 500 es una cota conservadora heredada de #312 y que aumentarla requiere revisar el sistema de fan-out selectivo en vez de subir el numero.

### S2 — Extraer el literal del batch commit a constante local

Reemplazar el literal `500` en la linea `if (count >= 500)` de `functions/src/utils/fanOut.ts:158` por una constante exportable **local al mismo archivo**:

```ts
/**
 * Firestore batched write hard limit (500 ops per batch).
 * Kept local to fanOut.ts — this is the SDK cap, not a product decision.
 *
 * Note: FANOUT_MAX_RECIPIENTS_PER_ACTION (500 recipients × 2 writes each = 1000 writes)
 * translates to exactly 2 commits of BATCH_COMMIT_MAX_OPS writes.
 */
export const BATCH_COMMIT_MAX_OPS = 500;
```

La constante queda definida y exportada en `functions/src/utils/fanOut.ts`. No se crea `functions/src/constants/firestore.ts` ni se migran otros batch-commits del repo (`cleanupNotifications`, `cleanupActivityFeed`, `comments`, `moderation`, `featuredLists`, `admin/listItems`, `admin/menuPhotos`, `deleteUserData`). Si en el futuro aparece el patron reutilizable cross-module, se promueve a `constants/firestore.ts` como follow-up separado — fuera del scope de #320.

### S3 — Mantener el nombre `FANOUT_MAX_RECIPIENTS_PER_ACTION`

NO se renombra `FANOUT_MAX_RECIPIENTS_PER_ACTION`. El nombre describe correctamente el cap semantico (destinatarios maximos de una accion de fan-out). El problema es solo de claridad en la relacion con el batch interno — se resuelve con S1 + S2.

### UX / donde vive

Solo codigo de Cloud Functions. No hay impacto en UI, ni en rules, ni en esquema de datos, ni en el comportamiento runtime. Un desarrollador que lea el utility de fan-out debe poder entender — sin abrir el issue #312 ni el #300 — de donde viene el cap de 500 en el batch commit y por que es distinto al cap de recipients.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Ampliar JSDoc de `FANOUT_MAX_RECIPIENTS_PER_ACTION` con la explicacion del batch commit y la relacion 500 × 2 = 2 batches | Alta | XS |
| S2: Extraer literal `500` del batch commit a constante local exportable `BATCH_COMMIT_MAX_OPS` en `functions/src/utils/fanOut.ts` | Alta | XS |
| Actualizar `docs/reference/patterns.md:110` para mencionar **ambas** constantes (`FANOUT_MAX_RECIPIENTS_PER_ACTION` y `BATCH_COMMIT_MAX_OPS`) y la relacion entre ellas | Alta | XS |

**Esfuerzo total estimado:** XS

---

## Out of Scope

- Renombrar `FANOUT_MAX_RECIPIENTS_PER_ACTION` (el nombre actual es semanticamente correcto).
- Cambiar el comportamiento runtime del fan-out (cap, dedup, getAll chunks).
- Modificar `FANOUT_DEDUP_WINDOW_HOURS` o `FANOUT_GETALL_CHUNK_SIZE`. La futura deuda de `FANOUT_GETALL_CHUNK_SIZE` (tambien un limite del Admin SDK) se queda como esta — separado, follow-up si aparece el patron reutilizable cross-module.
- Crear `functions/src/constants/firestore.ts` como modulo centralizado de constantes del SDK.
- Migrar otros call-sites del repo que hacen batch commits con literal `500` (`cleanupNotifications`, `cleanupActivityFeed`, `comments`, `moderation`, `featuredLists`, `admin/listItems`, `admin/menuPhotos`, `deleteUserData`).
- Introducir un sistema de fan-out selectivo o throttling por actor (seguimiento futuro si crecen las bases de seguidores).

---

## Tests

Feature de bajo riesgo y sin cambio de comportamiento. El cambio es puramente de naming interno (extraer un literal a constante local y ampliar JSDoc) y **no requiere tests nuevos**. Criterio de tests: **no se rompe ningun test existente**.

### Archivos que podrian verse afectados

| Archivo | Tipo | Que verificar |
|---------|------|---------------|
| `functions/src/__tests__/utils/fanOutBatch.test.ts` | Test existente | Sigue verde sin cambios (ningun test actual importa ni compara contra el literal `500` del batch) |
| `functions/src/__tests__/utils/fanOut.test.ts` | Test existente | Sigue verde sin cambios |

### Criterios de testing

- La suite completa de `functions/` sigue verde tras el cambio.
- No se agregan tests nuevos (el cambio no introduce logica nueva).
- No se modifica ningun test existente (no hay dependencia del literal `500` en assertions).
- No se relajan assertions existentes.

---

## Seguridad

Feature sin superficie de ataque nueva. No toca rules, callables, triggers, auth, ni validacion de inputs. La constante `FANOUT_MAX_RECIPIENTS_PER_ACTION = 500` sigue siendo el guardrail contra fan-out con bases de seguidores patologicas — su valor **no** cambia.

- [ ] No se modifican Firestore rules ni Storage rules.
- [ ] No se modifica comportamiento runtime de `fanOutToFollowers`.
- [ ] El cap de 500 recipients se mantiene; no se aumenta oportunisticamente.

### Vectores de ataque automatizado

No aplica. El cambio es puramente documental y de nombres. Un actor malicioso no puede explotar un JSDoc.

---

## Deuda tecnica y seguridad

### Issues relacionados

Se consultaron issues abiertos con labels `security` y `tech debt`: ambas listas vinieron vacias. Los unicos issues abiertos en el backlog son #168 (bloqueado), #319, #320 (este mismo) y #321. Ninguno solapa con este scope.

| Issue | Relacion | Accion |
|-------|----------|--------|
| #312 (cerrado) | Define la constante y la bajo de 5000 a 500 | Este PRD completa la claridad documental que #312 dejo pendiente |
| #321 | Tech debt separado sobre `lastCheckTs` en `useForceUpdate` | Sin relacion; no se agrava |

### Mitigacion incorporada

- Se aclara el comportamiento del batch commit (writes != recipients) directamente en el codigo, reduciendo el riesgo de que una futura edicion cambie el cap por confusion.

---

## Robustez del codigo

### Checklist de hooks async

No aplica: no se agregan hooks ni componentes React. El cambio es en Cloud Functions (Node runtime).

### Checklist de observabilidad

- [ ] `trackFunctionTiming('fanOutToFollowers')` y `trackFunctionTiming('fanOutDedupBatch')` existentes se preservan sin cambios.
- [ ] No se agregan nuevos eventos de analytics (feature de backend).

### Checklist offline

No aplica. `fanOutToFollowers` corre en servidor; el cliente nunca lo invoca directamente.

### Checklist de documentacion

- [ ] `docs/reference/patterns.md:110` actualizado: reemplazar "Batch writes de 500" por mencion explicita a **ambas** constantes (`FANOUT_MAX_RECIPIENTS_PER_ACTION` y `BATCH_COMMIT_MAX_OPS`) con la relacion entre ellas (500 recipients × 2 writes = 2 batches de 500 ops).
- [ ] `docs/reference/features.md` **no** requiere cambio (no es feature user-facing).
- [ ] `docs/reference/firestore.md` **no** requiere cambio (no hay coleccion nueva).

---

## Offline

No aplica. El fan-out corre en Cloud Functions (servidor). No hay flujo de datos cliente para evaluar.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Esfuerzo offline adicional: S

(No hay trabajo offline porque el feature no toca el frontend.)

---

## Modularizacion y % monolitico

Feature en backend puro. No modifica componentes, hooks ni services del frontend, por lo que no afecta el % monolitico de la app React.

### Checklist modularizacion

- [ ] Logica de negocio en `functions/src/utils/fanOut.ts` (sin cambio).
- [ ] `FANOUT_MAX_RECIPIENTS_PER_ACTION` vive en `functions/src/constants/fanOut.ts` (patron existente — sin cambio).
- [ ] `BATCH_COMMIT_MAX_OPS` vive en `functions/src/utils/fanOut.ts` (local al utility, exportable para tests si hiciera falta).
- [ ] No se crean archivos nuevos ni dependencias cruzadas entre modulos de functions.
- [ ] Ningun archivo supera 400 lineas tras el cambio (`fanOut.ts` son ~170 lineas; `constants/fanOut.ts` son 22 lineas).

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes |
| Estado global | = | No hay estado |
| Firebase coupling | = | Se usa el mismo Admin SDK |
| Organizacion por dominio | = | `FANOUT_MAX_RECIPIENTS_PER_ACTION` sigue en `constants/fanOut.ts`; `BATCH_COMMIT_MAX_OPS` queda local al utility |

---

## Accesibilidad y UI mobile

No aplica. Feature sin UI.

### Checklist de accesibilidad

N/A.

### Checklist de copy

N/A. Solo cambia JSDoc tecnico en ingles dentro de codigo de functions, consistente con el resto del archivo.

---

## Success Criteria

1. Un desarrollador nuevo que lea `functions/src/constants/fanOut.ts` entiende, sin consultar #312 ni #300, por que el cap de 500 es de **recipients** y por que el batch commit interno usa otro cap (ambos 500, pero por razones distintas: el de recipients es decision de producto; el del batch es limite duro del SDK).
2. El literal `500` que aparece en la condicion `if (count >= 500)` dentro del batch commit esta extraido a una constante nombrada y exportable `BATCH_COMMIT_MAX_OPS` en `functions/src/utils/fanOut.ts`, con JSDoc explicando "Firestore batched write hard limit (500 ops per batch)".
3. `docs/reference/patterns.md:110` menciona explicitamente ambas constantes y la relacion entre ellas (500 recipients × 2 writes = 2 batches).
4. La suite completa de `functions/` sigue verde, sin relajacion de assertions.
5. No hay cambio observable en runtime (logs, metricas de billing, latencia de triggers de fan-out).
6. El PRD pasa validacion funcional con Sofia y no bloquea features en progreso.

---

## Validacion Funcional

**Analista**: Sofia
**Fecha**: 2026-04-23
**Estado**: VALIDADO
**Ciclos**: 2

### Hallazgos cerrados en esta iteracion (Ciclo 2)

- IMPORTANTE #1 — "Decidir Opcion A o B de S2 antes del plan" → resuelto: se fijo **Opcion B** (constante local `BATCH_COMMIT_MAX_OPS` en `functions/src/utils/fanOut.ts`). Se elimino la Opcion A como alternativa. Se declaro explicitamente en "Out of Scope" que los otros batch-commits del repo (`cleanupNotifications`, `cleanupActivityFeed`, `comments`, `moderation`, `featuredLists`, `admin/listItems`, `admin/menuPhotos`, `deleteUserData`) no se migran en este PR.
- IMPORTANTE #2 — "Subir a Alta la actualizacion de `patterns.md:110`" → resuelto: el item en la tabla de Scope paso a prioridad **Alta** y condicionalidad eliminada. La actualizacion menciona explicitamente **ambas** constantes (`FANOUT_MAX_RECIPIENTS_PER_ACTION` y `BATCH_COMMIT_MAX_OPS`) con la relacion 500 recipients × 2 writes = 2 batches.
- Observacion #3 — "Sacar count exacto 478 tests" → resuelto: Success Criteria ahora dice "la suite completa de `functions/` sigue verde, sin relajacion de assertions".
- Observacion #4 — "Relajar clausula de tests" → resuelto: la seccion Tests ahora pide unicamente "no se rompe ningun test existente" (no test nuevo requerido, cambio puramente de naming interno).
- Observacion #5 — "Futura deuda `FANOUT_GETALL_CHUNK_SIZE`" → resuelto: agregada nota explicita en "Out of Scope" indicando que se queda como esta, separada del scope de #320.

### Verificaciones del Ciclo 1 (vigentes)

- Constante y literal `500` confirmados en las rutas que menciona el PRD (`functions/src/constants/fanOut.ts:15` y `functions/src/utils/fanOut.ts:158`).
- Ningun test actual compara contra el literal `500`; todos importan `FANOUT_MAX_RECIPIENTS_PER_ACTION`. Los unicos `500` en tests son strings decorativos en nombres de `it(...)`.
- `gh issue list --label security,tech-debt --state open` devuelve lista vacia. Sin overlap con otros issues abiertos.
- `docs/reference/features.md` no requiere cambio (el feature no es user-facing).

### Listo para specs-plan-writer

Si. Todas las observaciones de Sofia (Ciclo 1) estan resueltas en Ciclo 2. No hay hallazgos abiertos.
