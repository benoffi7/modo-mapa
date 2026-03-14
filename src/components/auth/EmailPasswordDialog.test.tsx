import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailPasswordDialog from './EmailPasswordDialog';

const mockLinkEmailPassword = vi.fn();
const mockSignInWithEmail = vi.fn();
const mockSendResetEmail = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    linkEmailPassword: mockLinkEmailPassword,
    signInWithEmail: mockSignInWithEmail,
    authError: null,
  }),
}));

vi.mock('../../services/emailAuth', () => ({
  sendResetEmail: (...args: unknown[]) => mockSendResetEmail(...args),
  getAuthErrorMessage: () => 'Error de prueba.',
}));

describe('EmailPasswordDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkEmailPassword.mockResolvedValue(undefined);
    mockSignInWithEmail.mockResolvedValue(undefined);
    mockSendResetEmail.mockResolvedValue(undefined);
  });

  it('renders register tab by default', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  it('renders login tab when initialTab is login', () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" />);
    expect(screen.queryByLabelText('Confirmar contraseña')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('switches to login tab', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Iniciar sesión' }));
    expect(screen.queryByLabelText('Confirmar contraseña')).not.toBeInTheDocument();
  });

  it('validates email format', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid' } });
    expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
  });

  it('validates password minimum length', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    const passwordInput = screen.getByLabelText('Contraseña');
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('validates password confirmation match', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'different' } });
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('disables register submit when form is invalid', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
  });

  it('calls linkEmailPassword on register submit', async () => {
    render(<EmailPasswordDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(mockLinkEmailPassword).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('calls signInWithEmail on login submit', async () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('shows anonymous data warning on login tab when hasAnonymousData', () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" hasAnonymousData />);
    expect(screen.getByText(/se van a perder/)).toBeInTheDocument();
  });

  it('does not show warning when no anonymous data', () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" />);
    expect(screen.queryByText(/se van a perder/)).not.toBeInTheDocument();
  });

  it('resets form on tab change', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Iniciar sesión' }));

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    expect(emailInput.value).toBe('');
  });

  it('resets form on close', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows forgot password link on login tab', () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" />);
    expect(screen.getByRole('button', { name: 'Olvidé mi contraseña' })).toBeInTheDocument();
  });

  it('does not show forgot password on register tab', () => {
    render(<EmailPasswordDialog {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Olvidé mi contraseña' })).not.toBeInTheDocument();
  });

  it('sends reset email when email is valid', async () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Olvidé mi contraseña' }));

    await waitFor(() => {
      expect(mockSendResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(screen.getByText(/enviamos un email/)).toBeInTheDocument();
    });
  });

  it('shows error when email is empty on forgot password', async () => {
    render(<EmailPasswordDialog {...defaultProps} initialTab="login" />);
    fireEvent.click(screen.getByRole('button', { name: 'Olvidé mi contraseña' }));

    await waitFor(() => {
      expect(screen.getByText(/Ingresá tu email/)).toBeInTheDocument();
    });
    expect(mockSendResetEmail).not.toHaveBeenCalled();
  });
});
