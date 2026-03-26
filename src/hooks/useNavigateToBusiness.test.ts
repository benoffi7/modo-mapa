import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
}));
import { createElement } from 'react';
import { SelectionProvider, useSelection } from '../context/SelectionContext';
import { TabProvider, useTab } from '../context/TabContext';
import { useNavigateToBusiness } from './useNavigateToBusiness';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SelectionProvider, null,
    createElement(TabProvider, null, children)
  );
}

describe('useNavigateToBusiness', () => {
  it('selects business by object and switches to buscar tab', () => {
    const { result } = renderHook(() => {
      const { navigateToBusiness } = useNavigateToBusiness();
      const { selectedBusiness } = useSelection();
      const { activeTab } = useTab();
      return { navigateToBusiness, selectedBusiness, activeTab };
    }, { wrapper });

    const biz = { id: 'biz_001', name: 'Test', address: 'Av. 1', category: 'cafe' as const, lat: -34.6, lng: -58.3, tags: [], phone: null };

    act(() => result.current.navigateToBusiness(biz));

    expect(result.current.selectedBusiness).toEqual(biz);
    expect(result.current.activeTab).toBe('buscar');
  });

  it('selects business by ID string from allBusinesses', () => {
    const { result } = renderHook(() => {
      const { navigateToBusiness } = useNavigateToBusiness();
      const { selectedBusiness } = useSelection();
      const { activeTab } = useTab();
      return { navigateToBusiness, selectedBusiness, activeTab };
    }, { wrapper });

    // biz_001 exists in allBusinesses (from businesses.json)
    act(() => result.current.navigateToBusiness('biz_001'));

    expect(result.current.selectedBusiness).not.toBeNull();
    expect(result.current.selectedBusiness?.id).toBe('biz_001');
    expect(result.current.activeTab).toBe('buscar');
  });

  it('does nothing for invalid business ID', () => {
    const { result } = renderHook(() => {
      const { navigateToBusiness } = useNavigateToBusiness();
      const { selectedBusiness } = useSelection();
      return { navigateToBusiness, selectedBusiness };
    }, { wrapper });

    act(() => result.current.navigateToBusiness('nonexistent_id'));

    expect(result.current.selectedBusiness).toBeNull();
  });
});
