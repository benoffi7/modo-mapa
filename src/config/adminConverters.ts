import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { AdminCounters, DailyMetrics, AbuseLog } from '../types/admin';
import type { PerfMetricsDoc } from '../types/perfMetrics';
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
      commentLikes: asNumber(d.commentLikes),
      dailyReads: asNumber(d.dailyReads),
      dailyWrites: asNumber(d.dailyWrites),
      dailyDeletes: asNumber(d.dailyDeletes),
    };
  },
};

function asNumberOrNull(val: unknown): number | null {
  return typeof val === 'number' ? val : null;
}

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
      newAccounts: asNumber(d.newAccounts),
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
      reviewed: d.reviewed === true,
      dismissed: d.dismissed === true,
      reviewedAt: d.reviewedAt ? toDate(d.reviewedAt) : undefined,
      severity: (d.severity === 'low' || d.severity === 'medium' || d.severity === 'high')
        ? d.severity
        : undefined,
    };
  },
};

function asQueryTimingRecord(val: unknown): Record<string, { p50: number; p95: number; count: number }> {
  if (val == null || typeof val !== 'object' || Array.isArray(val)) return {};
  const result: Record<string, { p50: number; p95: number; count: number }> = {};
  for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
    if (v && typeof v === 'object') {
      const q = v as Record<string, unknown>;
      result[key] = { p50: asNumber(q.p50), p95: asNumber(q.p95), count: asNumber(q.count) };
    }
  }
  return result;
}

export const perfMetricsConverter: FirestoreDataConverter<PerfMetricsDoc> = {
  toFirestore(data: PerfMetricsDoc) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): PerfMetricsDoc {
    const d = snap.data(options);
    const vitals = (d.vitals && typeof d.vitals === 'object') ? d.vitals as Record<string, unknown> : {};
    const device = (d.device && typeof d.device === 'object') ? d.device as Record<string, unknown> : {};
    return {
      sessionId: String(d.sessionId ?? ''),
      userId: d.userId ? String(d.userId) : null,
      timestamp: d.timestamp,
      vitals: {
        lcp: asNumberOrNull(vitals.lcp),
        inp: asNumberOrNull(vitals.inp),
        cls: asNumberOrNull(vitals.cls),
        ttfb: asNumberOrNull(vitals.ttfb),
      },
      queries: asQueryTimingRecord(d.queries),
      device: {
        type: (device.type === 'mobile' ? 'mobile' : 'desktop') as 'mobile' | 'desktop',
        connection: String(device.connection ?? 'unknown'),
      },
      appVersion: String(d.appVersion ?? ''),
    };
  },
};
