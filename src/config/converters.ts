import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { UserProfile, Rating, Comment, CommentLike, UserTag, CustomTag, Favorite, Feedback, FeedbackCategory, MenuPhoto, PriceLevel } from '../types';
import { toDate } from '../utils/formatDate';

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
      likeCount: (d.likeCount as number) ?? 0,
      ...(d.updatedAt ? { updatedAt: toDate(d.updatedAt) } : {}),
      ...(d.flagged === true ? { flagged: true } : {}),
    };
  },
};

export const commentLikeConverter: FirestoreDataConverter<CommentLike> = {
  toFirestore(like: CommentLike) {
    return { userId: like.userId, commentId: like.commentId, createdAt: like.createdAt };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): CommentLike {
    const d = snapshot.data(options);
    return { userId: d.userId, commentId: d.commentId, createdAt: toDate(d.createdAt) };
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

export const feedbackConverter: FirestoreDataConverter<Feedback> = {
  toFirestore(fb: Feedback) {
    return {
      userId: fb.userId,
      message: fb.message,
      category: fb.category,
      createdAt: fb.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Feedback {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      message: d.message ?? '',
      category: (d.category as FeedbackCategory) ?? 'otro',
      createdAt: toDate(d.createdAt),
      ...(d.flagged === true ? { flagged: true } : {}),
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

export const menuPhotoConverter: FirestoreDataConverter<MenuPhoto> = {
  toFirestore(photo: MenuPhoto) {
    return {
      userId: photo.userId,
      businessId: photo.businessId,
      storagePath: photo.storagePath,
      thumbnailPath: photo.thumbnailPath,
      status: photo.status,
      createdAt: photo.createdAt,
      reportCount: photo.reportCount,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): MenuPhoto {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      businessId: d.businessId,
      storagePath: d.storagePath ?? '',
      thumbnailPath: d.thumbnailPath ?? '',
      status: d.status ?? 'pending',
      ...(d.rejectionReason != null && { rejectionReason: d.rejectionReason as string }),
      ...(d.reviewedBy != null && { reviewedBy: d.reviewedBy as string }),
      ...(d.reviewedAt != null && { reviewedAt: toDate(d.reviewedAt) }),
      createdAt: toDate(d.createdAt),
      reportCount: (d.reportCount as number) ?? 0,
    };
  },
};

export const priceLevelConverter: FirestoreDataConverter<PriceLevel> = {
  toFirestore(pl: PriceLevel) {
    return {
      userId: pl.userId,
      businessId: pl.businessId,
      level: pl.level,
      createdAt: pl.createdAt,
      updatedAt: pl.updatedAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): PriceLevel {
    const d = snapshot.data(options);
    return {
      userId: d.userId,
      businessId: d.businessId,
      level: d.level,
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  },
};
