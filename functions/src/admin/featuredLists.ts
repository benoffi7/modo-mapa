import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK, ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
/**
 * Page size cap LOCAL para `getFeaturedLists`. Es callable publica (todos
 * los usuarios autenticados), por eso usa un cap mas estricto que el global
 * `MAX_PAGE_SIZE = 500` de los callables admin (`getPublicLists`,
 * `toggleFeaturedList`). Defensa contra scraping de listas destacadas.
 */
const FEATURED_LISTS_MAX_PAGE_SIZE = 100;

/** Extract optional databaseId from callable request data. */
function extractDbId(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'databaseId' in data) {
    const id = (data as { databaseId?: unknown }).databaseId;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

/**
 * Parse & clamp page size from the request payload.
 *
 * @param maxOverride opcional. Cap mas estricto que `MAX_PAGE_SIZE` para
 *   callables publicas (e.g. `getFeaturedLists` usa 100). El default
 *   sigue clampado contra el cap efectivo para proteger regresiones
 *   futuras si alguien sube `DEFAULT_PAGE_SIZE` por encima del override.
 */
function extractPageSize(data: unknown, maxOverride?: number): number {
  const cap = maxOverride ?? MAX_PAGE_SIZE;
  if (data && typeof data === 'object' && 'pageSize' in data) {
    const raw = (data as { pageSize?: unknown }).pageSize;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return Math.min(Math.floor(raw), cap);
    }
  }
  return Math.min(DEFAULT_PAGE_SIZE, cap);
}

function extractStartAfter(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'startAfter' in data) {
    const raw = (data as { startAfter?: unknown }).startAfter;
    if (typeof raw === 'string' && raw.length > 0 && raw.length <= 128) return raw;
  }
  return undefined;
}

export const toggleFeaturedList = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
  async (request) => {
    assertAdmin(request.auth);

    const { listId, featured } = request.data as {
      listId: string;
      featured: boolean;
    };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (typeof featured !== 'boolean') {
      throw new HttpsError('invalid-argument', 'featured must be boolean');
    }

    const db = getDb(extractDbId(request.data));
    const listRef = db.doc(`sharedLists/${listId}`);
    const snap = await listRef.get();

    if (!snap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    if (featured && !snap.data()?.isPublic) {
      throw new HttpsError('failed-precondition', 'Solo listas públicas pueden ser destacadas');
    }

    await listRef.update({ featured });
    return { success: true };
  },
);

interface ListData {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  itemCount: number;
}

interface ListPage {
  lists: ListData[];
  nextCursor: string | null;
}

export const getPublicLists = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
  async (request): Promise<ListPage> => {
    assertAdmin(request.auth);

    const db = getDb(extractDbId(request.data));
    const pageSize = extractPageSize(request.data);
    const startAfterId = extractStartAfter(request.data);

    let q = db
      .collection('sharedLists')
      .where('isPublic', '==', true)
      .orderBy('updatedAt', 'desc')
      .limit(pageSize);

    if (startAfterId) {
      const cursorSnap = await db.doc(`sharedLists/${startAfterId}`).get();
      if (cursorSnap.exists) {
        q = q.startAfter(cursorSnap);
      }
    }

    const snap = await q.get();
    const lists: ListData[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: String(data.ownerId ?? ''),
        name: String(data.name ?? ''),
        description: String(data.description ?? ''),
        isPublic: true,
        featured: data.featured === true,
        itemCount: Number(data.itemCount ?? 0),
      };
    });

    const nextCursor = snap.size === pageSize && snap.size > 0
      ? snap.docs[snap.size - 1].id
      : null;

    return { lists, nextCursor };
  },
);

/** Public callable — returns featured lists for any authenticated user. */
export const getFeaturedLists = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request): Promise<ListPage> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const db = getDb(extractDbId(request.data));
    await checkCallableRateLimit(db, `featured_lists_${request.auth.uid}`, 60, request.auth.uid);
    const pageSize = extractPageSize(request.data, FEATURED_LISTS_MAX_PAGE_SIZE);
    const startAfterId = extractStartAfter(request.data);

    let q = db
      .collection('sharedLists')
      .where('featured', '==', true)
      .orderBy('updatedAt', 'desc')
      .limit(pageSize);

    if (startAfterId) {
      const cursorSnap = await db.doc(`sharedLists/${startAfterId}`).get();
      if (cursorSnap.exists) {
        q = q.startAfter(cursorSnap);
      }
    }

    const snap = await q.get();
    const lists: ListData[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: String(data.ownerId ?? ''),
        name: String(data.name ?? ''),
        description: String(data.description ?? ''),
        isPublic: data.isPublic === true,
        featured: true,
        itemCount: Number(data.itemCount ?? 0),
      };
    });

    const nextCursor = snap.size === pageSize && snap.size > 0
      ? snap.docs[snap.size - 1].id
      : null;

    return { lists, nextCursor };
  },
);
