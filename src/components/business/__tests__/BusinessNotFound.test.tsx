import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import BusinessNotFound from '../BusinessNotFound';

describe('BusinessNotFound', () => {
  it('renders the invalid_id message', () => {
    render(<BusinessNotFound reason="invalid_id" />);
    expect(screen.getByText('El link parece estar roto.')).toBeInTheDocument();
  });

  it('renders the not_found message', () => {
    render(<BusinessNotFound reason="not_found" />);
    expect(screen.getByText('No encontramos este comercio.')).toBeInTheDocument();
  });

  it('renders the offline_no_cache message', () => {
    render(<BusinessNotFound reason="offline_no_cache" />);
    expect(screen.getByText('Necesitás conexión para ver este comercio.')).toBeInTheDocument();
  });

  it('navigates to / when clicking Volver al mapa', () => {
    render(<BusinessNotFound reason="not_found" />);
    fireEvent.click(screen.getByText('Volver al mapa'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
