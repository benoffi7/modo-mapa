import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  getMenuPhotoUrl: vi.fn(),
  getUserPendingPhotos: vi.fn(),
}));

vi.mock('../../services/menuPhotos', () => ({
  getMenuPhotoUrl: mocks.getMenuPhotoUrl,
  getUserPendingPhotos: mocks.getUserPendingPhotos,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' } }),
}));

vi.mock('../../context/BusinessScopeContext', () => ({
  useBusinessScope: () => ({ businessId: 'biz_001' }),
}));

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('../../utils/formatDate', () => ({ formatDateMedium: () => '31 mar 2026' }));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

// Stub MenuPhotoUpload child — it pulls extra context that's not relevant here
vi.mock('./MenuPhotoUpload', () => ({
  default: () => null,
}));

// Stub MenuPhotoViewer child — its image is covered by its own test
vi.mock('./MenuPhotoViewer', () => ({
  default: () => null,
}));

import MenuPhotoSection from './MenuPhotoSection';
import type { MenuPhoto } from '../../types';

const samplePhoto: MenuPhoto = {
  id: 'photo-1',
  businessId: 'biz_001',
  status: 'approved',
  storagePath: 'menus/biz_001/photo-1.jpg',
  thumbnailPath: 'menus/biz_001/photo-1-thumb.jpg',
  uploaderId: 'user1',
  reviewedAt: new Date('2026-03-31'),
  // Cast — we just need the shape used by the component
} as unknown as MenuPhoto;

describe('MenuPhotoSection – img performance attrs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMenuPhotoUrl.mockResolvedValue('https://example.com/photo.jpg');
    mocks.getUserPendingPhotos.mockResolvedValue([]);
  });

  it('renders <img> with loading="lazy", decoding="async", width and height', async () => {
    render(
      <MenuPhotoSection menuPhoto={samplePhoto} isLoading={false} onPhotoChange={vi.fn()} />,
    );

    // img only renders once getMenuPhotoUrl resolves and photoUrl is set
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /menú/i })).toBeInTheDocument();
    });

    const img = screen.getByRole('img', { name: /menú/i });
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('width')).toBe('400');
    expect(img.getAttribute('height')).toBe('200');
  });

  it('does not render <img> when menuPhoto is null', () => {
    const { container } = render(
      <MenuPhotoSection menuPhoto={null} isLoading={false} onPhotoChange={vi.fn()} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });
});
