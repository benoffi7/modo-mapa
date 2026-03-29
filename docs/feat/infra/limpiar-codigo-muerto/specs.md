# Specs: Limpiar codigo muerto del rediseno

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

Este feature no agrega ni modifica colecciones, documentos, indices ni tipos de Firestore. Solo elimina codigo del frontend y un archivo compartido duplicado.

### Constantes afectadas

En `src/constants/messages/common.ts`, se eliminan dos propiedades de `MSG_COMMON`:

- `genericError` -- sin consumidores en `src/`
- `noResults` -- sin consumidores en `src/`

Las propiedades restantes (`noUsersFound`, `publicProfileHint`) se mantienen.

---

## Firestore Rules

No se modifican Firestore rules.

### Rules impact analysis

No aplica -- este feature no agrega queries.

### Field whitelist check

No aplica -- no se agregan ni modifican campos.

---

## Cloud Functions

No se modifican Cloud Functions. El archivo `functions/src/shared/userOwnedCollections.ts` (la copia canonica) no se toca. Solo se elimina el duplicado top-level `shared/userOwnedCollections.ts` que no tiene consumidores en `src/`.

---

## Componentes

### Componentes eliminados (8)

| Archivo | Dominio | Razon de eliminacion |
|---------|---------|---------------------|
| `src/components/business/InlineReplyForm.tsx` | business | Sin importaciones en produccion |
| `src/components/business/QuestionInput.tsx` | business | Sin importaciones en produccion |
| `src/components/home/RecentVisits.tsx` | home | Reemplazado por nueva arquitectura de tabs |
| `src/components/home/SuggestionsView.tsx` | home | Reemplazado por nueva arquitectura de tabs |
| `src/components/profile/CheckInsView.tsx` | profile | Sin importaciones en produccion |
| `src/components/profile/CommentItem.tsx` | profile | Sin importaciones en produccion |
| `src/components/lists/SharedListDetailView.tsx` | lists | Reemplazado por `ListDetailScreen` |
| `src/components/notifications/NotificationList.tsx` | notifications | Reemplazado por nueva arquitectura de tabs |

### Mutable prop audit

No aplica -- no se agregan ni modifican componentes.

---

## Textos de usuario

No se agregan textos visibles al usuario. Se eliminan dos constantes de mensajes no consumidas (`MSG_COMMON.genericError` y `MSG_COMMON.noResults`).

---

## Hooks

### Hooks eliminados (4)

| Archivo | Test asociado | Razon |
|---------|---------------|-------|
| `src/hooks/useCommentSort.ts` | `src/hooks/useCommentSort.test.ts` (4 cases) | Solo referenciado por su test |
| `src/hooks/useCommentThreads.ts` | `src/hooks/useCommentThreads.test.ts` (5 cases) | Solo referenciado por su test |
| `src/hooks/useOptimisticLikes.ts` | `src/hooks/useOptimisticLikes.test.ts` (6 cases) | Solo referenciado por su test |
| `src/components/business/useQuestionThreads.ts` | `src/components/business/useQuestionThreads.test.ts` (6 cases) | Solo referenciado por su test |

