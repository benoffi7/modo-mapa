import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelection } from '../context/SelectionContext';
import { allBusinesses } from './useBusinesses';

/**
 * Handles URL deep links on mount:
 * - ?business=biz_001 → selects the business (opens BusinessSheet)
 * - ?list=xxx → returns the list ID for the caller to handle
 *
 * Returns the shared list ID if present in URL (one-time read).
 */
export function useDeepLinks(onListDeepLink?: (listId: string) => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedBusiness } = useSelection();

  useEffect(() => {
    const bizId = searchParams.get('business');
    if (bizId) {
      const biz = allBusinesses.find((b) => b.id === bizId);
      if (biz) {
        setSelectedBusiness(biz);
      }
      searchParams.delete('business');
      setSearchParams(searchParams, { replace: true });
    }

    const listId = searchParams.get('list');
    if (listId) {
      onListDeepLink?.(listId);
      searchParams.delete('list');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);
}
