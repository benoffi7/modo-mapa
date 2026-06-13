/**
 * Suite de referencia para `firestore.rules` — coleccion `customTags/{docId}` (#344).
 *
 * Cubre el whitelist de create (`hasOnly(['userId','businessId','label','createdAt'])`),
 * validacion de `label` 1-30, ownership en create/update/delete, y el caso
 * offline-first de doc ID client-side (`setDoc` con ID arbitrario).
 *
 * El cambio de #344 es `addDoc` → `setDoc` con ID client-side: las rules NO cambian
 * (el doc ID no se valida; lo validado son los campos). Este suite es el primer
 * rules test de `customTags` (cierra el checkbox pendiente en tests.md).
 *
 * Observacion de Sofia cubierta: delete de un doc inexistente (el "no-op tolerable"
 * del replay cuando el create fallo) — la rule de delete requiere
 * `resource.data.userId == auth.uid`; sobre un doc ausente `resource == null`, por lo
 * que la rule DENIEGA. En produccion el Firestore SDK no lanza en delete-not-found:
 * el replay del cliente resuelve igual y NO reintenta. Documentado en el test.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  doc,
  setDoc,
  updateDoc,
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

const OWNER = 'user_alice';
const OTHER = 'user_bob';
const BIZ = 'biz_123';
const CLIENT_TAG_ID = 'clientGeneratedTagId123';

function validCreatePayload(over: Record<string, unknown> = {}) {
  return {
    userId: OWNER,
    businessId: BIZ,
    label: 'Pet friendly',
    createdAt: serverTimestamp(),
    ...over,
  };
}

async function seedTag(
  env: RulesTestEnvironment,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await withAdminContext(env, async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'customTags', docId), data);
  });
}

describe('firestore.rules — customTags/{docId} (#344)', () => {
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

  describe('create — whitelist + client-side ID', () => {
    it('1. create con ID client-side + label valido + owner -> ALLOW', async () => {
      const ctx = authedContext(env, OWNER);
      await expectAllow(
        setDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), validCreatePayload()),
      );
    });

    it('2. create con label > 30 chars -> DENY', async () => {
      const ctx = authedContext(env, OWNER);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), validCreatePayload({ label: 'A'.repeat(31) })),
      );
    });

    it('3. create con label vacio -> DENY', async () => {
      const ctx = authedContext(env, OWNER);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), validCreatePayload({ label: '' })),
      );
    });

    it('4. create con campo extra fuera del whitelist -> DENY', async () => {
      const ctx = authedContext(env, OWNER);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), validCreatePayload({ isAdmin: true })),
      );
    });

    it('5. create con userId ajeno (no puede impersonar otro owner) -> DENY', async () => {
      const ctx = authedContext(env, OWNER);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), validCreatePayload({ userId: OTHER })),
      );
    });

    it('6. create con businessId invalido -> DENY', async () => {
      const ctx = authedContext(env, OWNER);
      await expectDeny(
        setDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), validCreatePayload({ businessId: 'not-a-biz' })),
      );
    });
  });

  describe('update — solo label, ownership', () => {
    it('7. update solo del label por el owner -> ALLOW', async () => {
      await seedTag(env, CLIENT_TAG_ID, { userId: OWNER, businessId: BIZ, label: 'Old', createdAt: new Date() });
      const ctx = authedContext(env, OWNER);
      await expectAllow(updateDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), { label: 'New' }));
    });

    it('8. update afectando un campo fuera de label -> DENY', async () => {
      await seedTag(env, CLIENT_TAG_ID, { userId: OWNER, businessId: BIZ, label: 'Old', createdAt: new Date() });
      const ctx = authedContext(env, OWNER);
      await expectDeny(updateDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), { businessId: 'biz_999' }));
    });

    it('9. update por un usuario que no es el owner -> DENY', async () => {
      await seedTag(env, CLIENT_TAG_ID, { userId: OWNER, businessId: BIZ, label: 'Old', createdAt: new Date() });
      const ctx = authedContext(env, OTHER);
      await expectDeny(updateDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID), { label: 'Hacked' }));
    });
  });

  describe('delete — ownership + no-op de doc inexistente', () => {
    it('10. delete por el owner -> ALLOW', async () => {
      await seedTag(env, CLIENT_TAG_ID, { userId: OWNER, businessId: BIZ, label: 'Old', createdAt: new Date() });
      const ctx = authedContext(env, OWNER);
      await expectAllow(deleteDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID)));
    });

    it('11. delete por otro owner -> DENY', async () => {
      await seedTag(env, CLIENT_TAG_ID, { userId: OWNER, businessId: BIZ, label: 'Old', createdAt: new Date() });
      const ctx = authedContext(env, OTHER);
      await expectDeny(deleteDoc(doc(ctx.firestore(), 'customTags', CLIENT_TAG_ID)));
    });

    it('12. delete de doc inexistente -> la rule DENIEGA (resource ausente); en prod el SDK no lanza, el replay resuelve sin reintentar', async () => {
      // Caso "create fallo permanentemente, luego delete offline del mismo tagId".
      // La rule `delete: resource.data.userId == auth.uid` no puede evaluar sobre un
      // doc ausente, asi que assertFails. Comportamiento documentado: el cliente
      // (Firestore SDK) NO lanza en delete-not-found, por lo que executeAction del
      // replay resuelve OK y NO llega a OFFLINE_MAX_RETRIES. Cubierto en syncEngine.test.
      const ctx = authedContext(env, OWNER);
      await expectDeny(deleteDoc(doc(ctx.firestore(), 'customTags', 'does-not-exist')));
    });
  });
});
