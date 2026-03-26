import type { ReactNode } from 'react';
import { SelectionProvider, useSelection, SelectionContext } from './SelectionContext';
import { FiltersProvider, useFilters, FiltersContext } from './FiltersContext';

/**
 * Combined provider — wraps SelectionProvider + FiltersProvider.
 * Used by SearchScreen (tab Buscar) where both contexts are needed.
 * Other tabs only need SelectionProvider.
 */
export function MapProvider({ children }: { children: ReactNode }) {
  return (
    <SelectionProvider>
      <FiltersProvider>
        {children}
      </FiltersProvider>
    </SelectionProvider>
  );
}

/** @deprecated Use useSelection() or useFilters() directly */
export function useMapContext() {
  const selection = useSelection();
  const filters = useFilters();
  return { ...selection, ...filters };
}

// Re-exports for backward compatibility
export { SelectionProvider, useSelection, SelectionContext };
export { FiltersProvider, useFilters, FiltersContext };
