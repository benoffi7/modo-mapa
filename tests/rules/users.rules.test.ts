/**
 * Suite de referencia para `firestore.rules` — coleccion `users/{userId}`.
 *
 * Cubre R6 (`hasOnly()` whitelist), R7 (displayName charset + length)
 * y R12 (`displayNameLower` bidireccional). Total: 16 tests.
 *
 * Regression sentinel: si se remueve el check bidireccional
 * (`displayNameLower == displayName.lower()`) de `firestore.rules`,
 * los tests "R12 update unidireccional -> DENY" y
 * "R12 create lower != name.lower() -> DENY" pasan a ALLOW y este
 * suite falla. Verificacion automatizada — no walkthrough manual.
 * Cross-ref: #322 specs L240-247, #332 specs S3.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  doc,
  setDoc,
  updateDoc,
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

/**
 * Payload base valido para create — los 4 campos del whitelist en sync.
 */
function validCreatePayload(displayName = 'Pedro_Garcia') {
  return {
    displayName,
    displayNameLower: displayName.toLowerCase(),
    avatarId: 'avatar_1',
    createdAt: serverTimestamp(),
  };
}

/**
 * Semilla un user doc usando el admin context (bypass rules).
 * Util para preparar el estado previo a tests de update.
 */
async function seedUser(
  env: RulesTestEnvironment,
  uid: string,
  data: Record<string, unknown>
): Promise<void> {
  await withAdminContext(env, async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

describe('firestore.rules — users/{userId}', () => {
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
  // R6 — hasOnly() whitelist en users
  // ----------------------------------------------------------------
  describe('R6 — hasOnly() whitelist (create + update)', () => {
    it('1. create con campo extra fuera del whitelist (isAdmin) -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = {
        ...validCreatePayload(),
        isAdmin: true, // campo no whitelisted
      };
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('2. create sin campo requerido (falta displayName) -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = {
        displayNameLower: 'pedro_garcia',
        avatarId: 'avatar_1',
        createdAt: serverTimestamp(),
      };
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('3. update agregando campo nuevo no listado en affectedKeys hasOnly -> DENY', async () => {
      await seedUser(env, UID, {
        displayName: 'Pedro_Garcia',
        displayNameLower: 'pedro_garcia',
        avatarId: 'avatar_1',
        createdAt: new Date(),
      });
      const ctx = authedContext(env, UID);
      await expectDeny(
        updateDoc(doc(ctx.firestore(), 'users', UID), {
          // displayName / displayNameLower / avatarId estan permitidos,
          // `email` no.
          email: 'pedro@example.com',
        })
      );
    });

    it('4. create con exactamente los 4 campos del whitelist -> ALLOW', async () => {
      const ctx = authedContext(env, UID);
      const payload = validCreatePayload();
      await expectAllow(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });
  });

  // ----------------------------------------------------------------
  // R7 — displayName charset + length
  // ----------------------------------------------------------------
  describe('R7 — displayName charset + length', () => {
    it('5. displayName vacio ("") -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = {
        ...validCreatePayload(''),
        displayNameLower: '',
      };
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('6. displayName > 30 chars -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const longName = 'A'.repeat(31);
      const payload = validCreatePayload(longName);
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('7. displayName con char fuera del regex ("Juan!") -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = validCreatePayload('Juan!');
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('8. displayName valido ("Pedro_Garcia") -> ALLOW', async () => {
      const ctx = authedContext(env, UID);
      const payload = validCreatePayload('Pedro_Garcia');
      await expectAllow(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('9. displayName all-whitespace ("   ") -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = validCreatePayload('   ');
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });
  });

  // ----------------------------------------------------------------
  // R12 — displayNameLower bidireccional (REGRESSION SENTINEL)
  // ----------------------------------------------------------------
  // Regression sentinel: si se remueve el check bidireccional
  // (displayNameLower == displayName.lower()) de firestore.rules, los tests
  // "R12 update unidireccional -> DENY" y "R12 create lower != name.lower() -> DENY"
  // pasan a ALLOW y este suite falla aca. Verificacion automatizada — no
  // walkthrough manual. Cross-ref: #322 specs L240-247, #332 specs S3.
  describe('R12 — displayNameLower bidireccional', () => {
    it('10. create con displayNameLower != displayName.lower() -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = {
        displayName: 'Juan',
        displayNameLower: 'pedro', // mismatch intencional
        avatarId: 'avatar_1',
        createdAt: serverTimestamp(),
      };
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('11. create con displayNameLower == displayName.lower() -> ALLOW', async () => {
      const ctx = authedContext(env, UID);
      const payload = {
        displayName: 'Juan',
        displayNameLower: 'juan',
        avatarId: 'avatar_1',
        createdAt: serverTimestamp(),
      };
      await expectAllow(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('12. create con displayName presente pero displayNameLower ausente -> DENY', async () => {
      const ctx = authedContext(env, UID);
      const payload = {
        displayName: 'Juan',
        avatarId: 'avatar_1',
        createdAt: serverTimestamp(),
      };
      await expectDeny(setDoc(doc(ctx.firestore(), 'users', UID), payload));
    });

    it('13. update unidireccional: cambia solo displayName sin actualizar displayNameLower -> DENY', async () => {
      await seedUser(env, UID, {
        displayName: 'Pedro',
        displayNameLower: 'pedro',
        avatarId: 'avatar_1',
        createdAt: new Date(),
      });
      const ctx = authedContext(env, UID);
      // Solo cambia displayName — displayNameLower queda stale.
      await expectDeny(
        updateDoc(doc(ctx.firestore(), 'users', UID), {
          displayName: 'Maria',
        })
      );
    });

    it('14. update bidireccional: cambia ambos campos en sync -> ALLOW', async () => {
      await seedUser(env, UID, {
        displayName: 'Pedro',
        displayNameLower: 'pedro',
        avatarId: 'avatar_1',
        createdAt: new Date(),
      });
      const ctx = authedContext(env, UID);
      await expectAllow(
        updateDoc(doc(ctx.firestore(), 'users', UID), {
          displayName: 'Maria',
          displayNameLower: 'maria',
        })
      );
    });
  });

  // ----------------------------------------------------------------
  // hasOnly() field injection en update
  // ----------------------------------------------------------------
  describe('hasOnly() update field injection', () => {
    it('15. update afectando solo displayName + displayNameLower en sync -> ALLOW', async () => {
      await seedUser(env, UID, {
        displayName: 'Pedro',
        displayNameLower: 'pedro',
        avatarId: 'avatar_1',
        createdAt: new Date(),
      });
      const ctx = authedContext(env, UID);
      await expectAllow(
        updateDoc(doc(ctx.firestore(), 'users', UID), {
          displayName: 'Pedro_Garcia',
          displayNameLower: 'pedro_garcia',
        })
      );
    });

    it('16. update afectando displayName + campo extra (isAdmin) -> DENY', async () => {
      await seedUser(env, UID, {
        displayName: 'Pedro',
        displayNameLower: 'pedro',
        avatarId: 'avatar_1',
        createdAt: new Date(),
      });
      const ctx = authedContext(env, UID);
      await expectDeny(
        updateDoc(doc(ctx.firestore(), 'users', UID), {
          displayName: 'Pedro_Garcia',
          displayNameLower: 'pedro_garcia',
          isAdmin: true, // campo no whitelisted en affectedKeys()
        })
      );
    });
  });
});
