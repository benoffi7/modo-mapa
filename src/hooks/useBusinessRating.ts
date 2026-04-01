import { useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { upsertRating, deleteRating, upsertCriteriaRating } from '../services/ratings';
import { withOfflineSupport } from '../services/offlineInterceptor';
import { RATING_CRITERIA } from '../constants/criteria';
import { STORAGE_KEY_HINT_POST_FIRST_RATING, STORAGE_KEY_ONBOARDING_COMPLETED } from '../constants/storage';
import { MSG_BUSINESS } from '../constants/messages';
import { incrementAnonRatingCount } from './useActivityReminder';
import type { Rating, RatingCriteria, RatingCriterionId } from '../types';

export interface CriteriaAverages {
  [key: string]: { sum: number; count: number; avg: number };
}

interface UseBusinessRatingParams {
  businessId: string;
  businessName?: string | undefined;
  ratings: Rating[];
  isLoading: boolean;
  onRatingChange: () => void;
}

export interface UseBusinessRatingReturn {
  averageRating: number;
  totalRatings: number;
  myRating: number | null;
  myCriteria: RatingCriteria;
  criteriaAverages: CriteriaAverages;
  hasCriteriaData: boolean;
  handleRate: (event: unknown, value: number | null) => Promise<void>;
  handleDeleteRating: () => Promise<void>;
  handleCriterionRate: (criterionId: RatingCriterionId, value: number | null) => Promise<void>;
}

export function useBusinessRating({
  businessId,
  businessName,
  ratings,
  onRatingChange,
}: UseBusinessRatingParams): UseBusinessRatingReturn {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();

  const { averageRating, totalRatings, serverMyRating, serverMyCriteria, criteriaAverages } = useMemo(() => {
    let sum = 0;
    let myScore: number | null = null;
    let myCriteria: RatingCriteria | undefined;
    const critAgg: CriteriaAverages = {};

    for (const criterion of RATING_CRITERIA) {
      critAgg[criterion.id] = { sum: 0, count: 0, avg: 0 };
    }

    for (const r of ratings) {
      sum += r.score;
      if (user && r.userId === user.uid) {
        myScore = r.score;
        myCriteria = r.criteria;
      }
      if (r.criteria) {
        for (const criterion of RATING_CRITERIA) {
          const value = r.criteria[criterion.id];
          if (value != null) {
            critAgg[criterion.id].sum += value;
            critAgg[criterion.id].count += 1;
          }
        }
      }
    }

    for (const key of Object.keys(critAgg)) {
      const entry = critAgg[key];
      entry.avg = entry.count > 0 ? entry.sum / entry.count : 0;
    }

    return {
      averageRating: ratings.length > 0 ? sum / ratings.length : 0,
      totalRatings: ratings.length,
      serverMyRating: myScore,
      serverMyCriteria: myCriteria,
      criteriaAverages: critAgg,
    };
  }, [ratings, user]);

  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [pendingCriteria, setPendingCriteria] = useState<RatingCriteria | null>(null);

  const myRating = pendingRating === 0 ? null : (pendingRating ?? serverMyRating);
  const myCriteria: RatingCriteria = { ...(serverMyCriteria ?? {}), ...(pendingCriteria ?? {}) };

  const handleRate = useCallback(async (_: unknown, value: number | null) => {
    if (!user || !value) return;
    setPendingRating(value);
    try {
      await withOfflineSupport(
        isOffline,
        'rating_upsert',
        { userId: user.uid, businessId, businessName },
        { score: value },
        () => upsertRating(user.uid, businessId, value),
        toast,
      );
      onRatingChange();
      localStorage.setItem(STORAGE_KEY_ONBOARDING_COMPLETED, 'true');
      if (user.isAnonymous) incrementAnonRatingCount();
      if (serverMyRating === null && localStorage.getItem(STORAGE_KEY_HINT_POST_FIRST_RATING) !== 'true') {
        localStorage.setItem(STORAGE_KEY_HINT_POST_FIRST_RATING, 'true');
        toast.info(MSG_BUSINESS.ratingSuccess);
      }
    } catch {
      setPendingRating(null);
      toast.error(MSG_BUSINESS.ratingError);
    }
  }, [user, businessId, businessName, isOffline, toast, onRatingChange, serverMyRating]);

  const handleDeleteRating = useCallback(async () => {
    if (!user) return;
    setPendingRating(0);
    setPendingCriteria(null);
    try {
      await withOfflineSupport(
        isOffline,
        'rating_delete',
        { userId: user.uid, businessId, businessName },
        { _type: 'rating_delete' },
        () => deleteRating(user.uid, businessId),
        toast,
      );
      onRatingChange();
    } catch {
      setPendingRating(null);
      toast.error(MSG_BUSINESS.ratingDeleteError);
    }
  }, [user, businessId, businessName, isOffline, toast, onRatingChange]);

  const handleCriterionRate = useCallback(async (criterionId: RatingCriterionId, value: number | null) => {
    if (!user || !value) return;
    setPendingCriteria((prev) => ({ ...(prev ?? {}), [criterionId]: value }));
    try {
      await upsertCriteriaRating(user.uid, businessId, { [criterionId]: value });
      onRatingChange();
    } catch {
      setPendingCriteria((prev) => {
        if (!prev) return null;
        const next = { ...prev };
        delete next[criterionId];
        return Object.keys(next).length > 0 ? next : null;
      });
      toast.error(MSG_BUSINESS.criteriaError);
    }
  }, [user, businessId, onRatingChange, toast]);

  const hasCriteriaData = Object.values(criteriaAverages).some((c) => c.count > 0);

  return {
    averageRating,
    totalRatings,
    myRating,
    myCriteria,
    criteriaAverages,
    hasCriteriaData,
    handleRate,
    handleDeleteRating,
    handleCriterionRate,
  };
}
