import { useState, useEffect, useCallback } from 'react';
import { ONBOARDING_HINT_DELAY_MS } from '../constants/timing';
import { STORAGE_KEY_ONBOARDING_CREATED_AT, STORAGE_KEY_ONBOARDING_COMPLETED } from '../constants/storage';

interface UseOnboardingHintReturn {
  show: boolean;
  dismiss: () => void;
}

export function useOnboardingHint(): UseOnboardingHintReturn {
  const [show, setShow] = useState(() => {
    if (localStorage.getItem(STORAGE_KEY_ONBOARDING_COMPLETED) === 'true') return false;
    const createdAt = localStorage.getItem(STORAGE_KEY_ONBOARDING_CREATED_AT);
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() >= ONBOARDING_HINT_DELAY_MS;
  });

  useEffect(() => {
    if (show) {
      localStorage.setItem(STORAGE_KEY_ONBOARDING_COMPLETED, 'true');
      return;
    }
    if (localStorage.getItem(STORAGE_KEY_ONBOARDING_COMPLETED) === 'true') return;
    const createdAt = localStorage.getItem(STORAGE_KEY_ONBOARDING_CREATED_AT);
    if (!createdAt) return;

    const remaining = ONBOARDING_HINT_DELAY_MS - (Date.now() - new Date(createdAt).getTime());
    if (remaining <= 0) return;

    const timer = setTimeout(() => {
      if (localStorage.getItem(STORAGE_KEY_ONBOARDING_COMPLETED) !== 'true') {
        setShow(true);
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [show]);

  const dismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY_ONBOARDING_COMPLETED, 'true');
  }, []);

  return { show, dismiss };
}
