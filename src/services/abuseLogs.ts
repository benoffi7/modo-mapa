import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { abuseLogConverter } from '../config/adminConverters';
import type { AbuseLog } from '../types/admin';

/**
 * Subscribes to real-time abuse logs, ordered by timestamp descending.
 *
 * NOTE — Perf instrumentation: esta funcion usa `onSnapshot` (subscription, no
 * promise), por lo cual el patron `measureAsync` / `measuredGetDoc` /
 * `measuredGetDocs` de `src/utils/perfMetrics.ts` no aplica directamente —
 * no hay una promise asincronica que envolver. El check 6 de
 * `scripts/pre-staging-check.sh` solo flagea `getDoc`/`getDocs` raw, no
 * `onSnapshot`, por lo cual NO se requiere el marker `// perf-instrument-ok`
 * (que tiene semantica especifica: suprimir el flag de read raw envuelto en
 * un `Promise.all` ya medido). Si en el futuro se desea telemetria de
 * tiempo-hasta-primer-snapshot, usar `trackEvent('admin_abuse_subscribe', { ms })`
 * con un timer manual (deferido — entrada futura en `docs/reports/tech-debt.md`).
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
