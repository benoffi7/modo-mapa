# Plan: Rate Limits + Field Validation

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Rate limit en menuPhotos trigger

**Branch:** `feat/242-rate-limits-field-validation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/triggers/menuPhotos.ts` | Importar `checkRateLimit` de `../utils/rateLimiter` y `logAbuse` de `../utils/abuseLogger`. Agregar rate limit check (10/dia) despues de `const db = getDb()`. Si excede: loggear abuso y retornar sin procesar thumbnail ni counters. |
| 2 | `functions/src/__tests__/triggers/menuPhotos.test.ts` | Agregar mocks para `checkRateLimit` y `logAbuse`. Agregar 2 tests: (a) rate limit excedido -- no genera thumbnail, no incrementa counters, loggea abuso; (b) rate limit ok -- flujo existente sin cambios. |

### Fase 2: Validacion de longitud en sharedLists update rule

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `firestore.rules` | En la regla de update de `sharedLists`, rama de `isListOwner()`: agregar validacion `name is string && name.size() > 0 && name.size() <= 50 && description is string && description.size() <= 200` despues del `affectedKeys().hasOnly()`. |

### Fase 3: Trigger de listItems con rate limit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `functions/src/triggers/listItems.ts` | Crear trigger `onListItemCreated` en path `listItems/{itemId}`. Extraer `addedBy`. Si existe, hacer query directa para contar items del usuario hoy. Si > 100, loggear abuso. Siempre incrementar counters (`incrementCounter` + `trackWrite`). |
| 5 | `functions/src/index.ts` | Agregar export: `export { onListItemCreated } from './triggers/listItems';` en la seccion de Triggers. |
| 6 | `functions/src/__tests__/triggers/listItems.test.ts` | Crear tests: (a) no snapshot -- retorna; (b) sin addedBy -- incrementa counters sin rate limit; (c) rate limit no excedido -- incrementa counters; (d) rate limit excedido -- incrementa counters + loggea abuso. |

### Fase 4: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `docs/reference/security.md` | Agregar `menuPhotos` (10/dia) y `listItems` (100/dia) a la tabla de rate limits server-side (triggers). Agregar `sharedLists name/description` a la tabla de limites de validacion. |
| 8 | `docs/reference/firestore.md` | Actualizar la entrada de `sharedLists` en la tabla de rules para mencionar validacion de longitud en update. |
| 9 | `docs/reference/tests.md` | Agregar `menuPhotos.test.ts` actualizado y `listItems.test.ts` nuevo al inventario de triggers. |

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio |
|---------|----------------|------------------------------|
| `functions/src/triggers/menuPhotos.ts` | 43 | ~65 |
| `functions/src/triggers/listItems.ts` | 0 (nuevo) | ~45 |
| `functions/src/__tests__/triggers/menuPhotos.test.ts` | 151 | ~220 |
| `functions/src/__tests__/triggers/listItems.test.ts` | 0 (nuevo) | ~120 |
| `firestore.rules` | 527 | ~532 |

Ningun archivo supera 400 lineas.

---

## Orden de implementacion

1. `functions/src/triggers/menuPhotos.ts` -- agregar rate limit (sin dependencias)
2. `functions/src/__tests__/triggers/menuPhotos.test.ts` -- tests del paso 1
3. `firestore.rules` -- validacion de longitud (independiente de triggers)
4. `functions/src/triggers/listItems.ts` -- nuevo trigger
5. `functions/src/index.ts` -- registrar nuevo trigger
6. `functions/src/__tests__/triggers/listItems.test.ts` -- tests del paso 4
7. `docs/reference/security.md` -- actualizar tablas de rate limits
8. `docs/reference/firestore.md` -- actualizar reglas de sharedLists
9. `docs/reference/tests.md` -- actualizar inventario

---

## Riesgos

1. **Indice compuesto para listItems query.** La query `where('addedBy', '==', x).where('createdAt', '>=', y)` requiere un indice compuesto. Si no existe, la query falla en produccion. **Mitigacion:** verificar indices existentes con `firebase firestore:indexes` antes de deploy. Si no existe, agregar a `firestore.indexes.json`.

2. **Items legacy sin `addedBy`.** Items creados antes del campo `addedBy` no tienen este campo. **Mitigacion:** el trigger chequea `if (!addedBy) return` despues de incrementar counters, saltando el rate limit para items legacy.

3. **Rule de sharedLists rechaza updates que no incluyan name/description.** Si un editor update solo `itemCount`, la rule no evalua name/description porque esta en la rama de editor. Si el owner update solo `color`, el `request.resource.data.name` toma el valor existente del doc (Firestore rules evaluan el doc completo post-merge). **Mitigacion:** no es un riesgo real; Firestore rules evaluan `request.resource.data` que incluye todos los campos del doc resultante.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (solo cambios backend)
- [x] Archivos nuevos en carpeta de dominio correcta (`functions/src/triggers/`)
- [x] Logica de negocio en triggers/utils, no en componentes
- [x] No se toca ningun archivo con deuda tecnica conocida
- [x] Ningun archivo resultante supera 400 lineas

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `docs/reference/security.md` | Agregar menuPhotos y listItems a tabla de rate limits; agregar sharedLists name/description a tabla de limites de validacion |
| 8 | `docs/reference/firestore.md` | Actualizar reglas de sharedLists con validacion de longitud en update |
| 9 | `docs/reference/tests.md` | Agregar menuPhotos.test.ts (actualizado) y listItems.test.ts (nuevo) al inventario |

## Criterios de done

- [ ] `onMenuPhotoCreated` incluye `checkRateLimit()` con limite 10/dia
- [ ] `sharedLists` update rule valida `name.size() <= 50` y `description.size() <= 200`
- [ ] `onListItemCreated` trigger creado con rate limit 100/dia
- [ ] Tests de menuPhotos cubren path de rate limit excedido
- [ ] Tests de listItems cubren todos los paths (sin addedBy, excedido, no excedido)
- [ ] Cobertura >= 80% del codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (`cd functions && npm run build`)
- [ ] `docs/reference/security.md` actualizado con nuevos rate limits
- [ ] `docs/reference/firestore.md` actualizado con validacion en sharedLists update
- [ ] `docs/reference/tests.md` actualizado con nuevos test files
