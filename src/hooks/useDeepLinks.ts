import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelection } from '../context/SelectionContext';
import { useTab } from '../context/TabContext';
import { allBusinesses } from './useBusinesses';
import { ALL_TAB_IDS } from '../types';
import type { TabId } from '../types';
const BUSINESS_ID_RE = /^biz_\d{1,6}$/;

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
    if (bizId && BUSINESS_ID_RE.test(bizId)) {
      const biz = allBusinesses.find((b) => b.id === bizId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);
}
