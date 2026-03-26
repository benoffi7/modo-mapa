import { useCallback } from 'react';
import { useSelection } from '../context/SelectionContext';
import { allBusinesses } from './useBusinesses';
import type { Business } from '../types';

/**
 * Standard behavior for navigating to a business from any tab:
 * 1. Sets the selected business (opens BusinessSheet)
 * 2. In the future, will also switch to the Search tab
 *
 * Accepts either a Business object or a business ID string.
 */
export function useNavigateToBusiness() {
  const { setSelectedBusiness } = useSelection();

  const navigateToBusiness = useCallback((businessOrId: Business | string) => {
    if (typeof businessOrId === 'string') {
      const biz = allBusinesses.find((b) => b.id === businessOrId);
      if (biz) setSelectedBusiness(biz);
    } else {
      setSelectedBusiness(businessOrId);
    }
  }, [setSelectedBusiness]);

  return { navigateToBusiness };
}
