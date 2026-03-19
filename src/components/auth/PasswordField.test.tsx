import { render, screen, fireEvent } from '@testing-library/react';
import PasswordField from './PasswordField';

describe('PasswordField', () => {
  const defaultProps = {
    label: 'Contraseña',
    value: 'test123',
    onChange: vi.fn(),
    autoComplete: 'new-password' as const,
  };

  it('renders with password type by default', () => {
    render(<PasswordField {...defaultProps} />);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('toggles to text on visibility click', () => {
    render(<PasswordField {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Mostrar contraseña'));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
  });

  it('toggles back to password', () => {
    render(<PasswordField {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Mostrar contraseña'));
    fireEvent.click(screen.getByLabelText('Ocultar contraseña'));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('shows error and helperText', () => {
    render(<PasswordField {...defaultProps} error helperText="Too short" />);
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('calls onChange with value', () => {
    render(<PasswordField {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'newval' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('newval');
  });
});
