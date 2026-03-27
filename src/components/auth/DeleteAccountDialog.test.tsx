import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteAccountDialog from './DeleteAccountDialog';

const mockDeleteAccount = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', email: 'test@example.com' },
    authError: null,
    clearAuthError: vi.fn(),
  }),
}));

const mockIsOffline = { value: false };
vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline.value }),
}));

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock('../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../services/emailAuth', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../constants/analyticsEvents', () => ({
  EVT_ACCOUNT_DELETED: 'account_deleted',
}));

describe('DeleteAccountDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteAccount.mockResolvedValue(undefined);
    mockIsOffline.value = false;
  });

  it('renders warning text and password field', () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    expect(screen.getByText(/Esta acción es permanente/)).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmá tu contraseña')).toBeInTheDocument();
  });

  it('renders dialog title', () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    expect(screen.getByText('Eliminar cuenta')).toBeInTheDocument();
  });

  it('submit button is disabled when password is empty', () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' })).toBeDisabled();
  });

  it('submit button is enabled when password is entered', () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Confirmá tu contraseña'), { target: { value: 'mypassword' } });
    expect(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' })).toBeEnabled();
  });

  it('calls deleteAccount with user and password on submit', async () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Confirmá tu contraseña'), { target: { value: 'mypassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' }));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith(
        { uid: 'test-uid', email: 'test@example.com' },
        'mypassword',
      );
    });
  });

  it('shows error on wrong password', async () => {
    mockDeleteAccount.mockRejectedValue(
      Object.assign(new Error('fail'), { code: 'auth/wrong-password' }),
    );

    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Confirmá tu contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' }));

    await waitFor(() => {
      expect(screen.getByText('Contraseña incorrecta')).toBeInTheDocument();
    });
  });

  it('shows generic error for non-auth errors', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('network error'));

    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Confirmá tu contraseña'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' }));

    await waitFor(() => {
      expect(screen.getByText('Error al eliminar la cuenta. Intentá de nuevo.')).toBeInTheDocument();
    });
  });

  it('shows success alert and toast after successful deletion', async () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Confirmá tu contraseña'), { target: { value: 'correct' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' }));

    await waitFor(() => {
      expect(screen.getByText('Cuenta eliminada.')).toBeInTheDocument();
      expect(mockToast.success).toHaveBeenCalledWith('Tu cuenta y datos fueron eliminados permanentemente');
    });
  });

  it('cancel button calls onClose', () => {
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('submit button is disabled when offline', () => {
    mockIsOffline.value = true;
    render(<DeleteAccountDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Confirmá tu contraseña'), { target: { value: 'mypassword' } });
    expect(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' })).toBeDisabled();
  });

  it('shows offline warning when offline', () => {
    mockIsOffline.value = true;
    render(<DeleteAccountDialog {...defaultProps} />);
    expect(screen.getByText(/Necesitás conexión a internet/)).toBeInTheDocument();
  });
});
