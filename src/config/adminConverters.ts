import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { AdminCounters, DailyMetrics, AbuseLog } from '../types/admin';

export const countersConverter: FirestoreDataConverter<AdminCounters> = {
  toFirestore(data: AdminCounters) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): AdminCounters {
    const d = snap.data(options);
    return {
      comments: (d.comments as number) ?? 0,
      ratings: (d.ratings as number) ?? 0,
      favorites: (d.favorites as number) ?? 0,
      feedback: (d.feedback as number) ?? 0,
      users: (d.users as number) ?? 0,
      customTags: (d.customTags as number) ?? 0,
      userTags: (d.userTags as number) ?? 0,
      dailyReads: (d.dailyReads as number) ?? 0,
      dailyWrites: (d.dailyWrites as number) ?? 0,
      dailyDeletes: (d.dailyDeletes as number) ?? 0,
    };
  },
};

export const dailyMetricsConverter: FirestoreDataConverter<DailyMetrics> = {
  toFirestore(data: DailyMetrics) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): DailyMetrics {
    const d = snap.data(options);
    return {
      date: snap.id,
      ratingDistribution: (d.ratingDistribution as Record<string, number>) ?? {},
      topFavorited: (d.topFavorited as DailyMetrics['topFavorited']) ?? [],
      topCommented: (d.topCommented as DailyMetrics['topCommented']) ?? [],
      topRated: (d.topRated as DailyMetrics['topRated']) ?? [],
      topTags: (d.topTags as DailyMetrics['topTags']) ?? [],
      dailyReads: (d.dailyReads as number) ?? 0,
      dailyWrites: (d.dailyWrites as number) ?? 0,
      dailyDeletes: (d.dailyDeletes as number) ?? 0,
      writesByCollection: (d.writesByCollection as Record<string, number>) ?? {},
      readsByCollection: (d.readsByCollection as Record<string, number>) ?? {},
      deletesByCollection: (d.deletesByCollection as Record<string, number>) ?? {},
      activeUsers: (d.activeUsers as number) ?? 0,
    };
  },
};

function toDate(field: unknown): Date {
  if (field && typeof field === 'object' && 'toDate' in field) {
    return (field as { toDate: () => Date }).toDate();
  }
  return new Date();
}

export const abuseLogConverter: FirestoreDataConverter<AbuseLog> = {
  toFirestore(data: AbuseLog) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): AbuseLog {
    const d = snap.data(options);
    return {
      id: snap.id,
      userId: d.userId as string,
      type: d.type as AbuseLog['type'],
      collection: d.collection as string,
      detail: d.detail as string,
      timestamp: toDate(d.timestamp),
    };
  },
};
