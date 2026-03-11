import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { PublicMetrics, TopTagEntry, TopBusinessEntry, TopRatedEntry } from '../types/metrics';

export const publicMetricsConverter: FirestoreDataConverter<PublicMetrics> = {
  toFirestore(data: PublicMetrics) {
    return { ...data };
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): PublicMetrics {
    const d = snap.data(options);
    return {
      date: snap.id,
      ratingDistribution: (d.ratingDistribution as Record<string, number>) ?? {},
      topFavorited: (d.topFavorited as TopBusinessEntry[]) ?? [],
      topCommented: (d.topCommented as TopBusinessEntry[]) ?? [],
      topRated: (d.topRated as TopRatedEntry[]) ?? [],
      topTags: (d.topTags as TopTagEntry[]) ?? [],
    };
  },
};
