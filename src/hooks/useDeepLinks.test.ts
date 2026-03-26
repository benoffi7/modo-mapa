import { renderHook } from '@testing-library/react';
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
import { MemoryRouter } from 'react-router-dom';
import { SelectionProvider, useSelection } from '../context/SelectionContext';
import { TabProvider, useTab } from '../context/TabContext';
import { useDeepLinks } from './useDeepLinks';

function createWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries },
      createElement(SelectionProvider, null,
        createElement(TabProvider, null, children)
      )
    );
  };
}

describe('useDeepLinks', () => {
  it('opens business from ?business=biz_001', () => {
    const wrapper = createWrapper(['/?business=biz_001']);

    const { result } = renderHook(() => {
      useDeepLinks();
      const { selectedBusiness } = useSelection();
      const { activeTab } = useTab();
      return { selectedBusiness, activeTab };
    }, { wrapper });

    expect(result.current.selectedBusiness?.id).toBe('biz_001');
    expect(result.current.activeTab).toBe('buscar');
  });

  it('switches tab from ?tab=social', () => {
    const wrapper = createWrapper(['/?tab=social']);

    const { result } = renderHook(() => {
      useDeepLinks();
      const { activeTab } = useTab();
      return { activeTab };
    }, { wrapper });

    expect(result.current.activeTab).toBe('social');
  });

  it('switches tab from ?tab=perfil', () => {
    const wrapper = createWrapper(['/?tab=perfil']);

    const { result } = renderHook(() => {
      useDeepLinks();
      const { activeTab } = useTab();
      return { activeTab };
    }, { wrapper });

    expect(result.current.activeTab).toBe('perfil');
  });

  it('ignores invalid tab parameter', () => {
    const wrapper = createWrapper(['/?tab=invalid']);

    const { result } = renderHook(() => {
      useDeepLinks();
      const { activeTab } = useTab();
      return { activeTab };
    }, { wrapper });

    // Should stay on default tab (buscar)
    expect(result.current.activeTab).toBe('buscar');
  });

  it('ignores malformed business ID', () => {
    const wrapper = createWrapper(['/?business=malicious_script']);

    const { result } = renderHook(() => {
      useDeepLinks();
      const { selectedBusiness } = useSelection();
      return { selectedBusiness };
    }, { wrapper });

    expect(result.current.selectedBusiness).toBeNull();
  });

  it('handles both business and tab params', () => {
    const wrapper = createWrapper(['/?business=biz_001&tab=listas']);

    const { result } = renderHook(() => {
      useDeepLinks();
      const { selectedBusiness } = useSelection();
      const { activeTab } = useTab();
      return { selectedBusiness, activeTab };
    }, { wrapper });

    // business param takes precedence (switches to buscar)
    expect(result.current.selectedBusiness?.id).toBe('biz_001');
    // But tab param was also processed — last write wins
    // In the code, business sets buscar, then tab sets listas
    expect(result.current.activeTab).toBe('listas');
  });
});
