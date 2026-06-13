# PRD: Tech Debt — fanOut N+1 Dedup Reads

**Feature:** 312-fanout-n1-dedup-reads
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #312
**Prioridad:** Alta

---

## Contexto

La función `fanOutToFollowers` en `functions/src/utils/fanOut.ts` escribe un item de actividad en el feed de cada seguidor del actor cada vez que este hace un rating, comentario o favorito. Fue parcialmente protegida en #300 agregando `.limit(FANOUT_MAX_RECIPIENTS_PER_ACTION)` a la query de follows, pero el loop interno sigue haciendo una lectura secuencial de Firestore por cada seguidor para chequear el documento de dedup en `_fanoutDedup`.

## Problema

- **N+1 lecturas secuenciales:** El for-loop llama a `await dedupRef.get()` una vez por follower. Con 500 seguidores (el tope actual `FANOUT_MAX_RECIPIENTS_PER_ACTION = 5000`), esto genera hasta 5000 reads síncronos en un solo trigger de Cloud Function.
- **Riesgo de timeout:** Cloud Functions v2 tiene un timeout de 60s por defecto. Una cadena de 500+ reads secuenciales puede acercarse o superar ese límite para usuarios populares, causando fallos silenciosos del trigger.
- **Amplificación de billing:** Cada acción (rating/comentario/favorito) de un usuario con muchos seguidores multiplica el costo de reads por el número de seguidores. Con el cap en 5000 esto es potencialmente 5000 reads por evento.

## Solucion

### S1 — Batch dedup reads con `db.getAll()`

Reemplazar el loop de `await dedupRef.get()` individuales por un `db.getAll(...refs)` en grupos de 30 documentos (límite de `getAll` en el Admin SDK). Esto convierte O(n) llamadas de red en `ceil(n/30)` operaciones paralelas.

Flujo actualizado:

1. Calcular todas las `dedupKey` y `dedupRef` para los followers antes del loop.
2. Dividir los refs en chunks de 30.
3. Llamar `db.getAll(...chunk)` por cada chunk — estas llamadas pueden ser `Promise.all` entre chunks (paralelas).
4. Construir un `Map<string, DocumentSnapshot>` con los resultados.
5. El loop de escritura de batch consulta el Map local en vez de Firestore — 0 reads adicionales durante el loop.

Esta es la solución recomendada en el issue (opción 1) y la que mejor preserva la semántica de dedup existente sin cambios de schema.

### S2 — Ajustar `FANOUT_MAX_RECIPIENTS_PER_ACTION`

El cap actual es 5000, lo que implica un máximo teórico de 5000 reads de dedup por invocación. Revisar si 500 (el valor que mencionaba el issue original) es un límite más razonable como cota de seguridad. Actualizar la constante y el comentario JSDoc en `functions/src/constants/fanOut.ts`.

> Nota: el valor correcto es una decision de producto (cuantos seguidores justifican fan-out vs notificacion directa). Este PRD propone mantenerlo en 500 como cota conservadora hasta que haya datos de uso real.

### S3 — Agregar `trackFunctionTiming` granular para dedup batch

