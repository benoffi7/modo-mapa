import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { AdminCounters, DailyMetrics, AbuseLog } from '../types/admin';
import { toDate } from '../utils/formatDate';

function asNumber(val: unknown, fallback = 0): number {
  return typeof val === 'number' ? val : fallback;
}

export const countersConverter: FirestoreDataConverter<AdminCounters> = {
  toFirestore(data: AdminCounters) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): AdminCounters {
    const d = snap.data(options);
    return {
      comments: asNumber(d.comments),
      ratings: asNumber(d.ratings),
      favorites: asNumber(d.favorites),
      feedback: asNumber(d.feedback),
      users: asNumber(d.users),
      customTags: asNumber(d.customTags),
      userTags: asNumber(d.userTags),
      dailyReads: asNumber(d.dailyReads),
      dailyWrites: asNumber(d.dailyWrites),
      dailyDeletes: asNumber(d.dailyDeletes),
    };
  },
};

function asRecord(val: unknown): Record<string, number> {
  return (val != null && typeof val === 'object' && !Array.isArray(val))
    ? val as Record<string, number>
    : {};
}

function asArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val as T[] : [];
}

export const dailyMetricsConverter: FirestoreDataConverter<DailyMetrics> = {
  toFirestore(data: DailyMetrics) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): DailyMetrics {
    const d = snap.data(options);
    return {
      date: snap.id,
      ratingDistribution: asRecord(d.ratingDistribution),
      topFavorited: asArray(d.topFavorited),
      topCommented: asArray(d.topCommented),
      topRated: asArray(d.topRated),
      topTags: asArray(d.topTags),
      dailyReads: asNumber(d.dailyReads),
      dailyWrites: asNumber(d.dailyWrites),
      dailyDeletes: asNumber(d.dailyDeletes),
      writesByCollection: asRecord(d.writesByCollection),
      readsByCollection: asRecord(d.readsByCollection),
      deletesByCollection: asRecord(d.deletesByCollection),
      activeUsers: asNumber(d.activeUsers),
    };
  },
};

export const abuseLogConverter: FirestoreDataConverter<AbuseLog> = {
  toFirestore(data: AbuseLog) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): AbuseLog {
    const d = snap.data(options);
    return {
      id: snap.id,
      userId: String(d.userId ?? ''),
      type: String(d.type ?? 'rate_limit') as AbuseLog['type'],
      collection: String(d.collection ?? ''),
      detail: String(d.detail ?? ''),
      timestamp: toDate(d.timestamp),
    };
  },
};
