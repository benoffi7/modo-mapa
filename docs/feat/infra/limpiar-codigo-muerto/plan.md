# Plan: Limpiar codigo muerto del rediseno

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Eliminar componentes muertos

**Branch:** `chore/limpiar-codigo-muerto`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/InlineReplyForm.tsx` | Eliminar archivo |
| 2 | `src/components/business/QuestionInput.tsx` | Eliminar archivo |
| 3 | `src/components/home/RecentVisits.tsx` | Eliminar archivo |
| 4 | `src/components/home/SuggestionsView.tsx` | Eliminar archivo |
| 5 | `src/components/profile/CheckInsView.tsx` | Eliminar archivo |
| 6 | `src/components/profile/CommentItem.tsx` | Eliminar archivo |
| 7 | `src/components/lists/SharedListDetailView.tsx` | Eliminar archivo |
| 8 | `src/components/notifications/NotificationList.tsx` | Eliminar archivo |

### Fase 2: Eliminar hooks muertos y sus tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useCommentSort.ts` | Eliminar archivo |
| 2 | `src/hooks/useCommentSort.test.ts` | Eliminar archivo |
| 3 | `src/hooks/useCommentThreads.ts` | Eliminar archivo |
| 4 | `src/hooks/useCommentThreads.test.ts` | Eliminar archivo |
| 5 | `src/hooks/useOptimisticLikes.ts` | Eliminar archivo |
| 6 | `src/hooks/useOptimisticLikes.test.ts` | Eliminar archivo |
| 7 | `src/components/business/useQuestionThreads.ts` | Eliminar archivo |
| 8 | `src/components/business/useQuestionThreads.test.ts` | Eliminar archivo |

### Fase 3: Eliminar context muerto y su test

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/context/MapContext.tsx` | Eliminar archivo |
| 2 | `src/context/MapContext.test.tsx` | Eliminar archivo |

### Fase 4: Eliminar barrel, constantes y shared duplicado

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/index.ts` | Eliminar archivo |
| 2 | `src/constants/messages/common.ts` | Eliminar propiedades `genericError` y `noResults` de `MSG_COMMON`. Mantener `noUsersFound` y `publicProfileHint` |
| 3 | `shared/userOwnedCollections.ts` | Eliminar archivo |
| 4 | `shared/userOwnedCollections.test.ts` | Eliminar archivo |

### Fase 5: Validacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | -- | Ejecutar `npm run build` y verificar que compila sin errores |
| 2 | -- | Ejecutar `npm run test:run` y verificar que todos los tests pasan |
| 3 | -- | Ejecutar `cd functions && npx vitest run` y verificar que functions tests pasan |
| 4 | -- | Ejecutar `npm run lint` y verificar sin errores |

