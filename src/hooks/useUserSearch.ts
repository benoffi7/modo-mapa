import { useState, useCallback, useRef } from 'react';
import { searchUsers } from '../services/follows';
import { logger } from '../utils/logger';

export interface UserSearchResult {
  userId: string;
  displayName: string;
}

export function useUserSearch() {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!term || term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchUsers(term);
        setResults(found);
      } catch (err) {
        if (import.meta.env.DEV) logger.error('User search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { results, searching, search, clear };
}
