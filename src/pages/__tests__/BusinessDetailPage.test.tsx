import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('../../context/FiltersContext', () => ({
  FiltersProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../hooks/useBusinessById', () => ({
  useBusinessById: vi.fn(),
}));

vi.mock('../../components/business/BusinessDetailScreen', () => ({
  default: ({ business, initialTab }: { business: { id: string }; initialTab?: string }) => (
    <div>detail-screen-{business.id}{initialTab ? `-${initialTab}` : ''}</div>
  ),
}));

vi.mock('../../components/business/BusinessNotFound', () => ({
  default: ({ reason }: { reason: string }) => <div>not-found-{reason}</div>,
}));

import { useParams, useSearchParams } from 'react-router-dom';
import { useBusinessById } from '../../hooks/useBusinessById';
import BusinessDetailPage from '../BusinessDetailPage';

const mockBusiness = { id: 'biz_001', name: 'Test', category: 'rest', address: 'Calle 1', lat: 0, lng: 0, tags: [] };

describe('BusinessDetailPage', () => {
  it('renderiza BusinessDetailScreen cuando el id es válido y existe', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'biz_001' });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()] as never);
    vi.mocked(useBusinessById).mockReturnValue({ business: mockBusiness as never, status: 'found' });

    render(<BusinessDetailPage />);
    expect(screen.getByText('detail-screen-biz_001')).toBeInTheDocument();
  });

  it('renderiza BusinessNotFound con reason=invalid_id cuando el id es inválido', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'not-valid' });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()] as never);
    vi.mocked(useBusinessById).mockReturnValue({ business: null, status: 'invalid_id' });

    render(<BusinessDetailPage />);
    expect(screen.getByText('not-found-invalid_id')).toBeInTheDocument();
  });

  it('renderiza BusinessNotFound con reason=not_found cuando el id no existe', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'biz_999999' });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()] as never);
    vi.mocked(useBusinessById).mockReturnValue({ business: null, status: 'not_found' });

    render(<BusinessDetailPage />);
    expect(screen.getByText('not-found-not_found')).toBeInTheDocument();
  });

  it('parsea ?tab=opiniones como initialTab', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'biz_001' });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('tab=opiniones'), vi.fn()] as never);
    vi.mocked(useBusinessById).mockReturnValue({ business: mockBusiness as never, status: 'found' });

    render(<BusinessDetailPage />);
    expect(screen.getByText('detail-screen-biz_001-opiniones')).toBeInTheDocument();
  });

  it('ignora ?tab=foo (tab inválido)', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'biz_001' });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('tab=foo'), vi.fn()] as never);
    vi.mocked(useBusinessById).mockReturnValue({ business: mockBusiness as never, status: 'found' });

    render(<BusinessDetailPage />);
    expect(screen.getByText('detail-screen-biz_001')).toBeInTheDocument();
  });
});
