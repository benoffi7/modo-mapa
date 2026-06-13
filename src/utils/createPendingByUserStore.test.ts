import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capturamos los callbacks de onAuthStateChanged y los unsubscribe entregados,
// para verificar que el factory registra UN listener y lo libera en __reset.
type AuthCallback = (user: { uid: string } | null) => void;
const authState = vi.hoisted(() => ({
  callbacks: [] as AuthCallback[],
  unsubscribed: 0,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: AuthCallback) => {
    authState.callbacks.push(cb);
    return () => {
      authState.unsubscribed += 1;
    };
  },
}));

vi.mock('../config/firebase', () => ({ auth: { __sentinel: 'default' } }));

import { createPendingByUserStore } from './createPendingByUserStore';

describe('createPendingByUserStore', () => {
  beforeEach(() => {
    authState.callbacks = [];
    authState.unsubscribed = 0;
  });

  it('registers exactly one auth listener on creation', () => {
    createPendingByUserStore<number>();
    expect(authState.callbacks).toHaveLength(1);
  });

  it('set / get / has / delete behave like a per-uid map', () => {
    const store = createPendingByUserStore<string[]>();

    expect(store.get('u1')).toBeUndefined();
    expect(store.has('u1')).toBe(false);

    store.set('u1', ['a', 'b']);
    expect(store.get('u1')).toEqual(['a', 'b']);
    expect(store.has('u1')).toBe(true);

    // Distintos uids no comparten snapshot.
    store.set('u2', ['c']);
    expect(store.get('u1')).toEqual(['a', 'b']);
    expect(store.get('u2')).toEqual(['c']);

    store.delete('u1');
    expect(store.has('u1')).toBe(false);
    expect(store.has('u2')).toBe(true);
  });

  it('set overwrites previous snapshot (last-write-wins)', () => {
    const store = createPendingByUserStore<number>();
    store.set('u1', 1);
    store.set('u1', 2);
    expect(store.get('u1')).toBe(2);
  });

  it('take reads and removes the snapshot atomically', () => {
    const store = createPendingByUserStore<string>();
    store.set('u1', 'snapshot');

    expect(store.take('u1')).toBe('snapshot');
    expect(store.has('u1')).toBe(false);
    // Segundo take devuelve undefined (ya consumido).
    expect(store.take('u1')).toBeUndefined();
  });

  it('take returns undefined without throwing when nothing is pending', () => {
    const store = createPendingByUserStore<string>();
    expect(store.take('absent')).toBeUndefined();
  });

  it('clears the previous uid snapshot on account switch', () => {
    const store = createPendingByUserStore<string>();
    const cb = authState.callbacks[0]!;

    // Login A
    cb({ uid: 'A' });
    store.set('A', 'pending-A');

    // Switch a B → snapshot de A debe limpiarse.
    cb({ uid: 'B' });
    expect(store.has('A')).toBe(false);
  });

  it('clears the previous uid snapshot on logout (uid -> null)', () => {
    const store = createPendingByUserStore<string>();
    const cb = authState.callbacks[0]!;

    cb({ uid: 'A' });
    store.set('A', 'pending-A');

    cb(null);
    expect(store.has('A')).toBe(false);
  });

  it('does not clear snapshot when the same uid re-emits', () => {
    const store = createPendingByUserStore<string>();
    const cb = authState.callbacks[0]!;

    cb({ uid: 'A' });
    store.set('A', 'pending-A');

    // Mismo uid (token refresh, por ejemplo) → no se toca el snapshot.
    cb({ uid: 'A' });
    expect(store.get('A')).toBe('pending-A');
  });

  it('does not clear an unrelated uid snapshot on switch', () => {
    const store = createPendingByUserStore<string>();
    const cb = authState.callbacks[0]!;

    cb({ uid: 'A' });
    store.set('A', 'pending-A');
    store.set('C', 'pending-C');

    cb({ uid: 'B' });
    // Solo el uid previo (A) se limpia; C sigue intacto.
    expect(store.has('A')).toBe(false);
    expect(store.get('C')).toBe('pending-C');
  });

  it('__reset clears state and unsubscribes the auth listener (defense-in-depth)', () => {
    const store = createPendingByUserStore<string>();
    store.set('u1', 'x');

    store.__reset();

    expect(store.has('u1')).toBe(false);
    expect(authState.unsubscribed).toBe(1);

    // __reset es idempotente: no vuelve a unsubscribe ni rompe.
    store.__reset();
    expect(authState.unsubscribed).toBe(1);
  });

  it('after __reset, previousUid tracking restarts (no stale clears)', () => {
    const store = createPendingByUserStore<string>();
    const cb = authState.callbacks[0]!;

    cb({ uid: 'A' });
    store.__reset();

    // previousUid se reseteó: un nuevo set + emit del mismo uid no se borra.
    store.set('A', 'fresh');
    cb({ uid: 'A' });
    expect(store.get('A')).toBe('fresh');
  });

  it('accepts an injected auth instance without throwing', () => {
    const fakeAuth = { __sentinel: 'injected' };
    // El mock de onAuthStateChanged no captura el auth, así que validamos
    // indirectamente: la creación con auth inyectado no lanza y registra listener.
    const store = createPendingByUserStore<number>(fakeAuth as never);
    expect(authState.callbacks).toHaveLength(1);
    store.set('u1', 1);
    expect(store.get('u1')).toBe(1);
    store.__reset();
  });
});
