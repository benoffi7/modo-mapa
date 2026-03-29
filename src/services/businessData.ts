import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter } from '../config/converters';
import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';

export type BusinessDataCollectionName = 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags' | 'priceLevels' | 'menuPhotos';

export interface BusinessDataResult {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
}

/** Fetch user's likes for a set of comment IDs using batched documentId() queries. */
export async function fetchUserLikes(uid: string, commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();

  const docIds = commentIds.map((cId) => `${uid}__${cId}`);
  const BATCH_SIZE = 30;
  const liked = new Set<string>();

  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batch = docIds.slice(i, i + BATCH_SIZE);
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.COMMENT_LIKES),
      where(documentId(), 'in', batch),
    ));
    for (const d of snap.docs) {
      const commentId = d.id.split('__')[1];
      liked.add(commentId);
    }
  }

  return liked;
}

export async function fetchSingleCollection(bId: string, uid: string, col: BusinessDataCollectionName) {
  switch (col) {
    case 'favorites': {
      const snap = await getDoc(doc(db, COLLECTIONS.FAVORITES, `${uid}__${bId}`));
      return { isFavorite: snap.exists() };
    }
    case 'ratings': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
        where('businessId', '==', bId),
      ));
      return { ratings: snap.docs.map((d) => d.data()) };
    }
    case 'comments': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
        where('businessId', '==', bId),
      ));
      const result = snap.docs.map((d) => d.data()).filter((c) => !c.flagged);
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const userCommentLikes = await fetchUserLikes(uid, result.map((c) => c.id));
      return { comments: result, userCommentLikes };
    }
    case 'userTags': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
        where('businessId', '==', bId),
      ));
      return { userTags: snap.docs.map((d) => d.data()) };
    }
    case 'customTags': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
        where('userId', '==', uid),
        where('businessId', '==', bId),
      ));
      const result = snap.docs.map((d) => d.data());
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return { customTags: result };
    }
    case 'priceLevels': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
        where('businessId', '==', bId),
      ));
      return { priceLevels: snap.docs.map((d) => d.data()) };
    }
    case 'menuPhotos': {
      const snap = await getDocs(query(
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

  const [favSnap, ratingsSnap, commentsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.FAVORITES, favDocId)),
    getDocs(query(
      collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
      where('userId', '==', uid),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
      where('businessId', '==', bId),
      where('status', '==', 'approved'),
    )),
  ]);

  const commentsResult = commentsSnap.docs.map((d) => d.data()).filter((c) => !c.flagged);
  commentsResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const customTagsResult = customTagsSnap.docs.map((d) => d.data());
  customTagsResult.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const userCommentLikes = await fetchUserLikes(uid, commentsResult.map((c) => c.id));

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
