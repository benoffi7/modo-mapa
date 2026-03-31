import { describe, it, expect } from 'vitest';
import * as types from '../index';

describe('types barrel', () => {
  it('exports ALL_TAB_IDS constant', () => {
    expect(types.ALL_TAB_IDS).toBeDefined();
    expect(Array.isArray(types.ALL_TAB_IDS)).toBe(true);
    expect(types.ALL_TAB_IDS).toHaveLength(5);
  });

  it('exports all expected runtime values', () => {
    // ALL_TAB_IDS is the only runtime value exported from types barrel
    expect(types.ALL_TAB_IDS).toEqual(['inicio', 'social', 'buscar', 'listas', 'perfil']);
  });

  // Type-level exports are verified by tsc --noEmit.
  // This test uses a compile-time assertion pattern to verify key types exist.
  it('type exports compile correctly (verified by tsc)', () => {
    // If this file compiles, these types are accessible from the barrel.
    // We cannot test type-only exports at runtime, but tsc validates them.
    const check: types.TabId = 'inicio';
    expect(check).toBe('inicio');
  });
});
