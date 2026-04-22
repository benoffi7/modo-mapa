import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { abuseLogConverter } from '../config/adminConverters';
import type { AbuseLog } from '../types/admin';

/**
 * Subscribes to real-time abuse logs, ordered by timestamp descending.
 */
export function subscribeToAbuseLogs(
  maxDocs: number,
  onNext: (logs: AbuseLog[], docChanges: { type: string; id: string }[]) => void,
  onError: () => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.ABUSE_LOGS).withConverter(abuseLogConverter),
    orderBy('timestamp', 'desc'),
    limit(maxDocs),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((d) => d.data());
      const changes = snapshot.docChanges().map((change) => ({
        type: change.type,
        id: change.doc.id,
      }));
      onNext(logs, changes);
    },
    () => onError(),
  );
}
