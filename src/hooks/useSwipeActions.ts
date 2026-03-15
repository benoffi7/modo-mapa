import { useState, useRef, useCallback } from 'react';

interface UseSwipeActionsOptions {
  threshold?: number;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export interface SwipeState {
  /** Currently swiped item id (left or right) */
  swipedId: string | null;
  /** Direction of active swipe */
  direction: 'left' | 'right' | null;
  /** Get touch handlers for an item */
  getHandlers: (id: string, elementRef: React.RefObject<HTMLElement | null>) => SwipeHandlers;
  /** Get inline transform style for a settled (non-active) item */
  getStyle: (id: string) => React.CSSProperties;
  /** Reset/close any open swipe */
  reset: () => void;
}

/**
 * Hook for swipe-to-reveal actions on list items.
 * Uses refs + direct DOM manipulation during touchMove to avoid 60fps re-renders.
 * Only triggers React state on touchEnd (settle/snap).
 */
export function useSwipeActions(options: UseSwipeActionsOptions = {}): SwipeState {
  const { threshold = 80 } = options;
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const deltaXRef = useRef(0);
  const cancelled = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const swipedIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    // Reset DOM if there's an active element
    if (activeElementRef.current) {
      activeElementRef.current.style.transform = 'translateX(0)';
      activeElementRef.current.style.transition = 'transform 0.2s ease-out';
    }
    setSwipedId(null);
    setDirection(null);
    swipedIdRef.current = null;
    activeIdRef.current = null;
    activeElementRef.current = null;
    deltaXRef.current = 0;
  }, []);

  const getHandlers = useCallback((id: string, elementRef: React.RefObject<HTMLElement | null>): SwipeHandlers => ({
    onTouchStart: (e: React.TouchEvent) => {
      // Close previously swiped item
      if (swipedIdRef.current && swipedIdRef.current !== id) {
        reset();
      }
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      cancelled.current = false;
      deltaXRef.current = 0;
      activeIdRef.current = id;
      activeElementRef.current = elementRef.current;
      // Remove transition for immediate response
      if (elementRef.current) {
        elementRef.current.style.transition = 'none';
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (cancelled.current || activeIdRef.current !== id) return;

      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Cancel swipe if vertical movement > 10px (user is scrolling)
      if (Math.abs(dy) > 10 && Math.abs(dx) < Math.abs(dy)) {
        cancelled.current = true;
        if (activeElementRef.current) {
          activeElementRef.current.style.transform = 'translateX(0)';
          activeElementRef.current.style.transition = 'transform 0.2s ease-out';
        }
        activeIdRef.current = null;
        activeElementRef.current = null;
        return;
      }

      // Dampen movement (max 120px) — direct DOM, no React re-render
      const clamped = Math.max(-120, Math.min(120, dx));
      deltaXRef.current = clamped;
      if (activeElementRef.current) {
        activeElementRef.current.style.transform = `translateX(${clamped}px)`;
      }
    },
    onTouchEnd: () => {
      if (cancelled.current || activeIdRef.current !== id) {
        activeIdRef.current = null;
        activeElementRef.current = null;
        return;
      }

      const dx = deltaXRef.current;
      if (Math.abs(dx) >= threshold) {
        // Settle in swiped position
        const dir = dx < 0 ? 'left' as const : 'right' as const;
        const offset = dir === 'left' ? -80 : 80;
        if (activeElementRef.current) {
          activeElementRef.current.style.transform = `translateX(${offset}px)`;
          activeElementRef.current.style.transition = 'transform 0.2s ease-out';
        }
        setSwipedId(id);
        setDirection(dir);
        swipedIdRef.current = id;
      } else {
        // Snap back
        if (activeElementRef.current) {
          activeElementRef.current.style.transform = 'translateX(0)';
          activeElementRef.current.style.transition = 'transform 0.2s ease-out';
        }
        setSwipedId(null);
        setDirection(null);
        swipedIdRef.current = null;
      }
      deltaXRef.current = 0;
      activeIdRef.current = null;
      activeElementRef.current = null;
    },
  }), [threshold, reset]);

  const getStyle = useCallback((id: string): React.CSSProperties => {
    // Settled swiped position (for initial render after touchEnd setState)
    if (swipedId === id && direction) {
      const offset = direction === 'left' ? -80 : 80;
      return {
        transform: `translateX(${offset}px)`,
        transition: 'transform 0.2s ease-out',
      };
    }
    // Default position
    return {
      transform: 'translateX(0)',
      transition: 'transform 0.2s ease-out',
    };
  }, [swipedId, direction]);

  return { swipedId, direction, getHandlers, getStyle, reset };
}
