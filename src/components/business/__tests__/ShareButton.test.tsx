import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  share: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('../../../utils/analytics', () => ({ trackEvent: mocks.trackEvent }));

import ShareButton from '../ShareButton';

const business = {
  id: 'biz_001',
  name: 'Test Comercio',
  category: 'restaurante',
  address: 'Calle 123',
  lat: -34,
  lng: -58,
  tags: [],
};

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://modmapa.app' },
      writable: true,
    });
  });

  it('genera URL canónica /comercio/:id al compartir via clipboard', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mocks.writeText.mockResolvedValue(undefined) },
      writable: true,
    });

    render(<ShareButton business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /compartir comercio/i }));

    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith('https://modmapa.app/comercio/biz_001');
    });
  });

  it('llama a trackEvent business_share con method=clipboard', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mocks.writeText.mockResolvedValue(undefined) },
      writable: true,
    });

    render(<ShareButton business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /compartir comercio/i }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith(
        'business_share',
        expect.objectContaining({ business_id: 'biz_001', method: 'clipboard' }),
      );
    });
  });

  it('usa navigator.share con URL canónica cuando está disponible', async () => {
    Object.defineProperty(navigator, 'share', {
      value: mocks.share.mockResolvedValue(undefined),
      writable: true,
    });

    render(<ShareButton business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /compartir comercio/i }));

    await waitFor(() => {
      expect(mocks.share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://modmapa.app/comercio/biz_001' }),
      );
    });
  });
});
