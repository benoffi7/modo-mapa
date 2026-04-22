import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface BusinessScopeLocation {
  lat: number;
  lng: number;
}

export interface BusinessScope {
  businessId: string;
  businessName: string;
  location: BusinessScopeLocation;
}

const BusinessScopeContext = createContext<BusinessScope | null>(null);

interface BusinessScopeProviderProps {
  scope: BusinessScope;
  children: ReactNode;
}

/**
 * Provider local al subárbol de BusinessSheetContent.
 * Evita el prop-drilling de `businessId` / `businessName` / `location`
 * a través de 11+ componentes del dominio Business.
 *
 * Consumidores: `useBusinessScope()`. Lanza error si se usa fuera del
 * provider para falla explícita y temprana.
 */
export function BusinessScopeProvider({ scope, children }: BusinessScopeProviderProps) {
  const value = useMemo<BusinessScope>(
    () => ({
      businessId: scope.businessId,
      businessName: scope.businessName,
      location: { lat: scope.location.lat, lng: scope.location.lng },
    }),
    [scope.businessId, scope.businessName, scope.location.lat, scope.location.lng],
  );

  return (
    <BusinessScopeContext.Provider value={value}>
      {children}
    </BusinessScopeContext.Provider>
  );
}

export function useBusinessScope(): BusinessScope {
  const ctx = useContext(BusinessScopeContext);
  if (!ctx) {
    throw new Error('useBusinessScope must be used within BusinessScopeProvider');
  }
  return ctx;
}

export function useOptionalBusinessScope(): BusinessScope | null {
  return useContext(BusinessScopeContext);
}
