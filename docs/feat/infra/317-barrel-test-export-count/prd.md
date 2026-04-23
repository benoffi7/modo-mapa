# PRD: barrel.test.ts — Eliminar hardcoded export count

**Feature:** 317-barrel-test-export-count
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #317
**Prioridad:** Baja

---

## Contexto

`src/constants/analyticsEvents/__tests__/barrel.test.ts` valida que el barrel de analytics events exporte exactamente N eventos mediante un hardcoded count. Cada vez que se agrega un evento nuevo (como `EVT_APP_VERSION_ACTIVE`, `EVT_BUSINESS_DETAIL_OPENED`, etc.), este count debe actualizarse manualmente — y es fácil olvidarlo.

## Problema

- El test `'exports exactly the expected number of events'` usa `toHaveLength(expectedExports.length)`, que detecta exportaciones *inesperadas* pero no agrega valor real: si el desarrollador agrega un evento al barrel sin agregarlo a `expectedExports`, el test pasa igual (el `it.each` loop tampoco lo detectaría, pero ese es el mismo problema del count test).
- El count falla en cada nueva feature que agrega eventos analytics, causando friction innecesaria en el flujo de desarrollo.
- El verdadero riesgo que el count intenta cubrir (exports no declarados en `expectedExports`) ya no es el objetivo principal del test, y la solución de snapshot es más mantenible.
- El conteo hardcodeado viola el patrón del proyecto de evitar magic numbers — `src/constants/` centraliza valores para que no haya números mágicos dispersos en el código.

## Solucion

### S1 — Reemplazar el count test por snapshot

Eliminar el `it('exports exactly the expected number of events', ...)` y reemplazarlo por un test de snapshot sobre `Object.keys(events).sort()`.

```ts
it('snapshot of exported event keys', () => {
  expect(Object.keys(events).sort()).toMatchSnapshot();
});
```

**Beneficios:**
- Detecta exportaciones no declaradas (igual que el count test, pero con nombre visible en diff).
- Al agregar un evento nuevo, `vitest --update-snapshots` actualiza el snapshot en una sola pasada — no hay número que buscar y editar.
- El diff del snapshot en PR muestra exactamente qué eventos se agregaron o removieron.

### S2 — Mantener el `it.each` loop sin cambios

El loop existente `it.each(expectedExports)('exports %s', ...)` sigue siendo la cobertura principal: garantiza que cada evento en `expectedExports` está presente y es string. No se toca.

### S3 — Generar el snapshot inicial

Al implementar, correr `vitest --update-snapshots` para generar el archivo `barrel.test.ts.snap` con el estado actual (57 eventos). El snapshot queda comiteado en el repo como referencia.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Eliminar `it('exports exactly the expected number...')` | Alta | XS |
| Agregar `it('snapshot of exported event keys', ...)` | Alta | XS |
| Correr `vitest --update-snapshots` y commitear `.snap` | Alta | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Modificar `expectedExports` (la lista de eventos declarados) — eso es responsabilidad de cada feature que agrega eventos.
- Agregar tests a otros barrels del proyecto (`constants/index.ts`, `types/index.ts`).
- Cambiar la estructura de directorios de `constants/analyticsEvents/`.
- Validar que los valores de los eventos sean únicos entre sí (no hay colisiones de strings) — eso es un problema distinto y de baja probabilidad.

---

## Tests

Este issue *es* un cambio de test. No genera código nuevo que necesite tests adicionales.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Test (modificar) | Reemplazar count test por snapshot test |
| `src/constants/analyticsEvents/__tests__/barrel.test.ts.snap` | Snapshot (nuevo) | Generado por `vitest --update-snapshots` |

### Criterios de testing

- El test suite de barrel sigue pasando sin errores tras el cambio.
- El snapshot generado contiene exactamente los 57 eventos actualmente en el barrel.
- Agregar un evento nuevo al barrel y correr los tests produce un fallo claro de snapshot (no un fallo de count) — verificar esto manualmente como parte de la implementacion.

---

## Seguridad

No aplica. Este issue no expone superficies de datos, no escribe a Firestore ni modifica lógica de negocio.

### Vectores de ataque automatizado

Ninguno. Cambio puramente de test infra.

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title
gh issue list --label "tech-debt" --state open --json number,title
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #318 business-detail-screen post-implementation review | independiente | No relacionado |
| #316 debounce/concurrency guard en useForceUpdate | independiente | No relacionado |
| #315 measureAsync en fetchAppVersionConfig | independiente | No relacionado |
| #314 import RETRY_DELAYS_MS desde timing.ts | independiente | No relacionado |
| #313 isCooldownActive duplication | independiente | No relacionado |

### Mitigacion incorporada

Ninguna deuda de seguridad se mitiga con este cambio.

---

## Robustez del codigo

No aplica — el cambio es exclusivamente en un archivo de test. No hay hooks async, componentes ni servicios nuevos.

### Checklist de observabilidad

No aplica.

### Checklist offline

No aplica.

### Checklist de documentacion

- [ ] No se modifica `features.md` (no es una feature de usuario).
- [ ] No hay colecciones nuevas en Firestore.
- [ ] No hay patrones nuevos en `patterns.md`.

---

## Offline

No aplica.

---

## Modularizacion y % monolitico

No aplica — cambio limitado a un archivo de test.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Sin cambio |
| Estado global | = | Sin cambio |
| Firebase coupling | = | Sin cambio |
| Organizacion por dominio | = | Sin cambio |

---

## Accesibilidad y UI mobile

No aplica.

---

## Success Criteria

1. `npm run test:run` pasa sin errores tras el cambio.
2. El archivo `barrel.test.ts.snap` existe en el repo y contiene los 57 eventos actuales ordenados alfabéticamente.
3. Agregar un evento al barrel sin actualizar el snapshot produce un fallo de tipo `snapshot mismatch` (no `toHaveLength`).
4. El PR no toca ningún archivo fuera de `src/constants/analyticsEvents/__tests__/`.
5. La cobertura global no baja del 80% (el cambio no reduce cobertura — reemplaza un assertion por otro equivalente).
