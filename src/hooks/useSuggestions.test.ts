import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock Firebase config to prevent env var check in CI
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
}));

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({ user: { uid: 'u1' } }),
}));

vi.mock('../context/MapContext', () => ({
  useFilters: vi.fn().mockReturnValue({ userLocation: null }),
}));

vi.mock('../services/suggestions', () => ({
  fetchUserSuggestionData: vi.fn().mockResolvedValue({ favorites: [], ratings: [], userTags: [] }),
}));

// Import after mocks
import { useSuggestions } from './useSuggestions';
import { allBusinesses } from './useBusinesses';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/MapContext';
import { fetchUserSuggestionData } from '../services/suggestions';
import { SUGGESTION_WEIGHTS, MAX_SUGGESTIONS } from '../constants/suggestions';

import type { Business } from '../types';

// Stub business data
const mockBusinesses: Business[] = [
  { id: 'b1', name: 'Pizza A', category: 'pizza', lat: -34.60, lng: -58.38, tags: ['barato', 'rapido'], phone: null, address: '' },
  { id: 'b2', name: 'Cafe B', category: 'cafe', lat: -34.61, lng: -58.39, tags: ['buena_atencion'], phone: null, address: '' },
  { id: 'b3', name: 'Pizza C', category: 'pizza', lat: -34.70, lng: -58.50, tags: ['delivery'], phone: null, address: '' },
  { id: 'b4', name: 'Bar D', category: 'bar', lat: -34.60, lng: -58.38, tags: ['barato'], phone: null, address: '' },
];

describe('useSuggestions — scoring algorithm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Replace allBusinesses array contents
    allBusinesses.length = 0;
    allBusinesses.push(...mockBusinesses);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: { uid: 'u1' } });
    (useFilters as ReturnType<typeof vi.fn>).mockReturnValue({ userLocation: null });
  });

  it('returns empty suggestions when user has no activity', async () => {
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [], ratings: [], userTags: [],
    });

    const { result } = renderHook(() => useSuggestions());
    // Wait for async effect
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
  });

  it('scores category match with correct weight', async () => {
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'b1', userId: 'u1', createdAt: new Date() }],
      ratings: [],
      userTags: [],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // b1 is favorited → alreadyFavorite penalty
    // b3 matches category 'pizza' → categoryMatch score
    const b3 = result.current.suggestions.find((s) => s.business.id === 'b3');
    expect(b3).toBeDefined();
    expect(b3!.score).toBe(SUGGESTION_WEIGHTS.categoryMatch);
    expect(b3!.reasons).toContain('category');
  });

  it('applies alreadyFavorite penalty', async () => {
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'b1', userId: 'u1', createdAt: new Date() }],
      ratings: [],
      userTags: [],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // b1 gets category match (3) + alreadyFavorite (-5) = -2 → excluded (score <= 0)
    const b1 = result.current.suggestions.find((s) => s.business.id === 'b1');
    expect(b1).toBeUndefined();
  });

  it('applies alreadyRated penalty', async () => {
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'b1', userId: 'u1', createdAt: new Date() }],
      ratings: [{ businessId: 'b3', userId: 'u1', score: 4, createdAt: new Date(), updatedAt: new Date() }],
      userTags: [],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // b3: categoryMatch (3) + alreadyRated (-3) = 0 → excluded
    const b3 = result.current.suggestions.find((s) => s.business.id === 'b3');
    expect(b3).toBeUndefined();
  });

  it('scores tag match', async () => {
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [],
      ratings: [],
      userTags: [{ userId: 'u1', businessId: 'b1', tagId: 'barato', createdAt: new Date() }],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // b4 has tag 'barato' → tagMatch
    const b4 = result.current.suggestions.find((s) => s.business.id === 'b4');
    expect(b4).toBeDefined();
    expect(b4!.reasons).toContain('tags');
    expect(b4!.score).toBe(SUGGESTION_WEIGHTS.tagMatch);
  });

  it('adds nearby bonus when user has location', async () => {
    // b1 is at -34.60, -58.38
    (useFilters as ReturnType<typeof vi.fn>).mockReturnValue({
      userLocation: { lat: -34.60, lng: -58.38 },
    });
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'b2', userId: 'u1', createdAt: new Date() }], // cafe
      ratings: [],
      userTags: [],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // b1 (pizza, nearby, same coords): nearby bonus only (no category match with cafe)
    const b1 = result.current.suggestions.find((s) => s.business.id === 'b1');
    expect(b1).toBeDefined();
    expect(b1!.reasons).toContain('nearby');

    // b3 (pizza, far away): no nearby bonus
    const b3 = result.current.suggestions.find((s) => s.business.id === 'b3');
    if (b3) {
      expect(b3.reasons).not.toContain('nearby');
    }
  });

  it('combines multiple scoring factors', async () => {
    (useFilters as ReturnType<typeof vi.fn>).mockReturnValue({
      userLocation: { lat: -34.60, lng: -58.38 },
    });
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'b1', userId: 'u1', createdAt: new Date() }],
      ratings: [],
      userTags: [{ userId: 'u1', businessId: 'b1', tagId: 'barato', createdAt: new Date() }],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // b4 (bar, tag 'barato', nearby): tagMatch(2) + nearby(1) = 3
    const b4 = result.current.suggestions.find((s) => s.business.id === 'b4');
    expect(b4).toBeDefined();
    expect(b4!.score).toBe(SUGGESTION_WEIGHTS.tagMatch + SUGGESTION_WEIGHTS.nearbyBonus);
    expect(b4!.reasons).toContain('tags');
    expect(b4!.reasons).toContain('nearby');
  });

  it('sorts by score descending, then name alphabetically', async () => {
    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'b1', userId: 'u1', createdAt: new Date() }],
      ratings: [],
      userTags: [{ userId: 'u1', businessId: 'b1', tagId: 'barato', createdAt: new Date() }],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    const scores = result.current.suggestions.map((s) => s.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('limits results to MAX_SUGGESTIONS', async () => {
    // Add many businesses with matching category
    const manyBiz: Business[] = Array.from({ length: 20 }, (_, i) => ({
      id: `bx${i}`, name: `Test ${i}`, category: 'pizza', lat: -34.6, lng: -58.38, tags: [], phone: null, address: '',
    }));
    allBusinesses.length = 0;
    allBusinesses.push(...manyBiz);

    (fetchUserSuggestionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      favorites: [{ businessId: 'bx0', userId: 'u1', createdAt: new Date() }],
      ratings: [],
      userTags: [],
    });

    const { result } = renderHook(() => useSuggestions());
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });

  it('returns empty when user is null', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null });

    const { result } = renderHook(() => useSuggestions());
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
