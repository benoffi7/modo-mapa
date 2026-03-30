import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { Follow, ActivityFeedItem, ActivityType, Recommendation, CheckIn } from '../../types';
import { toDate } from '../../utils/formatDate';

export const followConverter: FirestoreDataConverter<Follow> = {
  toFirestore(follow: Follow) {
    return {
      followerId: follow.followerId,
      followedId: follow.followedId,
      createdAt: follow.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Follow {
    const d = snapshot.data(options);
    return {
      followerId: d.followerId,
      followedId: d.followedId,
      createdAt: toDate(d.createdAt),
    };
  },
};

export const activityFeedItemConverter: FirestoreDataConverter<ActivityFeedItem> = {
  toFirestore(item: ActivityFeedItem) {
    return {
      actorId: item.actorId,
      actorName: item.actorName,
      type: item.type,
      businessId: item.businessId,
      businessName: item.businessName,
      referenceId: item.referenceId,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): ActivityFeedItem {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      actorId: d.actorId,
      actorName: d.actorName,
      type: d.type as ActivityType,
      businessId: d.businessId,
      businessName: d.businessName,
      referenceId: d.referenceId ?? '',
      createdAt: toDate(d.createdAt),
      expiresAt: toDate(d.expiresAt),
    };
  },
};

export const checkinConverter: FirestoreDataConverter<CheckIn> = {
  toFirestore(checkin: CheckIn) {
    return {
      userId: checkin.userId,
      businessId: checkin.businessId,
      businessName: checkin.businessName,
      createdAt: checkin.createdAt,
      ...(checkin.location && { location: checkin.location }),
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): CheckIn {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      businessId: d.businessId,
      businessName: d.businessName,
      createdAt: toDate(d.createdAt),
      ...(d.location != null && { location: d.location as { lat: number; lng: number } }),
    };
  },
};

export const recommendationConverter: FirestoreDataConverter<Recommendation> = {
  toFirestore(rec: Recommendation) {
    return {
      senderId: rec.senderId,
      senderName: rec.senderName,
      recipientId: rec.recipientId,
      businessId: rec.businessId,
      businessName: rec.businessName,
      message: rec.message,
      read: rec.read,
      createdAt: rec.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Recommendation {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      senderId: d.senderId,
      senderName: d.senderName,
      recipientId: d.recipientId,
      businessId: d.businessId,
      businessName: d.businessName ?? '',
      message: d.message ?? '',
      read: d.read === true,
      createdAt: toDate(d.createdAt),
    };
  },
};
