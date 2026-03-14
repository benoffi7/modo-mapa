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
  getHandlers: (id: string) => SwipeHandlers;
  /** Get inline transform style for an item */
  getStyle: (id: string) => React.CSSProperties;
  /** Reset/close any open swipe */
  reset: () => void;
}

/**
 * Hook for swipe-to-reveal actions on list items.
 * Only activates on touch devices (pointer: coarse).
 * Cancels if vertical movement exceeds 10px.
 */
export function useSwipeActions(options: UseSwipeActionsOptions = {}): SwipeState {
  const { threshold = 80 } = options;
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deltaX, setDeltaX] = useState(0);

  const startX = useRef(0);
  const startY = useRef(0);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    setSwipedId(null);
    setDirection(null);
    setActiveId(null);
    setDeltaX(0);
  }, []);

  const getHandlers = useCallback((id: string): SwipeHandlers => ({
    onTouchStart: (e: React.TouchEvent) => {
      // Close previously swiped item
      if (swipedId && swipedId !== id) {
        reset();
      }
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      cancelled.current = false;
      setActiveId(id);
      setDeltaX(0);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (cancelled.current || activeId !== id) return;

      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Cancel swipe if vertical movement > 10px (user is scrolling)
      if (Math.abs(dy) > 10 && Math.abs(dx) < Math.abs(dy)) {
        cancelled.current = true;
        setDeltaX(0);
        setActiveId(null);
        return;
      }

      // Dampen movement (max 120px)
      const clamped = Math.max(-120, Math.min(120, dx));
      setDeltaX(clamped);
    },
    onTouchEnd: () => {
      if (cancelled.current || activeId !== id) {
        setActiveId(null);
        return;
      }

      if (Math.abs(deltaX) >= threshold) {
        setSwipedId(id);
        setDirection(deltaX < 0 ? 'left' : 'right');
      } else {
        // Snap back
        setSwipedId(null);
        setDirection(null);
      }
      setDeltaX(0);
      setActiveId(null);
    },
  }), [swipedId, activeId, deltaX, threshold, reset]);

  const getStyle = useCallback((id: string): React.CSSProperties => {
    // While actively swiping
    if (activeId === id && deltaX !== 0) {
      return {
        transform: `translateX(${deltaX}px)`,
        transition: 'none',
      };
    }
    // Settled in swiped position
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
  }, [activeId, deltaX, swipedId, direction]);

  return { swipedId, direction, getHandlers, getStyle, reset };
}
