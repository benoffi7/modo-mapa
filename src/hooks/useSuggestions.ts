import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { favoriteConverter } from '../config/converters';
import { ratingConverter } from '../config/converters';
import { userTagConverter } from '../config/converters';
import { allBusinesses } from './useBusinesses';
import { useAuth } from '../context/AuthContext';
import { useMapContext } from '../context/MapContext';
import {
  SUGGESTION_WEIGHTS,
  MAX_SUGGESTIONS,
  NEARBY_RADIUS_KM,
} from '../constants/suggestions';
import type { Business, Favorite, Rating, UserTag, BusinessCategory } from '../types';

export type SuggestionReason = 'category' | 'tags' | 'nearby';

export interface SuggestedBusiness {
  business: Business;
  score: number;
  reasons: SuggestionReason[];
}

/** Haversine distance in km between two lat/lng points. */
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useSuggestions(): {
  suggestions: SuggestedBusiness[];
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { userLocation } = useMapContext();

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user activity data from Firestore
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setRatings([]);
      setUserTags([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchData = async () => {
      try {
        const [favsSnap, ratingsSnap, tagsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter),
              where('userId', '==', user.uid),
            ),
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
              where('userId', '==', user.uid),
            ),
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
              where('userId', '==', user.uid),
            ),
          ),
        ]);

        if (cancelled) return;

        setFavorites(favsSnap.docs.map((d) => d.data()));
        setRatings(ratingsSnap.docs.map((d) => d.data()));
        setUserTags(tagsSnap.docs.map((d) => d.data()));
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching suggestion data:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const suggestions = useMemo(() => {
    // Need at least some activity to generate suggestions
    if (favorites.length === 0 && ratings.length === 0 && userTags.length === 0) {
      return [];
    }

    // Build category preference map from favorites
    const categoryCount = new Map<BusinessCategory, number>();
    const favoriteBusinessIds = new Set(favorites.map((f) => f.businessId));
    const ratedBusinessIds = new Set(ratings.map((r) => r.businessId));

    for (const fav of favorites) {
      const biz = allBusinesses.find((b) => b.id === fav.businessId);
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

      // Tag match: check if business has tags the user frequently votes for
      const matchingTags = business.tags.filter((t) => tagCount.has(t));
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

      // Only include businesses with a positive score
      if (score > 0) {
        scored.push({ business, score, reasons });
      }
    }

    // Sort by score descending, then by name for stable ordering
    scored.sort((a, b) => b.score - a.score || a.business.name.localeCompare(b.business.name));

    return scored.slice(0, MAX_SUGGESTIONS);
  }, [favorites, ratings, userTags, userLocation]);

  return { suggestions, isLoading };
}
