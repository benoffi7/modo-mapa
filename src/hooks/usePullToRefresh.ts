import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

const THRESHOLD = 80;

interface UsePullToRefreshReturn {
  containerRef: RefObject<HTMLDivElement | null>;
  isRefreshing: boolean;
  pullProgress: number;
}

export function usePullToRefresh(onRefresh: () => Promise<void>): UsePullToRefreshReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let currentProgress = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop === 0 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy > 0) {
        currentProgress = Math.min(dy / THRESHOLD, 1);
        setPullProgress(currentProgress);
      } else {
        pullingRef.current = false;
        currentProgress = 0;
        setPullProgress(0);
      }
    };

    const onTouchEnd = () => {
      if (pullingRef.current && currentProgress >= 1) {
        handleRefresh();
      }
      pullingRef.current = false;
      currentProgress = 0;
      setPullProgress(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isRefreshing, handleRefresh]);

  return { containerRef, isRefreshing, pullProgress };
}
