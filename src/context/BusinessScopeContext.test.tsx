import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { BusinessScopeProvider, useBusinessScope } from './BusinessScopeContext';
import type { BusinessScope } from './BusinessScopeContext';

const makeScope = (overrides: Partial<BusinessScope> = {}): BusinessScope => ({
  businessId: 'biz-1',
  businessName: 'Café Test',
  location: { lat: -34.6, lng: -58.4 },
  ...overrides,
});

describe('BusinessScopeContext', () => {
  it('useBusinessScope tira error cuando se usa fuera del provider', () => {
    // Suppress React's error log for expected error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useBusinessScope())).toThrow(
      'useBusinessScope must be used within BusinessScopeProvider',
    );
    consoleErrorSpy.mockRestore();
  });

  it('provee el scope al subárbol', () => {
    const scope = makeScope();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BusinessScopeProvider scope={scope}>{children}</BusinessScopeProvider>
    );

    const { result } = renderHook(() => useBusinessScope(), { wrapper });

    expect(result.current.businessId).toBe('biz-1');
    expect(result.current.businessName).toBe('Café Test');
    expect(result.current.location).toEqual({ lat: -34.6, lng: -58.4 });
  });

  it('memoiza el value: primitivas iguales no cambian la referencia', () => {
    const wrapper = ({ children, scope }: { children: ReactNode; scope: BusinessScope }) => (
      <BusinessScopeProvider scope={scope}>{children}</BusinessScopeProvider>
    );

    const initial = makeScope();
    const { result, rerender } = renderHook(() => useBusinessScope(), {
      wrapper: ({ children }) => wrapper({ children, scope: initial }),
    });
    const firstValue = result.current;

    // Reconstruir un objeto con idénticas primitivas (padre suele recrearlo)
    const sameScope = makeScope();
    rerender({ scope: sameScope });

    expect(result.current).toBe(firstValue);
  });

  it('actualiza el value cuando cambia businessId', () => {
    const wrapper = ({ children, scope }: { children: ReactNode; scope: BusinessScope }) => (
      <BusinessScopeProvider scope={scope}>{children}</BusinessScopeProvider>
    );

    const initial = makeScope({ businessId: 'biz-a' });
    const { result, rerender } = renderHook(() => useBusinessScope(), {
      wrapper: ({ children }) => wrapper({ children, scope: initial }),
    });
    expect(result.current.businessId).toBe('biz-a');

    rerender({ scope: makeScope({ businessId: 'biz-b' }) });
    expect(result.current.businessId).toBe('biz-b');
  });

  it('renderiza children dentro del provider sin crashear', () => {
    const { getByText } = render(
      <BusinessScopeProvider scope={makeScope()}>
        <div>hijo</div>
      </BusinessScopeProvider>,
    );
    expect(getByText('hijo')).toBeInTheDocument();
  });
});
