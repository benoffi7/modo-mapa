import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { TabProvider, useTab } from './TabContext';

function wrapper({ children }: { children: ReactNode }) {
  return <TabProvider>{children}</TabProvider>;
}

describe('TabContext', () => {
  describe('defaults', () => {
    it('has buscar as default active tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      expect(result.current.activeTab).toBe('buscar');
    });

    it('has actividad as default social sub-tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      expect(result.current.socialSubTab).toBe('actividad');
    });

    it('has favoritos as default lists sub-tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      expect(result.current.listsSubTab).toBe('favoritos');
    });

    it('has null searchFilter by default', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      expect(result.current.searchFilter).toBeNull();
    });
  });

  describe('setActiveTab', () => {
    it('switches to inicio tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setActiveTab('inicio'));
      expect(result.current.activeTab).toBe('inicio');
    });

    it('switches to social tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setActiveTab('social'));
      expect(result.current.activeTab).toBe('social');
    });

    it('switches to perfil tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setActiveTab('perfil'));
      expect(result.current.activeTab).toBe('perfil');
    });
  });

  describe('sub-tabs', () => {
    it('sets social sub-tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setSocialSubTab('rankings'));
      expect(result.current.socialSubTab).toBe('rankings');
    });

    it('sets lists sub-tab', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setListsSubTab('recientes'));
      expect(result.current.listsSubTab).toBe('recientes');
    });
  });

  describe('searchFilter', () => {
    it('sets a category filter', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setSearchFilter({ type: 'category', value: 'restaurant' }));
      expect(result.current.searchFilter).toEqual({ type: 'category', value: 'restaurant' });
    });

    it('clears search filter with null', () => {
      const { result } = renderHook(() => useTab(), { wrapper });
      act(() => result.current.setSearchFilter({ type: 'text', value: 'cafe' }));
      act(() => result.current.setSearchFilter(null));
      expect(result.current.searchFilter).toBeNull();
    });
  });
});
