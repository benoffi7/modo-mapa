import { allBusinesses } from './useBusinesses';
import { BUSINESS_ID_REGEX } from '../constants/validation';
import type { Business } from '../types';

interface UseBusinessByIdReturn {
  business: Business | null;
  status: 'found' | 'not_found' | 'invalid_id';
}

export function useBusinessById(id: string | undefined): UseBusinessByIdReturn {
  if (!id || !BUSINESS_ID_REGEX.test(id)) return { business: null, status: 'invalid_id' };
  const business = allBusinesses.find((b) => b.id === id) ?? null;
  return business ? { business, status: 'found' } : { business: null, status: 'not_found' };
}
