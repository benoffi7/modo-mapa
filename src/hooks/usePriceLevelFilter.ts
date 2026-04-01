import { useState, useEffect, useCallback } from 'react';
import { fetchPriceLevelMap } from '../services/priceLevels';
import { logger } from '../utils/logger';

/** Map of businessId -> average price level (rounded to nearest int) */
type PriceMap = Map<string, number>;

let globalPriceMap: PriceMap | null = null;
let fetchPromise: Promise<PriceMap> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Returns a map of businessId -> average price level.
 * Fetches once globally and caches.
 */
export function usePriceLevelFilter() {
  const [priceMap, setPriceMap] = useState<PriceMap>(() => globalPriceMap ?? new Map());

  const load = useCallback(() => {
    // Invalidate stale cache
    if (globalPriceMap && Date.now() - cacheTimestamp > CACHE_TTL) {
      globalPriceMap = null;
      fetchPromise = null;
    }

    if (!fetchPromise) {
      fetchPromise = fetchPriceLevelMap();
    }

    fetchPromise.then((map) => {
      globalPriceMap = map;
      cacheTimestamp = Date.now();
      setPriceMap(map);
    }).catch((err) => {
      logger.error('[usePriceLevelFilter] fetchPriceLevels failed:', err);
    });
  }, []);

  useEffect(() => {
    if (!globalPriceMap || Date.now() - cacheTimestamp > CACHE_TTL) {
      load();
    }
  }, [load]);

  return priceMap;
}
