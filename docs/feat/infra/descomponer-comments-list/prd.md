# PRD: Descomponer CommentsList.tsx

**Feature:** descomponer-comments-list
**Categoria:** infra
**Fecha:** 2026-03-28
**Issue:** #220
**Prioridad:** Alta (merge blocker per file-size-directive)

---

## Contexto

`CommentsList.tsx` tiene actualmente 475 lineas, superando el limite de 400 establecido en `docs/reference/file-size-directive.md`. Esto lo convierte en merge blocker. El archivo ya tuvo extracciones previas en #195 (`useCommentsListFilters`, `useVirtualizedList`, `useCommentEdit`) y extracciones de UI (`CommentsStats`, `CommentsToolbar`), pero el componente principal sigue siendo demasiado grande debido al componente `CommentItem` (memo, ~180 lineas) incrustado en el mismo archivo y la duplicacion del renderizado de la lista normal vs. virtualizada.

## Problema

- `CommentsList.tsx` viola la directiva de tamano de archivos (475 > 400 lineas), lo que bloquea merges al branch principal
- El componente `CommentItem` (lineas 61-244) es un componente memo independiente que deberia vivir en su propio archivo, siguiendo el patron establecido con `CommentRow` en `BusinessComments`
- La logica de renderizado de la lista se duplica parcialmente entre el modo normal y el virtualizado (ambos instancian `CommentItem` con las mismas props)

## Solucion

### S1. Extraer `CommentItem` a archivo propio

Mover el componente `CommentItem` (memo, ~180 lineas) y su interfaz `CommentItemProps` a `src/components/menu/CommentsListItem.tsx`. El patron ya existe con `CommentRow` extraido de `BusinessComments` en #195.

### S2. Extraer wrapper de virtualizacion

Crear `CommentsListContent.tsx` que encapsule la logica de renderizado de la lista (normal y virtualizada). Recibe `filteredComments`, `shouldVirtualize`, `virtualizer`, `scrollContainerRef` y las props de `CommentItem` como un render callback o props directas. Esto elimina la duplicacion de la instanciacion de `CommentItem` en el archivo principal.

### S3. Simplificar CommentsList como orquestador

`CommentsList.tsx` queda como orquestador: hooks de datos, filtros, undo-delete, edit, swipe, y delega el renderizado a `CommentsListContent` + `PaginatedListShell`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Extraer `CommentItem` a `CommentsListItem.tsx` | P0 | S |
| Extraer `CommentsListContent.tsx` (lista normal + virtualizada) | P0 | S |
| Reducir `CommentsList.tsx` a orquestador | P0 | S |
| Verificar que imports y tipos se actualizan correctamente | P0 | S |
| Verificar lint y build pasan sin errores | P0 | S |

**Esfuerzo total estimado:** S (30 minutos, como indica el issue)

---

## Out of Scope

- Cambios funcionales o de comportamiento en CommentsList
- Refactorizar los hooks ya extraidos (`useCommentsListFilters`, `useVirtualizedList`, `useCommentEdit`)
- Agregar tests nuevos para logica existente (no hay logica nueva)
- Modificar `CommentsStats` o `CommentsToolbar` (ya estan extraidos)

---

## Tests

Este es un refactor puro de extraccion de componentes sin logica nueva. No se agregan tests nuevos.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | — | No hay logica nueva; es movimiento de codigo existente |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (no aplica: no hay codigo nuevo)
- Build y lint pasan sin errores
- La app funciona identicamente antes y despues del refactor
- Verificar que `CommentsList.tsx` queda por debajo de 400 lineas
- Verificar que ningun archivo nuevo supera 400 lineas

---

## Seguridad

No aplica. Este refactor no modifica flujos de datos, no agrega colecciones, no cambia inputs de usuario ni interactua con Firestore de forma diferente. Es una reorganizacion puramente estructural del mismo codigo.

---

## Offline

No aplica. El comportamiento offline existente (Firestore persistent cache, `useSwipeActions`, undo delete con timer) permanece identico. No se agregan ni modifican data flows.

### Esfuerzo offline adicional: N/A

---

## Modularizacion

Este PRD es precisamente sobre modularizacion. El objetivo es mejorar la separacion de componentes.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (ya extraida en #195 — `useCommentsListFilters`, `useVirtualizedList`, `useCommentEdit`)
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout — `CommentsListItem` es reutilizable como `CommentRow`
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout — `CommentsListItem` recibe todo via props
- [ ] Cada prop de accion tiene un handler real especificado — se propagan los mismos handlers existentes

---

## Success Criteria

1. `CommentsList.tsx` tiene menos de 300 lineas (objetivo: ~200 como orquestador)
2. Ningun archivo nuevo supera 400 lineas
3. `CommentsListItem.tsx` es un componente memo con props explicitas, siguiendo el patron de `CommentRow`
4. Build, lint y tests existentes pasan sin cambios
5. El comportamiento de la app es identico al actual (refactor sin cambios funcionales)
