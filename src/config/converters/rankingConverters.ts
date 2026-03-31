import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { UserRanking, UserRankingEntry, AppNotification, NotificationType, TrendingData, TrendingBusiness } from '../../types';
import { toDate } from '../../utils/formatDate';

export const userRankingConverter: FirestoreDataConverter<UserRanking> = {
  toFirestore(ranking: UserRanking) {
    return {
      period: ranking.period,
      startDate: ranking.startDate,
      endDate: ranking.endDate,
      rankings: ranking.rankings,
      totalParticipants: ranking.totalParticipants,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserRanking {
    const d = snapshot.data(options);
    return {
      period: d.period,
      startDate: toDate(d.startDate),
      endDate: toDate(d.endDate),
      rankings: (d.rankings as UserRankingEntry[]) ?? [],
      totalParticipants: (d.totalParticipants as number) ?? 0,
    };
  },
};

export const notificationConverter: FirestoreDataConverter<AppNotification> = {
  toFirestore(notif: AppNotification) {
    return {
      userId: notif.userId,
      type: notif.type,
      message: notif.message,
      read: notif.read,
      createdAt: notif.createdAt,
      expiresAt: notif.expiresAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): AppNotification {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      type: d.type as NotificationType,
      ...(d.actorId != null && { actorId: d.actorId as string }),
      ...(d.actorName != null && { actorName: d.actorName as string }),
      ...(d.businessId != null && { businessId: d.businessId as string }),
      ...(d.businessName != null && { businessName: d.businessName as string }),
      ...(d.referenceId != null && { referenceId: d.referenceId as string }),
      message: d.message ?? '',
      read: d.read ?? false,
      createdAt: toDate(d.createdAt),
      expiresAt: toDate(d.expiresAt),
    };
  },
};

export const trendingDataConverter: FirestoreDataConverter<TrendingData> = {
  toFirestore(data: TrendingData) {
    return { businesses: data.businesses, computedAt: data.computedAt, periodStart: data.periodStart, periodEnd: data.periodEnd };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): TrendingData {
    const d = snapshot.data(options);
    const businesses: TrendingBusiness[] = ((d.businesses ?? []) as Array<Record<string, unknown>>).map((b) => ({
      businessId: String(b.businessId ?? ''),
      name: String(b.name ?? ''),
      category: String(b.category ?? ''),
      score: Number(b.score ?? 0),
      rank: Number(b.rank ?? 0),
      breakdown: {
        ratings: Number((b.breakdown as Record<string, unknown>)?.ratings ?? 0),
        comments: Number((b.breakdown as Record<string, unknown>)?.comments ?? 0),
        userTags: Number((b.breakdown as Record<string, unknown>)?.userTags ?? 0),
        priceLevels: Number((b.breakdown as Record<string, unknown>)?.priceLevels ?? 0),
        listItems: Number((b.breakdown as Record<string, unknown>)?.listItems ?? 0),
      },
    }));
    return {
      businesses,
      computedAt: toDate(d.computedAt),
      periodStart: toDate(d.periodStart),
      periodEnd: toDate(d.periodEnd),
    };
  },
};
