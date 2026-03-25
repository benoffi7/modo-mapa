import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { UserProfile, Rating, RatingCriteria, Comment, CommentLike, UserTag, CustomTag, Favorite, Feedback, FeedbackCategory, FeedbackStatus, MenuPhoto, PriceLevel, UserRanking, UserRankingEntry, AppNotification, NotificationType, UserSettings, SharedList, ListItem, TrendingData, TrendingBusiness, CheckIn, Follow, ActivityFeedItem, ActivityType, Recommendation } from '../types';
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
      ...(rating.criteria != null && { criteria: rating.criteria }),
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
      ...(d.criteria != null && { criteria: d.criteria as RatingCriteria }),
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
      ...(comment.type && { type: comment.type }),
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
      ...(d.parentId != null && { parentId: d.parentId as string }),
      ...(d.replyCount != null && { replyCount: d.replyCount as number }),
      ...(d.type === 'comment' || d.type === 'question' ? { type: d.type } : {}),
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
      status: fb.status,
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
      status: (d.status as FeedbackStatus) ?? 'pending',
      createdAt: toDate(d.createdAt),
      ...(d.flagged === true ? { flagged: true } : {}),
      ...(d.adminResponse != null && { adminResponse: d.adminResponse as string }),
      ...(d.respondedAt != null && { respondedAt: toDate(d.respondedAt) }),
      ...(d.respondedBy != null && { respondedBy: d.respondedBy as string }),
      ...(d.viewedByUser === true && { viewedByUser: true }),
      ...(d.mediaUrl != null && { mediaUrl: d.mediaUrl as string }),
      ...(d.mediaType != null && { mediaType: d.mediaType as 'image' | 'video' | 'pdf' }),
      ...(d.githubIssueUrl != null && { githubIssueUrl: d.githubIssueUrl as string }),
      ...(d.businessId != null && { businessId: d.businessId as string }),
      ...(d.businessName != null && { businessName: d.businessName as string }),
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

export const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings) {
    return {
      profilePublic: settings.profilePublic,
      notificationsEnabled: settings.notificationsEnabled,
      notifyLikes: settings.notifyLikes,
      notifyPhotos: settings.notifyPhotos,
      notifyRankings: settings.notifyRankings,
      notifyFeedback: settings.notifyFeedback,
      notifyReplies: settings.notifyReplies,
      notifyFollowers: settings.notifyFollowers,
      notifyRecommendations: settings.notifyRecommendations,
      analyticsEnabled: settings.analyticsEnabled,
      ...(settings.locality != null && { locality: settings.locality }),
      ...(settings.localityLat != null && { localityLat: settings.localityLat }),
      ...(settings.localityLng != null && { localityLng: settings.localityLng }),
      updatedAt: settings.updatedAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserSettings {
    const d = snapshot.data(options);
    return {
      profilePublic: d.profilePublic ?? false,
      notificationsEnabled: d.notificationsEnabled ?? false,
      notifyLikes: d.notifyLikes ?? false,
      notifyPhotos: d.notifyPhotos ?? false,
      notifyRankings: d.notifyRankings ?? false,
      notifyFeedback: d.notifyFeedback ?? true,
      notifyReplies: d.notifyReplies ?? true,
      notifyFollowers: d.notifyFollowers ?? true,
      notifyRecommendations: d.notifyRecommendations ?? true,
      analyticsEnabled: d.analyticsEnabled ?? false,
      ...(d.locality != null && { locality: d.locality }),
      ...(d.localityLat != null && { localityLat: d.localityLat }),
      ...(d.localityLng != null && { localityLng: d.localityLng }),
      updatedAt: toDate(d.updatedAt),
    };
  },
};

export const sharedListConverter: FirestoreDataConverter<SharedList> = {
  toFirestore(list: SharedList) {
    return {
      ownerId: list.ownerId,
      name: list.name,
      description: list.description,
      isPublic: list.isPublic,
      featured: list.featured,
      editorIds: list.editorIds,
      itemCount: list.itemCount,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): SharedList {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      ownerId: String(d.ownerId ?? ''),
      name: String(d.name ?? ''),
      description: String(d.description ?? ''),
      isPublic: d.isPublic === true,
      featured: d.featured === true,
      editorIds: Array.isArray(d.editorIds) ? d.editorIds as string[] : [],
      itemCount: Number(d.itemCount ?? 0),
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
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

export const listItemConverter: FirestoreDataConverter<ListItem> = {
  toFirestore(item: ListItem) {
    return {
      listId: item.listId,
      businessId: item.businessId,
      addedBy: item.addedBy,
      createdAt: item.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): ListItem {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      listId: String(d.listId ?? ''),
      businessId: String(d.businessId ?? ''),
      addedBy: String(d.addedBy ?? ''),
      createdAt: toDate(d.createdAt),
    };
  },
};

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
