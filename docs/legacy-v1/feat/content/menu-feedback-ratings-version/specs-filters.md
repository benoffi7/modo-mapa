# Especificaciones Técnicas: Filtros y ordenamiento en listas del menú

**Issue:** #11 (extensión)
**Fecha:** 2026-03-11

## Archivos a crear

### 1. `src/hooks/useListFilters.ts`

Hook genérico para filtrado y ordenamiento de listas con items que tienen un `business` asociado.

```typescript
interface FilterableItem {
  business: Business | null;
}

interface UseListFiltersOptions {
  enableScoreFilter?: boolean; // solo para ratings
}

interface UseListFiltersReturn<T> {
  filtered: T[];
  total: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: BusinessCategory | null;
  setCategoryFilter: (c: BusinessCategory | null) => void;
  minScore: number | null;            // solo si enableScoreFilter
  setMinScore: (s: number | null) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'score-desc' | 'score-asc';
```

**Lógica:**

- Filtra por `business.name` conteniendo `searchQuery` (case-insensitive)
- Filtra por `business.category === categoryFilter` (si activo)
- Filtra por `score >= minScore` (si activo y enableScoreFilter)
- Ordena según `sortBy`
- Items con `business === null` se filtran siempre

### 2. `src/components/menu/ListFilters.tsx`

Componente visual de filtros, reutilizable.

**Props:**

```typescript
interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: BusinessCategory | null;
  onCategoryChange: (c: BusinessCategory | null) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  // Opcionales
  showScoreFilter?: boolean;
  minScore?: number | null;
  onMinScoreChange?: (s: number | null) => void;
  resultCount: number;
  totalCount: number;
}
```

**Render:**

- **Búsqueda**: `TextField` compacto (size small, placeholder "Buscar...", ícono Search)
- **Categorías**: fila de chips scrollable horizontal con CATEGORY_LABELS. Chip activo = filled/primary. Click en el activo lo desactiva (null).
- **Estrellas** (si `showScoreFilter`): fila de chips "1+", "2+", "3+", "4+", "5". Click activa/desactiva.
- **Orden**: `Select` compacto (size small) con opciones según contexto
- **Contador**: Typography caption "N de M" (solo si hay filtros activos)

Layout vertical compacto con `gap: 1`, padding `px: 2, py: 1`.

## Archivos a modificar

### 3. `src/components/menu/RatingsList.tsx`

- Importar y usar `useListFilters` con `enableScoreFilter: true`
- Pasar items con `{ ...rating, business, score }` al hook
- Renderizar `ListFilters` entre toolbar y lista
- Usar `filtered` del hook en vez del array directo
- Agregar campo `score` al interface para que el hook pueda ordenar

### 4. `src/components/menu/FavoritesList.tsx`

- Importar y usar `useListFilters` sin `enableScoreFilter`
- Pasar items con `{ ...fav, business }` al hook
- Renderizar `ListFilters` entre toolbar y lista (sin score filter)
- Usar `filtered` del hook

### 5. `src/types/index.ts`

- Exportar tipo `SortOption` si se necesita compartir (o definirlo en el hook)

## Opciones de ordenamiento por lista

**Favoritos:**

- Fecha (reciente/antiguo) — default: date-desc
- Nombre (A-Z / Z-A)

**Calificaciones:**

- Fecha (reciente/antiguo) — default: date-desc
- Nombre (A-Z / Z-A)
- Estrellas (mayor/menor)
