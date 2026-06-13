import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ isOffline: false }));
const mockSetDisplayName = vi.fn();

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ displayName: 'Juan', setDisplayName: mockSetDisplayName }),
}));
vi.mock('../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));
vi.mock('../../../utils/busyFlag', () => ({
  withBusyFlag: async (_k: string, fn: () => Promise<void>) => fn(),
}));

import EditDisplayNameDialog from '../EditDisplayNameDialog';

describe('EditDisplayNameDialog — offline gate (#344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOffline = false;
    mockSetDisplayName.mockResolvedValue(undefined);
  });

  it('online: Guardar enabled, no offline title, calls setDisplayName', async () => {
    render(<EditDisplayNameDialog open onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute('title', 'Requiere conexión');
    fireEvent.click(btn);
    await waitFor(() => expect(mockSetDisplayName).toHaveBeenCalledWith('Juan'));
  });

  it('offline: Guardar disabled with "Requiere conexión" title and does not call setDisplayName', async () => {
    mocks.isOffline = true;
    render(<EditDisplayNameDialog open onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Requiere conexión');
    // defense-in-depth: handleSave returns early even if invoked
    fireEvent.click(btn);
    expect(mockSetDisplayName).not.toHaveBeenCalled();
  });
});
