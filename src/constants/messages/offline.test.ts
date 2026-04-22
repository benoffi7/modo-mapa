import { describe, it, expect } from 'vitest';
import { MSG_OFFLINE } from './offline';

describe('MSG_OFFLINE messages', () => {
  describe('syncing', () => {
    it('uses singular form when count is 1', () => {
      expect(MSG_OFFLINE.syncing(1)).toBe('Sincronizando 1 acción...');
    });

    it('uses plural form when count is more than 1', () => {
      expect(MSG_OFFLINE.syncing(3)).toBe('Sincronizando 3 acciones...');
    });
  });

  describe('syncSuccess', () => {
    it('uses singular form when count is 1', () => {
      expect(MSG_OFFLINE.syncSuccess(1)).toBe('1 acción sincronizada');
    });

    it('uses plural form when count is more than 1', () => {
      expect(MSG_OFFLINE.syncSuccess(5)).toBe('5 acciones sincronizadas');
    });
  });

  describe('syncFailed', () => {
    it('uses singular form when count is 1', () => {
      expect(MSG_OFFLINE.syncFailed(1)).toBe('1 acción falló');
    });

    it('uses plural form when count is more than 1', () => {
      expect(MSG_OFFLINE.syncFailed(2)).toBe('2 acciones fallaron');
    });
  });

  describe('noConnectionPending', () => {
    it('no plural suffix when count is 1', () => {
      expect(MSG_OFFLINE.noConnectionPending(1)).toBe('Sin conexión - 1 pendiente');
    });

    it('adds plural suffix when count > 1', () => {
      expect(MSG_OFFLINE.noConnectionPending(3)).toBe('Sin conexión - 3 pendientes');
    });
  });

  it('noConnection is a static string', () => {
    expect(MSG_OFFLINE.noConnection).toBe('Sin conexión');
  });

  it('emptyPending is a static string', () => {
    expect(MSG_OFFLINE.emptyPending).toBe('No hay acciones pendientes');
  });
});
