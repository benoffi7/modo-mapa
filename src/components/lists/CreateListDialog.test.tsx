import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockWithBusyFlag = vi.hoisted(() => vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})));
vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: mockWithBusyFlag,
  isBusyFlagActive: vi.fn(() => false),
}));

const mockCreateList = vi.hoisted(() => vi.fn());
const mockGenerateListId = vi.hoisted(() => vi.fn(() => 'generated-list-id'));
vi.mock('../../services/sharedLists', () => ({
  createList: mockCreateList,
  generateListId: mockGenerateListId,
}));

const mockWithOfflineSupport = vi.hoisted(() =>
  vi.fn((_o: boolean, _t: string, _meta: object, _payload: object, fn: () => Promise<unknown>) => fn()),
);
vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' } }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

// Mock IconPicker to avoid MUI portal complexity
vi.mock('./IconPicker', () => ({
  default: () => null,
}));

vi.mock('../../constants/listIcons', () => ({
  getListIconById: () => undefined,
}));

vi.mock('../../constants/messages', () => ({
  MSG_LIST: {
    createSuccess: 'Lista creada',
    createError: 'Error al crear lista',
  },
  MSG_OFFLINE: {
    requiresConnection: 'Requiere conexión',
  },
}));

import CreateListDialog from './CreateListDialog';

describe('CreateListDialog – withBusyFlag integration', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateList.mockResolvedValue('new-list-id');
  });

  it('handleCreate invoca withBusyFlag con kind: list_create', async () => {
    render(<CreateListDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText('Nombre');
    fireEvent.change(nameInput, { target: { value: 'Mi nueva lista' } });

    const createButton = screen.getByRole('button', { name: 'Crear' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockWithBusyFlag).toHaveBeenCalledWith('list_create', expect.any(Function));
    });
  });

  it('createList es llamado dentro de withBusyFlag', async () => {
    render(<CreateListDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lista test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mockCreateList).toHaveBeenCalledWith('user1', 'Lista test', '', undefined, 'generated-list-id');
    });
  });

  it('no llama withBusyFlag si el nombre está vacío', async () => {
    render(<CreateListDialog {...defaultProps} />);

    const createButton = screen.getByRole('button', { name: 'Crear' });
    expect(createButton).toBeDisabled();
    expect(mockWithBusyFlag).not.toHaveBeenCalled();
  });
});
