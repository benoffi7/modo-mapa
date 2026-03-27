import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const VIRTUALIZE_THRESHOLD = 20;

interface UseVirtualizedListOptions {
  itemCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  searchInput: string;
  loadMore: () => void;
}

export function useVirtualizedList({
  itemCount,
  hasMore,
  isLoadingMore,
  searchInput,
  loadMore,
}: UseVirtualizedListOptions) {
  const shouldVirtualize = itemCount >= VIRTUALIZE_THRESHOLD;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 72,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  // Auto-loadMore when near the end of virtual list
  const lastVirtualItem = virtualizer.getVirtualItems().at(-1);
  const lastVirtualIndex = lastVirtualItem?.index ?? -1;
  useEffect(() => {
    if (!shouldVirtualize || lastVirtualIndex < 0 || !hasMore || isLoadingMore || searchInput) return;
    if (lastVirtualIndex >= itemCount - 5) {
      loadMore();
    }
  }, [shouldVirtualize, lastVirtualIndex, itemCount, hasMore, isLoadingMore, searchInput, loadMore]);

  return {
    shouldVirtualize,
    scrollContainerRef,
    virtualizer,
  };
}

export { VIRTUALIZE_THRESHOLD };
