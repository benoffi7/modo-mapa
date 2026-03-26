import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { TabProvider, useTab } from '../context/TabContext';
import { useTabNavigation } from './useTabNavigation';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(TabProvider, null, children);
}

describe('useTabNavigation', () => {
  describe('navigateToSearchWithFilter', () => {
    it('sets active tab to buscar and applies text filter', () => {
      const { result } = renderHook(() => {
        const nav = useTabNavigation();
        const tab = useTab();
        return { nav, tab };
      }, { wrapper });

      act(() => result.current.nav.navigateToSearchWithFilter({ type: 'text', value: 'pizza' }));

      expect(result.current.tab.activeTab).toBe('buscar');
      expect(result.current.tab.searchFilter).toEqual({ type: 'text', value: 'pizza' });
    });
  });

  describe('navigateToSearch', () => {
    it('sets active tab to buscar and clears filter', () => {
      const { result } = renderHook(() => {
        const nav = useTabNavigation();
        const tab = useTab();
        return { nav, tab };
      }, { wrapper });

      // First set a filter
      act(() => result.current.nav.navigateToSearchWithFilter({ type: 'category', value: 'bar' }));
      expect(result.current.tab.searchFilter).not.toBeNull();

      // Then navigate to search without filter
      act(() => result.current.nav.navigateToSearch());
      expect(result.current.tab.activeTab).toBe('buscar');
      expect(result.current.tab.searchFilter).toBeNull();
    });
  });

  describe('navigateToSocialSubTab', () => {
    it('sets active tab to social and selects sub-tab', () => {
      const { result } = renderHook(() => {
        const nav = useTabNavigation();
        const tab = useTab();
        return { nav, tab };
      }, { wrapper });

      act(() => result.current.nav.navigateToSocialSubTab('rankings'));

      expect(result.current.tab.activeTab).toBe('social');
      expect(result.current.tab.socialSubTab).toBe('rankings');
    });
  });

  describe('navigateToListsSubTab', () => {
    it('sets active tab to listas and selects sub-tab', () => {
      const { result } = renderHook(() => {
        const nav = useTabNavigation();
        const tab = useTab();
        return { nav, tab };
      }, { wrapper });

      act(() => result.current.nav.navigateToListsSubTab('recientes'));

      expect(result.current.tab.activeTab).toBe('listas');
      expect(result.current.tab.listsSubTab).toBe('recientes');
    });

    it('navigates to favoritos sub-tab', () => {
      const { result } = renderHook(() => {
        const nav = useTabNavigation();
        const tab = useTab();
        return { nav, tab };
      }, { wrapper });

      act(() => result.current.nav.navigateToListsSubTab('favoritos'));

      expect(result.current.tab.activeTab).toBe('listas');
      expect(result.current.tab.listsSubTab).toBe('favoritos');
    });
  });
});