El helper `trackFunctionTiming('fanOutToFollowers', startMs)` ya se llama al final y en el early-return. Agregar un timing interno para medir específicamente la fase de dedup batch reads, de modo que el Admin Panel de Performance pueda detectar regresiones futuras.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Reemplazar N+1 reads por `db.getAll()` batch en chunks de 30 | Alta | S |
| S2: Revisar y ajustar `FANOUT_MAX_RECIPIENTS_PER_ACTION` a 500 | Alta | XS |
| S3: Timing granular para fase de dedup batch | Baja | XS |
| Actualizar tests de `fanOut.test.ts` para mock de `db.getAll()` | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Migrar el sistema de dedup a un campo `lastFanOutAt` en el documento del actor (opción 2 del issue) — requiere cambio de schema y Firestore rules.
- Integración con Redis/Memorystore (opción 3) — costo y complejidad desproporcionados para el volumen actual.
- Fan-out selectivo basado en frecuencia del actor (throttling a nivel de actor, no de follower).
- Cambios al schema de `_fanoutDedup` o `activityFeed`.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/utils/fanOut.ts` | Utility | Comportamiento del batch dedup con `getAll` |
| `functions/src/__tests__/utils/fanOut.test.ts` | Test (actualizar) | Mock de `db.getAll()`, chunking a 30, dedup Map lookup |

### Casos a cubrir

- [ ] Con 1 follower: `getAll` llamado con 1 ref, se escribe feed + dedup.
- [ ] Con 31 followers sin dedup previo: `getAll` llamado 2 veces (chunk de 30 + chunk de 1), se escriben 31 feeds.
- [ ] Con 31 followers donde los primeros 30 tienen dedup fresco: solo se escribe 1 feed.
- [ ] Con dedup expirado: se reescribe.
- [ ] Con actor profilePublic = false: early return, `getAll` nunca se llama.
- [ ] Sin followers: early return, `getAll` nunca se llama.
- [ ] `FANOUT_MAX_RECIPIENTS_PER_ACTION` respetado: `getAll` nunca recibe más refs que el cap.
- [ ] Batch de escrituras: múltiples commits cuando hay más de 250 recipients (2 writes/recipient, cap 500 ops/batch).
- [ ] `trackFunctionTiming` llamado exactamente una vez en cada path (early return, sin followers, normal).

### Mock strategy

El mock de `buildDb` existente en `fanOut.test.ts` necesita agregar `getAll` como método del objeto db:

```typescript
getAll: vi.fn().mockImplementation(async (...refs) => {
  return refs.map((ref) => {
    const existing = state.dedup.get(ref._dedupKey);
    return {
      exists: existing !== undefined,
      get: (k: string) => k === 'createdAt' ? existing?.createdAt : undefined,
    };
  });
}),
```

Los refs deben incluir `_dedupKey` como propiedad de test para que el mock pueda resolver el estado.

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (actualmente `fanOut.ts` tiene 8 tests con cobertura ~100% — mantener ese nivel).
- Verificar que `getAll` se llama el número correcto de veces según el chunking.
- Verificar que ningún `dedupRef.get()` individual se llama en el path normal (el mock de `doc().get()` no debería recibir llamadas para keys de dedup).

---

## Seguridad

Este feature no agrega nuevas superficies de escritura a Firestore ni nuevos inputs de usuario. El riesgo principal que mitiga es de billing.

- [ ] `_fanoutDedup`: la colección sigue siendo escribible solo desde Cloud Functions (Admin SDK). No hay cambio en Firestore rules.
- [ ] El batch `getAll` usa refs construidos server-side (los `dedupKey` son SHA-256 de datos internos, no user-supplied). No hay riesgo de path injection.
- [ ] `FANOUT_MAX_RECIPIENTS_PER_ACTION` reducido a 500 acota el peor caso de billing por evento a 500 reads (batch de dedup) + hasta 1000 writes (dedup + feed, en batches de 500 ops).

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Fan-out trigger (indirecto) | Bot crea 500 follows + hace ratings en loop para amplificar writes | Ya mitigado: rate limit de 30 ratings/día y 50 follows/día en triggers existentes |
| `_fanoutDedup` collection | — (solo Admin SDK) | Sin cambio necesario |

> Este feature no escribe a Firestore desde el cliente. No aplican los checklists de `hasOnly()`, `affectedKeys()` ni moderacion.

---

## Deuda tecnica y seguridad

No hay issues abiertos de security o tech debt relacionados (los dos únicos issues abiertos son #168 —bloqueado por deps upstream— y #312 —este mismo).

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #300 (cerrado) | Detectó el N+1 y aplicó el `.limit()` como primera mitigación | Completar lo que #300 dejó pendiente (H-3 en el título indica que este era el tercer hotspot identificado) |

### Mitigacion incorporada

- Eliminar el N+1 de dedup reads resuelve completamente el hotspot H-3 identificado en el merge audit de v2.36.0.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] El for-loop de escritura de batch no tiene `await` que pueda dejar estado inconsistente — el batch se hace commit completo o falla.
- [ ] Los `Promise.all` de chunks de `getAll` tienen try/catch — si un chunk falla, el error se propaga y el trigger falla completo (comportamiento correcto: Cloud Functions reintenta).
- [ ] `trackFunctionTiming` se llama en todos los paths de retorno (ya implementado, mantener).
- [ ] `logger.error` en catch, nunca dentro de `if (import.meta.env.DEV)` — aplica solo al frontend, pero en functions usar `logger.error` del `firebase-functions` SDK igualmente (sin guards de DEV).

### Checklist de observabilidad

- [ ] `trackFunctionTiming('fanOutToFollowers', startMs)` ya instrumentado — mantener.
- [ ] (S3, opcional) Agregar `trackFunctionTiming('fanOutDedupBatch', batchStartMs)` para medir solo la fase de reads.

### Checklist offline

No aplica — es una Cloud Function server-side.

### Checklist de documentacion

- [ ] `docs/reference/features.md` no requiere update (el comportamiento observable del fan-out no cambia).
- [ ] `docs/reference/patterns.md` — actualizar la descripcion del patron **Fan-out writes pattern** para mencionar el batch dedup con `getAll`.

---

## Offline

No aplica. `fanOutToFollowers` es una Cloud Function trigger que se ejecuta en el servidor. No hay UI involucrada en este cambio.

---

## Modularizacion y % monolitico

Este cambio es puramente server-side, dentro de un utility existente (`functions/src/utils/fanOut.ts`). No agrega acoplamiento al frontend.

### Checklist modularizacion

- [ ] El cambio vive íntegramente en `functions/src/utils/fanOut.ts` — sin tocar triggers ni frontend.
- [ ] No se agregan dependencias nuevas (Admin SDK ya tiene `db.getAll()`).
- [ ] El archivo tiene actualmente 135 líneas — después del refactor estimado en ~150 líneas (bien bajo del límite de 300).

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Cambio puramente server-side |
| Estado global | = | Sin cambios de estado |
| Firebase coupling | = | Admin SDK ya usado, sin imports nuevos |
| Organizacion por dominio | = | Archivo existente en carpeta correcta |

---

## Accesibilidad y UI mobile

No aplica — no hay cambios de UI.

---

## Success Criteria

1. La función `fanOutToFollowers` hace como máximo `ceil(n/30)` llamadas a Firestore durante la fase de dedup, donde n es el número de followers (en lugar de n llamadas individuales).
2. El tiempo de ejecución del trigger se mantiene por debajo de 10s para un actor con 500 followers (vs el riesgo anterior de timeout a 60s).
3. El costo de reads por fan-out queda acotado en `ceil(500/30) = 17` reads de dedup + 1 read de followers + 1 read de userSettings = 19 reads máximo por invocación (vs 500+ anterior).
4. Los tests existentes en `fanOut.test.ts` siguen pasando y se agregan nuevos casos que verifican el chunking y el lookup desde el Map local.
5. `FANOUT_MAX_RECIPIENTS_PER_ACTION` actualizado a 500 con comentario explicando la decisión.
