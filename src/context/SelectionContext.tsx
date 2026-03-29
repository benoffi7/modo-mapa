import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Business } from '../types';

export type BusinessSheetTab = 'info' | 'opiniones';

interface SelectionContextType {
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
  activeSharedListId: string | null;
  setActiveSharedListId: (id: string | null) => void;
  selectedBusinessTab: BusinessSheetTab | null;
  setSelectedBusinessTab: (tab: BusinessSheetTab | null) => void;
}

const SelectionContext = createContext<SelectionContextType>({
  selectedBusiness: null,
  setSelectedBusiness: () => {},
  activeSharedListId: null,
  setActiveSharedListId: () => {},
  selectedBusinessTab: null,
  setSelectedBusinessTab: () => {},
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedBusiness, setSelectedBusinessRaw] = useState<Business | null>(null);
  const [activeSharedListId, setActiveSharedListId] = useState<string | null>(null);
  const [selectedBusinessTab, setSelectedBusinessTab] = useState<BusinessSheetTab | null>(null);

  const setSelectedBusiness = useCallback((business: Business | null) => {
    setSelectedBusinessRaw(business);
    if (!business) setSelectedBusinessTab(null);
  }, []);

  const value = useMemo<SelectionContextType>(() => ({
    selectedBusiness,
    setSelectedBusiness,
    activeSharedListId,
    setActiveSharedListId,
    selectedBusinessTab,
    setSelectedBusinessTab,
  }), [selectedBusiness, setSelectedBusiness, activeSharedListId, selectedBusinessTab]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export const useSelection = () => useContext(SelectionContext);
export { SelectionContext };
