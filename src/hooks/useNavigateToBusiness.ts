import { useCallback } from 'react';
import { useSelection } from '../context/SelectionContext';
import { useTab } from '../context/TabContext';
import { getBusinessById } from '../utils/businessMap';
import type { Business } from '../types';

/**
 * Standard behavior for navigating to a business from any tab:
 * 1. Switches to the Buscar tab
 * 2. Sets the selected business (opens BusinessSheet + centers map)
 *
 * Accepts either a Business object or a business ID string.
 */
export function useNavigateToBusiness() {
  const { setSelectedBusiness } = useSelection();
  const { setActiveTab } = useTab();

  const navigateToBusiness = useCallback((businessOrId: Business | string) => {
    const biz = typeof businessOrId === 'string'
      ? getBusinessById(businessOrId) ?? null
      : businessOrId;
    if (biz) {
      setActiveTab('buscar');
      setSelectedBusiness(biz);
    }
  }, [setSelectedBusiness, setActiveTab]);

  return { navigateToBusiness };
}
