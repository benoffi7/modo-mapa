import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { UserProfile, UserSettings } from '../../types';
import { toDate } from '../../utils/formatDate';

export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(profile: UserProfile) {
    return { displayName: profile.displayName, avatarId: profile.avatarId, createdAt: profile.createdAt };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserProfile {
    const d = snapshot.data(options);
    return { displayName: d.displayName, avatarId: d.avatarId, createdAt: toDate(d.createdAt) };
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
      ...(settings.notificationDigest != null && { notificationDigest: settings.notificationDigest }),
      analyticsEnabled: settings.analyticsEnabled,
      ...(settings.locality != null && { locality: settings.locality }),
      ...(settings.localityLat != null && { localityLat: settings.localityLat }),
      ...(settings.localityLng != null && { localityLng: settings.localityLng }),
      ...(settings.followedTags != null && { followedTags: settings.followedTags }),
      ...(settings.followedTagsUpdatedAt != null && { followedTagsUpdatedAt: settings.followedTagsUpdatedAt }),
      ...(settings.followedTagsLastSeenAt != null && { followedTagsLastSeenAt: settings.followedTagsLastSeenAt }),
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
      ...(d.notificationDigest != null && { notificationDigest: d.notificationDigest }),
      analyticsEnabled: d.analyticsEnabled ?? false,
      ...(d.locality != null && { locality: d.locality }),
      ...(d.localityLat != null && { localityLat: d.localityLat }),
      ...(d.localityLng != null && { localityLng: d.localityLng }),
      ...(d.followedTags != null && { followedTags: d.followedTags }),
      ...(d.followedTagsUpdatedAt != null && { followedTagsUpdatedAt: toDate(d.followedTagsUpdatedAt) }),
      ...(d.followedTagsLastSeenAt != null && { followedTagsLastSeenAt: toDate(d.followedTagsLastSeenAt) }),
      updatedAt: toDate(d.updatedAt),
    };
  },
};
