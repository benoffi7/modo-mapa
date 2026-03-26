import { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Business } from '../types';

interface SelectionContextType {
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
  activeSharedListId: string | null;
  setActiveSharedListId: (id: string | null) => void;
}

const SelectionContext = createContext<SelectionContextType>({
  selectedBusiness: null,
  setSelectedBusiness: () => {},
  activeSharedListId: null,
  setActiveSharedListId: () => {},
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [activeSharedListId, setActiveSharedListId] = useState<string | null>(null);

  const value = useMemo<SelectionContextType>(() => ({
    selectedBusiness,
    setSelectedBusiness,
    activeSharedListId,
    setActiveSharedListId,
  }), [selectedBusiness, activeSharedListId]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export const useSelection = () => useContext(SelectionContext);
export { SelectionContext };
