import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChangePasswordDialog from './ChangePasswordDialog';

const mockChangePassword = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    changePassword: mockChangePassword,
    authError: null,
    clearAuthError: vi.fn(),
  }),
}));

const mockWithBusyFlag = vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {}));
vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: (...args: unknown[]) => mockWithBusyFlag(...args),
  isBusyFlagActive: vi.fn(() => false),
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

  it('validates new password complexity', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'simple' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'simple' } });
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  });

  it('shows password strength indicator for new password', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'abc' } });
    expect(screen.getByText('8+ caracteres')).toBeInTheDocument();
    expect(screen.getByText('Una mayúscula')).toBeInTheDocument();
    expect(screen.getByText('Un número')).toBeInTheDocument();
    expect(screen.getByText('Un símbolo')).toBeInTheDocument();
  });

  it('validates password confirmation match', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'different' } });
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('calls changePassword on submit with complex password', async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('oldpass123', 'NewPass1!');
    });
  });

  it('shows success message after password change', async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(screen.getByText('Contraseña actualizada.')).toBeInTheDocument();
    });
  });

  it('shows visibility toggle on all password fields', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    const toggleButtons = screen.getAllByLabelText('Mostrar contraseña');
    expect(toggleButtons).toHaveLength(3);
  });

  it('resets form on close', () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('submit invoca withBusyFlag con kind: password_change', async () => {
    render(<ChangePasswordDialog {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(mockWithBusyFlag).toHaveBeenCalledWith('password_change', expect.any(Function));
    });
  });
});
