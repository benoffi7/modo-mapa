import { useMemo, useState, useDeferredValue, useEffect, useRef } from 'react';
import { getBusinessById } from '../utils/businessMap';
import type { Business, Comment } from '../types';

type SortMode = 'recent' | 'oldest' | 'useful';

interface CommentEntry {
  id: string;
  comment: Comment;
  business: Business | null;
}

interface UseCommentsListFiltersOptions {
  rawItems: Comment[];
  isPendingDelete: (id: string) => boolean;
  hasMore: boolean;
  loadAll: (limit: number) => void;
}

export function useCommentsListFilters({ rawItems, isPendingDelete, hasMore, loadAll }: UseCommentsListFiltersOptions) {
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [filterBusiness, setFilterBusiness] = useState<Business | null>(null);

  // "Load all" when search becomes active — fires once, not on every keystroke
  const hasTriggeredLoadAll = useRef(false);
  useEffect(() => {
    if (searchInput && !hasTriggeredLoadAll.current) {
      hasTriggeredLoadAll.current = true;
    }
    if (!searchInput) {
      hasTriggeredLoadAll.current = false;
    }
  }, [searchInput]);
  useEffect(() => {
    if (!hasTriggeredLoadAll.current || !hasMore) return;
    loadAll(200);
  }, [hasMore, loadAll]);

  // Map raw items to { comment, business }
  const comments = useMemo(() => {
    return rawItems
      .filter((data) => !isPendingDelete(data.id))
      .map((data) => ({
        id: data.id,
        comment: data,
        business: getBusinessById(data.businessId) ?? null,
      }));
  }, [rawItems, isPendingDelete]);

  // Sort
  const sortedComments = useMemo(() => {
    const list = [...comments];
    switch (sortMode) {
      case 'oldest':
        return list.reverse();
      case 'useful':
        return list.sort((a, b) => b.comment.likeCount - a.comment.likeCount);
      default:
        return list;
    }
  }, [comments, sortMode]);

  // Filter by search
  const searchedComments = useMemo(() => {
    if (!deferredSearch) return sortedComments;
    const q = deferredSearch.toLowerCase();
    return sortedComments.filter(
      (c) =>
        c.comment.text.toLowerCase().includes(q) ||
        (c.business?.name.toLowerCase().includes(q) ?? false),
    );
  }, [sortedComments, deferredSearch]);

  // Filter by business
  const filteredComments = useMemo(() => {
    if (!filterBusiness) return searchedComments;
    return searchedComments.filter((c) => c.comment.businessId === filterBusiness.id);
  }, [searchedComments, filterBusiness]);

  // Business options for autocomplete
  const businessOptions = useMemo(() => {
    const seen = new Set<string>();
    return comments
      .map((c) => c.business)
      .filter((b): b is Business => b !== null && !seen.has(b.id) && seen.add(b.id) && true)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [comments]);

  // Stats
  const stats = useMemo(() => {
    if (comments.length === 0) return null;
    const totalLikes = comments.reduce((sum, c) => sum + c.comment.likeCount, 0);
    const avgLikes = totalLikes / comments.length;
    const mostPopular = comments.reduce(
      (best, c) => (c.comment.likeCount > (best?.comment.likeCount ?? 0) ? c : best),
      comments[0],
    );
    return { total: comments.length, totalLikes, avgLikes, mostPopular };
  }, [comments]);

  const isFiltered = !!deferredSearch || !!filterBusiness;
  const showControls = comments.length >= 3;

  return {
    sortMode,
    setSortMode: setSortMode as (mode: string) => void,
    searchInput,
    setSearchInput,
    deferredSearch,
    filterBusiness,
    setFilterBusiness,
    comments,
    filteredComments,
    businessOptions,
    stats,
    isFiltered,
    showControls,
  };
}

export type { CommentEntry, SortMode };
