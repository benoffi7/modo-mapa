import { useEffect, useRef } from 'react';
import { useTab } from '../context/TabContext';
import type { TabId, SocialSubTab, ListsSubTab } from '../types';

/**
 * Calls `onActivate` every time the specified tab becomes the active tab.
 * Skips the initial mount (data already loads on mount).
 */
export function useTabRefresh(tabId: TabId, onActivate: () => void): void {
  const { activeTab } = useTab();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (activeTab === tabId) {
      onActivate();
    }
  }, [activeTab, tabId, onActivate]);
}

/**
 * Calls `onActivate` every time the specified sub-tab becomes active
 * within its parent tab.
 */
export function useSocialSubTabRefresh(subTabId: SocialSubTab, onActivate: () => void): void {
  const { activeTab, socialSubTab } = useTab();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (activeTab === 'social' && socialSubTab === subTabId) {
      onActivate();
    }
  }, [activeTab, socialSubTab, subTabId, onActivate]);
}

export function useListsSubTabRefresh(subTabId: ListsSubTab, onActivate: () => void): void {
  const { activeTab, listsSubTab } = useTab();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (activeTab === 'listas' && listsSubTab === subTabId) {
      onActivate();
    }
  }, [activeTab, listsSubTab, subTabId, onActivate]);
}
