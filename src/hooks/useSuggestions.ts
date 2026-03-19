import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/MapContext';
import { allBusinesses } from './useBusinesses';
import { fetchUserSuggestionData } from '../services/suggestions';
import {
  SUGGESTION_WEIGHTS,
  MAX_SUGGESTIONS,
  NEARBY_RADIUS_KM,
} from '../constants/suggestions';
import { distanceKm } from '../utils/distance';
import type { Business, Favorite, Rating, UserTag, BusinessCategory, SuggestedBusiness, SuggestionReason } from '../types';

export function useSuggestions(): {
  suggestions: SuggestedBusiness[];
  isLoading: boolean;
  error: boolean;
} {
  const { user } = useAuth();
  const { userLocation } = useFilters();

  interface SuggestionState {
    favorites: Favorite[];
    ratings: Rating[];
    userTags: UserTag[];
    isLoading: boolean;
    error: boolean;
  }

  const initialState: SuggestionState = { favorites: [], ratings: [], userTags: [], isLoading: false, error: false };
  const [state, setState] = useState<SuggestionState>(initialState);

  useEffect(() => {
    if (!user) {
      setState(initialState);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true, error: false }));

    fetchUserSuggestionData(user.uid)
      .then((data) => {
        if (!cancelled) setState({ favorites: data.favorites, ratings: data.ratings, userTags: data.userTags, isLoading: false, error: false });
      })
      .catch((err) => {
        console.error('[useSuggestions] fetchUserSuggestionData failed:', err);
        if (!cancelled) setState((prev) => ({ ...prev, isLoading: false, error: true }));
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { favorites, ratings, userTags, isLoading, error } = state;

  const suggestions = useMemo(() => {
    if (favorites.length === 0 && ratings.length === 0 && userTags.length === 0) {
      return [];
    }

    // Build category preference map from favorites
    const categoryCount = new Map<BusinessCategory, number>();
    const favoriteBusinessIds = new Set(favorites.map((f) => f.businessId));
    const ratedBusinessIds = new Set(ratings.map((r) => r.businessId));

    for (const fav of favorites) {
      const biz = allBusinesses.find((b: Business) => b.id === fav.businessId);
      if (biz) {
        categoryCount.set(biz.category, (categoryCount.get(biz.category) ?? 0) + 1);
      }
    }

    // Build tag preference map from user tags
    const tagCount = new Map<string, number>();
    for (const tag of userTags) {
      tagCount.set(tag.tagId, (tagCount.get(tag.tagId) ?? 0) + 1);
    }

    // Score each business
    const scored: SuggestedBusiness[] = [];

    for (const business of allBusinesses) {
      let score = 0;
      const reasons: SuggestionReason[] = [];

      // Category match
      if (categoryCount.has(business.category)) {
        score += SUGGESTION_WEIGHTS.categoryMatch;
        reasons.push('category');
      }

      // Tag match
      const matchingTags = business.tags.filter((t: string) => tagCount.has(t));
      if (matchingTags.length > 0) {
        score += SUGGESTION_WEIGHTS.tagMatch;
        reasons.push('tags');
      }

      // Nearby bonus
      if (userLocation) {
        const dist = distanceKm(
          userLocation.lat,
          userLocation.lng,
          business.lat,
          business.lng,
        );
        if (dist <= NEARBY_RADIUS_KM) {
          score += SUGGESTION_WEIGHTS.nearbyBonus;
          reasons.push('nearby');
        }
      }

      // Penalties
      if (favoriteBusinessIds.has(business.id)) {
        score += SUGGESTION_WEIGHTS.alreadyFavorite;
      }
      if (ratedBusinessIds.has(business.id)) {
        score += SUGGESTION_WEIGHTS.alreadyRated;
      }

      if (score > 0) {
        scored.push({ business, score, reasons });
      }
    }

    scored.sort((a, b) => b.score - a.score || a.business.name.localeCompare(b.business.name));
    return scored.slice(0, MAX_SUGGESTIONS);
  }, [favorites, ratings, userTags, userLocation]);

  return { suggestions, isLoading, error };
}
