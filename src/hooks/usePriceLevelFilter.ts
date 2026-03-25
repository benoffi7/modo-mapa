import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { priceLevelConverter } from '../config/converters';
import type { PriceLevel } from '../types';
import { logger } from '../utils/logger';

/** Map of businessId -> average price level (rounded to nearest int) */
type PriceMap = Map<string, number>;

let globalPriceMap: PriceMap | null = null;
let fetchPromise: Promise<PriceMap> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Safety bound: max docs to fetch (covers ~500 users × 40 businesses) */
const MAX_PRICE_LEVELS = 20_000;

async function fetchAllPriceLevels(): Promise<PriceMap> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
    limit(MAX_PRICE_LEVELS),
  ));
  const byBusiness = new Map<string, number[]>();
  for (const doc of snap.docs) {
    const pl: PriceLevel = doc.data();
    const arr = byBusiness.get(pl.businessId) ?? [];
    arr.push(pl.level);
    byBusiness.set(pl.businessId, arr);
  }

  const result: PriceMap = new Map();
  for (const [bId, levels] of byBusiness) {
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    result.set(bId, Math.round(avg));
  }
  return result;
}

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
      fetchPromise = fetchAllPriceLevels();
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

/** Invalidate the global cache (call after user votes). */
export function invalidatePriceLevelCache() {
  globalPriceMap = null;
  fetchPromise = null;
}