**Nota:** `useCommentEdit`, `useCommentsListFilters`, `useVerificationCooldown` y `useVirtualizedList` (tambien extraidos en #195) NO se eliminan porque tienen consumidores activos.

---

## Servicios

### Barrel export eliminado

`src/services/index.ts` -- barrel re-export sin consumidores. Todos los archivos en `src/` importan directamente de `services/favorites`, `services/ratings`, etc.

---

## Context eliminado

`src/context/MapContext.tsx` + `src/context/MapContext.test.tsx` (21 cases) -- marcado `@deprecated`, reemplazado completamente por `SelectionContext` + `FiltersContext` en la arquitectura de tabs.

---

## Shared duplicado eliminado

`shared/userOwnedCollections.ts` + `shared/userOwnedCollections.test.ts` (8 cases) -- duplicado del archivo canonico en `functions/src/shared/userOwnedCollections.ts`. El frontend no importa este archivo. Solo `functions/src/utils/deleteUserData.ts` lo consume, y lo hace desde la copia en `functions/src/shared/`.

---

## Integracion

Este feature no requiere modificar codigo existente en produccion. Todas las eliminaciones son de archivos huerfanos sin consumidores.

### Verificacion de ausencia de consumidores

Verificado via `grep -r` que ninguno de los 17 archivos a eliminar es importado desde codigo activo en `src/` o `functions/src/`:

- 8 componentes: 0 importaciones
- 4 hooks: 0 importaciones (solo sus propios tests)
- 1 context: 0 importaciones (solo su propio test)
- 1 barrel (`services/index.ts`): 0 importaciones
- 1 shared duplicado: 0 importaciones desde `src/`
- 2 constantes (`MSG_COMMON.genericError`, `MSG_COMMON.noResults`): 0 usos

### Preventive checklist

- [x] **Service layer**: No aplica -- solo eliminaciones
- [x] **Duplicated constants**: Se elimina el duplicado `shared/userOwnedCollections.ts`
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No aplica
- [x] **Stale props**: No aplica

---

## Tests

Este feature **elimina** 6 archivos de test con 50 test cases en total. No requiere tests nuevos.

### Archivos de test eliminados

| Archivo test | Cases | Tipo |
|-------------|-------|------|
| `src/hooks/useCommentSort.test.ts` | 4 | Unit test de hook muerto |
| `src/hooks/useCommentThreads.test.ts` | 5 | Unit test de hook muerto |
| `src/hooks/useOptimisticLikes.test.ts` | 6 | Unit test de hook muerto |
| `src/components/business/useQuestionThreads.test.ts` | 6 | Unit test de hook muerto |
| `src/context/MapContext.test.tsx` | 21 | Unit test de context muerto |
| `shared/userOwnedCollections.test.ts` | 8 | Unit test de shared duplicado |

### Criterios de validacion

- `npm run build` completa sin errores
- `npm run test:run` pasa sin errores
- `npm run test:coverage` mantiene >= 80% en todas las metricas (la cobertura deberia subir porque se elimina codigo muerto que no contaba como cubierto por tests activos)

---

## Analytics

No se agregan ni modifican eventos de analytics.

---

## Offline

No aplica -- este feature no modifica data flows.

---

## Decisiones tecnicas

1. **No se eliminan hooks con consumidores activos**: `useCommentEdit`, `useCommentsListFilters`, `useVerificationCooldown`, `useVirtualizedList` se mencionan en #195 junto con los 4 hooks eliminados, pero estos tienen importaciones activas en produccion.

2. **Se mantienen `MSG_COMMON.noUsersFound` y `MSG_COMMON.publicProfileHint`**: aunque son parte del mismo objeto, tienen consumidores activos (user search).

3. **El shared/ top-level no se elimina como directorio**: solo se elimina el archivo `userOwnedCollections.ts` y su test. Si el directorio queda vacio, git lo elimina automaticamente.

4. **No se eliminan archivos excluidos por el PRD**: `EditorsDialog` (#229), `InviteEditorDialog` (#230), `IconPicker` (#229), `useColorMode` (#231) y `ColorModeContext` (#231) tienen issues propios.

---

## Hardening de seguridad

No aplica -- este feature solo elimina codigo. No agrega superficies de ataque.

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos con label `security` o `tech debt` en el repo.

Este feature en si mismo **es** mitigacion de deuda tecnica:

| Aspecto | Mejora |
|---------|--------|
| Codigo muerto | -17 archivos, -23 archivos contando tests |
| Duplicado confuso | Elimina `shared/userOwnedCollections.ts` top-level (canonico esta en `functions/src/shared/`) |
| Context deprecated | Elimina `MapContext.tsx` que generaba ambiguedad |
| Metricas de test infladas | -50 test cases que cubrian codigo muerto |
| Constantes muertas | -2 propiedades no consumidas en `MSG_COMMON` |

---

## Documentacion afectada

Los siguientes docs de referencia contienen menciones a archivos/hooks/componentes eliminados y requieren actualizacion:

| Doc | Mencion a actualizar |
|-----|---------------------|
| `docs/reference/tests.md` | Fila de `MapContext.test.tsx` en inventario. Total de test files y cases. Filas de `useCommentSort.test.ts`, `useCommentThreads.test.ts`, `useOptimisticLikes.test.ts` si aparecen |
| `docs/reference/patterns.md` | Linea 50: mencion a `useOptimisticLikes`, `useCommentSort`, `useCommentThreads`, `useQuestionThreads` en "Optimistic UI" y "Extracted hooks (#195)". Linea 170: mencion a `RecentVisits`. Linea 171: mencion a `SuggestionsView`. Linea 194: mencion a `QuestionInput` |
| `docs/reference/project-reference.md` | Linea 98: mencion a `shared/userOwnedCollections.ts`. Linea 99: lista de extracted hooks. Linea 103: total de tests |
| `docs/reference/features.md` | Linea 30: menciones a `useOptimisticLikes`, `useCommentSort`, `useCommentThreads`, `useQuestionThreads`, `QuestionInput`. Linea 54: mencion a `SuggestionsView`. Linea 321: mencion a `SuggestionsView` |
| `docs/reference/files.md` | Entradas de `MapContext.tsx`, `SuggestionsView.tsx`, `RecentVisits.tsx`, `CheckInsView.tsx`, `SharedListDetailView.tsx` |
| `docs/reference/data-layer.md` | Linea 85: mencion a `RecentVisits` |
| `docs/reference/coding-standards.md` | Linea 280: mencion a `MapContext` |
| `docs/reference/design-system.md` | Lineas 90-92: menciones a `CommentItem.tsx` e `InlineReplyForm.tsx` |
