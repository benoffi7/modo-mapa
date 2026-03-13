import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { priceLevelConverter } from '../config/converters';
import type { PriceLevel } from '../types';

/** Map of businessId -> average price level (rounded to nearest int) */
type PriceMap = Map<string, number>;

let globalPriceMap: PriceMap | null = null;
let fetchPromise: Promise<PriceMap> | null = null;

async function fetchAllPriceLevels(): Promise<PriceMap> {
  const snap = await getDocs(
    collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
  );
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
    if (!fetchPromise) {
      fetchPromise = fetchAllPriceLevels();
    }

    fetchPromise.then((map) => {
      globalPriceMap = map;
      setPriceMap(map);
    }).catch(() => {
      // Silently fail — price filter just won't work
    });
  }, []);

  useEffect(() => {
    if (!globalPriceMap) {
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
