import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockWithBusyFlag = vi.hoisted(() => vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})));
vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: mockWithBusyFlag,
  isBusyFlagActive: vi.fn(() => false),
}));

const mockSetDisplayName = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user1' },
    displayName: null,
    setDisplayName: mockSetDisplayName,
    isLoading: false,
  }),
}));

vi.mock('../../constants/storage', () => ({
  STORAGE_KEY_ONBOARDING_CREATED_AT: 'onboarding_created_at',
}));

vi.mock('../../constants/ui', () => ({
  ANONYMOUS_DISPLAY_NAME: 'Anónimo',
}));

import NameDialog from './NameDialog';

describe('NameDialog – withBusyFlag integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDisplayName.mockResolvedValue(undefined);
    localStorage.clear();
  });

  it('submit invoca withBusyFlag con kind: profile_save', async () => {
    render(<NameDialog />);

    const input = screen.getByLabelText('Tu nombre');
    fireEvent.change(input, { target: { value: 'Gonzalo' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockWithBusyFlag).toHaveBeenCalledWith('profile_save', expect.any(Function));
    });
  });

  it('setDisplayName es llamado dentro de withBusyFlag con el nombre ingresado', async () => {
    render(<NameDialog />);

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Gonzalo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockSetDisplayName).toHaveBeenCalledWith('Gonzalo');
    });
  });

  it('no llama withBusyFlag si el nombre está vacío', async () => {
    render(<NameDialog />);

    const saveButton = screen.getByRole('button', { name: 'Guardar' });
    expect(saveButton).toBeDisabled();
    expect(mockWithBusyFlag).not.toHaveBeenCalled();
  });
});
