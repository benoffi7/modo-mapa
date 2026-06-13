import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBusinessPageMeta } from '../useBusinessPageMeta';
import type { Business } from '../../types';

function cleanupMetaTags() {
  document.head.querySelectorAll('meta[property]').forEach((el) => el.remove());
}

const baseBusiness: Business = {
  id: 'biz_001',
  name: 'Comercio de Prueba',
  category: 'restaurant',
  address: 'Calle 123',
  lat: -34,
  lng: -58,
  tags: [],
  phone: null,
};

describe('useBusinessPageMeta', () => {
  afterEach(() => {
    cleanupMetaTags();
    document.title = '';
    vi.restoreAllMocks();
  });

  it('setea document.title y los 4 meta tags OpenGraph al montar', () => {
    renderHook(() => useBusinessPageMeta(baseBusiness));

    expect(document.title).toBe('Comercio de Prueba — Modo Mapa');
    expect(document.head.querySelector('meta[property="og:title"]')!.getAttribute('content')).toBe('Comercio de Prueba');
    expect(document.head.querySelector('meta[property="og:description"]')!.getAttribute('content')).toBe('restaurant · Calle 123');
    expect(document.head.querySelector('meta[property="og:url"]')!.getAttribute('content')).toContain('/comercio/biz_001');
    expect(document.head.querySelector('meta[property="og:type"]')!.getAttribute('content')).toBe('place');
  });

  it('restaura document.title al desmontar', () => {
    document.title = 'Título Previo';
    const { unmount } = renderHook(() => useBusinessPageMeta(baseBusiness));

    expect(document.title).toBe('Comercio de Prueba — Modo Mapa');
    unmount();
    expect(document.title).toBe('Título Previo');
  });

  it('no re-ejecuta el effect cuando los campos relevantes del business no cambian', () => {
    const createSpy = vi.spyOn(document, 'createElement');

    const { rerender } = renderHook(({ business }) => useBusinessPageMeta(business), {
      initialProps: { business: baseBusiness },
    });

    const callsAfterMount = createSpy.mock.calls.filter(([tag]) => tag === 'meta').length;

    // Mismos id/name/category/address pero referencia distinta — no debe re-correr el effect.
    rerender({ business: { ...baseBusiness, lat: -99, lng: -99 } });

    const callsAfterRerender = createSpy.mock.calls.filter(([tag]) => tag === 'meta').length;
    expect(callsAfterRerender).toBe(callsAfterMount);
  });

  it('no-op si el mismo business se monta dos veces (tags ya existen, solo se actualizan)', () => {
    const { unmount } = renderHook(() => useBusinessPageMeta(baseBusiness));
    unmount();

    // Simular remount — cleanup previo removió solo document.title (no los tags).
    // El segundo render debería reutilizar los elementos existentes, no crear nuevos.
    renderHook(() => useBusinessPageMeta(baseBusiness));

    const ogTitleTags = document.head.querySelectorAll('meta[property="og:title"]');
    expect(ogTitleTags.length).toBe(1);
  });
});
