import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchActivityFeedDiag = vi.fn();

vi.mock('../../../../services/admin/config', () => ({
  fetchActivityFeedDiag: (userId: string) => mockFetchActivityFeedDiag(userId),
}));

vi.mock('../../../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../../../constants/analyticsEvents', () => ({
  ADMIN_ACTIVITY_FEED_DIAG: 'admin_activity_feed_diag',
}));

import ActivityFeedDiag from '../ActivityFeedDiag';

describe('ActivityFeedDiag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search form', () => {
    render(<ActivityFeedDiag />);
    expect(screen.getByLabelText('ID de usuario')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
  });

  it('shows loading state during search', async () => {
    mockFetchActivityFeedDiag.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ActivityFeedDiag />);

    const input = screen.getByLabelText('ID de usuario');
    fireEvent.change(input, { target: { value: 'user1' } });
    fireEvent.click(screen.getByText('Buscar'));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows results with type chips and expiry', async () => {
    mockFetchActivityFeedDiag.mockResolvedValue({
      items: [
        {
          id: 'i1',
          actorId: 'a1',
          actorName: 'Actor 1',
          type: 'rating',
          businessId: 'b1',
          businessName: 'Cafe Test',
          referenceId: 'r1',
          createdAt: '2026-03-01T00:00:00.000Z',
          expiresAt: '2026-04-01T00:00:00.000Z',
          isExpired: false,
        },
        {
          id: 'i2',
          actorId: 'a2',
          actorName: 'Actor 2',
          type: 'comment',
          businessId: 'b2',
          businessName: 'Restaurant Test',
          referenceId: 'r2',
          createdAt: '2026-01-01T00:00:00.000Z',
          expiresAt: '2026-02-01T00:00:00.000Z',
          isExpired: true,
        },
      ],
      total: 2,
    });

    render(<ActivityFeedDiag />);

    const input = screen.getByLabelText('ID de usuario');
    fireEvent.change(input, { target: { value: 'user1' } });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('rating')).toBeInTheDocument();
      expect(screen.getByText('comment')).toBeInTheDocument();
      expect(screen.getByText('Actor 1')).toBeInTheDocument();
      expect(screen.getByText('Cafe Test')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText('Expirado')).toBeInTheDocument();
    });
  });

  it('shows empty state when no results', async () => {
    mockFetchActivityFeedDiag.mockResolvedValue({ items: [], total: 0 });
    render(<ActivityFeedDiag />);

    const input = screen.getByLabelText('ID de usuario');
    fireEvent.change(input, { target: { value: 'user1' } });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('Sin resultados para este usuario')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    mockFetchActivityFeedDiag.mockRejectedValue(new Error('fail'));
    render(<ActivityFeedDiag />);

    const input = screen.getByLabelText('ID de usuario');
    fireEvent.change(input, { target: { value: 'user1' } });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('No se pudo obtener el activity feed')).toBeInTheDocument();
    });
  });
});
