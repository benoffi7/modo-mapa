/**
 * Suite de referencia para `firestore.rules` — coleccion `commentLikes/{docId}`.
 *
 * Cubre el cambio de #343 (cerrar guard #302 R3): el write de un like ahora
 * incluye `businessId` (formato `biz_NNN`), validado por `isValidBusinessId()`
 * dentro del `hasOnly()` whitelist. La query de likes filtra por
 * (userId == auth.uid, businessId), por lo que un usuario solo ve sus likes.
 *
 * Regression sentinel: si se quita `isValidBusinessId(...)` o `businessId` del
 * `hasOnly()` de `firestore.rules`, los tests de DENY (businessId invalido /
 * ausente) pasan a ALLOW y este suite falla. Verificacion automatizada.
 * Cross-ref: #343 specs "Firestore Rules", guard #302 R3.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  authedContext,
  clearFirestore,
  createRulesTestEnv,
  expectAllow,
  expectDeny,
  withAdminContext,
} from './setup';

const UID = 'user_alice';
const OTHER_UID = 'user_bob';
const COMMENT_ID = 'comment_123';
const BUSINESS_ID = 'biz_001';

function docId(uid = UID, commentId = COMMENT_ID): string {
  return `${uid}__${commentId}`;
}

/** Payload base valido para create — los 4 campos del whitelist. */
function validCreatePayload(overrides: Record<string, unknown> = {}) {
  return {
    userId: UID,
    commentId: COMMENT_ID,
    businessId: BUSINESS_ID,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/** Siembra un like via admin context (bypass rules) para tests de delete. */
async function seedLike(env: RulesTestEnvironment, uid: string): Promise<void> {
  await withAdminContext(env, async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'commentLikes', docId(uid)), {
      userId: uid,
      commentId: COMMENT_ID,
      businessId: BUSINESS_ID,
      createdAt: new Date(),
    });
  });
}

describe('firestore.rules — commentLikes/{docId}', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesTestEnv();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await clearFirestore(env);
  });

  // ----------------------------------------------------------------
  // CREATE — allow + deny
  // ----------------------------------------------------------------
  describe('create', () => {
    it('1. owner con businessId valido + commentId no vacio + timestamp -> ALLOW', async () => {
      const ctx = authedContext(env, UID);
      await expectAllow(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), validCreatePayload()),
      );
    });

    it('2. businessId invalido (no biz_NNN) -> DENY', async () => {
      const ctx = authedContext(env, UID);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), validCreatePayload({ businessId: 'not_a_biz' })),
      );
    });

    it('3. businessId ausente -> DENY', async () => {
      const ctx = authedContext(env, UID);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), {
          userId: UID,
          commentId: COMMENT_ID,
          createdAt: serverTimestamp(),
        }),
      );
    });

    it('4. campo extra fuera del whitelist -> DENY', async () => {
      const ctx = authedContext(env, UID);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), validCreatePayload({ extra: 'x' })),
      );
    });

    it('5. userId != auth.uid -> DENY', async () => {
      const ctx = authedContext(env, UID);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), validCreatePayload({ userId: OTHER_UID })),
      );
    });

    it('6. commentId vacio -> DENY', async () => {
      const ctx = authedContext(env, UID);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), validCreatePayload({ commentId: '' })),
      );
    });

    it('7. createdAt != request.time -> DENY', async () => {
      const ctx = authedContext(env, UID);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'commentLikes', docId()), validCreatePayload({ createdAt: new Date(2020, 0, 1) })),
      );
    });
  });

  // ----------------------------------------------------------------
  // DELETE — allow owner, deny non-owner
  // ----------------------------------------------------------------
  describe('delete', () => {
    it('8. owner borra su like -> ALLOW', async () => {
      await seedLike(env, UID);
      const ctx = authedContext(env, UID);
      await expectAllow(deleteDoc(doc(ctx.firestore(), 'commentLikes', docId(UID))));
    });

    it('9. no-owner intenta borrar like ajeno -> DENY', async () => {
      await seedLike(env, UID);
      const ctx = authedContext(env, OTHER_UID);
      await expectDeny(deleteDoc(doc(ctx.firestore(), 'commentLikes', docId(UID))));
    });
  });

  // ----------------------------------------------------------------
  // READ — autenticado
  // ----------------------------------------------------------------
  describe('read', () => {
    it('10. usuario autenticado puede leer -> ALLOW', async () => {
      await seedLike(env, UID);
      const ctx = authedContext(env, OTHER_UID);
      const { getDoc } = await import('firebase/firestore');
      await expectAllow(getDoc(doc(ctx.firestore(), 'commentLikes', docId(UID))));
    });
  });
});
