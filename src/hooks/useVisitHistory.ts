import { useState, useCallback, useMemo } from 'react';
import { getBusinessById } from '../utils/businessMap';
import { STORAGE_KEY_VISITS, MAX_VISIT_HISTORY } from '../constants';
import type { Business } from '../types';

interface VisitEntry {
  businessId: string;
  lastVisited: string;
  visitCount: number;
}

function readVisits(): VisitEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISITS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeVisits(visits: VisitEntry[]) {
  localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(visits));
}

export interface VisitWithBusiness extends VisitEntry {
  business: Business | null;
}

export function useVisitHistory() {
  const [visits, setVisits] = useState<VisitEntry[]>(readVisits);

  const recordVisit = useCallback((businessId: string) => {
    setVisits((prev) => {
      const now = new Date().toISOString();
      const existing = prev.find((v) => v.businessId === businessId);
      let updated: VisitEntry[];

      if (existing) {
        updated = [
          { ...existing, lastVisited: now, visitCount: existing.visitCount + 1 },
          ...prev.filter((v) => v.businessId !== businessId),
        ];
      } else {
        updated = [
          { businessId, lastVisited: now, visitCount: 1 },
          ...prev,
        ].slice(0, MAX_VISIT_HISTORY);
      }

      writeVisits(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_VISITS);
    setVisits([]);
  }, []);

  const visitsWithBusiness: VisitWithBusiness[] = useMemo(
    () => visits.map((v) => ({
      ...v,
      business: getBusinessById(v.businessId) ?? null,
    })),
    [visits],
  );

  return { visits: visitsWithBusiness, recordVisit, clearHistory };
}
