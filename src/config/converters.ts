import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { UserProfile, Rating, Comment, UserTag, CustomTag, Favorite } from '../types';

function toDate(field: unknown): Date {
  if (field && typeof field === 'object' && 'toDate' in field) {
    return (field as { toDate: () => Date }).toDate();
  }
  return new Date();
}

export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(profile: UserProfile) {
    return { displayName: profile.displayName, createdAt: profile.createdAt };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserProfile {
    const d = snapshot.data(options);
    return { displayName: d.displayName, createdAt: toDate(d.createdAt) };
  },
};

export const ratingConverter: FirestoreDataConverter<Rating> = {
  toFirestore(rating: Rating) {
    return {
      userId: rating.userId,
      businessId: rating.businessId,
      score: rating.score,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Rating {
    const d = snapshot.data(options);
    return {
      userId: d.userId,
      businessId: d.businessId,
      score: d.score,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  },
};

export const commentConverter: FirestoreDataConverter<Comment> = {
  toFirestore(comment: Comment) {
    return {
      userId: comment.userId,
      userName: comment.userName,
      businessId: comment.businessId,
      text: comment.text,
      createdAt: comment.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Comment {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      userName: d.userName,
      businessId: d.businessId,
      text: d.text,
      createdAt: toDate(d.createdAt),
    };
  },
};

export const userTagConverter: FirestoreDataConverter<UserTag> = {
  toFirestore(tag: UserTag) {
    return {
      userId: tag.userId,
      businessId: tag.businessId,
      tagId: tag.tagId,
      createdAt: tag.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserTag {
    const d = snapshot.data(options);
    return {
      userId: d.userId,
      businessId: d.businessId,
      tagId: d.tagId,
      createdAt: toDate(d.createdAt),
    };
  },
};

export const customTagConverter: FirestoreDataConverter<CustomTag> = {
  toFirestore(tag: CustomTag) {
    return {
      userId: tag.userId,
      businessId: tag.businessId,
      label: tag.label,
      createdAt: tag.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): CustomTag {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      businessId: d.businessId,
      label: d.label,
      createdAt: toDate(d.createdAt),
    };
  },
};

export const favoriteConverter: FirestoreDataConverter<Favorite> = {
  toFirestore(fav: Favorite) {
    return {
      userId: fav.userId,
      businessId: fav.businessId,
      createdAt: fav.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Favorite {
    const d = snapshot.data(options);
    return {
      userId: d.userId,
      businessId: d.businessId,
      createdAt: toDate(d.createdAt),
    };
  },
};
