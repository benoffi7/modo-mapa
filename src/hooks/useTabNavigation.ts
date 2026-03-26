import { useCallback } from 'react';
import { useTab } from '../context/TabContext';
import type { SocialSubTab, ListsSubTab } from '../types';
import type { SearchFilter } from '../context/TabContext';

/**
 * Cross-tab navigation helpers.
 * Used by Quick Actions, "Para ti" cards, recommendations, etc.
 */
export function useTabNavigation() {
  const { setActiveTab, setSocialSubTab, setListsSubTab, setSearchFilter } = useTab();

  const navigateToSearchWithFilter = useCallback((filter: SearchFilter) => {
    setSearchFilter(filter);
    setActiveTab('buscar');
  }, [setActiveTab, setSearchFilter]);

  const navigateToSearch = useCallback(() => {
    setSearchFilter(null);
    setActiveTab('buscar');
  }, [setActiveTab, setSearchFilter]);

  const navigateToSocialSubTab = useCallback((subTab: SocialSubTab) => {
    setSocialSubTab(subTab);
    setActiveTab('social');
  }, [setActiveTab, setSocialSubTab]);

  const navigateToListsSubTab = useCallback((subTab: ListsSubTab) => {
    setListsSubTab(subTab);
    setActiveTab('listas');
  }, [setActiveTab, setListsSubTab]);

  return {
    navigateToSearch,
    navigateToSearchWithFilter,
    navigateToSocialSubTab,
    navigateToListsSubTab,
  };
}
