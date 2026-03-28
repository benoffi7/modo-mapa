# Plan: Feedback Rating Validation

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Validacion en Firestore rules

**Branch:** `fix/feedback-rating-validation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | Agregar validacion condicional de `rating` en la regla `create` de `feedback` (linea 162, despues de la validacion de `businessName`): `&& (!('rating' in request.resource.data) \|\| (request.resource.data.rating is int && request.resource.data.rating >= 1 && request.resource.data.rating <= 5))` |

### Fase 2: Tests de Firestore rules

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2 | `package.json` | Agregar `@firebase/rules-unit-testing` como devDependency |
| 3 | `tests/rules/feedback.test.ts` | Crear test file con 10 test cases: rating int 1-5 aceptado (3 cases: 1, 3, 5), fuera de rango rechazado (4 cases: 0, 6, -1, 100), tipo incorrecto rechazado (3 cases: string, float, map), feedback sin rating aceptado (1 case). Usar `initializeTestEnvironment` con las rules del proyecto, contexto autenticado, y `assertSucceeds`/`assertFails` |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `docs/reference/security.md` | Agregar fila en la tabla "Limites de validacion": `Feedback rating \| 1-5 (int, opcional) \| Server` |

---

## Orden de implementacion

1. `firestore.rules` -- la regla es independiente y puede desplegarse inmediatamente
2. `package.json` -- instalar dependencia de testing
3. `tests/rules/feedback.test.ts` -- tests que validan la regla del paso 1
4. `docs/reference/security.md` -- documentacion

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `firestore.rules` | ~510 (actual 508 + 2 nuevas) | OK |
| `tests/rules/feedback.test.ts` | ~120 (nuevo) | OK |
| `docs/reference/security.md` | ~302 (actual 300 + 2 nuevas) | OK |

## Riesgos

1. **Dependencia `@firebase/rules-unit-testing` requiere emulador corriendo**: Los tests de rules necesitan el emulador de Firestore. Mitigacion: los tests se ejecutan con `firebase emulators:exec` o se marcan para ejecutar solo en CI con emuladores.

2. **Datos existentes con rating invalido**: Si algun documento existente tiene un `rating` invalido, no se vera afectado (la regla solo aplica a `create`, no a reads). Sin impacto.

3. **Cola offline con rating invalido**: Si un usuario encolara offline un feedback con rating invalido (bypasseando la UI), el write sera rechazado al sincronizar. Esto ya es el comportamiento esperado para cualquier validacion server-side.

## Criterios de done

- [x] Regla de validacion `rating is int && >= 1 && <= 5` agregada en `firestore.rules`
- [x] Tests de rules cubren los 10 escenarios (valido, fuera de rango, tipo incorrecto, ausente)
- [x] Todos los tests pasan
- [x] No lint errors
- [x] Build succeeds
- [x] Tabla de limites de validacion en `security.md` actualizada
- [x] Commit con mensaje descriptivo y lint passing
