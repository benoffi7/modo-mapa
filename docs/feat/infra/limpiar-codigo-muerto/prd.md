# PRD: Limpiar codigo muerto del rediseno

**Feature:** limpiar-codigo-muerto
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #232
**Prioridad:** Media

---

## Contexto

Despues del rediseno de la app (v3.0.0, branch `new-home`), quedaron componentes, hooks, contexts, servicios y constantes huerfanos que ya no se importan en produccion. Estos archivos aumentan el tamano del bundle potencialmente (si Vite no los tree-shake correctamente), dificultan la navegacion del codebase y generan falsos positivos en metricas de cobertura de tests.

## Problema

- **Codigo muerto acumulado**: 8 componentes, 4 hooks, 1 context, 1 barrel export, 2 constantes y 1 archivo shared estan sin consumidores en produccion. Solo son referenciados por sus propios tests.
- **Confusion para desarrolladores**: archivos como `MapContext.tsx` estan marcados `@deprecated` pero siguen presentes, creando ambiguedad sobre que usar.
- **Metricas de test infladas**: los tests de hooks muertos (useCommentSort, useCommentThreads, useOptimisticLikes, useQuestionThreads) cuentan en el total de 1131 tests pero no cubren codigo activo, distorsionando la cobertura real.

## Solucion

### S1. Eliminar componentes muertos

Borrar los 8 componentes sin importaciones en produccion:

- `src/components/business/InlineReplyForm.tsx`
- `src/components/business/QuestionInput.tsx`
- `src/components/home/RecentVisits.tsx`
- `src/components/home/SuggestionsView.tsx`
- `src/components/profile/CheckInsView.tsx`
- `src/components/profile/CommentItem.tsx`
- `src/components/lists/SharedListDetailView.tsx`
- `src/components/notifications/NotificationList.tsx`

### S2. Eliminar hooks muertos y sus tests

Borrar los 4 hooks que solo se usan en sus propios tests:

- `src/hooks/useCommentSort.ts` + `src/hooks/useCommentSort.test.ts`
- `src/hooks/useCommentThreads.ts` + `src/hooks/useCommentThreads.test.ts`
- `src/hooks/useOptimisticLikes.ts` + `src/hooks/useOptimisticLikes.test.ts`
- `src/components/business/useQuestionThreads.ts` + `src/components/business/useQuestionThreads.test.ts`

### S3. Eliminar context muerto y su test

Borrar `src/context/MapContext.tsx` (marcado `@deprecated`, reemplazado por `SelectionContext` + `FiltersContext`) y su test `src/context/MapContext.test.tsx`.

### S4. Eliminar barrel export, constantes y shared muertos

- Borrar `src/services/index.ts` (barrel export sin consumidores)
- Eliminar `MSG_COMMON.genericError` y `MSG_COMMON.noResults` de `src/constants/messages/common.ts`
- Borrar `shared/userOwnedCollections.ts` (top-level, duplicado de `functions/src/shared/userOwnedCollections.ts`) y su test `shared/userOwnedCollections.test.ts`

### S5. Actualizar documentacion de referencia

