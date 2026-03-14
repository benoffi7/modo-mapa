import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChangePasswordDialog from './ChangePasswordDialog';

const mockChangePassword = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    changePassword: mockChangePassword,
    authError: null,
  }),
}));

describe('ChangePasswordDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChangePassword.mockResolvedValue(undefined);
  });

  it('renders all password fields', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument();
  });

  it('disables submit when form is empty', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  });

  it('validates new password minimum length', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'short' } });
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('validates password confirmation match', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'different' } });
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('calls changePassword on submit', async () => {
    render(<ChangePasswordDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('oldpass123', 'newpass123');
    });
  });

  it('shows success message after password change', async () => {
    render(<ChangePasswordDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(screen.getByText('Contraseña actualizada.')).toBeInTheDocument();
    });
  });

  it('resets form on close', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
