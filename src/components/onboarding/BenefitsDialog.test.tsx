import { render, screen, fireEvent } from '@testing-library/react';
import BenefitsDialog from './BenefitsDialog';

const mockTrackEvent = vi.fn();

vi.mock('../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

describe('BenefitsDialog', () => {
  const defaultProps = {
    open: true,
    onContinue: vi.fn(),
    onClose: vi.fn(),
    source: 'menu' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all benefits when open', () => {
    render(<BenefitsDialog {...defaultProps} />);
    expect(screen.getByText('¿Por qué crear una cuenta?')).toBeInTheDocument();
    expect(screen.getByText('Sincronizá tus datos entre dispositivos')).toBeInTheDocument();
    expect(screen.getByText('Participá en rankings y listas colaborativas')).toBeInTheDocument();
    expect(screen.getByText('Tu perfil público con tus reseñas')).toBeInTheDocument();
    expect(screen.getByText('Tus favoritos siempre disponibles')).toBeInTheDocument();
  });

  it('tracks shown event with source', () => {
    render(<BenefitsDialog {...defaultProps} source="banner" />);
    expect(mockTrackEvent).toHaveBeenCalledWith('benefits_screen_shown', { source: 'banner' });
  });

  it('calls onContinue and sets localStorage on Continue click', () => {
    render(<BenefitsDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(defaultProps.onContinue).toHaveBeenCalled();
    expect(localStorage.getItem('benefits_screen_shown')).toBe('true');
    expect(mockTrackEvent).toHaveBeenCalledWith('benefits_screen_continue');
  });

  it('calls onClose and sets localStorage on "Ahora no" click', () => {
    render(<BenefitsDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(localStorage.getItem('benefits_screen_shown')).toBe('true');
  });

  it('does not render when closed', () => {
    render(<BenefitsDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('¿Por qué crear una cuenta?')).not.toBeInTheDocument();
  });
});