Actualizar `docs/reference/tests.md` para reflejar la reduccion en el total de tests y archivos de test. Actualizar `docs/reference/patterns.md` para: (a) remover referencias a hooks eliminados (seccion "Extracted hooks (#195)"), (b) corregir referencias a `SideMenu` que ya no existe en `new-home` (reemplazado por `TabShell`/`MapAppShell`), (c) remover referencia a `QuestionInput` como componente extraido (es codigo muerto). Actualizar `docs/reference/project-reference.md` con el nuevo conteo de tests.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Eliminar 8 componentes muertos | Alta | S |
| S2. Eliminar 4 hooks muertos + 4 test files | Alta | S |
| S3. Eliminar MapContext + test | Alta | S |
| S4. Eliminar barrel, constantes, shared duplicado + test | Alta | S |
| S5. Actualizar docs de referencia (tests.md, patterns.md, project-reference.md) | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- No tocar `EditorsDialog`, `InviteEditorDialog`, `IconPicker` (tienen issues propios #229, #230)
- No tocar `useColorMode.ts` ni `ColorModeContext` (tiene issue propio #231)
- No refactorizar archivos que se quedan -- solo eliminar los muertos
- No reorganizar carpetas ni mover archivos existentes

---

## Tests

Este feature **elimina** tests existentes y no agrega codigo nuevo con logica, por lo tanto no requiere tests nuevos.

### Archivos que se eliminan (tests)

| Archivo | Tipo | Razon de eliminacion |
|---------|------|---------------------|
| `src/hooks/useCommentSort.test.ts` | Unit test | Hook eliminado |
| `src/hooks/useCommentThreads.test.ts` | Unit test | Hook eliminado |
| `src/hooks/useOptimisticLikes.test.ts` | Unit test | Hook eliminado |
| `src/components/business/useQuestionThreads.test.ts` | Unit test | Hook eliminado |
| `src/context/MapContext.test.tsx` | Unit test | Context eliminado |
| `shared/userOwnedCollections.test.ts` | Unit test | Duplicado eliminado |

### Criterios de testing

- Cobertura >= 80% del codigo restante se mantiene (no se agrega codigo nuevo)
- `npm run test:run` pasa sin errores despues de las eliminaciones
- `npm run test:coverage` no baja de los thresholds actuales
- Build (`npm run build`) completa sin errores (confirma que nada importaba los archivos eliminados)

---

## Seguridad

Este feature solo elimina codigo. No agrega superficies de ataque ni modifica logica de negocio.

- [x] No se exponen nuevos endpoints ni colecciones
- [x] No se modifican Firestore rules
- [x] No se cambian Cloud Functions
- [x] No se agregan inputs de usuario

### Vectores de ataque automatizado

No aplica -- este feature no agrega superficies expuestas.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #229 EditorsDialog / #230 InviteEditorDialog / IconPicker | Excluidos explicitamente | No tocar, tienen issues propios |
| #231 useColorMode / ColorModeContext | Excluido explicitamente | No tocar, tiene issue propio |

### Mitigacion incorporada

- Se elimina `shared/userOwnedCollections.ts` (top-level) que es un duplicado confuso de `functions/src/shared/userOwnedCollections.ts`. Esto reduce el riesgo de que un desarrollador importe el archivo equivocado.
- Se elimina `MapContext.tsx` que esta marcado `@deprecated` pero seguia presente, eliminando la ambiguedad con `SelectionContext` + `FiltersContext`.
- Se limpian constantes muertas en `MSG_COMMON` que podrian confundir a un desarrollador que intente usarlas.

---

## Offline

No aplica -- este feature no modifica data flows ni agrega/cambia lecturas o escrituras.

### Data flows

Ninguno.

### Checklist offline

- [x] No se agregan lecturas de Firestore
- [x] No se agregan escrituras
- [x] No se agregan llamadas a APIs externas
- [x] No se cambia UI offline

### Esfuerzo offline adicional: Ninguno

---

## Modularizacion y % monolitico

Este feature **reduce** el porcentaje monolitico al eliminar codigo muerto que ensucia el codebase.

### Checklist modularizacion

- [x] No se agrega logica de negocio inline
- [x] No se agregan componentes nuevos
- [x] No se agregan useState a TabShell o MapAppShell
- [x] No se agregan dependencias implicitas
- [x] No se agregan props con noop handlers
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] No se agregan archivos nuevos
- [x] No se agregan contextos nuevos
- [x] No se superan 400 lineas en ningun archivo

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Se eliminan 8 componentes huerfanos, reduciendo superficie |
| Estado global | - | Se elimina MapContext deprecated |
| Firebase coupling | = | No se modifica |
| Organizacion por dominio | - | Se elimina el duplicado top-level shared/userOwnedCollections.ts |

---

## Success Criteria

1. Los 17 archivos muertos (8 componentes + 4 hooks + 1 context + 1 barrel + 1 shared duplicado + constantes) estan eliminados del codebase
2. Los 6 archivos de test asociados estan eliminados
3. `npm run build` completa sin errores
4. `npm run test:run` pasa sin errores (frontend y functions)
5. `npm run test:coverage` mantiene >= 80% en todas las metricas
6. Docs de referencia (tests.md, patterns.md, project-reference.md) reflejan el nuevo estado