### Fase 6: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/tests.md` | Eliminar fila de `MapContext.test.tsx` del inventario de Contexts. Actualizar total de test files (63 -> ~57) y total de test cases (1131 -> ~1081). Actualizar conteo en tabla resumen |
| 2 | `docs/reference/patterns.md` | Linea 50 (Optimistic UI): actualizar mencion -- los hooks eliminados ya no existen como archivos independientes, la logica fue inlined en los componentes que la usan. Linea 170: actualizar mencion a `RecentVisits` (archivo eliminado). Linea 171: actualizar mencion a `SuggestionsView` (archivo eliminado). Linea 193 (Extracted hooks #195): actualizar lista removiendo `useOptimisticLikes`, `useCommentSort`, `useCommentThreads`, `useQuestionThreads` (mantener los 4 que siguen vivos: `useCommentEdit`, `useVerificationCooldown`, `useCommentsListFilters`, `useVirtualizedList`). Linea 194: actualizar mencion a `QuestionInput` (archivo eliminado) |
| 3 | `docs/reference/project-reference.md` | Linea 98: actualizar mencion a `shared/userOwnedCollections.ts` (solo queda la copia canonica en `functions/src/shared/`). Linea 99: actualizar lista de extracted hooks (remover los 4 eliminados). Linea 103: actualizar total de tests |
| 4 | `docs/reference/features.md` | Linea 30: actualizar para reflejar que la logica de `useOptimisticLikes`, `useCommentSort`, `useCommentThreads` y `useQuestionThreads` esta inlined en sus componentes consumidores, no como hooks independientes. Actualizar mencion a `QuestionInput` como componente eliminado. Linea 54: actualizar mencion a `SuggestionsView.tsx`. Linea 321: actualizar mencion a `SuggestionsView` |
| 5 | `docs/reference/files.md` | Eliminar entradas de `MapContext.tsx`, `SuggestionsView.tsx`, `RecentVisits.tsx`, `CheckInsView.tsx`, `SharedListDetailView.tsx` del arbol de archivos |
| 6 | `docs/reference/data-layer.md` | Linea 85: actualizar mencion a `RecentVisits` (componente eliminado, `useVisitHistory` sigue activo) |
| 7 | `docs/reference/coding-standards.md` | Linea 280: eliminar fila de `MapContext` de la tabla de contextos |
| 8 | `docs/reference/design-system.md` | Lineas 90-92: actualizar/eliminar menciones a `CommentItem.tsx` e `InlineReplyForm.tsx` como archivos eliminados |

---

## Orden de implementacion

1. Fase 1 (componentes) -- sin dependencias, se pueden borrar todos en paralelo
2. Fase 2 (hooks + tests) -- sin dependencias, paralelo
3. Fase 3 (context + test) -- sin dependencias
4. Fase 4 (barrel, constantes, shared) -- sin dependencias
5. Fase 5 (validacion) -- depende de fases 1-4
6. Fase 6 (docs) -- depende de validacion exitosa en fase 5

Las fases 1-4 son independientes entre si y pueden ejecutarse en cualquier orden o en paralelo. La fase 5 es el gate de calidad. La fase 6 actualiza la documentacion con los nuevos conteos.

---

## Estimacion de tamano de archivos

Este feature solo elimina archivos y modifica propiedades en un archivo existente. No se crean archivos nuevos.

| Archivo modificado | Lineas actuales | Lineas resultantes | Supera 400? |
|-------------------|----------------|-------------------|-------------|
| `src/constants/messages/common.ts` | 7 | 4 | No |
| `docs/reference/tests.md` | ~374 | ~368 | No |
| `docs/reference/patterns.md` | ~209 | ~205 | No |
| `docs/reference/project-reference.md` | ~104 | ~102 | No |
| Otros docs de referencia | Variable | -1 a -3 lineas c/u | No |

---

## Riesgos

1. **Falso negativo en busqueda de importaciones**: un import dinamico o string template podria referenciar un archivo eliminado sin ser detectado por grep. **Mitigacion**: la fase 5 valida con `npm run build` que detecta imports rotos.

2. **Test de otro archivo depende de un export del archivo eliminado**: un test podria importar un tipo o helper de un hook muerto. **Mitigacion**: `npm run test:run` en fase 5 lo detecta.

3. **Docs desactualizados tras la eliminacion**: si no se actualizan todos los docs de referencia, quedan menciones a archivos inexistentes. **Mitigacion**: la fase 6 cubre exhaustivamente los 8 archivos de docs afectados, identificados via grep.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (no hay componentes nuevos)
- [x] No se agregan archivos nuevos
- [x] No hay logica de negocio nueva
- [x] No se toca ningun archivo con deuda tecnica que quede sin fix
- [x] Ningun archivo resultante supera 400 lineas

---

## Fase final: Documentacion (OBLIGATORIA)

Incluida como Fase 6 en el plan de implementacion arriba.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/tests.md` | Actualizar inventario y totales (eliminar filas de hooks/context muertos, actualizar conteos) |
| 2 | `docs/reference/patterns.md` | Actualizar secciones "Optimistic UI", "Shared date/distance utils", "Extracted hooks (#195)", "UI components extraidos" |
| 3 | `docs/reference/project-reference.md` | Actualizar shared/ folder mencion, extracted hooks lista, total de tests |
| 4 | `docs/reference/features.md` | Actualizar menciones a hooks y componentes eliminados en secciones de BusinessSheet y Distancia |
| 5 | `docs/reference/files.md` | Eliminar entradas de 5 componentes y 1 context del arbol |
| 6 | `docs/reference/data-layer.md` | Actualizar mencion a `RecentVisits` |
| 7 | `docs/reference/coding-standards.md` | Eliminar `MapContext` de tabla de contextos |
| 8 | `docs/reference/design-system.md` | Actualizar menciones a `CommentItem.tsx` e `InlineReplyForm.tsx` |

---

## Criterios de done

- [x] Los 17 archivos de codigo muerto estan eliminados
- [x] Los 6 archivos de test asociados estan eliminados
- [x] 2 constantes muertas eliminadas de `MSG_COMMON`
- [x] `npm run build` completa sin errores
- [x] `npm run test:run` pasa sin errores (frontend)
- [x] `cd functions && npx vitest run` pasa sin errores (backend)
- [x] `npm run lint` pasa sin errores
- [x] 8 docs de referencia actualizados (tests.md, patterns.md, project-reference.md, features.md, files.md, data-layer.md, coding-standards.md, design-system.md)
