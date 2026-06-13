import { useMemo } from 'react';
import { getBusinessById } from '../utils/businessMap';
import { BUSINESS_ID_REGEX } from '../constants/validation';
import type { Business } from '../types';

interface UseBusinessByIdReturn {
  business: Business | null;
  status: 'found' | 'not_found' | 'invalid_id';
}

export function useBusinessById(id: string | undefined): UseBusinessByIdReturn {
  return useMemo(() => {
    if (!id || !BUSINESS_ID_REGEX.test(id)) return { business: null, status: 'invalid_id' };
    const business = getBusinessById(id) ?? null;
    return business ? { business, status: 'found' } : { business: null, status: 'not_found' };
  }, [id]);
}
