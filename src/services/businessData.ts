import { collection, query, where, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter, commentLikeConverter } from '../config/converters';
import { measuredGetDocs, measuredGetDoc } from '../utils/perfMetrics';
import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';

export type BusinessDataCollectionName = 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags' | 'priceLevels' | 'menuPhotos';

interface BusinessDataResult {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
}

export async function fetchSingleCollection(bId: string, uid: string, col: BusinessDataCollectionName) {
  switch (col) {
    case 'favorites': {
      const snap = await measuredGetDoc('businessData_favorite', doc(db, COLLECTIONS.FAVORITES, `${uid}__${bId}`));
      return { isFavorite: snap.exists() };
    }
    case 'ratings': {
      const snap = await measuredGetDocs('businessData_ratings', query(
        collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
        where('businessId', '==', bId),
      ));
      return { ratings: snap.docs.map((d) => d.data()) };
    }
    case 'comments': {
      const [snap, likesSnap] = await Promise.all([
        measuredGetDocs('businessData_comments', query(
          collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
          where('businessId', '==', bId),
        )),
        measuredGetDocs('businessData_userLikes', query(
          collection(db, COLLECTIONS.COMMENT_LIKES).withConverter(commentLikeConverter),
          where('userId', '==', uid),
          where('businessId', '==', bId),
        )),
      ]);
      const result = snap.docs.map((d) => d.data()).filter((c) => !c.flagged);
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const userCommentLikes = new Set(likesSnap.docs.map((d) => d.data().commentId));
      return { comments: result, userCommentLikes };
    }
    case 'userTags': {
      const snap = await measuredGetDocs('businessData_userTags', query(
        collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
        where('businessId', '==', bId),
      ));
      return { userTags: snap.docs.map((d) => d.data()) };
    }
    case 'customTags': {
      const snap = await measuredGetDocs('businessData_customTags', query(
        collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
        where('userId', '==', uid),
        where('businessId', '==', bId),
      ));
      const result = snap.docs.map((d) => d.data());
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return { customTags: result };
    }
    case 'priceLevels': {
      const snap = await measuredGetDocs('businessData_priceLevels', query(
        collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
        where('businessId', '==', bId),
      ));
      return { priceLevels: snap.docs.map((d) => d.data()) };
    }
    case 'menuPhotos': {
      const snap = await measuredGetDocs('businessData_menuPhotos', query(
        collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
        where('businessId', '==', bId),
        where('status', '==', 'approved'),
      ));
      return { menuPhoto: snap.empty ? null : snap.docs[0].data() };
    }
  }
}

export async function fetchBusinessData(bId: string, uid: string): Promise<BusinessDataResult> {
  const favDocId = `${uid}__${bId}`;

  const [favSnap, ratingsSnap, commentsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap, likesSnap] = await Promise.all([
    measuredGetDoc('businessData_favorite', doc(db, COLLECTIONS.FAVORITES, favDocId)),
    measuredGetDocs('businessData_ratings', query(
      collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
      where('businessId', '==', bId),
    )),
    measuredGetDocs('businessData_comments', query(
      collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
      where('businessId', '==', bId),
    )),
    measuredGetDocs('businessData_userTags', query(
      collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
      where('businessId', '==', bId),
    )),
    measuredGetDocs('businessData_customTags', query(
      collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
      where('userId', '==', uid),
      where('businessId', '==', bId),
    )),
    measuredGetDocs('businessData_priceLevels', query(
      collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
      where('businessId', '==', bId),
    )),
    measuredGetDocs('businessData_menuPhotos', query(
      collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
      where('businessId', '==', bId),
      where('status', '==', 'approved'),
    )),
    measuredGetDocs('businessData_userLikes', query(
      collection(db, COLLECTIONS.COMMENT_LIKES).withConverter(commentLikeConverter),
      where('userId', '==', uid),
      where('businessId', '==', bId),
    )),
  ]);

  const commentsResult = commentsSnap.docs.map((d) => d.data()).filter((c) => !c.flagged);
  commentsResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const customTagsResult = customTagsSnap.docs.map((d) => d.data());
  customTagsResult.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const userCommentLikes = new Set(likesSnap.docs.map((d) => d.data().commentId));

  return {
    isFavorite: favSnap.exists(),
    ratings: ratingsSnap.docs.map((d) => d.data()),
    comments: commentsResult,
    userTags: userTagsSnap.docs.map((d) => d.data()),
    customTags: customTagsResult,
    userCommentLikes,
    priceLevels: priceLevelsSnap.docs.map((d) => d.data()),
    menuPhoto: menuPhotoSnap.empty ? null : menuPhotoSnap.docs[0].data(),
  };
}
