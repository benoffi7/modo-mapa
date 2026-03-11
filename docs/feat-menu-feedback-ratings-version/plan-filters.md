# Plan Técnico: Filtros y ordenamiento en listas del menú

**Issue:** #11 (extensión)
**Fecha:** 2026-03-11

## Orden de implementación

### Paso 1: Crear `src/hooks/useListFilters.ts`

- Definir tipos `SortOption`, `FilterableItem`, `UseListFiltersOptions`, `UseListFiltersReturn<T>`
- Implementar hook con estados: `searchQuery`, `categoryFilter`, `minScore`, `sortBy`
- Lógica de filtrado:
  1. Excluir items con `business === null`
  2. Filtrar por `business.name` conteniendo `searchQuery` (case-insensitive)
  3. Filtrar por `business.category === categoryFilter` (si no es null)
  4. Filtrar por `score >= minScore` (si `enableScoreFilter` y `minScore` no es null)
- Lógica de ordenamiento según `sortBy`:
  - `date-desc` / `date-asc`: por campo `updatedAt` o `createdAt`
  - `name-asc` / `name-desc`: por `business.name`
  - `score-desc` / `score-asc`: por `score` (solo ratings)
- Usar `useMemo` para recalcular solo cuando cambien inputs
- Exportar tipos necesarios

### Paso 2: Crear `src/components/menu/ListFilters.tsx`

- Importar tipos de `useListFilters`
- Importar `CATEGORY_LABELS` de `types/index.ts`
- Renderizar:
  - `TextField` size small con ícono Search, placeholder "Buscar..."
  - Fila de `Chip` scrollable horizontal con categorías (filled/primary si activo, click toggle)
  - Fila de `Chip` para estrellas "1+", "2+", "3+", "4+", "5" (solo si `showScoreFilter`, click toggle)
  - `Select` size small con opciones de orden (varían según `showScoreFilter`)
  - `Typography` caption "N de M" (solo si hay filtros activos, es decir filtered !== total)
- Layout: `Box` vertical con `gap: 1`, `px: 2`, `py: 1`
- Scroll horizontal para chips: `display: flex`, `overflowX: auto`, `flexWrap: nowrap`

### Paso 3: Modificar `src/components/menu/RatingsList.tsx`

- Importar `useListFilters` y `ListFilters`
- Llamar al hook con `enableScoreFilter: true` pasando `ratings` (filtrar los que tienen `business !== null` ya lo hace el hook)
- Agregar interfaz extendida para que el hook tenga acceso a `score` y `updatedAt`
- Renderizar `<ListFilters>` entre el estado de carga y la lista
- Reemplazar `ratings.map(...)` por `filtered.map(...)`
- Remover el `.sort()` manual (lo hace el hook)

### Paso 4: Modificar `src/components/menu/FavoritesList.tsx`

- Importar `useListFilters` y `ListFilters`
- Llamar al hook sin `enableScoreFilter`
- Renderizar `<ListFilters>` entre el estado de carga y la lista
- Reemplazar el array directo por `filtered`
- Asegurar que los items tengan `createdAt` para ordenar por fecha

### Paso 5: Verificar tipos en `src/types/index.ts`

- Verificar que `BusinessCategory` y `CATEGORY_LABELS` están exportados (ya lo están)
- No agregar `SortOption` aquí — se exporta desde el hook

## Dependencias entre pasos

```
Paso 1 (hook) ──┬──→ Paso 3 (RatingsList)
                 │
Paso 2 (UI)   ──┼──→ Paso 4 (FavoritesList)
                 │
                 └──→ Paso 5 (tipos - verificación)
```

Pasos 1 y 2 son independientes. Pasos 3 y 4 dependen de ambos.

## Notas

- No se necesitan cambios en Firestore ni en las reglas de seguridad
- El filtrado es 100% client-side
- Los filtros se resetean automáticamente al desmontar el componente (estados locales del hook)
