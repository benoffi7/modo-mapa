import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TabId, SocialSubTab, ListsSubTab } from '../types';

interface SearchFilter {
  type: 'category' | 'tag' | 'text';
  value: string;
}

interface TabContextType {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  socialSubTab: SocialSubTab;
  setSocialSubTab: (tab: SocialSubTab) => void;
  listsSubTab: ListsSubTab;
  setListsSubTab: (tab: ListsSubTab) => void;
  searchFilter: SearchFilter | null;
  setSearchFilter: (filter: SearchFilter | null) => void;
}

const TabContext = createContext<TabContextType>({
  activeTab: 'buscar',
  setActiveTab: () => {},
  socialSubTab: 'actividad',
  setSocialSubTab: () => {},
  listsSubTab: 'favoritos',
  setListsSubTab: () => {},
  searchFilter: null,
  setSearchFilter: () => {},
});

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTabRaw] = useState<TabId>('buscar');
  const [socialSubTab, setSocialSubTab] = useState<SocialSubTab>('actividad');
  const [listsSubTab, setListsSubTab] = useState<ListsSubTab>('favoritos');
  const [searchFilter, setSearchFilter] = useState<SearchFilter | null>(null);

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabRaw(tab);
  }, []);

  const value = useMemo<TabContextType>(() => ({
    activeTab,
    setActiveTab,
    socialSubTab,
    setSocialSubTab,
    listsSubTab,
    setListsSubTab,
    searchFilter,
    setSearchFilter,
  }), [activeTab, setActiveTab, socialSubTab, listsSubTab, searchFilter]);

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

export const useTab = () => useContext(TabContext);
export { TabContext };
export type { SearchFilter };
