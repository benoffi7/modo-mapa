import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerificationNudge from './VerificationNudge';

const mockResendVerification = vi.fn();
const mockRefreshEmailVerified = vi.fn();
const mockTrackEvent = vi.fn();
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

let mockAuth = {
  authMethod: 'email' as string,
  emailVerified: false,
  resendVerification: mockResendVerification,
  refreshEmailVerified: mockRefreshEmailVerified,
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

describe('VerificationNudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockAuth = {
      authMethod: 'email',
      emailVerified: false,
      resendVerification: mockResendVerification,
      refreshEmailVerified: mockRefreshEmailVerified,
    };
    mockResendVerification.mockResolvedValue(undefined);
    mockRefreshEmailVerified.mockResolvedValue(false);
  });

  it('renders for unverified email users', () => {
    render(<VerificationNudge />);
    expect(screen.getByText('Verificá tu email')).toBeInTheDocument();
    expect(mockTrackEvent).toHaveBeenCalledWith('verification_nudge_shown');
  });

  it('does not render for anonymous users', () => {
    mockAuth.authMethod = 'anonymous';
    const { container } = render(<VerificationNudge />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render for verified users', () => {
    mockAuth.emailVerified = true;
    const { container } = render(<VerificationNudge />);
    expect(container.firstChild).toBeNull();
  });

  it('calls resendVerification on re-send button click', async () => {
    render(<VerificationNudge />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-enviar email' }));
    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Email de verificación enviado');
      expect(mockTrackEvent).toHaveBeenCalledWith('verification_nudge_resend');
    });
  });

  it('calls refreshEmailVerified on "Ya verifiqué" click', async () => {
    mockRefreshEmailVerified.mockResolvedValue(true);
    render(<VerificationNudge />);
    fireEvent.click(screen.getByRole('button', { name: 'Ya verifiqué' }));
    await waitFor(() => {
      expect(mockRefreshEmailVerified).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('¡Email verificado!');
    });
  });

  it('shows info toast when not yet verified', async () => {
    render(<VerificationNudge />);
    fireEvent.click(screen.getByRole('button', { name: 'Ya verifiqué' }));
    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith('Todavía no verificado. Revisá tu bandeja de entrada.');
    });
  });

  it('dismisses and tracks event on X click', () => {
    render(<VerificationNudge />);
    fireEvent.click(screen.getByLabelText('Cerrar nudge de verificación'));
    expect(localStorage.getItem('verification_nudge_dismissed')).toBe('true');
    expect(mockTrackEvent).toHaveBeenCalledWith('verification_nudge_dismissed');
  });
});
