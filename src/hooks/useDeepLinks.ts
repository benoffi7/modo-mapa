import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelection } from '../context/SelectionContext';
import { useTab } from '../context/TabContext';
import { getBusinessById } from '../utils/businessMap';
import { ALL_TAB_IDS } from '../types';
import type { TabId } from '../types';
import { BUSINESS_ID_REGEX } from '../constants/validation';
import { STORAGE_KEY_LAST_BUSINESS_SHEET } from '../constants/storage';

/**
 * Handles URL deep links on mount:
 * - ?business=biz_001 → selects the business and switches to Buscar tab
 * - ?tab=social → switches to the specified tab
 */
export function useDeepLinks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedBusiness } = useSelection();
  const { setActiveTab } = useTab();

  useEffect(() => {
    let changed = false;

    const bizId = searchParams.get('business');
    if (bizId && BUSINESS_ID_REGEX.test(bizId)) {
      const biz = getBusinessById(bizId);
      if (biz) {
        setActiveTab('buscar');
        setSelectedBusiness(biz);
      }
      searchParams.delete('business');
      changed = true;
    } else if (bizId) {
      searchParams.delete('business');
      changed = true;
    }

    const tabParam = searchParams.get('tab');
    if (tabParam && ALL_TAB_IDS.includes(tabParam as TabId)) {
      setActiveTab(tabParam as TabId);
      searchParams.delete('tab');
      changed = true;
    }

    if (changed) {
      setSearchParams(searchParams, { replace: true });
    }

    const lastBusinessId = sessionStorage.getItem(STORAGE_KEY_LAST_BUSINESS_SHEET);
    if (lastBusinessId && BUSINESS_ID_REGEX.test(lastBusinessId)) {
      const lastBusiness = getBusinessById(lastBusinessId);
      if (lastBusiness) {
        setActiveTab('buscar');
        setSelectedBusiness(lastBusiness);
      }
    }
    try { sessionStorage.removeItem(STORAGE_KEY_LAST_BUSINESS_SHEET); } catch (e) { void e; }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);
}
