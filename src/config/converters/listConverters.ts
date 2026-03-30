import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { SharedList, ListItem } from '../../types';
import { toDate } from '../../utils/formatDate';

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
